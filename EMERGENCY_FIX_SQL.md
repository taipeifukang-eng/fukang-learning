# 🚨 緊急修復 SQL — 複製貼上執行

**問題根源**: staff_profiles 表缺少 INSERT RLS 策略
**解決方案**: 執行以下 SQL

---

## ⚡ 步驟 1：複製以下 SQL

```sql
-- 修復：添加 INSERT 策略到 staff_profiles
drop policy if exists staff_profiles_admin_insert on public.staff_profiles;
create policy staff_profiles_admin_insert on public.staff_profiles
  for insert with check (true);
```

## ⚡ 步驟 2：進 Supabase SQL Editor

https://supabase.com/dashboard/project/vesglrsuvcsamakbcsdr/sql/new

## ⚡ 步驟 3：貼上 SQL

1. 點 **New Query**
2. 全選上面的 SQL 代碼
3. 複製 (Ctrl+C)
4. 貼到 Supabase SQL Editor (Ctrl+V)

## ⚡ 步驟 4：執行

點右上綠色 **Execute** 按鈕

預期結果：看到 ✅ Success

## ⚡ 步驟 5：重試登入

1. 回瀏覽器 http://localhost:5175/
2. 硬刷新 (Ctrl+Shift+R)
3. 點「用 LINE 登入」
4. 登入應該成功 ✅

---

**這是解決 `create_user_failed` 的真正原因！** 🎯

完成後告訴我結果！ ✉️
