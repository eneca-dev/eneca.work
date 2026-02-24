-- Оптимизированный view для загрузки полного дерева проекта одним запросом
-- Иерархия: project -> stage -> object -> section -> decomposition_stage
-- Решает проблему N+1 запросов при загрузке дерева проекта

CREATE OR REPLACE VIEW view_project_tree_optimized AS
WITH RECURSIVE project_hierarchy AS (
  -- Уровень 1: Проекты
  SELECT
    p.project_id::text as node_id,
    p.project_name as node_name,
    'project'::text as node_type,
    1 as hierarchy_level,

    -- ID всех уровней
    p.project_id,
    NULL::uuid as stage_id,
    NULL::uuid as object_id,
    NULL::uuid as section_id,
    NULL::uuid as decomposition_stage_id,

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

  -- Уровень 2: Стадии
  SELECT
    s.stage_id::text as node_id,
    s.stage_name as node_name,
    'stage'::text as node_type,
    2 as hierarchy_level,

    s.stage_project_id as project_id,
    s.stage_id,
    NULL::uuid as object_id,
    NULL::uuid as section_id,
    NULL::uuid as decomposition_stage_id,

    s.stage_description as description,
    NULL::uuid as responsible_id,

    NULL::timestamp as start_date,
    NULL::timestamp as end_date,

    s.stage_name as sort_path,
    0 as sort_order

  FROM stages s

  UNION ALL

  -- Уровень 3: Объекты
  SELECT
    o.object_id::text as node_id,
    o.object_name as node_name,
    'object'::text as node_type,
    3 as hierarchy_level,

    s.stage_project_id as project_id,
    o.object_stage_id as stage_id,
    o.object_id,
    NULL::uuid as section_id,
    NULL::uuid as decomposition_stage_id,

    o.object_description as description,
    NULL::uuid as responsible_id,

    o.object_start_date as start_date,
    o.object_end_date as end_date,

    o.object_name as sort_path,
    0 as sort_order

  FROM objects o
  JOIN stages s ON o.object_stage_id = s.stage_id

  UNION ALL

  -- Уровень 4: Разделы
  SELECT
    sec.section_id::text as node_id,
    sec.section_name as node_name,
    'section'::text as node_type,
    4 as hierarchy_level,

    s.stage_project_id as project_id,
    o.object_stage_id as stage_id,
    sec.section_object_id as object_id,
    sec.section_id,
    NULL::uuid as decomposition_stage_id,

    sec.section_description as description,
    sec.section_responsible as responsible_id,

    sec.section_start_date as start_date,
    sec.section_end_date as end_date,

    sec.section_name as sort_path,
    0 as sort_order

  FROM sections sec
  JOIN objects o ON sec.section_object_id = o.object_id
  JOIN stages s ON o.object_stage_id = s.stage_id

  UNION ALL

  -- Уровень 5: Этапы декомпозиции
  SELECT
    ds.decomposition_stage_id::text as node_id,
    ds.decomposition_stage_name as node_name,
    'decomposition_stage'::text as node_type,
    5 as hierarchy_level,

    s.stage_project_id as project_id,
    o.object_stage_id as stage_id,
    sec.section_object_id as object_id,
    ds.decomposition_stage_section_id as section_id,
    ds.decomposition_stage_id,

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
)
SELECT * FROM project_hierarchy
ORDER BY hierarchy_level, sort_path, sort_order;
