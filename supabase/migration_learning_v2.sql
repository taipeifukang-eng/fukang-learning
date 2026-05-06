-- ============================================================
-- migration_learning_v2.sql
-- 在 Supabase SQL Editor 執行（schema.sql 與 policies_v2.sql 之後）
-- ============================================================

-- ── 1. 分類管理 ──────────────────────────────────────────────
create table if not exists public.categories (
  id   serial primary key,
  name text not null,
  sort_order integer not null default 0,
  enabled boolean not null default true
);

-- 基本 RLS
alter table public.categories enable row level security;

drop policy if exists categories_authenticated_read on public.categories;
create policy categories_authenticated_read on public.categories
  for select using (auth.role() = 'authenticated');

drop policy if exists categories_admin_all on public.categories;
create policy categories_admin_all on public.categories
  for all using (public.is_admin());

grant select on public.categories to authenticated;
grant insert, update, delete on public.categories to authenticated;
grant usage, select on sequence public.categories_id_seq to authenticated;


-- ── 2. courses 表：加入 category_id、封面 URL ────────────────
-- 保留既有 category (text) 作為備份欄位，新增 category_id FK
alter table public.courses
  add column if not exists category_id integer references public.categories(id) on delete set null;

-- 移除舊的純文字 audience 欄位（改用 course_audiences 表）
-- 注意：先備份再刪，這裡用 rename 保留資料
alter table public.courses
  rename column audience to audience_legacy;

-- 補上影片封面 URL（舊欄位是 cover_url，可能已存在）
alter table public.courses
  add column if not exists cover_url text;


-- ── 3. course_audiences：指定學習對象 ────────────────────────
-- audience_type: 'all' | 'org' | 'role'
-- audience_id: org_id 或 role_id；'all' 時為 null
create table if not exists public.course_audiences (
  id          serial primary key,
  course_id   uuid not null references public.courses(id) on delete cascade,
  audience_type text not null check (audience_type in ('all', 'org', 'role')),
  audience_id integer  -- org.id 或 role.id；all 時為 null
);

create unique index if not exists uq_course_audience
  on public.course_audiences (course_id, audience_type, coalesce(audience_id, -1));

alter table public.course_audiences enable row level security;

drop policy if exists course_audiences_authenticated_read on public.course_audiences;
create policy course_audiences_authenticated_read on public.course_audiences
  for select using (auth.role() = 'authenticated');

drop policy if exists course_audiences_admin_all on public.course_audiences;
create policy course_audiences_admin_all on public.course_audiences
  for all using (public.is_admin());

grant select on public.course_audiences to authenticated;
grant insert, update, delete on public.course_audiences to authenticated;
grant usage, select on sequence public.course_audiences_id_seq to authenticated;


-- ── 4. learning_progress：精準完成判定 ───────────────────────
-- 新增欄位：watched_seconds（高水位線）、duration_seconds（影片全長）
-- completed_at 已存在；progress_percent 改由前端自 watched/duration 計算

alter table public.learning_progress
  add column if not exists watched_seconds  integer not null default 0,
  add column if not exists duration_seconds integer not null default 0;

-- 管理員可讀全部進度（policies_v2 已有 progress_admin_read for SELECT）
-- 補上管理員可 INSERT / UPDATE（跨使用者審閱時需要）
drop policy if exists progress_admin_write on public.learning_progress;
create policy progress_admin_write on public.learning_progress
  for all using (public.is_admin())
  with check (public.is_admin());


-- ── 5. lessons：補充欄位 ─────────────────────────────────────
-- 補 duration_seconds（秒數，比 duration_minutes 更精確）
alter table public.lessons
  add column if not exists duration_seconds integer not null default 0,
  add column if not exists cover_url text;


-- ── 6. 讓學員自己能讀/寫自己的進度（原 progress_self_rw 已存在）─
-- 確認學員能 INSERT 新紀錄（避免 policy 衝突）
drop policy if exists progress_self_rw on public.learning_progress;
create policy progress_self_rw on public.learning_progress
  for all
  using  (auth.uid()::text = staff_profile_id::text)
  with check (auth.uid()::text = staff_profile_id::text);

grant select, insert, update on public.learning_progress to authenticated;
