-- ============================================
-- UP Migration: Add checkpoint status tracking and audit history
-- Date: 2025-12-18
-- Author: DB Architect Agent
--
-- Changes:
--   1. ALTER section_checkpoints: add completed_at, completed_by, updated_at
--   2. CREATE checkpoint_audit table (event-based, 50 entries max per checkpoint)
--   3. DROP/RECREATE view_section_checkpoints with:
--      - Computed status (pending, completed, completed_late, overdue)
--      - Status label in Russian
--      - Permission context (section_responsible, project_manager)
--      - Linked sections aggregation
--   4. ADD indexes for performance
-- ============================================

BEGIN;

-- ============================================
-- 1. ALTER section_checkpoints table
-- ============================================

-- Add completion tracking columns
ALTER TABLE public.section_checkpoints
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Add foreign key for completed_by
ALTER TABLE public.section_checkpoints
  ADD CONSTRAINT section_checkpoints_completed_by_fkey
  FOREIGN KEY (completed_by) REFERENCES public.profiles(user_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.section_checkpoints.completed_at IS 'Timestamp when checkpoint was marked as completed (NULL = pending)';
COMMENT ON COLUMN public.section_checkpoints.completed_by IS 'User who marked checkpoint as completed';
COMMENT ON COLUMN public.section_checkpoints.updated_at IS 'Last modification timestamp';

-- Add partial index for uncompleted checkpoints (frequently queried)
CREATE INDEX IF NOT EXISTS idx_section_checkpoints_uncompleted
  ON public.section_checkpoints(section_id, checkpoint_date)
  WHERE completed_at IS NULL;

-- Add partial index for completed checkpoints
CREATE INDEX IF NOT EXISTS idx_section_checkpoints_completed
  ON public.section_checkpoints(completed_at)
  WHERE completed_at IS NOT NULL;

-- Add index on completed_by for FK lookups
CREATE INDEX IF NOT EXISTS idx_section_checkpoints_completed_by
  ON public.section_checkpoints(completed_by)
  WHERE completed_by IS NOT NULL;

-- ============================================
-- 2. CREATE checkpoint_audit table
-- ============================================

CREATE TABLE IF NOT EXISTS public.checkpoint_audit (
  audit_id uuid NOT NULL DEFAULT gen_random_uuid(),
  checkpoint_id uuid NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  operation_type text NOT NULL,
  field_name text NOT NULL,
  old_value text,
  new_value text,

  CONSTRAINT checkpoint_audit_pkey PRIMARY KEY (audit_id),
  CONSTRAINT checkpoint_audit_checkpoint_id_fkey
    FOREIGN KEY (checkpoint_id) REFERENCES public.section_checkpoints(checkpoint_id) ON DELETE CASCADE,
  CONSTRAINT checkpoint_audit_changed_by_fkey
    FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT checkpoint_audit_operation_type_check
    CHECK (operation_type IN ('CREATE', 'UPDATE', 'DELETE', 'COMPLETE', 'UNCOMPLETE'))
);

COMMENT ON TABLE public.checkpoint_audit IS 'Audit trail for checkpoint changes. Application maintains max 50 entries per checkpoint.';
COMMENT ON COLUMN public.checkpoint_audit.operation_type IS 'CREATE, UPDATE, DELETE, COMPLETE, UNCOMPLETE';
COMMENT ON COLUMN public.checkpoint_audit.field_name IS 'Changed field: title, description, checkpoint_date, section_id, linked_sections, completed_at, etc.';
COMMENT ON COLUMN public.checkpoint_audit.old_value IS 'Previous value (text serialized)';
COMMENT ON COLUMN public.checkpoint_audit.new_value IS 'New value (text serialized)';

-- Indexes for audit table
CREATE INDEX IF NOT EXISTS idx_checkpoint_audit_checkpoint_id
  ON public.checkpoint_audit(checkpoint_id);

CREATE INDEX IF NOT EXISTS idx_checkpoint_audit_changed_at
  ON public.checkpoint_audit(checkpoint_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_checkpoint_audit_changed_by
  ON public.checkpoint_audit(changed_by)
  WHERE changed_by IS NOT NULL;

-- ============================================
-- 3. DROP and RECREATE view_section_checkpoints
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

  -- Resolved icon/color (custom override OR type default)
  COALESCE(sc.custom_icon, ct.icon) AS icon,
  COALESCE(sc.custom_color, ct.color) AS color,

  -- Completion tracking
  sc.completed_at,
  sc.completed_by,

  -- Computed status based on completed_at and checkpoint_date
  CASE
    WHEN sc.completed_at IS NOT NULL AND sc.completed_at::date <= sc.checkpoint_date
      THEN 'completed'
    WHEN sc.completed_at IS NOT NULL AND sc.completed_at::date > sc.checkpoint_date
      THEN 'completed_late'
    WHEN sc.completed_at IS NULL AND CURRENT_DATE > sc.checkpoint_date
      THEN 'overdue'
    ELSE 'pending'
  END AS status,

  -- Status label in Russian
  CASE
    WHEN sc.completed_at IS NOT NULL AND sc.completed_at::date <= sc.checkpoint_date
      THEN 'Выполнено'
    WHEN sc.completed_at IS NOT NULL AND sc.completed_at::date > sc.checkpoint_date
      THEN 'Выполнено с опозданием'
    WHEN sc.completed_at IS NULL AND CURRENT_DATE > sc.checkpoint_date
      THEN 'Просрочено'
    ELSE 'Ожидается'
  END AS status_label,

  -- Audit timestamps
  sc.created_by,
  sc.created_at,
  sc.updated_at,

  -- Permission context: section responsible
  sec.section_responsible,

  -- Permission context: project manager (via section -> project)
  p.project_manager,

  -- Aggregate linked sections as JSON array
  COALESCE(
    (SELECT jsonb_agg(jsonb_build_object(
      'section_id', csl.section_id,
      'section_name', s.section_name
    ) ORDER BY s.section_name)
    FROM public.checkpoint_section_links csl
    JOIN public.sections s ON s.section_id = csl.section_id
    WHERE csl.checkpoint_id = sc.checkpoint_id),
    '[]'::jsonb
  ) AS linked_sections,

  -- Count of linked sections (useful for UI)
  (SELECT COUNT(*)::int
   FROM public.checkpoint_section_links csl
   WHERE csl.checkpoint_id = sc.checkpoint_id) AS linked_sections_count

FROM public.section_checkpoints sc
LEFT JOIN public.checkpoint_types ct ON ct.type_id = sc.type_id
LEFT JOIN public.sections sec ON sec.section_id = sc.section_id
LEFT JOIN public.projects p ON p.project_id = sec.section_project_id;

COMMENT ON VIEW public.view_section_checkpoints IS 'Checkpoints with computed status, resolved icon/color, linked sections, and permission context';
COMMENT ON COLUMN public.view_section_checkpoints.status IS 'Computed: pending, completed, completed_late, overdue';
COMMENT ON COLUMN public.view_section_checkpoints.status_label IS 'Russian label: Ожидается, Выполнено, Выполнено с опозданием, Просрочено';
COMMENT ON COLUMN public.view_section_checkpoints.section_responsible IS 'Permission context: section responsible user_id';
COMMENT ON COLUMN public.view_section_checkpoints.project_manager IS 'Permission context: project manager user_id';

COMMIT;

-- ============================================
-- POST-MIGRATION VERIFICATION
-- Run these queries to verify the migration was successful
-- ============================================

/*
-- 1. Verify new columns on section_checkpoints
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'section_checkpoints'
  AND column_name IN ('completed_at', 'completed_by', 'updated_at')
ORDER BY column_name;

-- 2. Verify checkpoint_audit table exists
SELECT tablename, schemaname
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'checkpoint_audit';

-- 3. Verify indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('section_checkpoints', 'checkpoint_audit')
ORDER BY tablename, indexname;

-- 4. Verify view columns
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'view_section_checkpoints'
ORDER BY ordinal_position;

-- 5. Test status computation
SELECT
  checkpoint_id,
  title,
  checkpoint_date,
  completed_at,
  status,
  status_label
FROM view_section_checkpoints
LIMIT 5;

-- 6. Test with a sample checkpoint (creates pending status)
-- INSERT INTO section_checkpoints (section_id, type_id, title, checkpoint_date, created_by)
-- SELECT
--   (SELECT section_id FROM sections LIMIT 1),
--   (SELECT type_id FROM checkpoint_types WHERE type = 'task_transfer'),
--   'Test Checkpoint',
--   CURRENT_DATE + INTERVAL '7 days',
--   auth.uid();

-- 7. Verify permission context is populated
SELECT
  checkpoint_id,
  title,
  section_responsible,
  project_manager
FROM view_section_checkpoints
WHERE section_responsible IS NOT NULL
LIMIT 5;

-- 8. EXPLAIN ANALYZE on common query pattern
EXPLAIN ANALYZE
SELECT * FROM view_section_checkpoints
WHERE section_id = (SELECT section_id FROM sections LIMIT 1)
ORDER BY checkpoint_date;
*/
