-- 為課程新增「學習方塊」標籤欄位
-- 例如：{'store-newcomer', 'store-general'}
ALTER TABLE courses ADD COLUMN IF NOT EXISTS portal_sections text[] DEFAULT '{}';

-- GIN 索引加速 @> 查詢
CREATE INDEX IF NOT EXISTS idx_courses_portal_sections ON courses USING GIN (portal_sections);
