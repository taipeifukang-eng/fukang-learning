import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    icon?: string
    group?: string
    closable?: boolean
    public?: boolean
    requiresAuth?: boolean
    permission?: string
  }
}

export {}