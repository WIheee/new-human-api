假 AI 后端 API 文档

概述

一个伪装成 AI 的后端：第三方软件按 OpenAI 格式发请求，请求挂起，等管理员在管理端手动回复后，内容再按字符流式返回。

基础地址：http://localhost:3000
WebSocket：ws://localhost:3000/ws

全局常量

项 值
模型 ID deepseek-flash
默认 API Key sk-fake-ai-change-me
默认 Admin Token admin-change-me
超时时间 150000 ms（2.5 分钟）
日志上限 100 条

---

一、鉴权

1. 第三方软件（调用 /v1/*）

请求头：

```
Authorization: Bearer <API_KEY>
```

2. 管理端 HTTP（调用 /api/admin/*）

任选一种：

```
X-Admin-Token: <ADMIN_TOKEN>
Authorization: Bearer <ADMIN_TOKEN>
```

3. 管理端 WebSocket

连接时带 query：

```
ws://localhost:3000/ws?role=admin&token=<ADMIN_TOKEN>
```

错误响应

401 — 第三方软件

```json
{
  "error": {
    "message": "Invalid API key",
    "type": "invalid_request_error",
    "code": "invalid_api_key"
  }
}
```

401 — 管理端

```json
{ "error": "Unauthorized" }
```

---

二、HTTP 接口

2.1 健康检查

```
GET /api/health
```

无需鉴权

响应 200

```json
{ "ok": true, "time": 1789740626744 }
```

---

2.2 模型列表

```
GET /v1/models
Authorization: Bearer <API_KEY>
```

响应 200

```json
{
  "object": "list",
  "data": [
    {
      "id": "deepseek-flash",
      "object": "model",
      "created": 1789740626,
      "owned_by": "you"
    }
  ]
}
```

---

2.3 聊天补全

```
POST /v1/chat/completions
Authorization: Bearer <API_KEY>
Content-Type: application/json
```

请求体

字段 类型 必填 说明
model string 否 默认 deepseek-flash
messages array 是 OpenAI 格式消息数组
stream boolean 否 默认 false
其他字段 any 否 temperature、max_tokens 等会被忽略，不报错

messages 元素

```json
{ "role": "system" | "user" | "assistant", "content": "字符串" }
```

行为：请求发出后不会立即返回，而是挂起等待管理员回复。

---

2.3.1 非流式响应

管理员回复后，返回完整 JSON：

```json
{
  "id": "chatcmpl-a1b2c3d4",
  "object": "chat.completion",
  "created": 1789740626,
  "model": "deepseek-flash",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "你好，我是假AI"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 5,
    "completion_tokens": 4,
    "total_tokens": 9
  }
}
```

---

2.3.2 流式响应（stream: true）

响应头：

```
Content-Type: text/event-stream
Cache-Control: no-cache, no-transform
Connection: keep-alive
```

期间：每 15 秒发一次保活注释，客户端不会超时：

```
: keep-alive

```

管理员回复后，按字符吐 chunk：

```
data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","created":...,"model":"deepseek-flash","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}

data: {"id":"chatcmpl-xxx",...,"choices":[{"index":0,"delta":{"content":"你"},"finish_reason":null}]}

data: {"id":"chatcmpl-xxx",...,"choices":[{"index":0,"delta":{"content":"好"},"finish_reason":null}]}

data: {"id":"chatcmpl-xxx",...,"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: {"id":"chatcmpl-xxx",...,"choices":[],"usage":{"prompt_tokens":5,"completion_tokens":4,"total_tokens":9}}

data: [DONE]

```

字符间隔：3ms（内容超过 200 字时降到 2ms）。

---

2.3.3 超时（2.5 分钟无回复）

非流式：状态码 503

```json
{
  "error": {
    "message": "服务器繁忙，请稍后再试",
    "type": "server_error",
    "code": 503
  }
}
```

流式：先发错误 chunk，再发 [DONE]

```
data: {"error":{"message":"服务器繁忙，请稍后再试","type":"server_error"}}

data: [DONE]

```

---

2.4 查询请求日志

```
GET /api/admin/requests
X-Admin-Token: <ADMIN_TOKEN>
```

响应 200：数组，新→旧，最多 100 条

```json
[
  {
    "requestId": "a1b2c3d4",
    "model": "deepseek-flash",
    "messages": [
      { "role": "system", "content": "你是AI" },
      { "role": "user", "content": "你好" }
    ],
    "preview": "你好",
    "promptTokens": 5,
    "stream": true,
    "reply": "你好，我是假AI",
    "status": "replied",
    "createdAt": 1789740626793
  }
]
```

---

三、WebSocket 协议

3.1 连接

```
ws://localhost:3000/ws?role=admin&token=<ADMIN_TOKEN>
```

参数 必填 说明
role 是 目前仅支持 admin
token 是 必须等于 ADMIN_TOKEN

连接失败：服务端主动关闭

code 含义
4001 Token 错误
4003 role 不是 admin

---

3.2 服务端 → 客户端

init — 连接建立后立即下发

```json
{
  "type": "init",
  "requests": [ /* 同 /api/admin/requests 的格式 */ ]
}
```

request — 有新请求进来

```json
{
  "type": "request",
  "requestId": "a1b2c3d4",
  "model": "deepseek-flash",
  "messages": [
    { "role": "user", "content": "你好" }
  ],
  "preview": "你好",
  "promptTokens": 1,
  "stream": true,
  "reply": null,
  "status": "pending",
  "createdAt": 1789740626793
}
```

replied — 某条请求已被回复

```json
{
  "type": "replied",
  "requestId": "a1b2c3d4",
  "content": "你好，我是假AI"
}
```

所有在线管理端都会收到，包括回复者自己。

request-timeout — 某条请求超时

```json
{
  "type": "request-timeout",
  "requestId": "a1b2c3d4"
}
```

error — 操作失败

```json
{ "type": "error", "error": "请求不存在或已超时" }
```

---

3.3 客户端 → 服务端

reply — 回复某条请求

```json
{
  "type": "reply",
  "requestId": "a1b2c3d4",
  "content": "你好，我是假AI"
}
```

成功：服务端会向所有管理端广播 replied。
失败：服务端回 error（requestId 不存在、已超时、已回复）。

---

四、数据模型

4.1 RequestItem

字段 类型 说明
requestId string 8 位随机 ID
model string 模型名
messages array 完整消息数组，原样透传
preview string 最后一条 user 消息，用于列表展示
promptTokens number 估算的输入 token
stream boolean 是否流式
reply string \| null 管理员回复内容
status enum 见下
createdAt number 毫秒时间戳

4.2 status 枚举

值 含义
pending 等待回复
replied 已回复
timeout 超过 2.5 分钟未回复
cancelled 客户端主动断开

4.3 token 估算规则

```
tokens = max(1, ceil(字符数 / 2))
```

· 中文、英文统一按字符数 / 2
· 空字符串算 0
· prompt_tokens = 所有 messages 的 content 累加

---

五、完整流程示例

```
第三方软件                        后端                       管理端
    │                              │                          │
    │──POST /v1/chat/completions──>│                          │
    │  (stream: true)              │                          │
    │                              │──WS: request────────────>│
    │<──SSE: : keep-alive──────────│                          │
    │<──SSE: : keep-alive──────────│                          │
    │                              │<──WS: reply──────────────│
    │<──SSE: data: chunk───────────│                          │
    │<──SSE: data: chunk───────────│                          │
    │<──SSE: data: [DONE]──────────│                          │
    │                              │──WS: replied────────────>│
```

---

六、curl 速查

```bash
# 模型列表
curl http://localhost:3000/v1/models \
  -H "Authorization: Bearer sk-fake-ai-change-me"

# 非流式
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer sk-fake-ai-change-me" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-flash","messages":[{"role":"user","content":"你好"}]}'

# 流式
curl -N -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer sk-fake-ai-change-me" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-flash","stream":true,"messages":[{"role":"user","content":"你好"}]}'

# 管理端日志
curl http://localhost:3000/api/admin/requests \
  -H "X-Admin-Token: admin-change-me"
```

---

七、给前端 UI 的对接要点

1. 连接 WS：ws://localhost:3000/ws?role=admin&token=admin-change-me
2. 首次收到 init：渲染 requests 数组（新→旧）
3. 收到 request：在列表顶部插入新项，状态 pending
4. 收到 replied：找到对应 requestId，设置 reply、状态改 replied
5. 收到 request-timeout：找到对应项，状态改 timeout
6. 发送回复：ws.send(JSON.stringify({ type:'reply', requestId, content }))
7. 字段命名：全部 camelCase，与后端一致

---