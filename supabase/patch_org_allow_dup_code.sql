-- 移除 organizations.code 的唯一限制
-- 允許同一代號有多個部門（例如 0000 可同時有 營業部、行銷部）
--
-- 先找出目前的 unique constraint 名稱，再 DROP
DO $$
DECLARE
  cname text;
BEGIN
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
    RAISE NOTICE 'Dropped constraint: %', cname;
  ELSE
    RAISE NOTICE 'No unique constraint on code found (already removed or never existed)';
  END IF;
END;
$$;

-- 建議改用 (code, short_name) 聯合唯一，避免完全重複的資料
-- 若不需要聯合唯一限制，可把下面這行也一起執行
-- ALTER TABLE public.organizations ADD CONSTRAINT organizations_code_shortname_unique UNIQUE (code, short_name);
