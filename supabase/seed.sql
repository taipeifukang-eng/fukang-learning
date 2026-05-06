-- ============================================================
-- seed.sql
-- 初始角色與權限資料，在 Supabase SQL Editor 執行
-- ============================================================

-- ── 權限清單 ─────────────────────────────────────────────────
insert into public.permissions (key, title) values
  ('dashboard:view',  '檢視儀表板'),
  ('staff:view',      '檢視人員清單'),
  ('staff:toggle',    '啟用/停用人員'),
  ('roles:view',      '檢視角色設定'),
  ('roles:assign',    '指派角色給人員'),
  ('courses:view',    '檢視課程清單'),
  ('courses:edit',    '新增/編輯課程'),
  ('quiz:edit',       '編輯課後測驗'),
  ('quiz:attempt',    '進行課後測驗'),
  ('learning:view',   '瀏覽學習課程')
on conflict (key) do nothing;

-- ── 角色清單 ─────────────────────────────────────────────────
insert into public.roles (key, title, description) values
  ('super_admin',    '系統管理員', '管理整體平台設定、權限、人員與課程內容。'),
  ('content_admin',  '內容管理員', '維護課程與影片清單，但不處理角色指派。'),
  ('teacher',        '教師',       '可建立課程，並查看學員學習進度。'),
  ('student',        '學員',       '僅限存取學習課程頁面。')
on conflict (key) do nothing;

-- ── 角色 ↔ 權限 對應 ─────────────────────────────────────────
-- super_admin：全部權限
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r, public.permissions p
where r.key = 'super_admin'
on conflict do nothing;

-- content_admin
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'dashboard:view', 'courses:view', 'courses:edit', 'quiz:edit', 'quiz:attempt', 'learning:view'
)
where r.key = 'content_admin'
on conflict do nothing;

-- teacher
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'dashboard:view', 'courses:view', 'courses:edit', 'quiz:edit', 'quiz:attempt', 'learning:view'
)
where r.key = 'teacher'
on conflict do nothing;

-- student
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in ('learning:view', 'quiz:attempt')
where r.key = 'student'
on conflict do nothing;
