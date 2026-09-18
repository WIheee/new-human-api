<script setup lang="ts">
import type { RequestItem } from '@/types'

defineProps<{
  requests: RequestItem[]
  selectedId: string | null
}>()

const emit = defineEmits<{
  select: [id: string]
}>()

const statusMap: Record<
  RequestItem['status'],
  { label: string; color: string; icon: string }
> = {
  pending: {
    label: '待回复',
    color: 'var(--mdui-color-primary)',
    icon: 'schedule',
  },
  replied: {
    label: '已回复',
    color: 'var(--mdui-color-tertiary)',
    icon: 'check_circle',
  },
  timeout: {
    label: '已超时',
    color: 'var(--mdui-color-error)',
    icon: 'timer_off',
  },
  cancelled: {
    label: '已取消',
    color: 'var(--mdui-color-outline)',
    icon: 'cancel',
  },
}

function formatTime(ts: number) {
  const d = new Date(ts)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()

  if (isToday) {
    return `${d.getHours().toString().padStart(2, '0')}:${d
      .getMinutes()
      .toString()
      .padStart(2, '0')}`
  }
  return `${d.getMonth() + 1}/${d.getDate()} ${d
    .getHours()
    .toString()
    .padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}
</script>

<template>
  <TransitionGroup name="list" tag="div" class="list">
    <div
      v-for="req in requests"
      :key="req.requestId"
      class="item"
      :class="{
        active: req.requestId === selectedId,
        dim: req.status !== 'pending',
      }"
      @click="emit('select', req.requestId)"
    >
      <!-- 状态指示条 -->
      <div
        class="status-bar"
        :style="{ background: statusMap[req.status].color }"
      ></div>

      <div class="item-body">
        <div class="item-top">
          <div class="status-tag">
            <Transition name="status-icon" mode="out-in">
              <mdui-icon
                :key="req.status"
                :name="statusMap[req.status].icon"
                class="status-icon"
                :style="{ color: statusMap[req.status].color }"
              ></mdui-icon>
            </Transition>
            <span
              class="status-text"
              :style="{ color: statusMap[req.status].color }"
            >
              {{ statusMap[req.status].label }}
            </span>
          </div>
          <span class="time">{{ formatTime(req.createdAt) }}</span>
        </div>

        <div class="preview">{{ req.preview || '(无内容)' }}</div>

        <div class="meta">
          <span v-if="req.stream" class="tag tag-stream">
            <span class="pulse-dot"></span>
            流式
          </span>
          <span class="tag">{{ req.promptTokens }} tokens</span>
        </div>
      </div>
    </div>

    <div v-if="requests.length === 0" key="empty" class="empty-list">
      <mdui-icon name="inbox" class="empty-icon"></mdui-icon>
      <p>暂无请求</p>
    </div>
  </TransitionGroup>
</template>

<style scoped>
.list {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  position: relative;
}

/* ---------- 列表项 ---------- */
.item {
  display: flex;
  padding: 0;
  cursor: pointer;
  border-bottom: 1px solid var(--mdui-color-outline-variant);
  transition: background 0.2s ease, opacity 0.3s ease;
  position: relative;
}

.item::after {
  /* 点击涟漪覆盖层 */
  content: '';
  position: absolute;
  inset: 0;
  background: var(--mdui-color-primary);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.4s ease;
}

.item:active::after {
  opacity: 0.08;
  transition: opacity 0s;
}

.item:hover {
  background: var(--mdui-color-surface-container-high);
}

.item.active {
  background: var(--mdui-color-secondary-container);
}

.item.dim {
  opacity: 0.55;
}

.item.dim:hover {
  opacity: 0.85;
}

.item.dim.active {
  opacity: 1;
}

/* 左侧状态条 */
.status-bar {
  width: 3px;
  flex-shrink: 0;
  transition: background 0.35s ease;
}

.item-body {
  flex: 1;
  padding: 12px 16px;
  min-width: 0;
}

/* ---------- 顶部行 ---------- */
.item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.status-tag {
  display: flex;
  align-items: center;
  gap: 4px;
}

.status-icon {
  font-size: 14px;
}

.status-text {
  font-size: 12px;
  font-weight: 600;
}

.time {
  font-size: 12px;
  color: var(--mdui-color-on-surface-variant);
  flex-shrink: 0;
}

/* ---------- 预览 ---------- */
.preview {
  font-size: 14px;
  color: var(--mdui-color-on-surface);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 6px;
}

/* ---------- 元信息 ---------- */
.meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--mdui-color-surface-container-highest);
  color: var(--mdui-color-on-surface-variant);
  line-height: 1.4;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: background-color 0.35s ease, color 0.35s ease;
}

.tag-stream {
  background: var(--mdui-color-primary-container);
  color: var(--mdui-color-on-primary-container);
}

/* 流式脉冲小圆点 */
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

/* ---------- 空状态 ---------- */
.empty-list {
  padding: 60px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--mdui-color-on-surface-variant);
  font-size: 14px;
}

.empty-icon {
  font-size: 40px;
  opacity: 0.3;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}

.empty-list p {
  margin: 0;
}

/* ---------- 列表动画 ---------- */
.list-enter-active {
  transition: opacity 0.35s ease, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
    max-height 0.35s ease;
  overflow: hidden;
}
.list-enter-from {
  opacity: 0;
  transform: translateY(-20px);
  max-height: 0;
}
.list-enter-to {
  max-height: 200px;
}

.list-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
  position: absolute;
  width: 100%;
}
.list-leave-to {
  opacity: 0;
  transform: translateX(-24px);
}

.list-move {
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 状态图标切换动画 */
.status-icon-enter-active {
  transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.status-icon-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.status-icon-enter-from {
  opacity: 0;
  transform: scale(0.5) rotate(-90deg);
}
.status-icon-leave-to {
  opacity: 0;
  transform: scale(0.5) rotate(90deg);
}
</style>
