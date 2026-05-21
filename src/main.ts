import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import './style.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

// 先完成 auth 初始化（還原 session），再安裝 router
// 確保 beforeEach 守衛執行時 isAuthenticated 已正確設定，避免競態條件導致每次重整都被踢回登入頁
const auth = useAuthStore()
await auth.init()

app.use(router)
app.mount('#app')
