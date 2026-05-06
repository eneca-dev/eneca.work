-- ============================================================================
-- Migration: department_budget_settings
-- Description:
--   Настройки бюджета отдела: ставка BYN/час и часов в рабочем дне.
--   Используется для расчёта calc_budget из loadings (см. v_cache_loading_money).
-- Date: 2026-04-28
-- Связано с: docs/production/budgets-calc-from-loadings.md
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Таблица
-- ============================================================================

CREATE TABLE IF NOT EXISTS department_budget_settings (
  department_id      UUID PRIMARY KEY REFERENCES departments(department_id) ON DELETE CASCADE,
  hourly_rate        NUMERIC(10,2) NOT NULL CHECK (hourly_rate >= 0),
  work_hours_per_day NUMERIC(4,2)  NOT NULL DEFAULT 8 CHECK (work_hours_per_day > 0 AND work_hours_per_day <= 24),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by         UUID REFERENCES profiles(user_id)
);

COMMENT ON TABLE department_budget_settings IS
  'Настройки бюджета отдела: ставка BYN/час и часов в рабочем дне. Источник для расчёта v_cache_loading_money.';

-- ============================================================================
-- 2. Permission
-- ============================================================================

INSERT INTO permissions (name, description)
VALUES ('budgets.settings.edit', 'Редактирование настроек бюджета (ставки отделов)')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 3. RLS — паттерн как в budgets_rls
-- ============================================================================

ALTER TABLE department_budget_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dbs_select_policy ON department_budget_settings;
CREATE POLICY dbs_select_policy ON department_budget_settings
FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS dbs_insert_policy ON department_budget_settings;
CREATE POLICY dbs_insert_policy ON department_budget_settings
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions perm ON perm.id = rp.permission_id
    WHERE ur.user_id = auth.uid() AND perm.name = 'budgets.settings.edit'
  )
);

DROP POLICY IF EXISTS dbs_update_policy ON department_budget_settings;
CREATE POLICY dbs_update_policy ON department_budget_settings
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions perm ON perm.id = rp.permission_id
    WHERE ur.user_id = auth.uid() AND perm.name = 'budgets.settings.edit'
  )
);

DROP POLICY IF EXISTS dbs_delete_policy ON department_budget_settings;
CREATE POLICY dbs_delete_policy ON department_budget_settings
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions perm ON perm.id = rp.permission_id
    WHERE ur.user_id = auth.uid() AND perm.name = 'budgets.settings.edit'
  )
);

-- ============================================================================
-- 4. Сидер: 17.85 BYN/час, 8h/day для всех существующих отделов
-- ============================================================================

INSERT INTO department_budget_settings (department_id, hourly_rate, work_hours_per_day)
SELECT department_id, 17.85, 8.00 FROM departments
ON CONFLICT (department_id) DO NOTHING;

COMMIT;
