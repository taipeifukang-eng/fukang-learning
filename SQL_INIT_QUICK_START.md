# 🔧 SQL 初始化 - 5 分鐘快速指南

**目標**: 在 Supabase 建立資料庫結構、安全策略、初始資料

**時間**: ~5 分鐘  
**前置條件**: 已完成 LINE Channel Secret 設定 ✅

---

## 執行步驟

### ✅ 第 1 步：建立表格結構
**檔案**: `supabase/schema.sql`  
**內容**: 8 個表格（staff_profiles, roles, permissions, role_permissions, user_roles, courses, lessons, learning_progress）

1. 進 Supabase Dashboard → **SQL Editor**
2. 點左上「**New Query**」
3. 開啟 `supabase/schema.sql` 檔案
4. **全選複製** (Ctrl+A) → 貼到 SQL Editor
5. 點右上綠色 **▶ Execute** 按鈕
6. 等待顯示 ✅ Success

---

### ✅ 第 2 步：設定行級安全策略 (RLS)
**檔案**: `supabase/policies_v2.sql`  
**內容**: RLS 策略 + `is_admin()` 幫助函數

1. 點左上「**New Query**」
2. 開啟 `supabase/policies_v2.sql` 檔案
3. **全選複製** → 貼到新 Query
4. 點右上綠色 **▶ Execute** 按鈕
5. 等待顯示 ✅ Success

---

### ✅ 第 3 步：插入初始資料
**檔案**: `supabase/seed.sql`  
**內容**: 
- 8 個權限 (dashboard:view, staff:view, staff:toggle, roles:view, roles:assign, courses:view, courses:edit, learning:view)
- 4 個角色 (super_admin, content_admin, teacher, student)
- 角色↔權限對應表

1. 點左上「**New Query**」
2. 開啟 `supabase/seed.sql` 檔案
3. **全選複製** → 貼到新 Query
4. 點右上綠色 **▶ Execute** 按鈕
5. 等待顯示 ✅ Success

---

## 🎉 完成！

所有 SQL 執行完後：

### 驗證資料已插入
1. Supabase Dashboard → **Table Editor**
2. 左側列表應顯示 8 個表格
3. 點進 `roles` 表 → 應看到 4 筆資料
4. 點進 `permissions` 表 → 應看到 8 筆資料
5. 點進 `role_permissions` 表 → 應看到多筆關聯資料

### 測試前端
1. 開啟瀏覽器 → `http://localhost:5175/`
2. 點「**用 LINE 登入**」按鈕
3. 使用 LINE 帳號登入
4. 登入成功 → 重導到儀表板 ✅

---

## ❓ 常見問題

**Q: 能否跳過某個步驟？**  
A: 否。必須按順序執行 (schema → policies → seed)，否則會出現外鍵錯誤。

**Q: 執行失敗怎麼辦？**  
A: 
- 檢查是否有 SQL 語法錯誤
- 若顯示「already exists」可忽略（有 `IF NOT EXISTS` 保護）
- 若失敗，聯絡開發者

**Q: 如何清除所有資料重新初始化？**  
A: Supabase Dashboard → SQL Editor → 執行以下：
```sql
drop table if exists learning_progress;
drop table if exists lessons;
drop table if exists courses;
drop table if exists user_roles;
drop table if exists role_permissions;
drop table if exists permissions;
drop table if exists roles;
drop table if exists staff_profiles;
drop function if exists public.is_admin();
```
然後重新執行 schema.sql → policies_v2.sql → seed.sql

---

## 📞 需要幫助？

查看完整部署文件：
- [CHECKLIST.md](CHECKLIST.md) — 完整部署流程
- [DEPLOYMENT.md](DEPLOYMENT.md) — 部署概述
- [EDGE_FUNCTION_SECRETS.md](EDGE_FUNCTION_SECRETS.md) — Edge Function 設定
