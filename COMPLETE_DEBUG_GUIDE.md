# 🔍 DEBUG: create_user_failed 完整排除流程

**問題**: 登入後顯示 `create_user_failed`
**最可能原因**: SERVICE_ROLE_KEY 複製不完整或不正確

---

## 步驟 1：驗證 SERVICE_ROLE_KEY 是否完整

進 **Supabase Dashboard** → **Settings** → **API**

### 找 service_role key
1. 往下滑找到 **service_role** 分頁（標籤為「secret」）
2. 看下面的 key，應該是一個很長的字串，格式像：
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ....[很長的內容]....==
   ```

### 驗證長度
- **複製整個 key** 到**文字編輯器**（記事本或 VS Code）
- **統計字符數**：Ctrl+A 全選 → 會顯示字數
- **正確的 SERVICE_ROLE_KEY 應該 200+ 字符長**
- **如果只有 50-100 字符，表示複製不完整！**

---

## 步驟 2：重新設定 SERVICE_ROLE_KEY

如果複製不完整，需要重新設定：

### 進 Edge Function Secrets
1. https://supabase.com/dashboard/project/vesglrsuvcsamakbcsdr/edge-functions
2. 點 **line-callback**
3. 進 **Secrets** 分頁

### 刪除舊的 SERVICE_ROLE_KEY
1. 找到 SERVICE_ROLE_KEY 那行
2. 右邊有垃圾桶圖標，點擊刪除

### 新增正確的 SERVICE_ROLE_KEY
1. 進 Supabase Settings → API
2. **用右邊的複製按鈕複製 service_role key**（比手動選擇更安全）
3. 回 Edge Function Secrets
4. 點 **Add secret**
5. 填入：
   - **Name**: `SERVICE_ROLE_KEY`
   - **Value**: 貼上（Ctrl+V）
6. 點 **Add secret** 按鈕

---

## 步驟 3：重新部署 Edge Function

在終端機執行：
```bash
cd d:\Desktop\富康程式開發\富康中學
npx supabase functions deploy line-callback --project-ref vesglrsuvcsamakbcsdr
```

等待看到：
```
Deployed Functions on project vesglrsuvcsamakbcsdr: line-callback
```

---

## 步驟 4：重試登入

1. 瀏覽器開 http://localhost:5175/
2. 硬刷新 (Ctrl+Shift+R)
3. 點「用 LINE 登入」
4. 應該成功 ✅

---

## 如果還是失敗

進 Edge Function 查看日誌：
1. https://supabase.com/dashboard/project/vesglrsuvcsamakbcsdr/functions/line-callback
2. 點 **Logs** 分頁
3. 找最新的紅色錯誤訊息
4. **截圖錯誤訊息**給我分析
