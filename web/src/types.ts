export interface RequestItem {
  requestId: string
  model: string
  messages: Array<{ role: string; content: string }>
  preview: string
  promptTokens: number
  stream: boolean
  reply: string | null
  status: 'pending' | 'replied' | 'timeout' | 'cancelled'
  createdAt: number
}

export type WsMessage =
  | { type: 'init'; requests: RequestItem[] }
  | {
      type: 'request'
      requestId: string
      model: string
      messages: RequestItem['messages']
      preview: string
      promptTokens: number
      stream: boolean
      createdAt: number
    }
  | { type: 'replied'; requestId: string; content: string }
  | { type: 'request-timeout'; requestId: string }
  | { type: 'error'; error: string }
