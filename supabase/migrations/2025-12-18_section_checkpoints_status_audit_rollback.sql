-- ============================================
-- DOWN Migration: Rollback checkpoint status and audit
-- Date: 2025-12-18
-- Author: DB Architect Agent
--
-- Reverts:
--   1. DROP/RECREATE view_section_checkpoints (restore original)
--   2. DROP checkpoint_audit table
--   3. DROP indexes
--   4. ALTER section_checkpoints: remove completed_at, completed_by, updated_at
--
-- WARNING: This will DELETE all audit history!
-- ============================================

BEGIN;

-- ============================================
-- 1. DROP and RECREATE original view
-- ============================================

DROP VIEW IF EXISTS public.view_section_checkpoints;

CREATE VIEW public.view_section_checkpoints AS
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
  COALESCE(sc.custom_icon, ct.icon) AS icon,
  COALESCE(sc.custom_color, ct.color) AS color,
  sc.created_by,
  sc.created_at,
  COALESCE(
    (SELECT jsonb_agg(jsonb_build_object(
      'section_id', csl.section_id,
      'section_name', s.section_name
    ))
    FROM public.checkpoint_section_links csl
    JOIN public.sections s ON s.section_id = csl.section_id
    WHERE csl.checkpoint_id = sc.checkpoint_id),
    '[]'::jsonb
  ) AS linked_sections
FROM public.section_checkpoints sc
LEFT JOIN public.checkpoint_types ct ON ct.type_id = sc.type_id;

COMMENT ON VIEW public.view_section_checkpoints IS 'Checkpoints with resolved icon/color and linked sections';

-- ============================================
-- 2. DROP checkpoint_audit table
-- ============================================

DROP TABLE IF EXISTS public.checkpoint_audit;

-- ============================================
-- 3. DROP indexes on section_checkpoints
-- ============================================

DROP INDEX IF EXISTS public.idx_section_checkpoints_uncompleted;
DROP INDEX IF EXISTS public.idx_section_checkpoints_completed;
DROP INDEX IF EXISTS public.idx_section_checkpoints_completed_by;

-- ============================================
-- 4. DROP FK constraint before dropping column
-- ============================================

ALTER TABLE public.section_checkpoints
  DROP CONSTRAINT IF EXISTS section_checkpoints_completed_by_fkey;

-- ============================================
-- 5. ALTER section_checkpoints: remove new columns
-- ============================================

ALTER TABLE public.section_checkpoints
  DROP COLUMN IF EXISTS completed_at,
  DROP COLUMN IF EXISTS completed_by,
  DROP COLUMN IF EXISTS updated_at;

COMMIT;

-- ============================================
-- POST-ROLLBACK VERIFICATION
-- ============================================

/*
-- 1. Verify columns are removed
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'section_checkpoints'
ORDER BY ordinal_position;

-- 2. Verify checkpoint_audit table is dropped
SELECT EXISTS (
  SELECT 1 FROM pg_tables
  WHERE schemaname = 'public' AND tablename = 'checkpoint_audit'
) AS audit_table_exists;

-- 3. Verify view is restored to original
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'view_section_checkpoints'
ORDER BY ordinal_position;

-- Expected columns: checkpoint_id, section_id, type_id, type_code, type_name,
--                   is_custom, title, description, checkpoint_date, icon, color,
--                   created_by, created_at, linked_sections
*/
