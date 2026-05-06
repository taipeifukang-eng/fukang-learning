-- ============================================================
-- 課後測驗系統 Migration
-- ============================================================

-- 1. 測驗主表（每個 lesson 對應一份測驗）
create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  title text not null default '課後測驗',
  pass_score integer not null default 85,  -- 通過分數，預設 85
  enabled boolean not null default true,
  created_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id)  -- 每個 lesson 只能有一份測驗
);

-- 2. 題目表
create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  sort_order integer not null default 0,
  question_text text not null,
  question_type text not null default 'single',  -- 'single' | 'multiple' | 'truefalse'
  points integer not null default 10,             -- 此題配分
  explanation text                                -- 解析說明（答完後顯示）
);

-- 3. 選項表
create table if not exists public.quiz_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  sort_order integer not null default 0,
  option_text text not null,
  is_correct boolean not null default false
);

-- 4. 考試紀錄（每次作答記一筆）
create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  staff_profile_id uuid not null references public.staff_profiles(id) on delete cascade,
  attempt_no integer not null default 1,          -- 第幾次作答
  score integer not null default 0,               -- 本次得分（0-100）
  passed boolean not null default false,          -- 是否達通過分數
  started_at timestamptz not null default now(),
  submitted_at timestamptz                        -- 提交時間（null 表示未完成）
);

-- 5. 每次作答的答案明細
create table if not exists public.quiz_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  selected_option_ids uuid[] not null default '{}',  -- 選取的選項 id 陣列
  is_correct boolean not null default false
);

-- 6. 權限鍵（RBAC）
insert into public.permissions (key, title) values
  ('quiz:edit', '編輯課後測驗'),
  ('quiz:attempt', '進行課後測驗')
on conflict (key) do nothing;

-- 指派既有角色權限：teacher/content_admin/super_admin 可編輯；student 可作答
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in ('quiz:edit', 'quiz:attempt')
where r.key in ('super_admin', 'content_admin', 'teacher')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key = 'quiz:attempt'
where r.key = 'student'
on conflict do nothing;

-- ── RLS ──────────────────────────────────────────────────────

alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_options enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_answers enable row level security;

-- 既有環境可重複執行：先移除這五張表全部 policy，避免殘留舊規則
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('quizzes', 'quiz_questions', 'quiz_options', 'quiz_attempts', 'quiz_answers')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

grant select, insert, update, delete on public.quizzes to authenticated;
grant select, insert, update, delete on public.quiz_questions to authenticated;
grant select, insert, update, delete on public.quiz_options to authenticated;
grant select, insert, update, delete on public.quiz_attempts to authenticated;
grant select, insert, update, delete on public.quiz_answers to authenticated;

create or replace function public.has_permission(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.staff_profile_id = auth.uid()::uuid
      and p.key = p_key
  );
$$;

grant execute on function public.has_permission(text) to authenticated;

-- quizzes：所有已登入者可讀，管理員可寫
create policy quizzes_read on public.quizzes
  for select using (
    public.has_permission('quiz:attempt') or public.has_permission('quiz:edit')
  );

create policy quizzes_admin_write on public.quizzes
  for all using (
    public.has_permission('quiz:edit')
  )
  with check (
    public.has_permission('quiz:edit')
  );

-- quiz_questions：同上
create policy quiz_questions_read on public.quiz_questions
  for select using (
    public.has_permission('quiz:attempt') or public.has_permission('quiz:edit')
  );

create policy quiz_questions_admin_write on public.quiz_questions
  for all using (
    public.has_permission('quiz:edit')
  )
  with check (
    public.has_permission('quiz:edit')
  );

-- quiz_options：同上
create policy quiz_options_read on public.quiz_options
  for select using (
    public.has_permission('quiz:attempt') or public.has_permission('quiz:edit')
  );

create policy quiz_options_admin_write on public.quiz_options
  for all using (
    public.has_permission('quiz:edit')
  )
  with check (
    public.has_permission('quiz:edit')
  );

-- quiz_attempts：自己可讀寫，管理員可讀所有
create policy quiz_attempts_self on public.quiz_attempts
  for all using (
    staff_profile_id = auth.uid()::uuid
    and public.has_permission('quiz:attempt')
  )
  with check (
    staff_profile_id = auth.uid()::uuid
    and public.has_permission('quiz:attempt')
  );

create policy quiz_attempts_admin_read on public.quiz_attempts
  for select using (
    public.has_permission('quiz:edit')
  );

-- quiz_answers：自己可讀寫，管理員可讀所有
create policy quiz_answers_self on public.quiz_answers
  for all using (
    public.has_permission('quiz:attempt')
    and
    exists (
      select 1 from public.quiz_attempts qa
      where qa.id = attempt_id
        and qa.staff_profile_id = auth.uid()::uuid
    )
  )
  with check (
    public.has_permission('quiz:attempt')
    and
    exists (
      select 1 from public.quiz_attempts qa
      where qa.id = attempt_id
        and qa.staff_profile_id = auth.uid()::uuid
    )
  );

create policy quiz_answers_admin_read on public.quiz_answers
  for select using (
    public.has_permission('quiz:edit')
  );
