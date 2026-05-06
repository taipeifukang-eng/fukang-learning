-- ============================================================
-- patch_quiz_rbac_permissions.sql
-- 套用測驗 RBAC 權限：教師可編輯、學生可作答
-- ============================================================

-- 1) 權限鍵
insert into public.permissions (key, title) values
  ('quiz:edit', '編輯課後測驗'),
  ('quiz:attempt', '進行課後測驗')
on conflict (key) do nothing;

-- 2) 角色權限綁定
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

-- 3) 重新建立 quiz 相關 RLS policy（permission-based）
-- 先清除這五張表的所有既有 policy，避免舊政策殘留引用不存在物件（例如 profiles）
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

-- 補齊角色權限（RLS 之外仍需 GRANT）
grant select, insert, update, delete on public.quizzes to authenticated;
grant select, insert, update, delete on public.quiz_questions to authenticated;
grant select, insert, update, delete on public.quiz_options to authenticated;
grant select, insert, update, delete on public.quiz_attempts to authenticated;
grant select, insert, update, delete on public.quiz_answers to authenticated;

-- 3-1) 權限函式：以 SECURITY DEFINER 避免 policy 內 join RBAC 表時被 RLS 交互影響
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

create policy quiz_answers_self on public.quiz_answers
  for all using (
    public.has_permission('quiz:attempt')
    and exists (
      select 1
      from public.quiz_attempts qa
      where qa.id = attempt_id
        and qa.staff_profile_id = auth.uid()::uuid
    )
  )
  with check (
    public.has_permission('quiz:attempt')
    and exists (
      select 1
      from public.quiz_attempts qa
      where qa.id = attempt_id
        and qa.staff_profile_id = auth.uid()::uuid
    )
  );

create policy quiz_answers_admin_read on public.quiz_answers
  for select using (
    public.has_permission('quiz:edit')
  );
