-- ============================================================
-- patch_lesson_scripts.sql
-- 教學腳本設計：課程影片腳本、演員名單、拍攝完成與影片檔名流水號
-- 在 Supabase SQL Editor 執行
-- ============================================================

create table if not exists public.lesson_scripts (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete set null,
  topic text not null default '',
  learning_item text not null default '',
  script_body text not null default '',
  actors jsonb not null default '[]'::jsonb,
  shooting_completed boolean not null default false,
  video_file_name text not null default '',
  sequence_no integer not null default 0,
  notes text not null default '',
  created_by uuid references public.staff_profiles(id) on delete set null,
  updated_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lesson_scripts_course_id on public.lesson_scripts(course_id);
create index if not exists idx_lesson_scripts_lesson_id on public.lesson_scripts(lesson_id);
create index if not exists idx_lesson_scripts_completed on public.lesson_scripts(shooting_completed);
create unique index if not exists uq_lesson_scripts_lesson_id
  on public.lesson_scripts(lesson_id)
  where lesson_id is not null;

create or replace function public.set_lesson_scripts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_lesson_scripts_updated_at on public.lesson_scripts;
create trigger trg_lesson_scripts_updated_at
before update on public.lesson_scripts
for each row execute function public.set_lesson_scripts_updated_at();

alter table public.lesson_scripts enable row level security;

drop policy if exists lesson_scripts_authenticated_read on public.lesson_scripts;
create policy lesson_scripts_authenticated_read on public.lesson_scripts
  for select using (auth.role() = 'authenticated');

drop policy if exists lesson_scripts_admin_all on public.lesson_scripts;
create policy lesson_scripts_admin_all on public.lesson_scripts
  for all using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.lesson_scripts to authenticated;
