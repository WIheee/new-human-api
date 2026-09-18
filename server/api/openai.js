// api/openai.js
import express from 'express';
import { genId, logRequest, updateRequest } from '../chat/store.js';
import { estimateTokens, countMessagesTokens } from '../chat/tokens.js';
import { broadcastAdmins } from '../ws/admin-clients.js';
import { config } from '../config.js';

const router = express.Router();

export const pendingRequests = new Map();

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

router.get('/models', (req, res) => {
  res.json({
    object: 'list',
    data: [{
      id: config.MODEL,
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'you'
    }]
  });
});

router.post('/chat/completions', (req, res) => {
  const { messages = [], stream = false, model = config.MODEL } = req.body || {};
  const requestId = genId();
  const promptTokens = countMessagesTokens(messages);
  const lastUser = [...messages].reverse().find(m => m.role === 'user');

  const logItem = {
    requestId,
    model,
    messages,
    preview: lastUser?.content || '',
    promptTokens,
    stream,
    reply: null,
    status: 'pending',
    createdAt: Date.now()
  };
  logRequest(logItem);
  broadcastAdmins({ type: 'request', ...logItem });

  let keepAlive = null;
  let settled = false;

  const timeout = setTimeout(() => {
    if (settled) return;
    settled = true;
    pendingRequests.delete(requestId);
    updateRequest(requestId, { status: 'timeout' });

    if (stream) {
      if (!res.writableEnded) {
        try {
          res.write(`data: ${JSON.stringify({
            error: { message: '服务器繁忙，请稍后再试', type: 'server_error' }
          })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        } catch {}
      }
    } else if (!res.headersSent) {
      res.status(503).json({
        error: { message: '服务器繁忙，请稍后再试', type: 'server_error', code: 503 }
      });
    }

    if (keepAlive) clearInterval(keepAlive);
    broadcastAdmins({ type: 'request-timeout', requestId });
  }, config.TIMEOUT_MS);

  const cleanup = (status) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    if (keepAlive) clearInterval(keepAlive);
    pendingRequests.delete(requestId);
    if (status) updateRequest(requestId, { status });
  };

  res.on('close', () => {
    if (!res.writableEnded && !settled) cleanup('cancelled');
  });

  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    keepAlive = setInterval(() => {
      try { res.write(': keep-alive\n\n'); } catch {}
    }, 15000);

    pendingRequests.set(requestId, {
      resolve: async (content) => {
        cleanup(null);
        updateRequest(requestId, { reply: content, status: 'replied' });
        try {
          await streamReply(res, content, model, promptTokens);
        } catch {}
      }
    });
  } else {
    pendingRequests.set(requestId, {
      resolve: (content) => {
        cleanup(null);
        updateRequest(requestId, { reply: content, status: 'replied' });
        res.json(buildResponse(content, model, promptTokens));
      }
    });
  }
});

export function resolveRequest(requestId, content) {
  const p = pendingRequests.get(requestId);
  if (!p) return false;
  pendingRequests.delete(requestId);
  p.resolve(content);
  return true;
}

function buildResponse(content, model, promptTokens) {
  const completionTokens = estimateTokens(content);
  return {
    id: `chatcmpl-${genId()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{
      index: 0,
      message: { role: 'assistant', content },
      finish_reason: 'stop'
    }],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens
    }
  };
}

async function streamReply(res, content, model, promptTokens) {
  const id = `chatcmpl-${genId()}`;
  const created = Math.floor(Date.now() / 1000);
  const chars = [...content];
  const delay = chars.length > 200 ? 2 : 3;

  res.write(`data: ${JSON.stringify({
    id, object: 'chat.completion.chunk', created, model,
    choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }]
  })}\n\n`);

  for (const char of chars) {
    if (res.writableEnded || res.destroyed) return;
    res.write(`data: ${JSON.stringify({
      id, object: 'chat.completion.chunk', created, model,
      choices: [{ index: 0, delta: { content: char }, finish_reason: null }]
    })}\n\n`);
    await sleep(delay);
  }

  res.write(`data: ${JSON.stringify({
    id, object: 'chat.completion.chunk', created, model,
    choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
  })}\n\n`);

  const completionTokens = estimateTokens(content);
  res.write(`data: ${JSON.stringify({
    id, object: 'chat.completion.chunk', created, model,
    choices: [],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens
    }
  })}\n\n`);

  res.write('data: [DONE]\n\n');
  res.end();
}

export default router;
