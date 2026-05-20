-- ================================================================
-- 新增：以「組織」為單位的主管管轄範圍
-- 用途：店長只需指派管轄的「門市/部門」，
--       系統自動把該組織下所有人員都納入其管理範圍，
--       不需要一個人一個人勾選。
-- ================================================================

create table if not exists public.staff_manager_org_scope (
  id          bigserial primary key,
  manager_id  uuid    not null references public.staff_profiles(id) on delete cascade,
  org_id      bigint  not null references public.organizations(id) on delete cascade,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique(manager_id, org_id)
);

alter table public.staff_manager_org_scope enable row level security;

-- 任何已登入用戶皆可讀（supervisor match 及 org scope 都在前端計算）
drop policy if exists org_scope_select on public.staff_manager_org_scope;
create policy org_scope_select on public.staff_manager_org_scope
  for select using (auth.role() = 'authenticated');

-- 管理員可完整操作
drop policy if exists org_scope_admin_all on public.staff_manager_org_scope;
create policy org_scope_admin_all on public.staff_manager_org_scope
  for all using (public.is_admin());
