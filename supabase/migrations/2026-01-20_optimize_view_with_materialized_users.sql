-- Оптимизация view_project_tree_optimized
-- Проблема: CTE project_users пересчитывается для каждой строки результата
-- Решение: Создаём материализованное представление для involved_users

-- Шаг 1: Создаём материализованное представление для involved_users
DROP MATERIALIZED VIEW IF EXISTS mat_project_involved_users CASCADE;

CREATE MATERIALIZED VIEW mat_project_involved_users AS
SELECT DISTINCT
  p.project_id,
  ARRAY_AGG(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) as involved_users
FROM projects p
CROSS JOIN LATERAL (
  -- Менеджер проекта
  SELECT p.project_manager as user_id
  WHERE p.project_manager IS NOT NULL

  UNION

  -- Ответственные за разделы
  SELECT sec.section_responsible as user_id
  FROM sections sec
  JOIN objects o ON sec.section_object_id = o.object_id
  JOIN stages s ON o.object_stage_id = s.stage_id
  WHERE s.stage_project_id = p.project_id
    AND sec.section_responsible IS NOT NULL

  UNION

  -- Пользователи с загрузками
  SELECT l.loading_responsible as user_id
  FROM loadings l
  JOIN sections sec ON l.loading_section = sec.section_id
  JOIN objects o ON sec.section_object_id = o.object_id
  JOIN stages s ON o.object_stage_id = s.stage_id
  WHERE s.stage_project_id = p.project_id
    AND l.loading_responsible IS NOT NULL
) users
GROUP BY p.project_id;

-- Создаём индекс для быстрого поиска
CREATE UNIQUE INDEX idx_mat_project_involved_users_project_id
ON mat_project_involved_users(project_id);

-- Шаг 2: Пересоздаём view без CTE project_users
DROP VIEW IF EXISTS view_project_tree_optimized;

CREATE VIEW view_project_tree_optimized AS
WITH
project_hierarchy AS (
  -- Уровень 1: Проекты (stage_type как параметр)
  SELECT
    p.project_id::text as node_id,
    p.project_name as node_name,
    'project'::text as node_type,
    1 as hierarchy_level,

    -- ID всех уровней
    p.project_id,
    NULL::uuid as object_id,
    NULL::uuid as section_id,
    NULL::uuid as decomposition_stage_id,

    -- Стадия как параметр проекта
    p.stage_type,

    -- Описания
    p.project_description as description,

    -- Ответственные
    p.project_manager as responsible_id,

    -- Даты
    NULL::timestamp as start_date,
    NULL::timestamp as end_date,

    -- Порядок сортировки
    p.project_name as sort_path,
    0 as sort_order,

    -- Дополнительные поля для списка проектов
    p.project_status,
    p.project_manager as manager_id,
    CASE
      WHEN p.project_manager IS NOT NULL THEN
        COALESCE(
          NULLIF(TRIM(BOTH FROM pm.first_name || ' ' || pm.last_name), ''),
          SPLIT_PART(pm.email, '@', 1)
        )
      ELSE NULL
    END as manager_name,
    pm.avatar_url as manager_avatar,
    (ufp.user_id IS NOT NULL) as is_favorite,
    pu.involved_users

  FROM projects p
  LEFT JOIN profiles pm ON p.project_manager = pm.user_id
  LEFT JOIN user_favorite_projects ufp ON ufp.project_id = p.project_id AND ufp.user_id = auth.uid()
  LEFT JOIN mat_project_involved_users pu ON pu.project_id = p.project_id

  UNION ALL

  -- Уровень 2: Объекты (теперь прямые дети проектов)
  SELECT
    o.object_id::text as node_id,
    o.object_name as node_name,
    'object'::text as node_type,
    2 as hierarchy_level,

    -- Получаем project_id через stage
    s.stage_project_id as project_id,
    o.object_id,
    NULL::uuid as section_id,
    NULL::uuid as decomposition_stage_id,

    -- Стадия из projects
    p.stage_type,

    o.object_description as description,
    NULL::uuid as responsible_id,

    o.object_start_date as start_date,
    o.object_end_date as end_date,

    o.object_name as sort_path,
    0 as sort_order,

    -- Дополнительные поля для списка проектов
    p.project_status,
    p.project_manager as manager_id,
    CASE
      WHEN p.project_manager IS NOT NULL THEN
        COALESCE(
          NULLIF(TRIM(BOTH FROM pm.first_name || ' ' || pm.last_name), ''),
          SPLIT_PART(pm.email, '@', 1)
        )
      ELSE NULL
    END as manager_name,
    pm.avatar_url as manager_avatar,
    (ufp.user_id IS NOT NULL) as is_favorite,
    pu.involved_users

  FROM objects o
  JOIN stages s ON o.object_stage_id = s.stage_id
  JOIN projects p ON s.stage_project_id = p.project_id
  LEFT JOIN profiles pm ON p.project_manager = pm.user_id
  LEFT JOIN user_favorite_projects ufp ON ufp.project_id = p.project_id AND ufp.user_id = auth.uid()
  LEFT JOIN mat_project_involved_users pu ON pu.project_id = p.project_id

  UNION ALL

  -- Уровень 3: Разделы
  SELECT
    sec.section_id::text as node_id,
    sec.section_name as node_name,
    'section'::text as node_type,
    3 as hierarchy_level,

    s.stage_project_id as project_id,
    sec.section_object_id as object_id,
    sec.section_id,
    NULL::uuid as decomposition_stage_id,

    p.stage_type,

    sec.section_description as description,
    sec.section_responsible as responsible_id,

    sec.section_start_date as start_date,
    sec.section_end_date as end_date,

    sec.section_name as sort_path,
    0 as sort_order,

    -- Дополнительные поля для списка проектов
    p.project_status,
    p.project_manager as manager_id,
    CASE
      WHEN p.project_manager IS NOT NULL THEN
        COALESCE(
          NULLIF(TRIM(BOTH FROM pm.first_name || ' ' || pm.last_name), ''),
          SPLIT_PART(pm.email, '@', 1)
        )
      ELSE NULL
    END as manager_name,
    pm.avatar_url as manager_avatar,
    (ufp.user_id IS NOT NULL) as is_favorite,
    pu.involved_users

  FROM sections sec
  JOIN objects o ON sec.section_object_id = o.object_id
  JOIN stages s ON o.object_stage_id = s.stage_id
  JOIN projects p ON s.stage_project_id = p.project_id
  LEFT JOIN profiles pm ON p.project_manager = pm.user_id
  LEFT JOIN user_favorite_projects ufp ON ufp.project_id = p.project_id AND ufp.user_id = auth.uid()
  LEFT JOIN mat_project_involved_users pu ON pu.project_id = p.project_id

  UNION ALL

  -- Уровень 4: Этапы декомпозиции
  SELECT
    ds.decomposition_stage_id::text as node_id,
    ds.decomposition_stage_name as node_name,
    'decomposition_stage'::text as node_type,
    4 as hierarchy_level,

    s.stage_project_id as project_id,
    sec.section_object_id as object_id,
    ds.decomposition_stage_section_id as section_id,
    ds.decomposition_stage_id,

    p.stage_type,

    ds.decomposition_stage_description as description,
    NULL::uuid as responsible_id,

    ds.decomposition_stage_start as start_date,
    ds.decomposition_stage_finish as end_date,

    ds.decomposition_stage_name as sort_path,
    ds.decomposition_stage_order as sort_order,

    -- Дополнительные поля для списка проектов
    p.project_status,
    p.project_manager as manager_id,
    CASE
      WHEN p.project_manager IS NOT NULL THEN
        COALESCE(
          NULLIF(TRIM(BOTH FROM pm.first_name || ' ' || pm.last_name), ''),
          SPLIT_PART(pm.email, '@', 1)
        )
      ELSE NULL
    END as manager_name,
    pm.avatar_url as manager_avatar,
    (ufp.user_id IS NOT NULL) as is_favorite,
    pu.involved_users

  FROM decomposition_stages ds
  JOIN sections sec ON ds.decomposition_stage_section_id = sec.section_id
  JOIN objects o ON sec.section_object_id = o.object_id
  JOIN stages s ON o.object_stage_id = s.stage_id
  JOIN projects p ON s.stage_project_id = p.project_id
  LEFT JOIN profiles pm ON p.project_manager = pm.user_id
  LEFT JOIN user_favorite_projects ufp ON ufp.project_id = p.project_id AND ufp.user_id = auth.uid()
  LEFT JOIN mat_project_involved_users pu ON pu.project_id = p.project_id
)
SELECT * FROM project_hierarchy
ORDER BY hierarchy_level, sort_path, sort_order;

-- Шаг 3: Создаём функцию для обновления материализованного представления
CREATE OR REPLACE FUNCTION refresh_project_involved_users()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mat_project_involved_users;
END;
$$;

-- Шаг 4: Создаём триггеры для автоматического обновления
-- Триггер на изменение проектов (project_manager)
CREATE OR REPLACE FUNCTION trigger_refresh_project_users_on_project()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM refresh_project_involved_users();
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_project_manager_change ON projects;
CREATE TRIGGER trigger_project_manager_change
AFTER INSERT OR UPDATE OF project_manager OR DELETE ON projects
FOR EACH STATEMENT
EXECUTE FUNCTION trigger_refresh_project_users_on_project();

-- Триггер на изменение разделов (section_responsible)
CREATE OR REPLACE FUNCTION trigger_refresh_project_users_on_section()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM refresh_project_involved_users();
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_section_responsible_change ON sections;
CREATE TRIGGER trigger_section_responsible_change
AFTER INSERT OR UPDATE OF section_responsible OR DELETE ON sections
FOR EACH STATEMENT
EXECUTE FUNCTION trigger_refresh_project_users_on_section();

-- Триггер на изменение загрузок (loading_responsible)
CREATE OR REPLACE FUNCTION trigger_refresh_project_users_on_loading()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM refresh_project_involved_users();
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_loading_responsible_change ON loadings;
CREATE TRIGGER trigger_loading_responsible_change
AFTER INSERT OR UPDATE OF loading_responsible OR DELETE ON loadings
FOR EACH STATEMENT
EXECUTE FUNCTION trigger_refresh_project_users_on_loading();

-- Шаг 5: Первичное заполнение материализованного представления
REFRESH MATERIALIZED VIEW mat_project_involved_users;
