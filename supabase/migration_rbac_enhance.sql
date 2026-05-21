-- ================================================================
-- RBAC 增強：為 permissions / roles / user_roles 補欄位
-- 在 Supabase SQL Editor 執行此檔案
-- ================================================================

-- 1. permissions 補 description + category
alter table public.permissions
  add column if not exists description text not null default '',
  add column if not exists category    text not null default '一般';

-- 2. roles 補 enabled + is_system
alter table public.roles
  add column if not exists enabled   boolean not null default true,
  add column if not exists is_system boolean not null default false;

-- 系統內建角色標記為 is_system
update public.roles
  set is_system = true
  where key in ('super_admin', 'content_admin', 'Supervision', 'student');

-- 3. user_roles 補 created_at（若尚無）
alter table public.user_roles
  add column if not exists created_at timestamptz not null default now();

-- ================================================================
-- 4. 補充各 permission 的 category + description
-- ================================================================
update public.permissions set category = '儀表板', description = '進入後台管理首頁'           where key = 'dashboard:view';

update public.permissions set category = '人員管理', description = '查看所有人員帳號列表'       where key = 'staff:view';
update public.permissions set category = '人員管理', description = '啟用或停用人員登入權限'      where key = 'staff:toggle';
update public.permissions set category = '人員管理', description = '指派人員的平台角色'          where key = 'staff:assign_role';
update public.permissions set category = '人員管理', description = '將人員編制到組織/門市'       where key = 'staff:assign_org';

update public.permissions set category = '角色權限', description = '查看角色與權限設定頁'       where key = 'roles:view';
update public.permissions set category = '角色權限', description = '為人員指派或移除角色'        where key = 'roles:assign';

update public.permissions set category = '課程管理', description = '查看課程清單'               where key = 'courses:view';
update public.permissions set category = '課程管理', description = '新增、編輯或刪除課程與影片'  where key = 'courses:edit';

update public.permissions set category = '測驗管理', description = '建立與編輯課後測驗題目'      where key = 'quiz:edit';
update public.permissions set category = '測驗管理', description = '進行課後測驗作答'            where key = 'quiz:attempt';

update public.permissions set category = '學習專區', description = '進入學習專區瀏覽課程'        where key = 'learning:view';

update public.permissions set category = '組織管理', description = '查看組織/門市列表'           where key = 'orgs:view';
update public.permissions set category = '組織管理', description = '新增、編輯或刪除組織'         where key = 'orgs:edit';

update public.permissions set category = '分類管理', description = '新增、編輯或刪除課程分類'    where key = 'categories:edit';

update public.permissions set category = '學習進度', description = '查看個人學習進度報表'         where key = 'progress:view';
update public.permissions set category = '學習進度', description = '查看管轄範圍內的人員學習進度' where key = 'team_progress:view';

-- ================================================================
-- 5. 更名角色：教師 → 督導
-- ================================================================
update public.roles set key = 'Supervision', title = '督導', description = '可建立課程，並查看學員學習進度。'
  where key = 'teacher';
