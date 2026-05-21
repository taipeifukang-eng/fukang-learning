-- ================================================================
-- 為 staff_profiles 補 job_title（當前職位）欄位
-- 在 Supabase SQL Editor 執行此檔案
-- ================================================================

alter table public.staff_profiles
  add column if not exists job_title text not null default '';

comment on column public.staff_profiles.job_title is '當前職位名稱（同步自FK菁英業務管理網）';
