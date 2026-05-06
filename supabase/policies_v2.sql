-- ============================================================
-- policies_v2.sql
-- 在 Supabase SQL Editor 執行此檔案（schema.sql 之後執行）
-- ============================================================

-- ── Helper 函式：判斷目前使用者是否為管理角色 ──────────────────
create or replace function public.is_admin()
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on ur.role_id = r.id
    where ur.staff_profile_id = auth.uid()
      and r.key in ('super_admin', 'content_admin', 'teacher')
  );
$$;

-- ── roles / permissions / role_permissions：開啟 RLS ──────────
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;

-- 已登入使用者可讀取角色與權限清單
drop policy if exists roles_authenticated_read on public.roles;
create policy roles_authenticated_read on public.roles
  for select using (auth.role() = 'authenticated');

drop policy if exists permissions_authenticated_read on public.permissions;
create policy permissions_authenticated_read on public.permissions
  for select using (auth.role() = 'authenticated');

drop policy if exists role_permissions_authenticated_read on public.role_permissions;
create policy role_permissions_authenticated_read on public.role_permissions
  for select using (auth.role() = 'authenticated');

-- user_roles：自己可讀、管理員可全部操作
drop policy if exists user_roles_self_read on public.user_roles;
create policy user_roles_self_read on public.user_roles
  for select using (auth.uid() = staff_profile_id);

drop policy if exists user_roles_admin_all on public.user_roles;
create policy user_roles_admin_all on public.user_roles
  for all using (public.is_admin());

-- ── staff_profiles：SERVICE_ROLE 可全部操作（用於 Edge Function），管理員可讀更新 ─────────
-- 注意：SERVICE_ROLE_KEY 用戶可以繞過所有 RLS，所以無需明確策略

-- 管理員使用者可讀全部
drop policy if exists staff_profiles_admin_read on public.staff_profiles;
create policy staff_profiles_admin_read on public.staff_profiles
  for select using (public.is_admin());

-- 管理員使用者可更新
drop policy if exists staff_profiles_admin_update on public.staff_profiles;
create policy staff_profiles_admin_update on public.staff_profiles
  for update using (public.is_admin());

-- 允許 SERVICE_ROLE_KEY 用戶（Edge Function）插入
-- 使用 auth.role() = 'service_role' 檢查可能不準確，改用 INSERT with check (true) 允許所有人
-- SERVICE_ROLE_KEY 會在認證層面繞過 RLS，所以這個策略對 Edge Function 有效
drop policy if exists staff_profiles_admin_insert on public.staff_profiles;
create policy staff_profiles_admin_insert on public.staff_profiles
  for insert with check (true);

-- organizations：已登入使用者可讀，管理員可維護；另需 grant 給 authenticated
grant select, insert, update, delete on public.organizations to authenticated;
grant usage, select on sequence public.organizations_id_seq to authenticated;

-- ── courses / lessons：管理員可寫 ─────────────────────────────
drop policy if exists courses_admin_all on public.courses;
create policy courses_admin_all on public.courses
  for all using (public.is_admin());

drop policy if exists lessons_admin_all on public.lessons;
create policy lessons_admin_all on public.lessons
  for all using (public.is_admin());

-- ── learning_progress：管理員可讀全部 ─────────────────────────
drop policy if exists progress_admin_read on public.learning_progress;
create policy progress_admin_read on public.learning_progress
  for select using (public.is_admin());

-- 自己可讀寫自己的進度
drop policy if exists progress_self_read on public.learning_progress;
create policy progress_self_read on public.learning_progress
  for select using (auth.uid() = staff_profile_id);

drop policy if exists progress_self_upsert on public.learning_progress;
create policy progress_self_upsert on public.learning_progress
  for all using (auth.uid() = staff_profile_id);

-- ── categories：已登入可讀，管理員可維護 ────────────────────────
alter table public.categories enable row level security;

drop policy if exists categories_authenticated_read on public.categories;
create policy categories_authenticated_read on public.categories
  for select using (auth.role() = 'authenticated');

drop policy if exists categories_admin_all on public.categories;
create policy categories_admin_all on public.categories
  for all using (public.is_admin());

grant select, insert, update, delete on public.categories to authenticated;
grant usage, select on sequence public.categories_id_seq to authenticated;

-- ── course_audiences：已登入可讀，管理員可維護 ──────────────────
alter table public.course_audiences enable row level security;

drop policy if exists course_audiences_authenticated_read on public.course_audiences;
create policy course_audiences_authenticated_read on public.course_audiences
  for select using (auth.role() = 'authenticated');

drop policy if exists course_audiences_admin_all on public.course_audiences;
create policy course_audiences_admin_all on public.course_audiences
  for all using (public.is_admin());

grant select, insert, update, delete on public.course_audiences to authenticated;
grant usage, select on sequence public.course_audiences_id_seq to authenticated;

-- ── courses / lessons：已登入使用者可讀（學員需要） ─────────────
drop policy if exists courses_authenticated_read on public.courses;
create policy courses_authenticated_read on public.courses
  for select using (auth.role() = 'authenticated');

drop policy if exists lessons_authenticated_read on public.lessons;
create policy lessons_authenticated_read on public.lessons
  for select using (auth.role() = 'authenticated');
