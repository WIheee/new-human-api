import { ref, watchEffect, readonly, type Ref } from 'vue'

export type ThemeMode = 'auto' | 'light' | 'dark'

const STORAGE_KEY = 'web.theme'

function readStored(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'auto') return v
  } catch {
    /* ignore */
  }
  return 'auto'
}

// 全局单例状态
const themeMode: Ref<ThemeMode> = ref(readStored())

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement
  root.classList.remove('mdui-theme-light', 'mdui-theme-dark')
  if (mode === 'light') {
    root.classList.add('mdui-theme-light')
  } else if (mode === 'dark') {
    root.classList.add('mdui-theme-dark')
  }
  // auto: 不加类，MDUI 会自动跟随系统
}

watchEffect(() => {
  applyTheme(themeMode.value)
  try {
    localStorage.setItem(STORAGE_KEY, themeMode.value)
  } catch {
    /* ignore */
  }
})

const ICONS: Record<ThemeMode, string> = {
  auto: 'brightness_auto',
  light: 'light_mode',
  dark: 'dark_mode',
}

const LABELS: Record<ThemeMode, string> = {
  auto: '主题：跟随系统',
  light: '主题：浅色',
  dark: '主题：深色',
}

export function useTheme() {
  function cycle() {
    const next: Record<ThemeMode, ThemeMode> = {
      auto: 'light',
      light: 'dark',
      dark: 'auto',
    }
    themeMode.value = next[themeMode.value]
  }

  function set(mode: ThemeMode) {
    themeMode.value = mode
  }

  return {
    themeMode: readonly(themeMode) as Readonly<Ref<ThemeMode>>,
    icon: ICONS,
    label: LABELS,
    cycle,
    set,
  }
}
