# 🔧 SQL 初始化 — 緊急快速指南

**問題**: `create_profile_failed` 錯誤
**原因**: Supabase 表格不存在
**解決**: 立即執行 3 個 SQL 檔案

---

## ⚡ 極速版本 (3 分鐘)

### 步驟 1：進入 SQL Editor
進 https://supabase.com/dashboard/project/vesglrsuvcsamakbcsdr/sql/new

### 步驟 2：執行 schema.sql
1. 點左上「**New Query**」
2. 打開本專案的 `supabase/schema.sql` 檔案
3. **全選複製** (Ctrl+A → Ctrl+C)
4. 貼到 SQL Editor
5. 點右上綠色 **Execute** 按鈕
6. 等待 ✅ Success

### 步驟 3：執行 policies_v2.sql
1. 點左上「**New Query**」
2. 打開本專案的 `supabase/policies_v2.sql` 檔案
3. **全選複製** (Ctrl+A → Ctrl+C)
4. 貼到新 Query
5. 點右上綠色 **Execute** 按鈕
6. 等待 ✅ Success

### 步驟 4：執行 seed.sql
1. 點左上「**New Query**」
2. 打開本專案的 `supabase/seed.sql` 檔案
3. **全選複製** (Ctrl+A → Ctrl+C)
4. 貼到新 Query
5. 點右上綠色 **Execute** 按鈕
6. 等待 ✅ Success

---

## ✅ 完成後

1. 回到瀏覽器 → http://localhost:5175/
2. 刷新頁面 (F5)
3. 點「用 LINE 登入」
4. 登入應該成功 ✅

---

## 🐛 如果 SQL 執行失敗

| 錯誤 | 解決方式 |
|-----|--------|
| "relation does not exist" | 表示之前的 Query 沒執行成功，重新執行 schema.sql |
| "duplicate key value" | 正常，表示資料已存在。點「Retry」或忽略 |
| "permission denied" | 確認使用的是 Service Role Key（不是 Anon Key）— Supabase 預設使用正確的 |
| 其他錯誤 | 複製完整錯誤訊息，截圖給我看 |

---

## 📞 需要幫助？

如果還是不行，截圖錯誤訊息給我 ✉️
