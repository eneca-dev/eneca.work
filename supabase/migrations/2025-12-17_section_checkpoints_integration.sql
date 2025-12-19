-- ============================================
-- CHECKPOINT TYPES (Predefined milestone types)
-- ============================================

CREATE TABLE public.checkpoint_types (
  type_id uuid NOT NULL DEFAULT gen_random_uuid(),
  type text NOT NULL UNIQUE,              -- 'task_transfer', 'section_end', 'custom'
  name text NOT NULL,                     -- 'Передача задания', 'Конец раздела', ''
  icon text NOT NULL,                     -- Lucide icon name
  color text NOT NULL DEFAULT '#6B7280',  -- hex color
  description text,
  is_custom boolean NOT NULL DEFAULT false, -- true ONLY for 'custom' type
  created_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT checkpoint_types_pkey PRIMARY KEY (type_id)
);

COMMENT ON TABLE checkpoint_types IS 'Predefined checkpoint types (task_transfer, section_end) and custom placeholder';
COMMENT ON COLUMN checkpoint_types.is_custom IS 'true for "custom" type, false for predefined types';

-- ============================================
-- SECTION CHECKPOINTS (Main checkpoints table)
-- ============================================

CREATE TABLE public.section_checkpoints (
  checkpoint_id uuid NOT NULL DEFAULT gen_random_uuid(),
  
  -- Parent section (owner)
  section_id uuid NOT NULL,
  
  -- Type reference
  type_id uuid NOT NULL,
  
  -- Checkpoint data
  title text NOT NULL,
  description text,
  checkpoint_date date NOT NULL,
  
  -- Custom overrides (for custom checkpoints only, NULL for predefined)
  custom_icon text,
  custom_color text,
  
  -- Audit
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT section_checkpoints_pkey PRIMARY KEY (checkpoint_id),
  CONSTRAINT section_checkpoints_section_fkey 
    FOREIGN KEY (section_id) REFERENCES sections(section_id) ON DELETE CASCADE,
  CONSTRAINT section_checkpoints_type_fkey 
    FOREIGN KEY (type_id) REFERENCES checkpoint_types(type_id) ON DELETE RESTRICT,
  CONSTRAINT section_checkpoints_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES profiles(user_id) ON DELETE SET NULL
);

COMMENT ON TABLE section_checkpoints IS 'Project milestone checkpoints with parent section ownership';
COMMENT ON COLUMN section_checkpoints.custom_icon IS 'Lucide icon override for custom checkpoints (NULL for predefined)';
COMMENT ON COLUMN section_checkpoints.custom_color IS 'Hex color override for custom checkpoints (NULL for predefined)';

-- Essential indexes
CREATE INDEX idx_section_checkpoints_section ON section_checkpoints(section_id);
CREATE INDEX idx_section_checkpoints_type ON section_checkpoints(type_id);
CREATE INDEX idx_section_checkpoints_date ON section_checkpoints(checkpoint_date);
CREATE INDEX idx_section_checkpoints_created_by ON section_checkpoints(created_by) WHERE created_by IS NOT NULL;

-- ============================================
-- CHECKPOINT SECTION LINKS (M:N linked sections)
-- ============================================

CREATE TABLE public.checkpoint_section_links (
  checkpoint_id uuid NOT NULL,
  section_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT checkpoint_section_links_pkey PRIMARY KEY (checkpoint_id, section_id),
  CONSTRAINT checkpoint_section_links_checkpoint_fkey 
    FOREIGN KEY (checkpoint_id) REFERENCES section_checkpoints(checkpoint_id) ON DELETE CASCADE,
  CONSTRAINT checkpoint_section_links_section_fkey 
    FOREIGN KEY (section_id) REFERENCES sections(section_id) ON DELETE CASCADE
);

COMMENT ON TABLE checkpoint_section_links IS 'Additional sections affected by checkpoint (beyond parent)';

-- Index for reverse lookup
CREATE INDEX idx_checkpoint_section_links_section ON checkpoint_section_links(section_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- ALTER TABLE checkpoint_types ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE section_checkpoints ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE checkpoint_section_links ENABLE ROW LEVEL SECURITY;

-- -- Checkpoint Types: Everyone can read non-custom types
-- CREATE POLICY "Anyone can view predefined checkpoint types"
--   ON checkpoint_types FOR SELECT
--   USING (is_custom = false);

-- -- Custom type visible to all (needed for FK constraint)
-- CREATE POLICY "Anyone can view custom type"
--   ON checkpoint_types FOR SELECT
--   USING (is_custom = true);

-- -- Only admins can modify types
-- CREATE POLICY "Admins can manage checkpoint types"
--   ON checkpoint_types FOR ALL
--   USING (
--     EXISTS (
--       SELECT 1 FROM user_permissions_cache
--       WHERE user_id = auth.uid()
--       AND permissions @> '["checkpoints.types.manage"]'::jsonb
--     )
--   );

-- -- Section Checkpoints: Based on section access (simplified - adjust to your permission model)
-- CREATE POLICY "Users can view checkpoints for accessible sections"
--   ON section_checkpoints FOR SELECT
--   USING (true); -- TODO: Add your section access logic

-- CREATE POLICY "Users can create checkpoints"
--   ON section_checkpoints FOR INSERT
--   WITH CHECK (created_by = auth.uid());

-- CREATE POLICY "Users can delete own checkpoints"
--   ON section_checkpoints FOR DELETE
--   USING (created_by = auth.uid());

-- -- Section Links: Inherit checkpoint policy
-- CREATE POLICY "Inherit checkpoint access for links"
--   ON checkpoint_section_links FOR ALL
--   USING (
--     EXISTS (
--       SELECT 1 FROM section_checkpoints sc
--       WHERE sc.checkpoint_id = checkpoint_section_links.checkpoint_id
--     )
--   );

-- ============================================
-- SEED DATA: Predefined checkpoint types
-- ============================================

INSERT INTO checkpoint_types (type, name, icon, color, description, is_custom) VALUES
  ('task_transfer', 'Передача задания', 'ArrowRightFromLine', '#f97316', 'Передача задания в другой раздел', false),
  ('section_end', 'Конец раздела', 'Flag', '#ef4444', 'Завершение работы по разделу', false),
  ('custom', '', 'Bookmark', '#6B7280', 'Пользовательский чекпоинт (не отображается в UI)', true);

-- ============================================
-- HELPER VIEW: Checkpoints with resolved icons/colors
-- ============================================

CREATE OR REPLACE VIEW view_section_checkpoints AS
SELECT 
  sc.checkpoint_id,
  sc.section_id,
  sc.type_id,
  ct.type AS type_code,
  ct.name AS type_name,
  ct.is_custom,
  sc.title,
  sc.description,
  sc.checkpoint_date,
  
  -- Resolved icon/color (custom override OR type default)
  COALESCE(sc.custom_icon, ct.icon) AS icon,
  COALESCE(sc.custom_color, ct.color) AS color,
  
  sc.created_by,
  sc.created_at,
  
  -- Aggregate linked sections as JSON array
  COALESCE(
    (SELECT jsonb_agg(jsonb_build_object(
      'section_id', csl.section_id,
      'section_name', s.section_name
    ))
    FROM checkpoint_section_links csl
    JOIN sections s ON s.section_id = csl.section_id
    WHERE csl.checkpoint_id = sc.checkpoint_id),
    '[]'::jsonb
  ) AS linked_sections
FROM section_checkpoints sc
LEFT JOIN checkpoint_types ct ON ct.type_id = sc.type_id;

COMMENT ON VIEW view_section_checkpoints IS 'Checkpoints with resolved icon/color and linked sections';
🧪 Test Queries

-- 1. Verify tables and indexes
SELECT tablename, indexname, indexdef 
FROM pg_indexes 
WHERE schemaname = 'public'
AND tablename IN ('checkpoint_types', 'section_checkpoints', 'checkpoint_section_links')
ORDER BY tablename, indexname;

-- 2. Test predefined checkpoint creation
INSERT INTO section_checkpoints (
  section_id, 
  type_id, 
  title, 
  checkpoint_date, 
  created_by
)
SELECT 
  (SELECT section_id FROM sections LIMIT 1),
  (SELECT type_id FROM checkpoint_types WHERE type = 'task_transfer'),
  'Test: Передача в ГИП',
  '2025-01-15',
  auth.uid();

-- 3. Test custom checkpoint creation
INSERT INTO section_checkpoints (
  section_id, 
  type_id, 
  title, 
  checkpoint_date, 
  custom_icon,
  custom_color,
  created_by
)
SELECT 
  (SELECT section_id FROM sections LIMIT 1),
  (SELECT type_id FROM checkpoint_types WHERE type = 'custom'),
  'Custom: Митинг с заказчиком',
  '2025-02-01',
  'Users',
  '#3b82f6',
  auth.uid();

-- 4. Query from view (frontend will use this)
SELECT * FROM view_section_checkpoints
WHERE section_id = 'your-section-uuid'
ORDER BY checkpoint_date;

-- 5. Verify icon/color resolution
SELECT 
  title,
  type_code,
  custom_icon,
  custom_color,
  icon AS resolved_icon,
  color AS resolved_color
FROM view_section_checkpoints;