# 富康中學學習平台 - 完整部署檢查清單

## 🎯 項目概況
- **專案名稱**: FK-Learning（富康中學學習網）
- **Supabase 專案 ID**: vesglrsuvcsamakbcsdr
- **LINE Channel ID**: 2009779886
- **本地開發**: http://localhost:5173

---

## ✅ 已完成（開發已交付）

### 前端代碼
- [x] Vite 8 + Vue 3.5 + TypeScript 專案
- [x] Pinia 狀態管理
- [x] Vue Router 路由系統
- [x] AdminLayout 管理殼層（warm amber 主題）
- [x] 所有頁面視圖
- [x] 環境變數設定

### 後端 / 基礎設施
- [x] Supabase 專案建立
- [x] 資料庫 schema（8 張資料表）
- [x] Edge Function `line-callback` 部署
- [x] 初始 RLS 政策與種子資料 SQL

### 認證流程
- [x] LINE OAuth 2.0 整合（前端）
- [x] Edge Function 後端處理（code → token 交換）
- [x] Supabase session 建立與恢復
- [x] CSRF 狀態驗證
- [x] 帳號停用檢查

### 編譯與驗證
- [x] npm run build 通過（97 modules）
- [x] 無 TypeScript 錯誤

---

## ⏳ 待完成（使用者操作）

### 📋 步驟 1：LINE Developers Console 複製 Channel Secret
**狀態**: ✅ 已完成  
**Channel Secret**: dd2c3167d839208a5d0f44851b755075

✅ 進 https://developers.line.biz/console/  
✅ 找到 FK-Learning Channel  
✅ 進 Basic settings  
✅ 複製 Channel Secret  

---

### 📋 步驟 2：Supabase Edge Function 設定環境變數
**狀態**: ✅ 已完成  
**耗時**: 2 分鐘  
**前置條件**: 完成步驟 1

**指南**: 見 [EDGE_FUNCTION_SECRETS.md](EDGE_FUNCTION_SECRETS.md)

✅ 進 Supabase Dashboard  
✅ 找到 Edge Functions → line-callback  
✅ 進 Secrets 分頁  
✅ 新增 `LINE_CHANNEL_ID` = `2009779886`  
✅ 新增 `LINE_CHANNEL_SECRET` = `dd2c3167d839208a5d0f44851b755075`  

---

### 📋 步驟 4：LINE Login Callback URL 設定
**狀態**: ✅ 已完成  
**Callback URL**: `http://localhost:5175/auth/line/callback` (已添加到 LINE Console)

✅ 進 LINE Developers Console  
✅ 找到 FK-Learning Channel  
✅ 進 LINE Login 設定  
✅ 在 Callback URL 添加 `http://localhost:5175/auth/line/callback`  

---

### 📋 步驟 5：測試 LINE 登入流程
**狀態**: ⏳ 待操作  
**耗時**: 5 分鐘  
**前置條件**: 完成步驟 1-4  
**快速指南**: 見 [LINE_LOGIN_TEST_CHECKLIST.md](LINE_LOGIN_TEST_CHECKLIST.md)

**測試步驟**:

□ 開瀏覽器 → http://localhost:5175/
□ 硬刷新 (Ctrl+Shift+R)
□ 點「用 LINE 登入」按鈕
□ 使用 LINE 帳號登入
□ 登入成功 → 重導到儀表板
□ 可看到導航菜單與統計資訊

---

### 📋 步驟 6：Supabase SQL 初始化資料庫
**狀態**: ⏳ 待操作  
**耗時**: 5 分鐘  
**前置條件**: 完成步驟 1-5（確認登入成功）  
**快速指南**: 見 [SQL_INIT_QUICK_START.md](SQL_INIT_QUICK_START.md)

**位置**: [Supabase Dashboard SQL Editor](https://supabase.com/dashboard/project/vesglrsuvcsamakbcsdr/sql/new)

執行順序（複製檔案內容貼到 SQL Editor，點「Run」）：

#### 6.1 執行 schema.sql
📁 **檔案**: `supabase/schema.sql`  
📝 **內容**: 建立 8 張資料表 + 基本 RLS  
✅ **預期結果**: 看到「Success」、「No rows returned」

□ schema.sql 執行完成

#### 6.2 執行 policies_v2.sql
📁 **檔案**: `supabase/policies_v2.sql`  
📝 **內容**: 管理員 RLS 政策 + `is_admin()` helper function  
✅ **預期結果**: 看到「Success」、「No rows returned」

□ policies_v2.sql 執行完成

#### 6.3 執行 seed.sql
📁 **檔案**: `supabase/seed.sql`  
📝 **內容**: 初始化 4 個角色、8 個權限、角色對應  
✅ **預期結果**: 看到「Success」、「No rows returned」

□ seed.sql 執行完成
  ```

□ 本地執行開發伺服器：
  ```bash
  npm run dev
  ```

□ 開啟 http://localhost:5173 測試：
  - 點「使用 LINE 登入」
  - 應跳轉到 LINE OAuth 授權頁
  - 授權後應返回 http://localhost:5173/learn 或 /admin（取決於帳號角色）
  - 檢查瀏覽器 DevTools → Application → Cookies 應有 `sb-xxx-auth-token`

□ 驗證 mock 登入仍正常：
  - 點「示範：系統管理員」等按鈕
  - 應進入對應的儀表板

---

## 📚 參考文件

| 檔案 | 用途 |
|---|---|
| [DEPLOYMENT.md](DEPLOYMENT.md) | 部署總覽 |
| [EDGE_FUNCTION_SECRETS.md](EDGE_FUNCTION_SECRETS.md) | Edge Function Secrets 設定 |
| [LINE_CHANNEL_SECRET_GUIDE.md](LINE_CHANNEL_SECRET_GUIDE.md) | LINE Channel Secret 複製指南 |
| `supabase/schema.sql` | 資料表定義 |
| `supabase/policies_v2.sql` | RLS 政策 |
| `supabase/seed.sql` | 初始資料 |

---

## 🔗 快速連結

| 服務 | URL |
|---|---|
| 本地開發 | http://localhost:5173 |
| Supabase Dashboard | https://supabase.com/dashboard/project/vesglrsuvcsamakbcsdr |
| Edge Functions | https://supabase.com/dashboard/project/vesglrsuvcsamakbcsdr/functions |
| SQL Editor | https://supabase.com/dashboard/project/vesglrsuvcsamakbcsdr/sql/new |
| LINE Developers | https://developers.line.biz/console/ |

---

## 💡 常見問題

**Q: 為什麼要分 3 個 SQL 檔案？**  
A: schema.sql 定義表結構，policies_v2.sql 設定進階安全政策，seed.sql 初始化業務資料。分開執行更清晰。

**Q: 可以同時執行 3 個 SQL 嗎？**  
A: 不建議。因為 policies_v2.sql 和 seed.sql 依賴 schema.sql 的表已存在，需按順序。

**Q: Channel Secret 外洩怎麼辦？**  
A: 進 LINE Developers Console → Channel → 重新產生新的 Channel Secret，舊的立即作廢。

**Q: 本地開發時 LINE Login 不動作？**  
A: 確認：
  1. LINE Callback URL 已設定為 `http://localhost:5173/auth/line/callback`
  2. `.env` 裡 `VITE_LINE_CLIENT_ID` 已填 `2009779886`
  3. Edge Function Secrets 已設定
  4. npm run dev 已執行

**Q: 怎樣測試真實 LINE Login？**  
A: 用你的 LINE 帳號手機掃描或點「使用 LINE 登入」，進行完整 OAuth 流程。

---

## 📞 支援
若遇到問題，檢查：
1. 瀏覽器 DevTools → Console 有無錯誤
2. Supabase Dashboard → Logs → Edge Functions 有無異常
3. 確認各步驟都已完成且無手誤
