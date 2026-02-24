-- Обновление view: убираем уровень "stage" из иерархии
-- Теперь иерархия: project (со stage_type как параметром) -> object -> section -> decomposition_stage
-- stage_type берется из таблицы projects как параметр проекта

DROP VIEW IF EXISTS view_project_tree_optimized;

CREATE VIEW view_project_tree_optimized AS
WITH RECURSIVE project_hierarchy AS (
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
    0 as sort_order

  FROM projects p

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
    0 as sort_order

  FROM objects o
  JOIN stages s ON o.object_stage_id = s.stage_id
  JOIN projects p ON s.stage_project_id = p.project_id

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
    0 as sort_order

  FROM sections sec
  JOIN objects o ON sec.section_object_id = o.object_id
  JOIN stages s ON o.object_stage_id = s.stage_id
  JOIN projects p ON s.stage_project_id = p.project_id

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
    ds.decomposition_stage_order as sort_order

  FROM decomposition_stages ds
  JOIN sections sec ON ds.decomposition_stage_section_id = sec.section_id
  JOIN objects o ON sec.section_object_id = o.object_id
  JOIN stages s ON o.object_stage_id = s.stage_id
  JOIN projects p ON s.stage_project_id = p.project_id
)
SELECT * FROM project_hierarchy
ORDER BY hierarchy_level, sort_path, sort_order;
