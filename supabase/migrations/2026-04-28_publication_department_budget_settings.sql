-- ============================================================================
-- Migration: Add department_budget_settings to supabase_realtime publication
-- Description:
--   Чтобы изменение ставок отдела одним пользователем мгновенно
--   отражалось у других через Realtime — нужно опубликовать таблицу.
-- Date: 2026-04-28
-- Связано с: docs/production/budgets-calc-from-loadings.md
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'department_budget_settings'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE department_budget_settings';
  END IF;
END $$;
