-- ============================================================
-- patch_permissions_v2.sql
-- 新增 categories:edit 與 progress:view 權限並指派給對應角色
-- 在 Supabase SQL Editor 執行
-- ============================================================

-- 1. 新增 permissions（若已存在則略過）
insert into public.permissions (key, title)
values
  ('categories:edit', '分類管理'),
  ('progress:view',   '查看學習進度')
on conflict (key) do nothing;

-- 2. 指派給 super_admin
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r, public.permissions p
where r.key = 'super_admin'
  and p.key in ('categories:edit', 'progress:view')
on conflict do nothing;

-- 3. 指派給 content_admin（分類編輯 + 進度查看）
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r, public.permissions p
where r.key = 'content_admin'
  and p.key in ('categories:edit', 'progress:view')
on conflict do nothing;

-- 4. 指派給 teacher（只給 progress:view）
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r, public.permissions p
where r.key = 'teacher'
  and p.key = 'progress:view'
on conflict do nothing;

-- 確認結果
select r.key as role, p.key as permission
from public.role_permissions rp
join public.roles r on r.id = rp.role_id
join public.permissions p on p.id = rp.permission_id
where p.key in ('categories:edit', 'progress:view')
order by r.key, p.key;
