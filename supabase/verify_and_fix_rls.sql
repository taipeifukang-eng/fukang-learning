-- 驗證並修復 staff_profiles RLS 策略

-- 1. 檢查 RLS 是否啟用
select 'Check 1: RLS Status' as step, 
       table_name, 
       row_security_enabled 
from information_schema.tables 
where table_schema = 'public' and table_name = 'staff_profiles';

-- 2. 查看現有策略
select 'Check 2: Existing Policies' as step,
       policyname,
       permissive,
       roles,
       qual,
       with_check
from pg_policies 
where tablename = 'staff_profiles' 
order by policyname;

-- 3. 確保 INSERT 策略存在
drop policy if exists staff_profiles_admin_insert on public.staff_profiles;
create policy staff_profiles_admin_insert on public.staff_profiles
  for insert with check (true);

-- 4. 確保 SELECT 策略存在
drop policy if exists staff_profiles_admin_read on public.staff_profiles;
create policy staff_profiles_admin_read on public.staff_profiles
  for select using (auth.role() = 'service_role' OR public.is_admin());

-- 5. 確保 UPDATE 策略存在  
drop policy if exists staff_profiles_admin_update on public.staff_profiles;
create policy staff_profiles_admin_update on public.staff_profiles
  for update using (auth.role() = 'service_role' OR public.is_admin());

-- 6. 檢查修復後的策略
select 'Check 3: Updated Policies' as step,
       policyname,
       permissive,
       roles,
       qual,
       with_check
from pg_policies 
where tablename = 'staff_profiles' 
order by policyname;
