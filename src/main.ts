import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import './style.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// 恢復已登入的 Supabase session（頁面重整後不需重新登入）
const auth = useAuthStore()
auth.init().finally(() => {
  app.mount('#app')
})
