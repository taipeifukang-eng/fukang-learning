// 測試 Edge Function 環境變數的簡單腳本
// 如果需要診斷，可以在 Supabase SQL Editor 中執行相關查詢

// 檢查 SERVICE_ROLE_KEY 是否正確設定的方法：
// 1. 進 Supabase Dashboard → Settings → API
// 2. 複製 service_role key （整個字串包括最後的 ==）
// 3. 開文字編輯器貼上，確認字長至少 200+ 字符
// 4. 回 Edge Function Secrets，刪掉舊的 SERVICE_ROLE_KEY
// 5. 新增 SERVICE_ROLE_KEY，完整貼上

// 常見的 SERVICE_ROLE_KEY 應該看起來像：
// eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlc2dscnN1dmNzYW1ha2Jjc2RyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzc5MTkwOSwiZXhwIjoyMDkzMzY3OTA5fQ.[很長的簽名]==

// 如果複製出來只有 50-100 字符，表示複製不完整，需要重新複製！
