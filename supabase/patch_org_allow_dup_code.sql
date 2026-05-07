-- 調整 organizations.code 唯一規則：
--   代號 0000（總部用）可重複（允許多個總部部門）
--   其他代號（門市）仍強制唯一
--
-- ★ 請直接到 Supabase Dashboard → SQL Editor 貼上並執行此檔案

-- Step 1：移除所有舊的 UNIQUE constraint（不管名稱為何）
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.organizations'::regclass
      AND contype IN ('u', 'p')
      AND conkey @> ARRAY(
        SELECT attnum FROM pg_attribute
        WHERE attrelid = 'public.organizations'::regclass
          AND attname = 'code'
      )
      AND conname <> 'organizations_pkey'
  LOOP
    EXECUTE format('ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS %I', rec.conname);
    RAISE NOTICE 'Dropped constraint: %', rec.conname;
  END LOOP;
END;
$$;

-- Step 2：移除所有舊的 code 相關唯一索引
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'organizations'
      AND indexdef ILIKE '%unique%'
      AND indexdef ILIKE '%code%'
      AND indexname NOT ILIKE '%pkey%'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', rec.indexname);
    RAISE NOTICE 'Dropped index: %', rec.indexname;
  END LOOP;
END;
$$;

-- Step 3：建立部分唯一索引 — 只有 code 不等於 '0000' 時才強制唯一
DROP INDEX IF EXISTS public.organizations_code_unique_nonzero;
CREATE UNIQUE INDEX organizations_code_unique_nonzero
  ON public.organizations (code)
  WHERE code <> '0000';
