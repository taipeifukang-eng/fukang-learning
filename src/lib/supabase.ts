import { createClient } from '@supabase/supabase-js'
import { appConfig } from './config'

// 永遠建立 client（缺少設定時 API 呼叫會失敗但不影響型別）
// 使用 sessionStorage 而非 localStorage：session 隨視窗/頁籤關閉自動清除，
// 防止在公用電腦上前一個登入者的 session 被下一人直接使用。
export const supabase = createClient(
  appConfig.supabaseUrl || 'https://placeholder.supabase.co',
  appConfig.supabaseAnonKey || 'placeholder',
  {
    auth: {
      storage: window.sessionStorage,
      persistSession: true,
    },
  },
)