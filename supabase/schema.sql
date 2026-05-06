create table if not exists public.staff_profiles (
  id uuid primary key default gen_random_uuid(),
  line_user_id text unique not null,
  display_name text not null,
  email text,
  department text,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.roles (
  id bigint generated always as identity primary key,
  key text unique not null,
  title text not null,
  description text
);

create table if not exists public.permissions (
  id bigint generated always as identity primary key,
  key text unique not null,
  title text not null
);

create table if not exists public.role_permissions (
  role_id bigint not null references public.roles(id) on delete cascade,
  permission_id bigint not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table if not exists public.user_roles (
  staff_profile_id uuid not null references public.staff_profiles(id) on delete cascade,
  role_id bigint not null references public.roles(id) on delete cascade,
  primary key (staff_profile_id, role_id)
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  description text,
  audience text,
  enabled boolean not null default true,
  cover_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  summary text,
  duration_minutes integer not null default 0,
  video_provider text not null default 'bunny',
  bunny_video_id text not null,
  sort_order integer not null default 0
);

create table if not exists public.learning_progress (
  staff_profile_id uuid not null references public.staff_profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed_at timestamptz,
  progress_percent integer not null default 0,
  primary key (staff_profile_id, lesson_id)
);

-- 啟用 RLS（策略在 policies_v2.sql 中定義）
alter table public.staff_profiles enable row level security;
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.learning_progress enable row level security;

drop policy if exists staff_profiles_self_read on public.staff_profiles;
create policy staff_profiles_self_read on public.staff_profiles
for select
using (auth.uid()::text = id::text);

drop policy if exists courses_authenticated_read on public.courses;
create policy courses_authenticated_read on public.courses
for select
using (auth.role() = 'authenticated');

drop policy if exists lessons_authenticated_read on public.lessons;
create policy lessons_authenticated_read on public.lessons
for select
using (auth.role() = 'authenticated');

drop policy if exists progress_self_rw on public.learning_progress;
create policy progress_self_rw on public.learning_progress
for all
using (auth.uid()::text = staff_profile_id::text)
with check (auth.uid()::text = staff_profile_id::text);