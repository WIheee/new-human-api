import { ref, onUnmounted, type Ref } from 'vue'
import type { RequestItem, WsMessage } from '@/types'

export function useWebSocket(adminToken: string) {
  const ws = ref<WebSocket | null>(null)
  const connected = ref(false)
  const requests: Ref<RequestItem[]> = ref([])
  const lastError = ref<string | null>(null)

  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let manualClose = false

  function connect() {
    manualClose = false
    const url = `ws://localhost:3000/ws?role=admin&token=${encodeURIComponent(adminToken)}`
    ws.value = new WebSocket(url)

    ws.value.onopen = () => {
      connected.value = true
      lastError.value = null
    }

    ws.value.onmessage = (event) => {
      let data: WsMessage
      try {
        data = JSON.parse(event.data)
      } catch {
        console.warn('[ws] 无法解析消息', event.data)
        return
      }

      if (data.type === 'init') {
        requests.value = data.requests
      } else if (data.type === 'request') {
        const item: RequestItem = {
          requestId: data.requestId,
          model: data.model || '',
          messages: data.messages || [],
          preview: data.preview || '',
          promptTokens: data.promptTokens || 0,
          stream: data.stream || false,
          reply: null,
          status: 'pending',
          createdAt: data.createdAt || Date.now(),
        }
        // 避免重复插入
        if (!requests.value.some((r) => r.requestId === item.requestId)) {
          requests.value.unshift(item)
        }
      } else if (data.type === 'replied') {
        const item = requests.value.find((r) => r.requestId === data.requestId)
        if (item) {
          item.reply = data.content
          item.status = 'replied'
        }
      } else if (data.type === 'request-timeout') {
        const item = requests.value.find((r) => r.requestId === data.requestId)
        if (item) item.status = 'timeout'
      } else if (data.type === 'error') {
        lastError.value = data.error
        console.warn('[ws] 服务端错误:', data.error)
      }
    }

    ws.value.onclose = (event) => {
      connected.value = false
      ws.value = null

      if (manualClose) return

      // 认证失败，不重连
      if (event.code === 4001 || event.code === 4003) {
        lastError.value = event.code === 4001 ? 'Token 错误' : 'role 参数错误'
        return
      }

      // 自动重连
      reconnectTimer = setTimeout(() => connect(), 3000)
    }

    ws.value.onerror = () => {
      // onclose 会处理重连
    }
  }

  function disconnect() {
    manualClose = true
    if (reconnectTimer) clearTimeout(reconnectTimer)
    ws.value?.close()
    ws.value = null
    connected.value = false
  }

  function sendReply(requestId: string, content: string): boolean {
    if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
      lastError.value = 'WebSocket 未连接'
      return false
    }
    ws.value.send(JSON.stringify({ type: 'reply', requestId, content }))
    return true
  }

  onUnmounted(() => {
    disconnect()
  })

  return { connected, requests, lastError, connect, disconnect, sendReply }
}
