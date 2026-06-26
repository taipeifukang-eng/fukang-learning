<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import BrandLogo from '../components/BrandLogo.vue'
import { appConfig } from '../lib/config'
import { useAuthStore } from '../stores/auth'
import { useUiStore } from '../stores/ui'

interface MenuItem {
  to: string
  title: string
  icon: string
}

interface MenuGroup {
  id: string
  title: string
  icon: string
  items: MenuItem[]
}

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()

const userMenuOpen = ref(false)
const contextMenu = ref<{ x: number; y: number; path: string } | null>(null)

const primarySwatches = [
  { label: '琥珀橘', light: '#c2410c', dark: '#fb923c' },
  { label: '玫瑰紅', light: '#be123c', dark: '#fb7185' },
  { label: '天空藍', light: '#0369a1', dark: '#38bdf8' },
  { label: '紫羅蘭', light: '#6d28d9', dark: '#a78bfa' },
]

const secondarySwatches = [
  { label: '琥珀金', light: '#b45309', dark: '#fbbf24' },
  { label: '松石綠', light: '#0f766e', dark: '#5eead4' },
  { label: '深灰藍', light: '#334155', dark: '#94a3b8' },
  { label: '酒紅', light: '#991b1b', dark: '#f87171' },
]

const menuGroups: MenuGroup[] = [
  {
    id: 'platform',
    title: '平台管理',
    icon: 'grid',
    items: [
      { to: '/admin', title: '儀表板', icon: 'grid' },
      { to: '/admin/organizations', title: '組織管理', icon: 'building' },
      { to: '/admin/people', title: '人員管理', icon: 'users' },
      { to: '/admin/staff', title: '用戶管理', icon: 'users' },
      { to: '/admin/team-scope', title: '主管範圍管理', icon: 'users' },
      { to: '/admin/team-progress', title: '轄區進度總覽', icon: 'book' },
      { to: '/admin/roles', title: 'RBAC 權限', icon: 'shield' },
    ],
  },
  {
    id: 'content',
    title: '課程管理',
    icon: 'video',
    items: [
      { to: '/admin/categories', title: '分類管理', icon: 'tag' },
      { to: '/admin/courses', title: '課程影片管理', icon: 'video' },
      { to: '/admin/scripts', title: '腳本設計', icon: 'fileText' },
    ],
  },
  {
    id: 'learning',
    title: '學習中心',
    icon: 'book',
    items: [
      { to: '/learning', title: '學習專區', icon: 'book' },
      { to: '/learning/my-progress', title: '我的學習紀錄', icon: 'book' },
    ],
  },
]

const menuPermissionMap: Record<string, string | undefined> = {
  '/admin': 'dashboard:view',
  '/admin/organizations': 'orgs:view',
  '/admin/people': 'staff:view',
  '/admin/staff': 'staff:view',
  '/admin/team-scope': 'roles:assign',
  '/admin/team-progress': 'team_progress:view',
  '/admin/roles': 'roles:view',
  '/admin/categories': 'categories:edit',
  '/admin/courses': 'courses:view',
  '/admin/scripts': 'courses:view',
  '/learning': 'learning:view',
  '/learning/my-progress': 'learning:view',
}

const visibleMenuGroups = computed<MenuGroup[]>(() =>
  menuGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const permission = menuPermissionMap[item.to]
        return !permission || auth.hasPermission(permission)
      }),
    }))
    .filter((group) => group.items.length > 0),
)

const breadcrumbItems = computed(() => {
  const items = [] as Array<{ label: string; to?: string }>
  if (route.meta.group) {
    items.push({ label: route.meta.group as string })
  }
  if (route.meta.title) {
    items.push({ label: route.meta.title as string, to: route.fullPath })
  }
  return items
})

const activeRouteTitle = computed(() => (route.meta.title as string) ?? '後台')
const activeRouteIcon = computed(() => (route.meta.icon as string) ?? 'grid')

function isMenuActive(item: MenuItem) {
  return route.path === item.to || route.path.startsWith(`${item.to}/`)
}

function closeCurrentTab(path: string) {
  const nextPath = ui.closeTab(path, auth.defaultHomePath)
  contextMenu.value = null
  if (route.path === path) {
    router.push(nextPath)
  }
}

function logout() {
  auth.logout()
  router.push('/login')
}

watch(
  () => route.fullPath,
  () => {
    ui.syncTab(route)
    ui.closeMobileSidebar()
  },
  { immediate: true },
)

onMounted(() => {
  ui.initializeTheme()
})
</script>

<template>
  <div class="admin-shell" :class="{ 'admin-shell--collapsed': ui.sidebarCollapsed }">
    <div class="admin-accent"></div>

    <header class="admin-header">
      <div class="admin-header__left">
        <button class="admin-icon-button" type="button" :aria-label="ui.menuButtonLabel" @click="ui.toggleMenu">
          <AppIcon name="menu" />
        </button>
        <BrandLogo class="admin-brand-logo" />
        <div class="admin-header__title">
          <strong>{{ appConfig.appName }}</strong>
          <span>{{ appConfig.appSubtitle }}</span>
        </div>
      </div>

      <div class="admin-header__right">
        <button class="admin-icon-button" type="button" aria-label="切換主題" @click="ui.toggleTheme">
          <AppIcon :name="ui.theme === 'light' ? 'moon' : 'sun'" />
        </button>

        <div class="admin-palette-wrap">
          <button class="admin-icon-button" type="button" aria-label="開啟色盤設定" @click="ui.paletteOpen = !ui.paletteOpen">
            <AppIcon name="palette" />
          </button>

          <div v-if="ui.paletteOpen" class="admin-palette-panel">
            <div class="admin-palette-panel__header">
              <strong>{{ ui.theme === 'light' ? '淺色模式' : '深色模式' }}</strong>
              <button class="admin-text-button" type="button" @click="ui.resetPalette">重設</button>
            </div>

            <div class="admin-palette-row">
              <span>主色</span>
              <div class="swatch-row">
                <button
                  v-for="swatch in primarySwatches"
                  :key="swatch.label"
                  class="swatch"
                  type="button"
                  :style="{ background: ui.theme === 'light' ? swatch.light : swatch.dark }"
                  @click="ui.setPrimaryColor(ui.theme, ui.theme === 'light' ? swatch.light : swatch.dark)"
                ></button>
                <input
                  :value="ui.customPrimary[ui.theme]"
                  type="color"
                  @input="ui.setPrimaryColor(ui.theme, ($event.target as HTMLInputElement).value)"
                />
              </div>
            </div>

            <div class="admin-palette-row">
              <span>輔色</span>
              <div class="swatch-row">
                <button
                  v-for="swatch in secondarySwatches"
                  :key="swatch.label"
                  class="swatch"
                  type="button"
                  :style="{ background: ui.theme === 'light' ? swatch.light : swatch.dark }"
                  @click="ui.setSecondaryColor(ui.theme, ui.theme === 'light' ? swatch.light : swatch.dark)"
                ></button>
                <input
                  :value="ui.customSecondary[ui.theme]"
                  type="color"
                  @input="ui.setSecondaryColor(ui.theme, ($event.target as HTMLInputElement).value)"
                />
              </div>
            </div>
          </div>
        </div>

        <div class="admin-user-menu">
          <button class="admin-user-pill" type="button" @click="userMenuOpen = !userMenuOpen">
            <div>
              <strong>{{ auth.currentUser?.name }}</strong>
              <span>{{ auth.currentUser?.displayRole }}</span>
            </div>
            <AppIcon name="chevronDown" :size="16" />
          </button>

          <div v-if="userMenuOpen" class="admin-dropdown">
            <div class="admin-dropdown__label">LINE 綁定帳號：{{ auth.currentUser?.lineUserId }}</div>
            <button class="admin-dropdown__item" type="button" @click="logout">
              <AppIcon name="logout" :size="16" />
              登出
            </button>
          </div>
        </div>
      </div>
    </header>

    <div v-if="ui.mobileSidebarOpen" class="admin-backdrop" @click="ui.closeMobileSidebar"></div>

    <aside class="admin-sidebar" :class="{ 'admin-sidebar--open': ui.mobileSidebarOpen }">
      <div class="admin-sidebar__inner">
        <section v-for="group in visibleMenuGroups" :key="group.id" class="admin-menu-group">
          <div class="admin-menu-group__label">
            <AppIcon :name="group.icon" :size="15" />
            <span>{{ group.title }}</span>
          </div>
          <RouterLink
            v-for="item in group.items"
            :key="item.to"
            :to="item.to"
            class="admin-nav-link"
            :class="{ 'is-active': isMenuActive(item) }"
          >
            <AppIcon :name="item.icon" />
            <span>{{ item.title }}</span>
          </RouterLink>
        </section>
      </div>
    </aside>

    <main class="admin-main">
      <section class="admin-page-title">
        <div class="admin-page-title__icon">
          <AppIcon :name="activeRouteIcon" />
        </div>
        <div>
          <h1>{{ activeRouteTitle }}</h1>
          <p>富康連鎖藥局學習平台</p>
        </div>
      </section>

      <nav class="admin-tabs">
        <button
          v-for="tab in ui.tabs"
          :key="tab.path"
          class="admin-tab"
          :class="{ 'is-active': route.path === tab.path }"
          type="button"
          @click="router.push(tab.path)"
          @contextmenu.prevent="contextMenu = { x: $event.clientX, y: $event.clientY, path: tab.path }"
        >
          <AppIcon :name="tab.icon" :size="15" />
          <span>{{ tab.title }}</span>
          <span v-if="tab.closable" class="admin-tab__close" @click.stop="closeCurrentTab(tab.path)">×</span>
        </button>
      </nav>

      <nav class="admin-breadcrumb">
        <span v-for="item in breadcrumbItems" :key="item.label">{{ item.label }}</span>
      </nav>

      <div
        v-if="contextMenu"
        class="admin-context-menu"
        :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
      >
        <button type="button" @click="closeCurrentTab(contextMenu.path)">關閉</button>
        <button type="button" @click="ui.closeOtherTabs(contextMenu.path); router.push(contextMenu.path); contextMenu = null">關閉其他</button>
        <button type="button" @click="ui.closeAllClosableTabs(); router.push(auth.defaultHomePath); contextMenu = null">全部關閉</button>
      </div>

      <section class="admin-content" @click="contextMenu = null; userMenuOpen = false; ui.paletteOpen = false">
        <RouterView v-slot="{ Component, route: innerRoute }">
          <KeepAlive>
            <component :is="Component" :key="innerRoute.fullPath" />
          </KeepAlive>
        </RouterView>
      </section>
    </main>
  </div>
</template>
