-- ============================================================================
-- Migration: Add parent_planned_amount to v_cache_budgets_current
-- ============================================================================
-- Добавляет поле parent_planned_amount для расчёта процентов от родителя
-- ============================================================================

CREATE OR REPLACE VIEW v_cache_budgets_current AS
SELECT
  b.budget_id,
  b.entity_type,
  b.entity_id,
  b.name,
  b.is_active,
  b.created_by,
  b.created_at,
  b.updated_at,
  -- Current version
  bv.version_id,
  bv.planned_amount,
  bv.effective_from,
  bv.comment AS version_comment,
  bv.created_by AS version_created_by,
  bv.created_at AS version_created_at,
  -- Spent calculations
  COALESCE(wl_sum.spent_amount, 0::numeric) AS spent_amount,
  bv.planned_amount - COALESCE(wl_sum.spent_amount, 0::numeric) AS remaining_amount,
  CASE
    WHEN bv.planned_amount > 0::numeric
    THEN COALESCE(wl_sum.spent_amount, 0::numeric) / bv.planned_amount * 100::numeric
    ELSE 0::numeric
  END AS spent_percentage,
  -- Budget type
  bt.type_id,
  bt.name AS type_name,
  bt.color AS type_color,
  bt.description AS type_description,
  -- Parent budget info
  b.parent_budget_id,
  pb.name AS parent_name,
  pb.entity_type AS parent_entity_type,
  pb.entity_id AS parent_entity_id,
  -- NEW: Parent planned amount for percentage calculation
  COALESCE(pbv.planned_amount, 0::numeric) AS parent_planned_amount
FROM budgets b
JOIN budget_versions bv ON bv.budget_id = b.budget_id AND bv.effective_to IS NULL
JOIN budget_types bt ON bt.type_id = b.budget_type_id
LEFT JOIN (
  SELECT budget_id, sum(work_log_amount) AS spent_amount
  FROM work_logs
  WHERE budget_id IS NOT NULL
  GROUP BY budget_id
) wl_sum ON wl_sum.budget_id = b.budget_id
LEFT JOIN budgets pb ON pb.budget_id = b.parent_budget_id
LEFT JOIN budget_versions pbv ON pbv.budget_id = pb.budget_id AND pbv.effective_to IS NULL
WHERE b.is_active = true;

-- Add comment
COMMENT ON VIEW v_cache_budgets_current IS 'Active budgets with current version, spent amount, and parent budget info including parent_planned_amount';
