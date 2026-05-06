import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { RouteLocationNormalizedLoaded } from 'vue-router'

interface AdminTab {
  path: string
  title: string
  icon: string
  closable: boolean
}

const THEME_KEY = 'admin-theme'
const SIDEBAR_KEY = 'admin-sidebar-collapsed'
const PRIMARY_LIGHT_KEY = 'admin-primary-light'
const PRIMARY_DARK_KEY = 'admin-primary-dark'
const SECONDARY_LIGHT_KEY = 'admin-secondary-light'
const SECONDARY_DARK_KEY = 'admin-secondary-dark'

const PRIMARY_DEFAULTS = { light: '#c2410c', dark: '#fb923c' }
const SECONDARY_DEFAULTS = { light: '#b45309', dark: '#fbbf24' }

function hexToRgbTuple(hex: string) {
  const value = hex.replace('#', '')
  const normalized = value.length === 3 ? value.split('').map((char) => char + char).join('') : value
  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  return `${r}, ${g}, ${b}`
}

function setCssVar(name: string, value: string) {
  document.documentElement.style.setProperty(name, value)
}

export const useUiStore = defineStore('ui', () => {
  const mobileSidebarOpen = ref(false)
  const sidebarCollapsed = ref(localStorage.getItem(SIDEBAR_KEY) === '1')
  const theme = ref<'light' | 'dark'>((localStorage.getItem(THEME_KEY) as 'light' | 'dark' | null) ?? 'light')
  const tabs = ref<AdminTab[]>([])
  const paletteOpen = ref(false)

  const customPrimary = ref({
    light: localStorage.getItem(PRIMARY_LIGHT_KEY) ?? PRIMARY_DEFAULTS.light,
    dark: localStorage.getItem(PRIMARY_DARK_KEY) ?? PRIMARY_DEFAULTS.dark,
  })

  const customSecondary = ref({
    light: localStorage.getItem(SECONDARY_LIGHT_KEY) ?? SECONDARY_DEFAULTS.light,
    dark: localStorage.getItem(SECONDARY_DARK_KEY) ?? SECONDARY_DEFAULTS.dark,
  })

  const menuButtonLabel = computed(() => {
    if (mobileSidebarOpen.value) return '關閉選單'
    return sidebarCollapsed.value ? '展開選單' : '收合選單'
  })

  function applyTheme(nextTheme: 'light' | 'dark') {
    document.documentElement.dataset.adminTheme = nextTheme
    document.documentElement.classList.toggle('dark', nextTheme === 'dark')
    document.documentElement.style.colorScheme = nextTheme
    theme.value = nextTheme
    localStorage.setItem(THEME_KEY, nextTheme)
    applyPalette()
  }

  function initializeTheme() {
    applyTheme(theme.value)
  }

  function toggleTheme() {
    const nextTheme = theme.value === 'light' ? 'dark' : 'light'
    const transitionDocument = document as Document & {
      startViewTransition?: (callback: () => void) => void
    }
    if (transitionDocument.startViewTransition) {
      transitionDocument.startViewTransition(() => applyTheme(nextTheme))
      return
    }
    applyTheme(nextTheme)
  }

  function applyPalette() {
    const activePrimary = customPrimary.value[theme.value]
    const activeSecondary = customSecondary.value[theme.value]
    setCssVar('--admin-primary', activePrimary)
    setCssVar('--admin-primary-rgb', hexToRgbTuple(activePrimary))
    setCssVar(
      '--admin-primary-soft',
      theme.value === 'light' ? 'rgba(194, 65, 12, 0.11)' : 'rgba(251, 146, 60, 0.18)',
    )
    setCssVar('--admin-secondary', activeSecondary)
    setCssVar('--admin-secondary-rgb', hexToRgbTuple(activeSecondary))
    setCssVar(
      '--admin-secondary-soft',
      theme.value === 'light' ? 'rgba(180, 83, 9, 0.10)' : 'rgba(251, 191, 36, 0.16)',
    )
  }

  function setPrimaryColor(mode: 'light' | 'dark', value: string) {
    customPrimary.value[mode] = value
    localStorage.setItem(mode === 'light' ? PRIMARY_LIGHT_KEY : PRIMARY_DARK_KEY, value)
    applyPalette()
  }

  function setSecondaryColor(mode: 'light' | 'dark', value: string) {
    customSecondary.value[mode] = value
    localStorage.setItem(mode === 'light' ? SECONDARY_LIGHT_KEY : SECONDARY_DARK_KEY, value)
    applyPalette()
  }

  function resetPalette() {
    customPrimary.value = { ...PRIMARY_DEFAULTS }
    customSecondary.value = { ...SECONDARY_DEFAULTS }
    localStorage.setItem(PRIMARY_LIGHT_KEY, PRIMARY_DEFAULTS.light)
    localStorage.setItem(PRIMARY_DARK_KEY, PRIMARY_DEFAULTS.dark)
    localStorage.setItem(SECONDARY_LIGHT_KEY, SECONDARY_DEFAULTS.light)
    localStorage.setItem(SECONDARY_DARK_KEY, SECONDARY_DEFAULTS.dark)
    applyPalette()
  }

  function toggleMenu() {
    if (window.matchMedia('(max-width: 767px)').matches) {
      mobileSidebarOpen.value = !mobileSidebarOpen.value
      return
    }

    sidebarCollapsed.value = !sidebarCollapsed.value
    localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed.value ? '1' : '0')
  }

  function closeMobileSidebar() {
    mobileSidebarOpen.value = false
  }

  function syncTab(route: RouteLocationNormalizedLoaded) {
    if (!route.path.startsWith('/admin') && !route.path.startsWith('/learning')) {
      return
    }

    const existing = tabs.value.find((tab) => tab.path === route.path)
    const nextTab = {
      path: route.path,
      title: typeof route.meta.title === 'string' ? route.meta.title : '未命名頁面',
      icon: typeof route.meta.icon === 'string' ? route.meta.icon : 'grid',
      closable: route.meta.closable !== false,
    }

    if (existing) {
      existing.title = nextTab.title
      existing.icon = nextTab.icon
      existing.closable = nextTab.closable
      return
    }

    tabs.value.push(nextTab)
  }

  function closeTab(path: string, fallbackPath: string) {
    const index = tabs.value.findIndex((tab) => tab.path === path)
    if (index === -1 || tabs.value[index].closable === false) {
      return fallbackPath
    }

    tabs.value.splice(index, 1)
    return tabs.value[index]?.path ?? tabs.value[index - 1]?.path ?? fallbackPath
  }

  function closeOtherTabs(path: string) {
    tabs.value = tabs.value.filter((tab) => tab.path === path || tab.closable === false)
  }

  function closeAllClosableTabs() {
    tabs.value = tabs.value.filter((tab) => tab.closable === false)
  }

  return {
    mobileSidebarOpen,
    sidebarCollapsed,
    theme,
    tabs,
    paletteOpen,
    customPrimary,
    customSecondary,
    menuButtonLabel,
    initializeTheme,
    toggleTheme,
    toggleMenu,
    closeMobileSidebar,
    syncTab,
    closeTab,
    closeOtherTabs,
    closeAllClosableTabs,
    setPrimaryColor,
    setSecondaryColor,
    resetPalette,
  }
})