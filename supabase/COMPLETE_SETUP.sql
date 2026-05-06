-- ============================================================
-- COMPLETE_SETUP.sql - 完整 RLS 和表格重新初始化
-- 執行順序：schema.sql → 這個文件 → seed.sql
-- ============================================================

-- 禁用所有現有策略（如果存在）
drop policy if exists staff_profiles_self_read on public.staff_profiles;
drop policy if exists staff_profiles_admin_read on public.staff_profiles;
drop policy if exists staff_profiles_admin_update on public.staff_profiles;
drop policy if exists staff_profiles_admin_insert on public.staff_profiles;
drop policy if exists courses_authenticated_read on public.courses;
drop policy if exists courses_admin_all on public.courses;
drop policy if exists lessons_authenticated_read on public.lessons;
drop policy if exists lessons_admin_all on public.lessons;
drop policy if exists progress_self_read on public.learning_progress;
drop policy if exists progress_admin_read on public.learning_progress;
drop policy if exists roles_authenticated_read on public.roles;
drop policy if exists permissions_authenticated_read on public.permissions;
drop policy if exists role_permissions_authenticated_read on public.role_permissions;
drop policy if exists user_roles_self_read on public.user_roles;
drop policy if exists user_roles_admin_all on public.user_roles;

-- ── 重新啟用 RLS ──────────────────────────────────────────
alter table public.staff_profiles enable row level security;
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.learning_progress enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;

-- ═══════════════════════════════════════════════════════════
-- 核心策略：SERVICE_ROLE_KEY 繞過 RLS，所以這些策略對 Edge Function 無影響
-- Edge Function 的 INSERT/UPDATE 不受 RLS 限制
-- ═══════════════════════════════════════════════════════════

-- ── staff_profiles：普通使用者可讀自己，管理員可讀寫 ──────
create policy staff_profiles_self_read on public.staff_profiles
  for select using (auth.uid()::text = id::text);

create policy staff_profiles_admin_read on public.staff_profiles
  for select using (public.is_admin());

create policy staff_profiles_admin_update on public.staff_profiles
  for update using (public.is_admin());

create policy staff_profiles_admin_insert on public.staff_profiles
  for insert with check (true);

-- ── courses：已登入使用者可讀，管理員可全部 ─────────────
create policy courses_authenticated_read on public.courses
  for select using (auth.role() = 'authenticated');

create policy courses_admin_all on public.courses
  for all using (public.is_admin());

-- ── lessons：已登入使用者可讀，管理員可全部 ─────────────
create policy lessons_authenticated_read on public.lessons
  for select using (auth.role() = 'authenticated');

create policy lessons_admin_all on public.lessons
  for all using (public.is_admin());

-- ── learning_progress：使用者可讀自己的，管理員可讀全部 ──
create policy progress_self_read on public.learning_progress
  for select using (auth.uid()::text = staff_profile_id::text);

create policy progress_admin_read on public.learning_progress
  for select using (public.is_admin());

-- ── roles、permissions、role_permissions：已登入可讀 ────
create policy roles_authenticated_read on public.roles
  for select using (auth.role() = 'authenticated');

create policy permissions_authenticated_read on public.permissions
  for select using (auth.role() = 'authenticated');

create policy role_permissions_authenticated_read on public.role_permissions
  for select using (auth.role() = 'authenticated');

-- ── user_roles：使用者可讀自己的，管理員可全部 ──────────
create policy user_roles_self_read on public.user_roles
  for select using (auth.uid()::text = staff_profile_id::text);

create policy user_roles_admin_all on public.user_roles
  for all using (public.is_admin());
