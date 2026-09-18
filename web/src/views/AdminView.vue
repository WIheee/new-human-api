<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useWebSocket } from '@/composables/useWebSocket'
import { useTheme } from '@/composables/useTheme'
import RequestList from '@/components/RequestList.vue'
import RequestDetail from '@/components/RequestDetail.vue'

const adminToken = ref('admin-change-me')
const { connected, requests, lastError, connect, sendReply } = useWebSocket(adminToken.value)

const { themeMode, icon: themeIcon, label: themeLabel, cycle: cycleTheme } = useTheme()

const selectedId = ref<string | null>(null)
const mobileTab = ref<'list' | 'detail'>('list')
const isMobile = ref(false)

function checkMobile() {
  isMobile.value = window.innerWidth < 768
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})

const selectedRequest = computed(
  () => requests.value.find((r) => r.requestId === selectedId.value) ?? null,
)

const pendingCount = computed(
  () => requests.value.filter((r) => r.status === 'pending').length,
)

watch(
  requests,
  (list) => {
    if (selectedId.value && !list.some((r) => r.requestId === selectedId.value)) {
      selectedId.value = null
    }
    if (!selectedId.value && list.length > 0) {
      selectedId.value = list[0]!.requestId
    }
  },
  { deep: false },
)

function selectRequest(id: string) {
  selectedId.value = id
  if (isMobile.value) {
    mobileTab.value = 'detail'
  }
}

function handleReply(content: string) {
  if (!selectedRequest.value) return
  sendReply(selectedRequest.value.requestId, content)
}

function backToList() {
  mobileTab.value = 'list'
}

function switchTab(tab: 'list' | 'detail') {
  mobileTab.value = tab
}

// 连接状态对应的颜色
const statusColor = computed(() =>
  connected.value ? 'var(--mdui-color-tertiary)' : 'var(--mdui-color-error)',
)

connect()
</script>

<template>
  <div class="layout" :class="{ mobile: isMobile }">
    <!-- ==================== 桌面端 ==================== -->
    <template v-if="!isMobile">
      <aside class="sidebar">
        <div class="sidebar-header">
          <mdui-icon name="smart_toy" class="logo-icon"></mdui-icon>
          <span class="title">假 AI 管理端</span>
          <div class="header-actions">
            <mdui-button-icon
              :icon="themeIcon[themeMode]"
              :title="themeLabel[themeMode]"
              class="theme-btn"
              @click="cycleTheme"
            ></mdui-button-icon>
            <mdui-chip
              class="status-chip"
              :style="`--mdui-chip-color: ${statusColor}`"
            >
              {{ connected ? '已连接' : '未连接' }}
            </mdui-chip>
          </div>
        </div>

        <Transition name="banner">
          <div v-if="lastError" class="error-banner">
            <mdui-icon name="error_outline"></mdui-icon>
            <span>{{ lastError }}</span>
          </div>
        </Transition>

        <Transition name="banner">
          <div class="pending-bar" v-if="pendingCount > 0">
            <mdui-icon name="pending_actions"></mdui-icon>
            <span>{{ pendingCount }} 条待回复</span>
          </div>
        </Transition>

        <RequestList
          :requests="requests"
          :selected-id="selectedId"
          @select="selectRequest"
        />
      </aside>

      <main class="main">
        <Transition name="fade-slide" mode="out-in">
          <RequestDetail
            v-if="selectedRequest"
            :key="selectedRequest.requestId"
            :request="selectedRequest"
            @reply="handleReply"
          />
          <div v-else class="empty" key="empty">
            <mdui-icon name="touch_app" class="empty-icon"></mdui-icon>
            <p class="empty-title">暂无选中的请求</p>
            <p class="empty-desc">从左侧列表选择一条请求开始回复</p>
          </div>
        </Transition>
      </main>
    </template>

    <!-- ==================== 移动端 ==================== -->
    <template v-else>
      <header class="mobile-header">
        <Transition name="back-btn">
          <div v-if="mobileTab === 'detail' && selectedRequest" class="mobile-back">
            <mdui-button-icon
              icon="arrow_back"
              @click="backToList"
            ></mdui-button-icon>
          </div>
        </Transition>
        <div class="mobile-title">
          <mdui-icon name="smart_toy" class="logo-icon"></mdui-icon>
          <span>{{ mobileTab === 'list' ? '请求列表' : '回复详情' }}</span>
        </div>
        <mdui-button-icon
          :icon="themeIcon[themeMode]"
          :title="themeLabel[themeMode]"
          class="theme-btn"
          @click="cycleTheme"
        ></mdui-button-icon>
        <mdui-chip
          class="status-chip"
          :style="`--mdui-chip-color: ${statusColor}`"
        >
          {{ connected ? '已连接' : '未连接' }}
        </mdui-chip>
      </header>

      <Transition name="banner">
        <div v-if="lastError" class="error-banner">
          <mdui-icon name="error_outline"></mdui-icon>
          <span>{{ lastError }}</span>
        </div>
      </Transition>

      <div class="mobile-content">
        <!-- 列表页 -->
        <Transition name="page" mode="out-in">
          <div v-if="mobileTab === 'list'" key="list" class="mobile-page">
            <div class="pending-bar" v-if="pendingCount > 0">
              <mdui-icon name="pending_actions"></mdui-icon>
              <span>{{ pendingCount }} 条待回复</span>
            </div>
            <RequestList
              :requests="requests"
              :selected-id="selectedId"
              @select="selectRequest"
            />
          </div>

          <!-- 详情页 -->
          <div v-else key="detail" class="mobile-page">
            <RequestDetail
              v-if="selectedRequest"
              :key="selectedRequest.requestId"
              :request="selectedRequest"
              @reply="handleReply"
            />
            <div v-else class="empty">
              <mdui-icon name="touch_app" class="empty-icon"></mdui-icon>
              <p class="empty-title">请先选择一条请求</p>
              <p class="empty-desc">返回列表页点击任意请求即可查看</p>
            </div>
          </div>
        </Transition>
      </div>

      <nav class="bottom-nav">
        <button
          type="button"
          class="nav-btn"
          :class="{ active: mobileTab === 'list' }"
          @click="switchTab('list')"
        >
          <span class="nav-indicator"></span>
          <mdui-icon name="list_alt"></mdui-icon>
          <span>请求列表</span>
          <Transition name="badge">
            <span v-if="pendingCount > 0" class="nav-badge">
              {{ pendingCount }}
            </span>
          </Transition>
        </button>
        <button
          type="button"
          class="nav-btn"
          :class="{ active: mobileTab === 'detail' }"
          @click="switchTab('detail')"
        >
          <span class="nav-indicator"></span>
          <mdui-icon name="chat"></mdui-icon>
          <span>回复详情</span>
        </button>
      </nav>
    </template>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: var(--mdui-color-surface);
  transition: background-color 0.35s ease;
}

/* ==================== 桌面端 ==================== */
.sidebar {
  width: 360px;
  min-width: 300px;
  border-right: 1px solid var(--mdui-color-outline-variant);
  display: flex;
  flex-direction: column;
  background: var(--mdui-color-surface-container-low);
  transition: background-color 0.35s ease, border-color 0.35s ease;
}

.sidebar-header {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid var(--mdui-color-outline-variant);
  gap: 8px;
}

.logo-icon {
  font-size: 24px;
  color: var(--mdui-color-primary);
  transition: color 0.35s ease, transform 0.35s ease;
}

.logo-icon:hover {
  transform: rotate(-10deg) scale(1.1);
}

.title {
  font-weight: 600;
  font-size: 16px;
  white-space: nowrap;
}

.header-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.theme-btn {
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
    color 0.3s ease;
}

.theme-btn:hover {
  transform: rotate(30deg) scale(1.1);
}

.status-chip {
  flex-shrink: 0;
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--mdui-color-error-container);
  color: var(--mdui-color-on-error-container);
  font-size: 13px;
}

.pending-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--mdui-color-primary-container);
  color: var(--mdui-color-on-primary-container);
  font-size: 13px;
  font-weight: 500;
}

.main {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--mdui-color-surface);
  position: relative;
}

.empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--mdui-color-on-surface-variant);
  gap: 8px;
}

.empty-icon {
  font-size: 56px;
  opacity: 0.25;
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

.empty-title {
  font-size: 16px;
  font-weight: 500;
  margin: 0;
}

.empty-desc {
  font-size: 14px;
  margin: 0;
  opacity: 0.7;
}

/* ==================== 移动端 ==================== */
.layout.mobile {
  flex-direction: column;
}

.mobile-header {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  background: var(--mdui-color-surface-container);
  border-bottom: 1px solid var(--mdui-color-outline-variant);
  gap: 4px;
  flex-shrink: 0;
  transition: background-color 0.35s ease, border-color 0.35s ease;
}

.mobile-back {
  margin-left: -8px;
}

.mobile-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 16px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-title .logo-icon {
  font-size: 22px;
  color: var(--mdui-color-primary);
  flex-shrink: 0;
}

.mobile-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
  position: relative;
}

.mobile-page {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* 底部导航 */
.bottom-nav {
  display: flex;
  border-top: 1px solid var(--mdui-color-outline-variant);
  background: var(--mdui-color-surface-container);
  flex-shrink: 0;
  height: 62px;
  padding-bottom: env(safe-area-inset-bottom, 0);
  transition: background-color 0.35s ease, border-color 0.35s ease;
}

.nav-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  background: none;
  border: none;
  padding: 6px 8px;
  cursor: pointer;
  color: var(--mdui-color-on-surface-variant);
  font-size: 12px;
  font-family: inherit;
  position: relative;
  transition: color 0.25s ease, transform 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.nav-btn:active {
  transform: scale(0.94);
}

.nav-btn.active {
  color: var(--mdui-color-primary);
}

.nav-btn mdui-icon {
  font-size: 22px;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.nav-btn.active mdui-icon {
  transform: translateY(-2px) scale(1.1);
}

/* 顶部指示条（替换之前的圆角底线，更接近 MDUI 3 风格） */
.nav-indicator {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%) scaleX(0);
  width: 32px;
  height: 3px;
  border-radius: 0 0 3px 3px;
  background: var(--mdui-color-primary);
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  transform-origin: center;
}

.nav-btn.active .nav-indicator {
  transform: translateX(-50%) scaleX(1);
}

.nav-badge {
  position: absolute;
  top: 4px;
  left: 50%;
  transform: translateX(8px);
  background: var(--mdui-color-error);
  color: var(--mdui-color-on-error);
  font-size: 10px;
  font-weight: 600;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  line-height: 1;
}

/* ==================== 过渡动画 ==================== */

/* 页面切换：淡入 + 轻微上移 */
.page-enter-active,
.page-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* 桌面端内容切换 */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* 横幅出现 / 消失 */
.banner-enter-active,
.banner-leave-active {
  transition: opacity 0.3s ease, max-height 0.3s ease, padding 0.3s ease;
  overflow: hidden;
}
.banner-enter-from,
.banner-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}
.banner-enter-to,
.banner-leave-from {
  max-height: 60px;
}

/* 移动端返回按钮出现 */
.back-btn-enter-active,
.back-btn-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease, width 0.2s ease;
}
.back-btn-enter-from,
.back-btn-leave-to {
  opacity: 0;
  transform: translateX(-8px);
  width: 0;
}

/* 徽章弹入 */
.badge-enter-active {
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s;
}
.badge-leave-active {
  transition: transform 0.2s ease, opacity 0.2s;
}
.badge-enter-from,
.badge-leave-to {
  opacity: 0;
  transform: translateX(8px) scale(0.4);
}
</style>
