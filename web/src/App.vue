<script setup lang="ts">
import { RouterView } from 'vue-router'
// 引入主题 hook（副作用：watchEffect 会立即应用主题）
import '@/composables/useTheme'
</script>

<template>
  <RouterView />
</template>

<style>
html,
body,
#app {
  margin: 0;
  padding: 0;
  height: 100%;
  background: var(--mdui-color-surface);
  color: var(--mdui-color-on-surface);
  font-family: system-ui, -apple-system, sans-serif;
  -webkit-tap-highlight-color: transparent;
  overflow: hidden;
  overscroll-behavior: none;
  /* 主题切换时的平滑过渡 */
  transition: background-color 0.35s ease, color 0.35s ease;
}

/* ---------- 滚动条美化（深色主题自动适配） ---------- */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--mdui-color-outline-variant);
  border-radius: 3px;
  transition: background 0.2s;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--mdui-color-outline);
}

/* ---------- 全局过渡：主题色切换 ---------- */
.theme-transition,
.theme-transition * {
  transition: background-color 0.35s ease, color 0.35s ease,
    border-color 0.35s ease !important;
}
</style>
