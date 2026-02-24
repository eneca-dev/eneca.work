-- Добавляем поля проекта в view_project_tree_optimized для списка проектов
-- Используем profiles (как в view_project_tree) для получения данных о менеджерах
-- Собираем всех задействованных пользователей в JSON массив для эффективной фильтрации

DROP VIEW IF EXISTS view_project_tree_optimized;

CREATE VIEW view_project_tree_optimized AS
WITH
-- Сначала собираем всех задействованных пользователей по проектам
project_users AS (
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
  GROUP BY p.project_id
),
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
  LEFT JOIN project_users pu ON pu.project_id = p.project_id

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
  LEFT JOIN project_users pu ON pu.project_id = p.project_id

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
  LEFT JOIN project_users pu ON pu.project_id = p.project_id

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
  LEFT JOIN project_users pu ON pu.project_id = p.project_id
)
SELECT * FROM project_hierarchy
ORDER BY hierarchy_level, sort_path, sort_order;
