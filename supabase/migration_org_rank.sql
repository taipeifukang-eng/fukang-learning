-- ============================================================
-- migration_org_rank.sql
-- 新增組織表 + staff_profiles 擴充欄位
-- 在 Supabase SQL Editor 執行
-- ============================================================

-- ── 1. 組織表（門市 / 總部）──────────────────────────────────
create table if not exists public.organizations (
  id   bigint generated always as identity primary key,
  name text not null,
  type text not null check (type in ('store', 'headquarters')),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── 2. staff_profiles 新增欄位 ───────────────────────────────
alter table public.staff_profiles
  add column if not exists org_id bigint references public.organizations(id) on delete set null,
  add column if not exists rank  text check (rank in ('新人','專員','組長','主任','副店長','店長','督導','經理'));

-- ── 3. 組織表 RLS ────────────────────────────────────────────
alter table public.organizations enable row level security;

drop policy if exists orgs_authenticated_read on public.organizations;
create policy orgs_authenticated_read on public.organizations
  for select using (auth.role() = 'authenticated');

drop policy if exists orgs_admin_all on public.organizations;
create policy orgs_admin_all on public.organizations
  for all using (public.is_admin());

-- ── 4. staff_profiles 新增 self_read policy（讓用戶看到自己）──
-- （schema.sql 已有 staff_profiles_self_read，確保存在）
drop policy if exists staff_profiles_self_read on public.staff_profiles;
create policy staff_profiles_self_read on public.staff_profiles
  for select using (auth.uid() = id);

-- ── 5. 新增 staff:assign_role 權限（如果不存在）────────────────
insert into public.permissions (key, title) values
  ('staff:assign_role', '指派用戶角色'),
  ('staff:assign_org',  '指派組織/門市'),
  ('orgs:view',         '檢視組織管理'),
  ('orgs:edit',         '編輯組織管理')
on conflict (key) do nothing;

-- ── 6. 將新權限指派給 super_admin ───────────────────────────
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.key = 'super_admin'
  and p.key in ('staff:assign_role','staff:assign_org','orgs:view','orgs:edit')
on conflict do nothing;

-- ── 7. Seed 組織資料（範例）────────────────────────────────
insert into public.organizations (name, type) values
  ('總部', 'headquarters'),
  ('富康台中店', 'store'),
  ('富康台北店', 'store')
on conflict do nothing;
