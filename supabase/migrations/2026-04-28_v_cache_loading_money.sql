-- ============================================================================
-- Migration: v_cache_loading_money
-- Description:
--   Расчёт денежной стоимости каждой загрузки:
--     money = loading_rate × work_hours_per_day × work_days × hourly_rate
--   Учитывает все loading_status (active/archived) и is_shortage.
--   Skip если loading_responsible IS NULL (кейс C).
-- Date: 2026-04-28
-- Связано с: docs/production/budgets-calc-from-loadings.md
-- Зависит от: dim_work_calendar, department_budget_settings
-- ============================================================================

CREATE OR REPLACE VIEW v_cache_loading_money AS
WITH loading_with_workdays AS (
  SELECT
    l.loading_id,
    l.loading_section,
    l.loading_responsible,
    l.loading_rate,
    l.loading_start,
    l.loading_finish,
    l.loading_status,
    l.is_shortage,
    p.department_id,
    dbs.hourly_rate,
    dbs.work_hours_per_day,
    (
      SELECT COUNT(*)::int
      FROM dim_work_calendar wc
      WHERE wc.calendar_date BETWEEN l.loading_start AND l.loading_finish
        AND wc.is_working_day
    ) AS work_days
  FROM loadings l
  LEFT JOIN profiles p ON p.user_id = l.loading_responsible
  LEFT JOIN department_budget_settings dbs ON dbs.department_id = p.department_id
  -- loadings без loading_responsible учитываем как error_flag='no_responsible' для аудита
)
SELECT
  loading_id,
  loading_section,
  loading_responsible,
  loading_rate,
  loading_start,
  loading_finish,
  loading_status,
  is_shortage,
  department_id,
  hourly_rate,
  work_hours_per_day,
  work_days,
  CASE
    WHEN loading_responsible IS NULL THEN 0  -- кейс C: без исполнителя
    WHEN department_id      IS NULL THEN 0   -- кейс A: исполнитель без отдела
    WHEN hourly_rate        IS NULL THEN 0   -- кейс B: ставка не настроена
    ELSE COALESCE(loading_rate, 0) * work_hours_per_day * work_days
  END AS hours,
  CASE
    WHEN loading_responsible IS NULL THEN 0
    WHEN department_id      IS NULL THEN 0
    WHEN hourly_rate        IS NULL THEN 0
    ELSE COALESCE(loading_rate, 0) * work_hours_per_day * work_days * hourly_rate
  END AS money,
  CASE
    WHEN loading_responsible IS NULL THEN 'no_responsible'
    WHEN department_id      IS NULL THEN 'no_department'
    WHEN hourly_rate        IS NULL THEN 'no_rate'
    ELSE NULL
  END AS error_flag
FROM loading_with_workdays;

COMMENT ON VIEW v_cache_loading_money IS
  'Расчёт денежной стоимости каждой загрузки: rate × hours/day × work_days × hourly_rate';
