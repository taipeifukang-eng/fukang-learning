# ✅ LINE 登入成功驗證清單

## 登入成功的標誌

當你點「用 LINE 登入」後，應該看到以下現象：

### ✅ 預期行為（成功）

1. **重導到 LINE 官方登入頁面**
   - 看到綠色 LINE Logo
   - 要求輸入 LINE 帳號密碼

2. **授權畫面**
   - LINE 要求分享帳戶資訊
   - 點同意授權

3. **重導回應用**
   - URL 從 `/auth/line/callback?code=...` 變成 `/dashboard`
   - 看到儀表板頁面 ✅

4. **儀表板應顯示**
   - 標題：「系統統計」
   - 顯示：Staff Count（人員數）、Enabled Courses（啟用課程數）
   - 左側導航菜單可見
   - 右上角有登出按鈕

---

## ❌ 仍然失敗的症狀

| 症狀 | 可能原因 |
|-----|--------|
| 還是 `create_user_failed` | SERVICE_ROLE_KEY 仍不正確 |
| 頁面空白或卡住 | 瀏覽器快取，試硬刷新 (Ctrl+Shift+R) |
| 404 或其他 LINE 錯誤 | Callback URL 設定有問題 |

---

## 🔧 如果仍然失敗

1. **開發者工具查看日誌** (F12 → Console)
   - 有無紅色錯誤訊息？
   - 複製完整錯誤訊息

2. **進 Supabase Dashboard → Edge Functions → line-callback → Logs**
   - 查看最新的日誌
   - 有無紅色錯誤？

3. **截圖給我分析** ✉️

---

## 登入成功後的下一步

1. 回到儀表板
2. 左側菜單探索各頁面：
   - **Staff** — 人員管理
   - **Courses** — 課程管理
   - **Learning** — 學習課程
3. 驗證資料是否能從 Supabase 讀取

---

**現在就試試登入吧！** 🚀
