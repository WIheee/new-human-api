// config.js
// 所有配置集中在这里，用环境变量覆盖默认值
//
// 用法示例：
//   API_KEY=sk-xxx ADMIN_TOKEN=abc pnpm dev

export const config = {
  PORT: Number(process.env.PORT) || 3000,

  // 第三方软件填的 API Key（Bearer 形式）
  API_KEY: process.env.API_KEY || 'sk-fake-ai-change-me',

  // 管理端用的 token（HTTP 头 或 WS query）
  ADMIN_TOKEN: process.env.ADMIN_TOKEN || 'admin-change-me',

  // 允许跨域的来源（Vue 开发服务器）
  CORS_ORIGINS: (process.env.CORS_ORIGINS ||
    'http://localhost:5173,http://127.0.0.1:5173'
  ).split(',').map(s => s.trim()).filter(Boolean),

  MODEL: 'deepseek-flash',
  TIMEOUT_MS: 150000
};
