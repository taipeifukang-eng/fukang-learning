# 🔍 登入失敗深度診斷清單

## 問題症狀
- 按「用 LINE 登入」後看到 `create_user_failed` 錯誤
- Edge Function 無法創建新使用者

## 根本原因可能性排查

### 1️⃣ SUPABASE_URL 未設置在 Secrets
**檢查方法**:
```bash
npx supabase secrets list --project-ref vesglrsuvcsamakbcsdr
```
**預期結果**: 應該看到 `SUPABASE_URL` 在列表中

**如果缺少**: 執行：
```bash
npx supabase secrets set SUPABASE_URL=https://vesglrsuvcsamakbcsdr.supabase.co --project-ref vesglrsuvcsamakbcsdr
```

---

### 2️⃣ staff_profiles RLS 策略問題
**檢查 Supabase SQL Editor**:
https://supabase.com/dashboard/project/vesglrsuvcsamakbcsdr/sql/new

執行此 SQL 查看 RLS 狀態：
```sql
-- 檢查 RLS 是否啟用
select table_name, row_security_enabled 
from information_schema.tables 
where table_schema = 'public' and table_name = 'staff_profiles';

-- 查看所有 staff_profiles 策略
select policyname, qual, with_check 
from pg_policies 
where tablename = 'staff_profiles' 
order by policyname;
```

**預期結果**: 應該看到 3 個策略：
- `staff_profiles_admin_read` (SELECT)
- `staff_profiles_admin_update` (UPDATE)
- `staff_profiles_admin_insert` (INSERT)

**如果缺少 INSERT 策略**:
```sql
create policy staff_profiles_admin_insert on public.staff_profiles
  for insert with check (true);
```

---

### 3️⃣ 郵箱唯一性衝突
Edge Function 可能在創建用戶時出現郵箱重複。

**檢查 Supabase Auth 中是否已有該用戶**:
進 Supabase 儀表板 → Authentication → Users
搜索 `fukangtw.local` 郵箱

**解決方案**: 如果找到重複用戶，可以：
1. 手動刪除該用戶
2. 或改變郵箱生成方式（加時間戳）

---

### 4️⃣ SERVICE_ROLE_KEY 是否正確
Secrets 中有 `SERVICE_ROLE_KEY`，但可能是錯的。

**驗證方法** - 在 Supabase SQL Editor 執行：
```sql
-- 用 SERVICE_ROLE_KEY 創建一條測試記錄
insert into public.staff_profiles (id, line_user_id, display_name)
values (
  gen_random_uuid(),
  'test_' || now()::text,
  'Test User'
);
```

如果能插入 → SERVICE_ROLE_KEY 正確
如果報 RLS 錯誤 → RLS 策略有問題

---

## 立即診斷步驟

### 第一步：檢查 SUPABASE_URL Secrets
```bash
npx supabase secrets list --project-ref vesglrsuvcsamakbcsdr | grep SUPABASE_URL
```

### 第二步：如果缺少，添加它
```bash
npx supabase secrets set SUPABASE_URL=https://vesglrsuvcsamakbcsdr.supabase.co --project-ref vesglrsuvcsamakbcsdr
```

### 第三步：重新部署 Edge Function
```bash
npx supabase functions deploy line-callback --project-ref vesglrsuvcsamakbcsdr
```

### 第四步：重試登入
進 http://localhost:5175/ → 硬刷新 → 點「用 LINE 登入」

---

## 如果還是失敗

進 Supabase 儀表板查看 Edge Function 日誌：
https://supabase.com/dashboard/project/vesglrsuvcsamakbcsdr/functions/line-callback/details

日誌會顯示具體錯誤！
