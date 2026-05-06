import { createClient } from '@supabase/supabase-js'
import { appConfig } from './config'

// 永遠建立 client（缺少設定時 API 呼叫會失敗但不影響型別）
export const supabase = createClient(
  appConfig.supabaseUrl || 'https://placeholder.supabase.co',
  appConfig.supabaseAnonKey || 'placeholder',
)