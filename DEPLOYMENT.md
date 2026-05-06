## LINE Login + Supabase 部署檢查清單

### ✅ 已完成
- [x] Edge Function 部署到 Supabase
- [x] 前端完整整合（auth store + callback + session 恢復）
- [x] build 通過編譯

### ⏳ 待完成（按順序）

#### 步驟 1：SQL Editor 執行初始化腳本
進 [Supabase Dashboard SQL Editor](https://supabase.com/dashboard/project/vesglrsuvcsamakbcsdr/sql/new)，複製貼上以下檔案內容依序執行：

**1.1 執行 schema.sql**
```bash
# 位置: supabase/schema.sql
# 建立 8 張資料表 + 基本 RLS
```

**1.2 執行 policies_v2.sql**
```bash
# 位置: supabase/policies_v2.sql
# 設定管理員 RLS 政策 + is_admin() helper function
```

**1.3 執行 seed.sql**
```bash
# 位置: supabase/seed.sql
# 初始化 4 個角色（super_admin、content_admin、teacher、student）
# 初始化 8 個權限
# 建立角色 ↔ 權限對應
```

#### 步驟 2：設定 Edge Function 環境變數
📖 **詳細指南**: 見 [EDGE_FUNCTION_SECRETS.md](EDGE_FUNCTION_SECRETS.md)

進 [Supabase Dashboard → Edge Functions](https://supabase.com/dashboard/project/vesglrsuvcsamakbcsdr/functions) → `line-callback` → **Secrets**

新增：
- **Key**: `LINE_CHANNEL_ID`
  **Value**: `2009779886`
  
- **Key**: `LINE_CHANNEL_SECRET`
  **Value**: 見 [LINE_CHANNEL_SECRET_GUIDE.md](LINE_CHANNEL_SECRET_GUIDE.md)

#### 步驟 3：確認 LINE Callback URL
確保已在 [LINE Developers Console](https://developers.line.biz/zh-hant/services/line-login/) 新增 Callback URL：
```
http://localhost:5173/auth/line/callback
```

#### 步驟 4：測試登入流程
1. 在本地執行 `npm run dev`
2. 開啟 http://localhost:5173
3. 點「使用 LINE 登入」，應該會導向 LINE OAuth 授權頁
4. 授權後應返回 callback → 建立 Supabase session

### 📋 其他待辦
- [ ] 真實 Supabase API：`src/stores/catalog.ts` 改為讀寫 courses/lessons 資料表
- [ ] Bunny.net Stream：取得 library ID，填入 `VITE_BUNNY_CDN_PREFIX`
- [ ] 測試 RBAC：確認各角色可存取的頁面與資料

### 🔗 快速連結
- [Supabase Dashboard](https://supabase.com/dashboard/project/vesglrsuvcsamakbcsdr)
- [LINE Developers Console](https://developers.line.biz/zh-hant/services/line-login/)
- [本地開發](http://localhost:5173)
