-- ============================================================================
-- Migration: Budgets System - Views
-- Description: Create cache views for budgets with spent amounts and summaries
-- Date: 2025-12-09
-- ============================================================================

-- ============================================================================
-- 1. v_cache_budgets_current
-- Текущие активные бюджеты с актуальной суммой, расходом и тегами
-- ============================================================================

CREATE VIEW v_cache_budgets_current AS
WITH budget_spent AS (
  SELECT
    budget_id,
    COALESCE(SUM(work_log_amount), 0) as spent_amount
  FROM work_logs
  WHERE budget_id IS NOT NULL
  GROUP BY budget_id
),
budget_tags_agg AS (
  SELECT
    btl.budget_id,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'tag_id', t.tag_id,
          'name', t.name,
          'color', t.color
        )
      ) FILTER (WHERE t.tag_id IS NOT NULL),
      '[]'::jsonb
    ) as tags
  FROM budget_tag_links btl
  JOIN budget_tags t ON btl.tag_id = t.tag_id AND t.is_active = true
  GROUP BY btl.budget_id
)
SELECT
  b.budget_id,
  b.entity_type,
  b.entity_id,
  b.name,
  b.is_active,
  b.created_by,
  b.created_at,
  b.updated_at,
  bv.version_id,
  bv.planned_amount,
  bv.effective_from,
  bv.comment as version_comment,
  bv.created_by as version_created_by,
  bv.created_at as version_created_at,
  COALESCE(bs.spent_amount, 0) as spent_amount,
  bv.planned_amount - COALESCE(bs.spent_amount, 0) as remaining_amount,
  CASE
    WHEN bv.planned_amount = 0 THEN 0
    ELSE ROUND((COALESCE(bs.spent_amount, 0) / bv.planned_amount) * 100, 2)
  END as spent_percentage,
  COALESCE(bta.tags, '[]'::jsonb) as tags
FROM budgets b
JOIN budget_versions bv ON b.budget_id = bv.budget_id AND bv.effective_to IS NULL
LEFT JOIN budget_spent bs ON b.budget_id = bs.budget_id
LEFT JOIN budget_tags_agg bta ON b.budget_id = bta.budget_id
WHERE b.is_active = true;

COMMENT ON VIEW v_cache_budgets_current IS 'Текущие активные бюджеты с суммой, расходом и тегами';

-- ============================================================================
-- 2. v_cache_section_budget_summary
-- Сводка бюджетов по разделам
-- ============================================================================

CREATE VIEW v_cache_section_budget_summary AS
WITH budget_with_spent AS (
  SELECT
    b.budget_id,
    b.entity_id as section_id,
    bv.planned_amount,
    COALESCE(
      (SELECT SUM(work_log_amount) FROM work_logs WHERE budget_id = b.budget_id),
      0
    ) as spent_amount
  FROM budgets b
  JOIN budget_versions bv ON b.budget_id = bv.budget_id AND bv.effective_to IS NULL
  WHERE b.entity_type = 'section' AND b.is_active = true
),
section_totals AS (
  SELECT
    section_id,
    COUNT(*) as budget_count,
    COALESCE(SUM(planned_amount), 0) as total_planned,
    COALESCE(SUM(spent_amount), 0) as total_spent
  FROM budget_with_spent
  GROUP BY section_id
)
SELECT
  s.section_id,
  s.section_name,
  s.section_project_id,
  s.section_object_id,
  s.section_responsible,
  COALESCE(st.budget_count, 0)::integer as budget_count,
  COALESCE(st.total_planned, 0) as total_planned,
  COALESCE(st.total_spent, 0) as total_spent,
  COALESCE(st.total_planned, 0) - COALESCE(st.total_spent, 0) as remaining,
  CASE
    WHEN COALESCE(st.total_planned, 0) = 0 THEN 0
    ELSE ROUND((COALESCE(st.total_spent, 0) / st.total_planned) * 100, 2)
  END as spent_percentage
FROM sections s
LEFT JOIN section_totals st ON st.section_id = s.section_id;

COMMENT ON VIEW v_cache_section_budget_summary IS 'Сводка бюджетов по разделам с общим планом и расходом';

-- ============================================================================
-- 3. v_cache_budget_tags
-- Справочник тегов с количеством использований
-- ============================================================================

CREATE VIEW v_cache_budget_tags AS
SELECT
  t.tag_id,
  t.name,
  t.color,
  t.description,
  t.is_active,
  t.created_at,
  COALESCE(
    (SELECT COUNT(*) FROM budget_tag_links WHERE tag_id = t.tag_id),
    0
  )::integer as usage_count
FROM budget_tags t;

COMMENT ON VIEW v_cache_budget_tags IS 'Справочник тегов бюджетов с количеством использований';
