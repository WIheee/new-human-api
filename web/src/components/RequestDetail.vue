<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue'
import type { RequestItem } from '@/types'

const props = defineProps<{
  request: RequestItem
}>()

const emit = defineEmits<{
  reply: [content: string]
}>()

const replyText = ref('')
const sending = ref(false)
const messagesRef = ref<HTMLElement | null>(null)

const isPending = computed(() => props.request.status === 'pending')
const canSend = computed(
  () => isPending.value && replyText.value.trim().length > 0 && !sending.value,
)
const charCount = computed(() => replyText.value.length)

// 用于 TransitionGroup 的展示列表（附带稳定 key）
const displayMessages = computed(() => {
  const list: Array<{ key: string; role: string; content: string }> = []
  props.request.messages.forEach((m, i) => {
    list.push({
      key: `m-${i}`,
      role: m.role,
      content: m.content,
    })
  })
  if (props.request.reply) {
    list.push({
      key: 'admin-reply',
      role: 'admin',
      content: props.request.reply,
    })
  }
  return list
})

watch(
  () => props.request.requestId,
  () => {
    replyText.value = ''
    sending.value = false
    nextTick(() => scrollToBottom())
  },
)

watch(
  () => props.request.status,
  (status) => {
    if (status !== 'pending') sending.value = false
  },
)

watch(
  () => props.request.messages.length,
  () => nextTick(() => scrollToBottom()),
)

watch(
  () => props.request.reply,
  () => nextTick(() => scrollToBottom()),
)

function scrollToBottom() {
  const el = messagesRef.value
  if (!el) return
  el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
}

function submit() {
  if (!canSend.value) return
  const text = replyText.value.trim()
  sending.value = true
  emit('reply', text)
  replyText.value = ''
  setTimeout(() => {
    sending.value = false
  }, 5000)
}

function formatTime(ts: number) {
  const d = new Date(ts)
  return d.toLocaleString('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const statusText: Record<RequestItem['status'], string> = {
  pending: '待回复',
  replied: '已回复',
  timeout: '已超时',
  cancelled: '已取消',
}

const statusClass: Record<RequestItem['status'], string> = {
  pending: 's-pending',
  replied: 's-replied',
  timeout: 's-timeout',
  cancelled: 's-cancelled',
}

// assistant / admin → 右侧；user / system → 左侧
function isRight(role: string): boolean {
  return role === 'assistant' || role === 'admin'
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    user: 'user（对方）',
    system: 'system',
    assistant: 'assistant（你）',
    admin: 'admin（你）',
  }
  return map[role] ?? role
}
</script>

<template>
  <div class="detail">
    <!-- 顶部信息栏 -->
    <header class="detail-header">
      <div class="info-item">
        <span class="label">模型</span>
        <span>{{ request.model || '-' }}</span>
      </div>
      <div class="info-item">
        <span class="label">类型</span>
        <span class="type-badge" :class="{ stream: request.stream }">
          <span v-if="request.stream" class="pulse-dot"></span>
          {{ request.stream ? '流式' : '非流式' }}
        </span>
      </div>
      <div class="info-item">
        <span class="label">Tokens</span>
        <span>{{ request.promptTokens }}</span>
      </div>
      <div class="info-item">
        <span class="label">状态</span>
        <Transition name="status-text" mode="out-in">
          <span
            :key="request.status"
            class="status"
            :class="statusClass[request.status]"
          >
            {{ statusText[request.status] }}
          </span>
        </Transition>
      </div>
    </header>

    <!-- 对话记录 -->
    <TransitionGroup
      ref="messagesRef"
      name="msg"
      tag="div"
      class="messages"
    >
      <!-- 消息气泡 -->
      <div
        v-for="msg in displayMessages"
        :key="msg.key"
        class="msg-row"
        :class="isRight(msg.role) ? 'row-right' : 'row-left'"
      >
        <div class="msg-bubble" :class="msg.role">
          <div class="msg-role">{{ roleLabel(msg.role) }}</div>
          <div class="msg-content">{{ msg.content }}</div>
        </div>
      </div>

      <!-- 等待回复 -->
      <div v-if="isPending && !sending" key="__waiting" class="waiting">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="waiting-text">等待你回复...</span>
      </div>

      <div v-if="isPending && sending" key="__sending" class="waiting">
        <mdui-icon name="hourglass_top" class="waiting-icon"></mdui-icon>
        <span class="waiting-text">正在发送...</span>
      </div>
    </TransitionGroup>

    <!-- 回复输入区 -->
    <div class="reply-area">
      <template v-if="isPending">
        <mdui-text-field
          v-model="replyText"
          variant="outlined"
          label="你的回复"
          placeholder="输入要返回给第三方软件的内容..."
          rows="3"
          autosize
          :max-rows="8"
          clearable
          :disabled="sending"
          @keydown.ctrl.enter="submit"
          @keydown.meta.enter="submit"
        ></mdui-text-field>
        <div class="reply-actions">
          <span class="hint">
            Ctrl + Enter 发送 · {{ charCount }} 字
          </span>
          <mdui-button
            variant="filled"
            icon="send"
            :loading="sending"
            :disabled="!canSend"
            @click="submit"
          >
            {{ sending ? '发送中...' : '发送回复' }}
          </mdui-button>
        </div>
      </template>

      <Transition name="closed" mode="out-in">
        <div v-if="!isPending" class="closed">
          <mdui-icon
            :name="
              request.status === 'replied'
                ? 'check_circle'
                : request.status === 'timeout'
                  ? 'timer_off'
                  : 'cancel'
            "
            class="closed-icon"
          ></mdui-icon>
          <span>该请求已{{ statusText[request.status] }}，无法再回复</span>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--mdui-color-surface);
  transition: background-color 0.35s ease;
}

/* ---------- 顶部信息栏 ---------- */
.detail-header {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--mdui-color-outline-variant);
  background: var(--mdui-color-surface-container-low);
  flex-shrink: 0;
  transition: background-color 0.35s ease, border-color 0.35s ease;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
}

.info-item .label {
  font-size: 11px;
  color: var(--mdui-color-on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.type-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 12px;
  background: var(--mdui-color-surface-container-highest);
  transition: background-color 0.35s ease;
}

.type-badge.stream {
  background: var(--mdui-color-primary-container);
  color: var(--mdui-color-on-primary-container);
}

.pulse-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse-dot 1.4s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%,
  100% {
    opacity: 0.4;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1.2);
  }
}

.status {
  font-weight: 600;
}
.s-pending {
  color: var(--mdui-color-primary);
}
.s-replied {
  color: var(--mdui-color-tertiary);
}
.s-timeout {
  color: var(--mdui-color-error);
}
.s-cancelled {
  color: var(--mdui-color-outline);
}

/* ---------- 消息区 ---------- */
.messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  -webkit-overflow-scrolling: touch;
  position: relative;
}

.msg-row {
  display: flex;
  width: 100%;
}

.row-left {
  justify-content: flex-start;
}

.row-right {
  justify-content: flex-end;
}

/* ---------- 气泡 ---------- */
.msg-bubble {
  max-width: 80%;
  padding: 10px 14px;
  border-radius: 16px;
  position: relative;
  word-break: break-word;
  transition: background-color 0.35s ease, color 0.35s ease,
    box-shadow 0.25s ease;
}

.msg-bubble:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.row-left .msg-bubble {
  border-bottom-left-radius: 4px;
}

.row-right .msg-bubble {
  border-bottom-right-radius: 4px;
}

.msg-bubble.user {
  background: var(--mdui-color-primary-container);
  color: var(--mdui-color-on-primary-container);
}

.msg-bubble.system {
  background: var(--mdui-color-surface-container-highest);
  color: var(--mdui-color-on-surface-variant);
  opacity: 0.9;
}

.msg-bubble.assistant,
.msg-bubble.admin {
  background: var(--mdui-color-tertiary-container);
  color: var(--mdui-color-on-tertiary-container);
}

.msg-role {
  font-size: 11px;
  font-weight: 600;
  opacity: 0.65;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.msg-content {
  font-size: 14px;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
}

/* ---------- 等待指示 ---------- */
.waiting {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 4px;
  color: var(--mdui-color-on-surface-variant);
  font-size: 13px;
  justify-content: flex-end;
}

.waiting .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--mdui-color-primary);
  animation: pulse 1.2s infinite ease-in-out;
}

.waiting .dot:nth-child(2) {
  animation-delay: 0.15s;
}
.waiting .dot:nth-child(3) {
  animation-delay: 0.3s;
}

.waiting-text {
  margin-left: 6px;
}

.waiting-icon {
  font-size: 16px;
  animation: spin 1.5s linear infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* ---------- 回复输入区 ---------- */
.reply-area {
  border-top: 1px solid var(--mdui-color-outline-variant);
  padding: 12px 16px;
  background: var(--mdui-color-surface-container-low);
  flex-shrink: 0;
  transition: background-color 0.35s ease, border-color 0.35s ease;
}

.reply-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
}

.hint {
  font-size: 12px;
  color: var(--mdui-color-on-surface-variant);
}

.closed {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: var(--mdui-color-on-surface-variant);
  font-size: 14px;
  gap: 8px;
}

.closed-icon {
  font-size: 20px;
}

/* ---------- 消息入场 / 出场动画 ---------- */
.msg-enter-active {
  transition: opacity 0.4s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.msg-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
  position: absolute;
  width: calc(100% - 32px);
}
.msg-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
.msg-move {
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 左侧消息：从左边滑入 */
.msg-enter-from.row-left {
  opacity: 0;
  transform: translateX(-16px) translateY(8px) scale(0.94);
}

/* 右侧消息：从右边滑入 */
.msg-enter-from.row-right {
  opacity: 0;
  transform: translateX(16px) translateY(8px) scale(0.94);
}

/* 等待指示入场 */
.msg-enter-from.waiting {
  opacity: 0;
  transform: translateX(16px);
}

/* 状态文字切换 */
.status-text-enter-active {
  transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.status-text-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.status-text-enter-from {
  opacity: 0;
  transform: translateY(-6px);
}
.status-text-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

/* 关闭提示入场 */
.closed-enter-active {
  transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.closed-enter-from {
  opacity: 0;
  transform: scale(0.9);
}

/* ---------- 移动端适配 ---------- */
@media (max-width: 767px) {
  .detail-header {
    gap: 12px;
    padding: 8px 12px;
  }

  .info-item {
    font-size: 12px;
  }

  .messages {
    padding: 12px;
  }

  .msg-bubble {
    max-width: 85%;
  }

  .reply-area {
    padding: 10px 12px;
  }

  .reply-actions {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .reply-actions .hint {
    text-align: center;
  }
}
</style>
