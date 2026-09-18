// index.js
import express from 'express';
import { createServer } from 'node:http';
import { config } from './config.js';
import { cors } from './middleware/cors.js';
import { requireApiKey, requireAdmin } from './middleware/auth.js';
import openaiRouter from './api/openai.js';
import adminRouter from './api/admin.js';
import { setupWS } from './ws/index.js';

const app = express();

// 1. CORS 最先（preflight 需要）
app.use(cors);
// 2. body 解析
app.use(express.json({ limit: '10mb' }));

// 3. 日志
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// 4. 健康检查（不需要鉴权）
app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: Date.now() });
});

// 5. OpenAI 兼容端点（需要 API Key）
app.use('/v1', requireApiKey, openaiRouter);

// 6. 管理 API（需要 Admin Token）
app.use('/api/admin', requireAdmin, adminRouter);

const server = createServer(app);
setupWS(server);

server.listen(config.PORT, () => {
  console.log(`HTTP 运行在 http://localhost:${config.PORT}`);
  console.log(`WS   运行在 ws://localhost:${config.PORT}/ws`);
  console.log(`模型：${config.MODEL}`);
  console.log(`API_KEY     = ${config.API_KEY}`);
  console.log(`ADMIN_TOKEN = ${config.ADMIN_TOKEN}`);
  console.log(`CORS 允许来源：${config.CORS_ORIGINS.join(', ')}`);
});
