# ✅ LINE 登入測試檢查清單

## 步驟 1：準備測試環境

- [ ] 開發伺服器正在運行 (`npm run dev` 在 5175)
- [ ] 瀏覽器打開 `http://localhost:5175/`
- [ ] LINE Console 已添加 Callback URL `http://localhost:5175/auth/line/callback` ✅

---

## 步驟 2：執行登入測試

1. **硬刷新瀏覽器** (Ctrl+Shift+R 或 Cmd+Shift+R)
   - 確保新的 .env 設定被載入
   
2. 點擊頁面上的 **用 LINE 登入** 按鈕
   - 按鈕通常在登入頁面中央
   - 或導航到 `/login`

3. **預期行為**：
   - ✅ 跳轉到 LINE 官方登入頁面（綠色 LINE Logo）
   - ❌ 不應再出現「400 Bad Request」錯誤

---

## 步驟 3：完成 LINE 登入

1. 用你的 LINE 帳號登入
2. LINE 可能會要求授權（允許分享帳戶資訊）
3. 同意授權 → 跳轉回應用

---

## 步驟 4：驗證登入成功

登入成功的標誌：

- [ ] ✅ 頁面重導到儀表板 (`/dashboard`)
- [ ] ✅ 可看到「系統統計」區塊（Staff Count、Courses Count 等）
- [ ] ✅ 左側導航菜單顯示（Staff、Courses、Learning 等選項）
- [ ] ✅ 右上角顯示登出按鈕或使用者資訊

**如果看到以上任何一項，表示 LINE 登入已成功！** 🎉

---

## 🔴 如果登入失敗

| 症狀 | 可能原因 | 解決方式 |
|-----|--------|--------|
| 還是 400 錯誤 | LINE Console 未保存 | 進 LINE Console 確認 Callback URL 已保存 ✅ |
| 頁面空白 | 快取問題 | 硬刷新 (Ctrl+Shift+R) 或開 Incognito 視窗 |
| 登入按鈕看不到 | JavaScript 錯誤 | 開瀏覽器開發者工具 (F12) 查看 Console 有無紅色錯誤 |
| 登入後卡住 | Edge Function 未部署 | 檢查 Supabase Dashboard → Edge Functions → line-callback 是否存在 |

---

## ✅ 登入成功後的下一步

1. 進 Supabase SQL Editor
2. 依次執行 3 個 SQL 檔案：
   - `schema.sql` (建立表格)
   - `policies_v2.sql` (設定安全)
   - `seed.sql` (插入初始資料)
3. 回到應用重新登入
4. 測試儀表板是否能讀取真實資料

詳細指南見 → [SQL_INIT_QUICK_START.md](SQL_INIT_QUICK_START.md)

---

## 📞 需要幫助？

- LINE 登入問題？查看 [LINE_REDIRECT_URI_FIX.md](LINE_REDIRECT_URI_FIX.md)
- SQL 問題？查看 [SQL_INIT_QUICK_START.md](SQL_INIT_QUICK_START.md)
- 其他？查看 [DEPLOYMENT.md](DEPLOYMENT.md)
