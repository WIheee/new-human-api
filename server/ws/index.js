// ws/index.js
import { WebSocketServer } from 'ws';
import { adminClients, broadcastAdmins } from './admin-clients.js';
import { resolveRequest } from '../api/openai.js';
import { getRequestLog } from '../chat/store.js';
import { config } from '../config.js';

export function setupWS(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const role = url.searchParams.get('role') || 'admin';
    const token = url.searchParams.get('token') || '';

    if (role !== 'admin') {
      ws.close(4003, '仅支持 admin');
      return;
    }

    // 鉴权
    if (token !== config.ADMIN_TOKEN) {
      ws.close(4001, 'Unauthorized');
      return;
    }

    adminClients.add(ws);

    ws.send(JSON.stringify({
      type: 'init',
      requests: getRequestLog()
    }));

    ws.on('message', raw => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return ws.send(JSON.stringify({ type: 'error', error: '非法 JSON' }));
      }

      if (msg.type === 'reply') {
        const ok = resolveRequest(msg.requestId, msg.content || '');
        if (!ok) {
          ws.send(JSON.stringify({
            type: 'error',
            error: '请求不存在或已超时'
          }));
        } else {
          broadcastAdmins({
            type: 'replied',
            requestId: msg.requestId,
            content: msg.content
          });
        }
      }
    });

    ws.on('close', () => {
      adminClients.delete(ws);
    });
  });
}
