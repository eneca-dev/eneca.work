-- ============================================================================
-- Migration: v_cache_section_calc_budget
-- Description:
--   Сводка расчётного бюджета по разделам — агрегация всех loadings раздела
--   из v_cache_loading_money (любой loading_status, любой is_shortage).
-- Date: 2026-04-28
-- Связано с: docs/production/budgets-calc-from-loadings.md
-- Зависит от: v_cache_loading_money
-- ============================================================================

CREATE OR REPLACE VIEW v_cache_section_calc_budget AS
SELECT
  loading_section AS section_id,
  COALESCE(SUM(money), 0)::numeric AS calc_budget,
  COALESCE(SUM(hours), 0)::numeric AS total_hours,
  COUNT(*)::int                    AS loading_count,
  COUNT(*) FILTER (WHERE error_flag IS NULL)::int     AS valid_loading_count,
  COUNT(*) FILTER (WHERE error_flag IS NOT NULL)::int AS errors_count
FROM v_cache_loading_money
GROUP BY loading_section;

COMMENT ON VIEW v_cache_section_calc_budget IS
  'Сводка расчётного бюджета по разделам: сумма money/hours и счётчики loadings из v_cache_loading_money';
