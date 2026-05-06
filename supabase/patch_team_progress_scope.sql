-- ============================================================
-- patch_team_progress_scope.sql
-- 目標：店長/督導可查看「自己轄下人員」學習進度
-- 在 Supabase SQL Editor 執行
-- ============================================================

-- 0) 權限代碼（可搭配前端路由控管）
insert into public.permissions (key, title)
values ('team_progress:view', '查看轄下學習進度')
on conflict (key) do nothing;

-- 建議給角色：super_admin / content_admin / teacher
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key = 'team_progress:view'
where r.key in ('super_admin', 'content_admin', 'teacher')
on conflict do nothing;


-- 1) 管理範圍關聯表（精準控管，避免只靠 org_id 造成越權）
create table if not exists public.staff_manager_scope (
  id bigserial primary key,
  manager_id uuid not null references public.staff_profiles(id) on delete cascade,
  member_id uuid not null references public.staff_profiles(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (manager_id, member_id)
);

alter table public.staff_manager_scope enable row level security;

-- 只有管理員可維護管理範圍
drop policy if exists manager_scope_admin_all on public.staff_manager_scope;
create policy manager_scope_admin_all on public.staff_manager_scope
  for all using (public.is_admin())
  with check (public.is_admin());

-- 主管本人可讀自己的轄下清單
drop policy if exists manager_scope_self_read on public.staff_manager_scope;
create policy manager_scope_self_read on public.staff_manager_scope
  for select using (auth.uid() = manager_id);

grant select, insert, update, delete on public.staff_manager_scope to authenticated;
grant usage, select on sequence public.staff_manager_scope_id_seq to authenticated;


-- 2) 權限函式：是否可查看某 staff 的進度
create or replace function public.can_view_staff_progress(target_staff_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select
    -- 自己看自己
    auth.uid() = target_staff_id
    -- 管理員可看全部
    or public.is_admin()
    -- 主管可看轄下人員
    or exists (
      select 1
      from public.staff_manager_scope s
      where s.manager_id = auth.uid()
        and s.member_id = target_staff_id
        and s.active = true
    );
$$;


-- 3) learning_progress：加入「轄下可讀」策略（保留既有 self upsert）
drop policy if exists progress_scope_read on public.learning_progress;
create policy progress_scope_read on public.learning_progress
  for select using (public.can_view_staff_progress(staff_profile_id));


-- 4) staff_profiles：主管可讀轄下名單（顯示姓名/組織用）
drop policy if exists staff_profiles_scope_read on public.staff_profiles;
create policy staff_profiles_scope_read on public.staff_profiles
  for select using (public.can_view_staff_progress(id));


-- 5) 查詢用 View（前端直接 select 這個 view）
create or replace view public.v_team_learning_progress as
select
  lp.staff_profile_id,
  sp.display_name,
  sp.employee_no,
  sp.org_id,
  sp.rank,
  l.id as lesson_id,
  l.title as lesson_title,
  c.id as course_id,
  c.title as course_title,
  lp.watched_seconds,
  lp.duration_seconds,
  lp.progress_percent,
  lp.completed_at
from public.learning_progress lp
join public.staff_profiles sp on sp.id = lp.staff_profile_id
join public.lessons l on l.id = lp.lesson_id
join public.courses c on c.id = l.course_id;

grant select on public.v_team_learning_progress to authenticated;


-- 6) 驗證：目前登入者看得到哪些人
-- select distinct staff_profile_id, display_name, employee_no, org_id, rank
-- from public.v_team_learning_progress
-- order by display_name;


-- 7) 範例：指派某店長看兩位同仁（請替換成真實 UUID）
-- insert into public.staff_manager_scope (manager_id, member_id) values
-- ('<店長_UUID>', '<店員A_UUID>'),
-- ('<店長_UUID>', '<店員B_UUID>')
-- on conflict (manager_id, member_id) do update set active = true;
