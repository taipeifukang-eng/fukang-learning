<script setup lang="ts">
import { ref } from 'vue'
import { supabase } from '../lib/supabase'

const props = defineProps<{
  courseId: string
  onUploaded: (bunnyVideoId: string, durationSeconds: number, title: string) => void
}>()

const file = ref<File | null>(null)
const title = ref('')
const uploading = ref(false)
const progress = ref(0)
const errorMsg = ref('')
const statusMsg = ref('')

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  file.value = input.files?.[0] ?? null
  if (file.value && !title.value) {
    // 預設以檔名當標題（去副檔名）
    title.value = file.value.name.replace(/\.[^/.]+$/, '')
  }
}

async function upload() {
  if (!file.value || !title.value.trim()) {
    errorMsg.value = '請填寫標題並選擇影片檔案'
    return
  }

  uploading.value = true
  progress.value = 0
  errorMsg.value = ''

  try {
    // 1. 呼叫 Edge Function 建立 Bunny video 記錄
    const { data: session } = await supabase.auth.getSession()
    const token = session.session?.access_token
    if (!token) throw new Error('未登入')

    const fnRes = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bunny-upload`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: title.value.trim() }),
      },
    )
    if (!fnRes.ok) {
      const err = await fnRes.json()
      throw new Error(err.error ?? '建立 Bunny 影片失敗')
    }

    const { videoId, uploadUrl, apiKey, libraryId } = await fnRes.json()

    // 2. 直接 PUT 上傳至 Bunny（支援大檔）
    await uploadWithProgress(file.value, uploadUrl, apiKey)

    // 3. 輪詢 Bunny API，等待影片處理完成並取得時長（最多等 90 秒）
    statusMsg.value = '等待 Bunny 處理影片時長...'
    let duration = 0
    for (let i = 0; i < 18; i++) {
      await new Promise<void>((r) => setTimeout(r, 5000))
      try {
        const infoRes = await fetch(
          `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`,
          { headers: { AccessKey: apiKey } },
        )
        if (infoRes.ok) {
          const info = await infoRes.json()
          if ((info.length ?? 0) > 0) {
            duration = Math.round(info.length)
            break
          }
        }
      } catch {
        // 忽略暫時性錯誤，繼續輪詢
      }
    }
    statusMsg.value = duration > 0 ? `偵測到時長：${duration} 秒` : '時長偵測超時，已略過'

    // 4. 讓呼叫端存入 DB
    props.onUploaded(videoId, duration, title.value.trim())

    // 重置
    file.value = null
    title.value = ''
    progress.value = 100
    setTimeout(() => { statusMsg.value = '' }, 3000)
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : '上傳失敗'
  } finally {
    uploading.value = false
  }
}

function uploadWithProgress(blob: File, url: string, apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('AccessKey', apiKey)
    xhr.setRequestHeader('Content-Type', 'application/octet-stream')

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        progress.value = Math.round((e.loaded / e.total) * 100)
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`Bunny 上傳失敗 (${xhr.status})`))
    }
    xhr.onerror = () => reject(new Error('網路錯誤'))
    xhr.send(blob)
  })
}
</script>

<template>
  <div class="upload-box panel-card">
    <h3>上傳影片</h3>

    <label class="form-label">影片標題
      <input v-model="title" class="form-input" placeholder="輸入影片標題" :disabled="uploading" />
    </label>

    <label class="form-label">選擇影片檔案
      <input type="file" accept="video/*" class="form-input" :disabled="uploading" @change="onFileChange" />
    </label>

    <p v-if="file" class="muted-text">已選擇：{{ file.name }}（{{ (file.size / 1024 / 1024).toFixed(1) }} MB）</p>

    <div v-if="uploading" class="progress-row">
      <div class="progress-bar"><span :style="{ width: `${progress}%` }"></span></div>
      <strong>{{ progress }}%</strong>
    </div>

    <p v-if="statusMsg" class="muted-text" style="margin-top:.25rem">{{ statusMsg }}</p>
    <p v-if="errorMsg" class="error-text">{{ errorMsg }}</p>

    <button class="btn btn--primary" type="button" :disabled="uploading || !file" @click="upload">
      {{ uploading ? '上傳中...' : '開始上傳' }}
    </button>
  </div>
</template>
