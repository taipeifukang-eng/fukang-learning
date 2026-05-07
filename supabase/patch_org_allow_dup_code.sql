-- 調整 organizations.code 唯一規則：
--   代號 0000（總部用）可重複（允許多個總部部門）
--   其他代號（門市）仍強制唯一
--
-- Step 1：移除舊的全域唯一限制
DO $$
DECLARE
  cname text;
BEGIN
  -- 找 UNIQUE constraint
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.organizations'::regclass
    AND contype = 'u'
    AND conkey = ARRAY(
      SELECT attnum FROM pg_attribute
      WHERE attrelid = 'public.organizations'::regclass
        AND attname = 'code'
    );

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.organizations DROP CONSTRAINT %I', cname);
    RAISE NOTICE 'Dropped full-unique constraint: %', cname;
  ELSE
    RAISE NOTICE 'No simple unique constraint on code found';
  END IF;

  -- 也嘗試移除舊的全域唯一索引（如果是用 CREATE UNIQUE INDEX 建立的）
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'organizations'
      AND indexname = 'organizations_code_key'
  ) THEN
    DROP INDEX IF EXISTS organizations_code_key;
    RAISE NOTICE 'Dropped index: organizations_code_key';
  END IF;
END;
$$;

-- Step 2：移除舊的部分唯一索引（如果重複執行此腳本）
DROP INDEX IF EXISTS public.organizations_code_unique_nonzero;

-- Step 3：建立部分唯一索引 — 只有 code 不等於 '0000' 時才強制唯一
--   代號 0000 可以有多筆（總部多個部門）
--   其他代號仍不能重複
CREATE UNIQUE INDEX organizations_code_unique_nonzero
  ON public.organizations (code)
  WHERE code <> '0000';
