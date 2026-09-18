// test.js
// 一键测试假 AI 后端：鉴权、CORS、WS、非流式、流式
// 用法：node test.js
// 前提：服务已在 3000 端口跑着

import WebSocket from 'ws';

const BASE = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000/ws';
const API_KEY = 'sk-fake-ai-change-me';
const ADMIN_TOKEN = 'admin-change-me';
let pass = 0;
let fail = 0;

function ok(name, cond, extra = '') {
  if (cond) {
    pass++;
    console.log(`✅ ${name}${extra ? '  ' + extra : ''}`);
  } else {
    fail++;
    console.log(`❌ ${name}${extra ? '  ' + extra : ''}`);
  }
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ============ 1. 健康检查 ============
async function testHealth() {
  console.log('\n[1] 健康检查');
  const res = await fetch(`${BASE}/api/health`);
  const data = await res.json();
  ok('GET /api/health → 200', res.status === 200);
  ok('返回 ok:true', data.ok === true);
}

// ============ 2. 模型列表 ============
async function testModels() {
  console.log('\n[2] 模型列表');

  const r1 = await fetch(`${BASE}/v1/models`);
  ok('无 key → 401', r1.status === 401);

  const r2 = await fetch(`${BASE}/v1/models`, {
    headers: { Authorization: `Bearer ${API_KEY}` }
  });
  const d2 = await r2.json();
  ok('带 key → 200', r2.status === 200);
  ok('模型为 deepseek-flash', d2.data?.[0]?.id === 'deepseek-flash');
}

// ============ 3. 管理接口 ============
async function testAdmin() {
  console.log('\n[3] 管理接口');

  const r1 = await fetch(`${BASE}/api/admin/requests`);
  ok('无 token → 401', r1.status === 401);

  const r2 = await fetch(`${BASE}/api/admin/requests`, {
    headers: { 'X-Admin-Token': ADMIN_TOKEN }
  });
  const d2 = await r2.json();
  ok('带 token → 200', r2.status === 200);
  ok('返回数组', Array.isArray(d2));
}

// ============ 4. CORS ============
async function testCors() {
  console.log('\n[4] CORS 预检');

  const res = await fetch(`${BASE}/api/admin/requests`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:5173',
      'Access-Control-Request-Method': 'GET'
    }
  });
  const allow = res.headers.get('access-control-allow-origin');
  ok('预检 → 204', res.status === 204);
  ok('Allow-Origin 正确', allow === 'http://localhost:5173', `(${allow})`);
}

// ============ 5. WS 鉴权 ============
function testWsAuth() {
  console.log('\n[5] WS 鉴权');

  return new Promise(resolve => {
    const bad = new WebSocket(`${WS_URL}?role=admin`);
    bad.on('close', (code, reason) => {
      ok('无 token → 4001 断开', code === 4001, `(code=${code})`);

      const good = new WebSocket(`${WS_URL}?role=admin&token=${ADMIN_TOKEN}`);
      good.on('message', raw => {
        const d = JSON.parse(raw.toString());
        ok('带 token → 收到 init', d.type === 'init');
        good.close();
        resolve();
      });
      good.on('error', () => {
        ok('带 token 连接失败', false);
        resolve();
      });
    });
    bad.on('error', () => {});
  });
}

// ============ 6. 非流式完整链路 ============
async function testNonStream() {
  console.log('\n[6] 非流式完整链路');

  // 开管理端 WS，自动回复
  const admin = new WebSocket(`${WS_URL}?role=admin&token=${ADMIN_TOKEN}`);
  await new Promise(r => admin.on('open', r));

  let replied = false;
  admin.on('message', raw => {
    const d = JSON.parse(raw.toString());
    if (d.type === 'request' && !replied) {
      replied = true;
      admin.send(JSON.stringify({
        type: 'reply',
        requestId: d.requestId,
        content: '你好，我是假AI'
      }));
    }
  });

  const res = await fetch(`${BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'deepseek-flash',
      messages: [{ role: 'user', content: '你好' }]
    })
  });

  const data = await res.json();
  ok('状态 200', res.status === 200);
  ok('回复内容正确', data.choices?.[0]?.message?.content === '你好，我是假AI');
  ok('有 usage', !!data.usage, JSON.stringify(data.usage));

  admin.close();
}

// ============ 7. 流式完整链路 ============
async function testStream() {
  console.log('\n[7] 流式完整链路');

  const admin = new WebSocket(`${WS_URL}?role=admin&token=${ADMIN_TOKEN}`);
  await new Promise(r => admin.on('open', r));

  let replied = false;
  admin.on('message', raw => {
    const d = JSON.parse(raw.toString());
    if (d.type === 'request' && !replied) {
      replied = true;
      admin.send(JSON.stringify({
        type: 'reply',
        requestId: d.requestId,
        content: '流式测试'
      }));
    }
  });

  const res = await fetch(`${BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'deepseek-flash',
      stream: true,
      messages: [{ role: 'user', content: '你好' }]
    })
  });

  ok('状态 200', res.status === 200);
  ok('Content-Type 是 SSE',
    res.headers.get('content-type')?.includes('text/event-stream'));

  const text = await res.text();

  ok('含 role chunk', text.includes('"role":"assistant"'));
  ok('含字符 chunk', text.includes('"content":"流"'));
  ok('含 finish_reason', text.includes('"finish_reason":"stop"'));
  ok('含 usage', text.includes('"usage"'));
  ok('含 [DONE]', text.includes('data: [DONE]'));

  admin.close();
}

// ============ 主流程 ============
async function main() {
  console.log('开始测试假 AI 后端\n' + '='.repeat(40));
  console.log(`目标：${BASE}`);
  console.log(`API_KEY=${API_KEY}  ADMIN_TOKEN=${ADMIN_TOKEN}\n`);

  try {
    await testHealth();
    await testModels();
    await testAdmin();
    await testCors();
    await testWsAuth();
    await testNonStream();
    await testStream();
  } catch (e) {
    console.error('\n💥 异常中断：', e.message);
    fail++;
  }

  console.log('\n' + '='.repeat(40));
  console.log(`通过 ${pass}  失败 ${fail}`);
  process.exit(fail === 0 ? 0 : 1);
}

main();