# 🔧 Edge Function Service Role Key 設定指南

**問題**: `create_user_failed` — Edge Function 無法建立 Supabase Auth 使用者

**原因**: Edge Function 缺少 `SUPABASE_SERVICE_ROLE_KEY` 環境變數

**解決**: 手動添加 Service Role Key 到 Edge Function Secrets

---

## 步驟 1：取得 Service Role Key

### 進入 Supabase Dashboard
https://supabase.com/dashboard/project/vesglrsuvcsamakbcsdr/settings/api

### 找到 Service Role Key
1. 進 **Settings** → **API**
2. 往下滑找到 **Service Role** 或 **service_role**
3. 應該看到一個很長的 JWT 字符串（以 `eyJhbGci...` 開頭）
4. **複製整個 key**（按右邊的複製按鈕或全選複製）

⚠️ **注意**：
- Service Role Key 有完全權限，不要分享給別人
- 不要提交到 Git
- 只用在 Server 端（Edge Function）

---

## 步驟 2：添加到 Edge Function Secrets

### 進入 Edge Function 設定
https://supabase.com/dashboard/project/vesglrsuvcsamakbcsdr/edge-functions

### 找到 line-callback 函數
1. 在列表中找到 **line-callback**
2. 點進去

### 進入 Secrets 分頁
1. 點 **Secrets** 分頁（靠近 **Details**）
2. 應該已看到：
   - ✅ `LINE_CHANNEL_ID` = `2009779886`
   - ✅ `LINE_CHANNEL_SECRET` = `dd2c3167d839208a5d0f44851b755075`

### 新增 Service Role Key Secret
1. 點 **Add secret**
2. 填入：
   - **Name**: `SUPABASE_SERVICE_ROLE_KEY`
   - **Value**: 貼上步驟 1 複製的 Service Role Key
3. 點 **Add secret** 按鈕

應該看到 3 個 Secrets 列表：
```
✅ LINE_CHANNEL_ID
✅ LINE_CHANNEL_SECRET
✅ SUPABASE_SERVICE_ROLE_KEY
```

---

## ✅ 完成後

1. 回到瀏覽器 → `http://localhost:5175/`
2. 刷新頁面 (F5)
3. 點「用 LINE 登入」
4. 應該登入成功 ✅

---

## 🐛 如果還是失敗

1. **確認 Key 複製完整** — Service Role Key 應該是很長的字符串
2. **確認沒有多余空格** — 複製時不要選到前後的空格
3. **硬刷新瀏覽器** — Ctrl+Shift+R
4. **檢查瀏覽器 Console** — F12 開發者工具看有無錯誤訊息

需要幫助？截圖給我 ✉️
