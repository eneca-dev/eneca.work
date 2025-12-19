-- ============================================
-- Migration: Checkpoints Additions
-- Date: 2025-12-18
--
-- Changes:
--   1. Add created_by column to checkpoint_types (for tracking custom type creators)
--   2. Add checkpoint tables to Realtime publication
-- ============================================

BEGIN;

-- ============================================
-- 1. Add created_by to checkpoint_types
-- ============================================

-- Add column
ALTER TABLE public.checkpoint_types
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- Add FK constraint (only if column was just added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'checkpoint_types_created_by_fkey'
    AND table_name = 'checkpoint_types'
  ) THEN
    ALTER TABLE public.checkpoint_types
      ADD CONSTRAINT checkpoint_types_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES public.profiles(user_id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.checkpoint_types.created_by IS 'User who created custom checkpoint type (NULL for built-in types)';

-- Index for FK lookup (partial - only non-null values)
CREATE INDEX IF NOT EXISTS idx_checkpoint_types_created_by
  ON public.checkpoint_types(created_by)
  WHERE created_by IS NOT NULL;

-- ============================================
-- 2. Add tables to Realtime publication
-- ============================================

-- Add tables to supabase_realtime publication (ignore if already added)
DO $$
BEGIN
  -- checkpoint_types
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'checkpoint_types'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.checkpoint_types;
  END IF;

  -- section_checkpoints
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'section_checkpoints'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.section_checkpoints;
  END IF;

  -- checkpoint_section_links
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'checkpoint_section_links'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.checkpoint_section_links;
  END IF;

  -- checkpoint_audit
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'checkpoint_audit'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.checkpoint_audit;
  END IF;
END $$;

COMMIT;

-- ============================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================

/*
-- 1. Verify created_by column
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'checkpoint_types' AND column_name = 'created_by';
-- Expected: created_by | uuid | YES

-- 2. Verify FK constraint
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'checkpoint_types' AND constraint_name = 'checkpoint_types_created_by_fkey';
-- Expected: checkpoint_types_created_by_fkey | FOREIGN KEY

-- 3. Verify index
SELECT indexname FROM pg_indexes
WHERE tablename = 'checkpoint_types' AND indexname = 'idx_checkpoint_types_created_by';
-- Expected: idx_checkpoint_types_created_by

-- 4. Verify Realtime publication
SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('checkpoint_types', 'section_checkpoints', 'checkpoint_section_links', 'checkpoint_audit');
-- Expected: 4 rows
*/
