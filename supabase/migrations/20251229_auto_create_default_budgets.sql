-- ============================================================================
-- Migration: Auto-create default "Основной" budget for entities
-- ============================================================================
-- Creates triggers on sections, objects, stages, projects to automatically
-- create a default budget with type "Основной" and planned_amount = 0
-- ============================================================================

-- Константа: ID типа "Основной"
-- Используем DO блок для проверки существования
DO $$
DECLARE
  v_main_type_id uuid := '5d45eec9-6e5b-4e67-95b8-19817b1f935b';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM budget_types WHERE type_id = v_main_type_id) THEN
    RAISE EXCEPTION 'Budget type "Основной" not found with id %', v_main_type_id;
  END IF;
END $$;

-- ============================================================================
-- Function: Find parent budget ID by entity hierarchy
-- ============================================================================
CREATE OR REPLACE FUNCTION find_parent_budget_id(
  p_entity_type budget_entity_type,
  p_entity_id uuid
) RETURNS uuid AS $$
DECLARE
  v_main_type_id uuid := '5d45eec9-6e5b-4e67-95b8-19817b1f935b';
  v_parent_budget_id uuid;
  v_object_id uuid;
  v_stage_id uuid;
  v_project_id uuid;
BEGIN
  -- Для project нет родителя
  IF p_entity_type = 'project' THEN
    RETURN NULL;
  END IF;

  -- Получаем иерархию в зависимости от типа entity
  IF p_entity_type = 'section' THEN
    -- section → object → stage → project
    SELECT s.section_object_id, o.object_stage_id, st.stage_project_id
    INTO v_object_id, v_stage_id, v_project_id
    FROM sections s
    JOIN objects o ON s.section_object_id = o.object_id
    JOIN stages st ON o.object_stage_id = st.stage_id
    WHERE s.section_id = p_entity_id;

    -- Ищем бюджет object
    SELECT budget_id INTO v_parent_budget_id
    FROM budgets
    WHERE entity_type = 'object'
      AND entity_id = v_object_id
      AND budget_type_id = v_main_type_id
      AND is_active = true
    LIMIT 1;

    IF v_parent_budget_id IS NOT NULL THEN
      RETURN v_parent_budget_id;
    END IF;

    -- Ищем бюджет stage
    SELECT budget_id INTO v_parent_budget_id
    FROM budgets
    WHERE entity_type = 'stage'
      AND entity_id = v_stage_id
      AND budget_type_id = v_main_type_id
      AND is_active = true
    LIMIT 1;

    IF v_parent_budget_id IS NOT NULL THEN
      RETURN v_parent_budget_id;
    END IF;

    -- Ищем бюджет project
    SELECT budget_id INTO v_parent_budget_id
    FROM budgets
    WHERE entity_type = 'project'
      AND entity_id = v_project_id
      AND budget_type_id = v_main_type_id
      AND is_active = true
    LIMIT 1;

    RETURN v_parent_budget_id;

  ELSIF p_entity_type = 'object' THEN
    -- object → stage → project
    SELECT o.object_stage_id, st.stage_project_id
    INTO v_stage_id, v_project_id
    FROM objects o
    JOIN stages st ON o.object_stage_id = st.stage_id
    WHERE o.object_id = p_entity_id;

    -- Ищем бюджет stage
    SELECT budget_id INTO v_parent_budget_id
    FROM budgets
    WHERE entity_type = 'stage'
      AND entity_id = v_stage_id
      AND budget_type_id = v_main_type_id
      AND is_active = true
    LIMIT 1;

    IF v_parent_budget_id IS NOT NULL THEN
      RETURN v_parent_budget_id;
    END IF;

    -- Ищем бюджет project
    SELECT budget_id INTO v_parent_budget_id
    FROM budgets
    WHERE entity_type = 'project'
      AND entity_id = v_project_id
      AND budget_type_id = v_main_type_id
      AND is_active = true
    LIMIT 1;

    RETURN v_parent_budget_id;

  ELSIF p_entity_type = 'stage' THEN
    -- stage → project
    SELECT stage_project_id INTO v_project_id
    FROM stages
    WHERE stage_id = p_entity_id;

    -- Ищем бюджет project
    SELECT budget_id INTO v_parent_budget_id
    FROM budgets
    WHERE entity_type = 'project'
      AND entity_id = v_project_id
      AND budget_type_id = v_main_type_id
      AND is_active = true
    LIMIT 1;

    RETURN v_parent_budget_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: Create default budget trigger function
-- ============================================================================
CREATE OR REPLACE FUNCTION create_default_budget_trigger() RETURNS TRIGGER AS $$
DECLARE
  v_main_type_id uuid := '5d45eec9-6e5b-4e67-95b8-19817b1f935b';
  v_entity_type budget_entity_type;
  v_entity_id uuid;
  v_entity_name text;
  v_budget_id uuid;
  v_version_id uuid;
  v_parent_budget_id uuid;
  v_created_by uuid;
BEGIN
  -- Определяем entity_type по имени таблицы
  CASE TG_TABLE_NAME
    WHEN 'sections' THEN
      v_entity_type := 'section';
      v_entity_id := NEW.section_id;
      v_entity_name := NEW.section_name;
    WHEN 'objects' THEN
      v_entity_type := 'object';
      v_entity_id := NEW.object_id;
      v_entity_name := NEW.object_name;
    WHEN 'stages' THEN
      v_entity_type := 'stage';
      v_entity_id := NEW.stage_id;
      v_entity_name := NEW.stage_name;
    WHEN 'projects' THEN
      v_entity_type := 'project';
      v_entity_id := NEW.project_id;
      v_entity_name := NEW.project_name;
    ELSE
      RAISE EXCEPTION 'Unknown table: %', TG_TABLE_NAME;
  END CASE;

  -- Получаем created_by (auth.uid() или fallback на первого админа)
  v_created_by := COALESCE(
    auth.uid(),
    (SELECT ur.user_id FROM user_roles ur
     JOIN roles r ON ur.role_id = r.id
     WHERE r.name = 'admin'
     LIMIT 1)
  );

  -- Если нет пользователя, пропускаем создание бюджета
  IF v_created_by IS NULL THEN
    RAISE WARNING 'Cannot create default budget: no user context and no admin found';
    RETURN NEW;
  END IF;

  -- Находим родительский бюджет
  v_parent_budget_id := find_parent_budget_id(v_entity_type, v_entity_id);

  -- Генерируем ID
  v_budget_id := gen_random_uuid();
  v_version_id := gen_random_uuid();

  -- Создаём бюджет
  INSERT INTO budgets (
    budget_id,
    entity_type,
    entity_id,
    name,
    budget_type_id,
    parent_budget_id,
    is_active,
    created_by,
    created_at,
    updated_at
  ) VALUES (
    v_budget_id,
    v_entity_type,
    v_entity_id,
    'Основной',
    v_main_type_id,
    v_parent_budget_id,
    true,
    v_created_by,
    now(),
    now()
  );

  -- Создаём начальную версию с planned_amount = 0
  INSERT INTO budget_versions (
    version_id,
    budget_id,
    planned_amount,
    effective_from,
    effective_to,
    comment,
    created_by,
    created_at
  ) VALUES (
    v_version_id,
    v_budget_id,
    0,
    CURRENT_DATE,
    NULL,
    'Автоматически созданный бюджет',
    v_created_by,
    now()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Triggers: Create on each entity table
-- ============================================================================

-- Drop existing triggers if any
DROP TRIGGER IF EXISTS trg_create_default_budget_section ON sections;
DROP TRIGGER IF EXISTS trg_create_default_budget_object ON objects;
DROP TRIGGER IF EXISTS trg_create_default_budget_stage ON stages;
DROP TRIGGER IF EXISTS trg_create_default_budget_project ON projects;

-- Create triggers
CREATE TRIGGER trg_create_default_budget_section
  AFTER INSERT ON sections
  FOR EACH ROW
  EXECUTE FUNCTION create_default_budget_trigger();

CREATE TRIGGER trg_create_default_budget_object
  AFTER INSERT ON objects
  FOR EACH ROW
  EXECUTE FUNCTION create_default_budget_trigger();

CREATE TRIGGER trg_create_default_budget_stage
  AFTER INSERT ON stages
  FOR EACH ROW
  EXECUTE FUNCTION create_default_budget_trigger();

CREATE TRIGGER trg_create_default_budget_project
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION create_default_budget_trigger();

-- ============================================================================
-- Grant permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION find_parent_budget_id(budget_entity_type, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION create_default_budget_trigger() TO authenticated;

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON FUNCTION find_parent_budget_id IS 'Finds parent budget ID for an entity by traversing hierarchy';
COMMENT ON FUNCTION create_default_budget_trigger IS 'Trigger function to auto-create default "Основной" budget on entity insert';
