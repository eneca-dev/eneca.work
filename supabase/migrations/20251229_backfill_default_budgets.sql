-- ============================================================================
-- Data Migration: Backfill default budgets for existing entities
-- ============================================================================
-- Creates "Основной" budgets for all existing entities that don't have one.
-- Order: projects → stages → objects → sections (to ensure parent_budget_id works)
-- ============================================================================

DO $$
DECLARE
  v_main_type_id uuid := '5d45eec9-6e5b-4e67-95b8-19817b1f935b';
  v_admin_id uuid;
  v_budget_id uuid;
  v_version_id uuid;
  v_parent_budget_id uuid;
  v_count integer := 0;
  rec RECORD;
BEGIN
  -- Получаем ID первого админа для created_by
  SELECT ur.user_id INTO v_admin_id
  FROM user_roles ur
  JOIN roles r ON ur.role_id = r.id
  WHERE r.name = 'admin'
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'No admin user found for created_by';
  END IF;

  RAISE NOTICE 'Using admin_id: %', v_admin_id;

  -- ========================================
  -- 1. Projects (no parent)
  -- ========================================
  FOR rec IN
    SELECT project_id, project_name
    FROM projects p
    WHERE NOT EXISTS (
      SELECT 1 FROM budgets b
      WHERE b.entity_type = 'project'
      AND b.entity_id = p.project_id
      AND b.budget_type_id = v_main_type_id
      AND b.is_active = true
    )
  LOOP
    v_budget_id := gen_random_uuid();
    v_version_id := gen_random_uuid();

    INSERT INTO budgets (budget_id, entity_type, entity_id, name, budget_type_id, parent_budget_id, is_active, created_by, created_at, updated_at)
    VALUES (v_budget_id, 'project', rec.project_id, 'Основной', v_main_type_id, NULL, true, v_admin_id, now(), now());

    INSERT INTO budget_versions (version_id, budget_id, planned_amount, effective_from, effective_to, comment, created_by, created_at)
    VALUES (v_version_id, v_budget_id, 0, CURRENT_DATE, NULL, 'Backfill migration', v_admin_id, now());

    v_count := v_count + 1;
  END LOOP;
  RAISE NOTICE 'Created % project budgets', v_count;
  v_count := 0;

  -- ========================================
  -- 2. Stages (parent = project budget)
  -- ========================================
  FOR rec IN
    SELECT s.stage_id, s.stage_name, s.stage_project_id
    FROM stages s
    WHERE NOT EXISTS (
      SELECT 1 FROM budgets b
      WHERE b.entity_type = 'stage'
      AND b.entity_id = s.stage_id
      AND b.budget_type_id = v_main_type_id
      AND b.is_active = true
    )
  LOOP
    v_budget_id := gen_random_uuid();
    v_version_id := gen_random_uuid();

    -- Find parent budget (project)
    SELECT budget_id INTO v_parent_budget_id
    FROM budgets
    WHERE entity_type = 'project'
      AND entity_id = rec.stage_project_id
      AND budget_type_id = v_main_type_id
      AND is_active = true
    LIMIT 1;

    INSERT INTO budgets (budget_id, entity_type, entity_id, name, budget_type_id, parent_budget_id, is_active, created_by, created_at, updated_at)
    VALUES (v_budget_id, 'stage', rec.stage_id, 'Основной', v_main_type_id, v_parent_budget_id, true, v_admin_id, now(), now());

    INSERT INTO budget_versions (version_id, budget_id, planned_amount, effective_from, effective_to, comment, created_by, created_at)
    VALUES (v_version_id, v_budget_id, 0, CURRENT_DATE, NULL, 'Backfill migration', v_admin_id, now());

    v_count := v_count + 1;
  END LOOP;
  RAISE NOTICE 'Created % stage budgets', v_count;
  v_count := 0;

  -- ========================================
  -- 3. Objects (parent = stage budget)
  -- ========================================
  FOR rec IN
    SELECT o.object_id, o.object_name, o.object_stage_id
    FROM objects o
    WHERE NOT EXISTS (
      SELECT 1 FROM budgets b
      WHERE b.entity_type = 'object'
      AND b.entity_id = o.object_id
      AND b.budget_type_id = v_main_type_id
      AND b.is_active = true
    )
  LOOP
    v_budget_id := gen_random_uuid();
    v_version_id := gen_random_uuid();

    -- Find parent budget (stage)
    SELECT budget_id INTO v_parent_budget_id
    FROM budgets
    WHERE entity_type = 'stage'
      AND entity_id = rec.object_stage_id
      AND budget_type_id = v_main_type_id
      AND is_active = true
    LIMIT 1;

    INSERT INTO budgets (budget_id, entity_type, entity_id, name, budget_type_id, parent_budget_id, is_active, created_by, created_at, updated_at)
    VALUES (v_budget_id, 'object', rec.object_id, 'Основной', v_main_type_id, v_parent_budget_id, true, v_admin_id, now(), now());

    INSERT INTO budget_versions (version_id, budget_id, planned_amount, effective_from, effective_to, comment, created_by, created_at)
    VALUES (v_version_id, v_budget_id, 0, CURRENT_DATE, NULL, 'Backfill migration', v_admin_id, now());

    v_count := v_count + 1;
  END LOOP;
  RAISE NOTICE 'Created % object budgets', v_count;
  v_count := 0;

  -- ========================================
  -- 4. Sections (parent = object budget)
  -- ========================================
  FOR rec IN
    SELECT s.section_id, s.section_name, s.section_object_id
    FROM sections s
    WHERE NOT EXISTS (
      SELECT 1 FROM budgets b
      WHERE b.entity_type = 'section'
      AND b.entity_id = s.section_id
      AND b.budget_type_id = v_main_type_id
      AND b.is_active = true
    )
  LOOP
    v_budget_id := gen_random_uuid();
    v_version_id := gen_random_uuid();

    -- Find parent budget (object)
    SELECT budget_id INTO v_parent_budget_id
    FROM budgets
    WHERE entity_type = 'object'
      AND entity_id = rec.section_object_id
      AND budget_type_id = v_main_type_id
      AND is_active = true
    LIMIT 1;

    INSERT INTO budgets (budget_id, entity_type, entity_id, name, budget_type_id, parent_budget_id, is_active, created_by, created_at, updated_at)
    VALUES (v_budget_id, 'section', rec.section_id, 'Основной', v_main_type_id, v_parent_budget_id, true, v_admin_id, now(), now());

    INSERT INTO budget_versions (version_id, budget_id, planned_amount, effective_from, effective_to, comment, created_by, created_at)
    VALUES (v_version_id, v_budget_id, 0, CURRENT_DATE, NULL, 'Backfill migration', v_admin_id, now());

    v_count := v_count + 1;
  END LOOP;
  RAISE NOTICE 'Created % section budgets', v_count;

  RAISE NOTICE 'Backfill complete!';
END $$;
