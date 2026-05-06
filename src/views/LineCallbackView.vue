<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const errorMessage = ref('')

onMounted(async () => {
  const code = route.query.code as string | undefined
  const state = route.query.state as string | undefined
  const errorParam = route.query.error as string | undefined

  // LINE 拒絕授權（使用者按取消）
  if (errorParam) {
    errorMessage.value = `LINE 授權失敗：${errorParam}`
    return
  }

  if (!code || !state) {
    errorMessage.value = '缺少必要的 OAuth 參數，請重新登入。'
    return
  }

  try {
    await auth.completeLineLogin(code, state)
    router.replace(auth.defaultHomePath)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '登入失敗，請稍後再試。'
  }
})
</script>

<template>
  <div class="callback-screen">
    <div class="loading-card">
      <h1>正在完成 LINE 登入</h1>
      <p v-if="!errorMessage">登入資訊處理中，稍後會自動跳轉。</p>
      <div v-else class="callback-error">
        <p>{{ errorMessage }}</p>
        <a href="/login">返回登入頁</a>
      </div>
    </div>
  </div>
</template>