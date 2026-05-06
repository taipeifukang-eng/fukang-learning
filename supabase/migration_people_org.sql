-- ============================================================
-- migration_people_org.sql
-- 員編與組織管理欄位調整
-- ============================================================

alter table public.staff_profiles
  add column if not exists employee_no text;

create unique index if not exists staff_profiles_employee_no_unique
  on public.staff_profiles (employee_no)
  where employee_no is not null;

alter table public.organizations
  add column if not exists code text,
  add column if not exists short_name text;

grant select, insert, update, delete on public.organizations to authenticated;
grant usage, select on sequence public.organizations_id_seq to authenticated;

create unique index if not exists organizations_code_unique
  on public.organizations (code)
  where code is not null;

update public.organizations
set code = case id
  when 1 then 'HQ'
  when 2 then 'TC'
  when 3 then 'TP'
  else concat('ORG', id)
end
where code is null;

update public.organizations
set short_name = name
where short_name is null;

insert into public.permissions (key, title) values
  ('orgs:view', '檢視組織管理'),
  ('orgs:edit', '編輯組織管理')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in ('orgs:view', 'orgs:edit')
where r.key = 'super_admin'
on conflict do nothing;
