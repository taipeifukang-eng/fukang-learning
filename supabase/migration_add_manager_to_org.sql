-- ================================================================
-- 新增：organizations 表的「經理」欄位
-- 經理 > 督導/副理 > 店長（組織指派範圍）的階層架構
-- 執行方式：至 Supabase Dashboard → SQL Editor → 貼上執行
-- ================================================================

alter table public.organizations
  add column if not exists manager text not null default '';
