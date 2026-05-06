# 🚨 登入失敗 — 最終修復方案

**問題**: create_user_failed 

**根本原因**: RLS 策略配置過於複雜，或 SERVICE_ROLE_KEY 配置不正確

**完整修復步驟**:

---

## 步驟 1️⃣：執行完整 RLS 重設（Supabase SQL Editor）

進 https://supabase.com/dashboard/project/vesglrsuvcsamakbcsdr/sql/new

複製以下 SQL 並執行：

```sql
-- 禁用舊策略
drop policy if exists staff_profiles_self_read on public.staff_profiles;
drop policy if exists staff_profiles_admin_read on public.staff_profiles;
drop policy if exists staff_profiles_admin_update on public.staff_profiles;
drop policy if exists staff_profiles_admin_insert on public.staff_profiles;

-- 重新創建最小化策略（只允許 INSERT，其他交給 Edge Function 的 SERVICE_ROLE）
create policy staff_profiles_insert_all on public.staff_profiles
  for insert with check (true);

create policy staff_profiles_select_admin on public.staff_profiles
  for select using (public.is_admin());

create policy staff_profiles_update_admin on public.staff_profiles
  for update using (public.is_admin());
```

等到看到 ✅ Success

---

## 步驟 2️⃣：驗證 SERVICE_ROLE_KEY Secrets

在終端執行：

```bash
npx supabase secrets list --project-ref vesglrsuvcsamakbcsdr | findstr SERVICE_ROLE_KEY
```

應該看到 `SERVICE_ROLE_KEY` 存在

---

## 步驟 3️⃣：重新部署 Edge Function

```bash
cd "d:\Desktop\富康程式開發\富康中學"
npx supabase functions deploy line-callback --project-ref vesglrsuvcsamakbcsdr
```

等到看到 `Deployed Functions on project...`

---

## 步驟 4️⃣：重試登入

1. 進 http://localhost:5175/
2. 硬刷新 **Ctrl+Shift+R**
3. 點「用 LINE 登入」
4. 完成 LINE 登入

---

## 如果還是失敗 ❌

進 Supabase 儀表板查看 Edge Function 日誌：
https://supabase.com/dashboard/project/vesglrsuvcsamakbcsdr/functions/line-callback

查看最新的請求日誌，告訴我具體錯誤信息。

---

## 備選方案：禁用 RLS（開發環境用）

如果上面都失敗了，暫時禁用 staff_profiles 的 RLS：

```sql
-- 禁用 RLS（緊急）
alter table public.staff_profiles disable row level security;

-- 重新啟用時再執行
alter table public.staff_profiles enable row level security;
```

但 **不建議在生產環境使用**！
