-- ============================================================================
-- Migration: Budgets System - Tables
-- Description: Create budget management tables with versioning and tags
-- Date: 2025-12-09
-- ============================================================================

-- ============================================================================
-- 1. ENUM TYPE
-- ============================================================================

CREATE TYPE budget_entity_type AS ENUM ('section', 'object', 'stage', 'project');

-- ============================================================================
-- 2. BUDGET TAGS (справочник тегов)
-- ============================================================================

CREATE TABLE budget_tags (
  tag_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color VARCHAR(7) NOT NULL DEFAULT '#6B7280',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE budget_tags IS 'Справочник тегов для классификации бюджетов';
COMMENT ON COLUMN budget_tags.name IS 'Название тега (уникальное)';
COMMENT ON COLUMN budget_tags.color IS 'HEX цвет для отображения в UI';

-- ============================================================================
-- 3. BUDGETS (основная таблица бюджетов)
-- ============================================================================

CREATE TABLE budgets (
  budget_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type budget_entity_type NOT NULL,
  entity_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Уникальность: один бюджет с таким именем на сущность
  CONSTRAINT budgets_entity_name_unique UNIQUE (entity_type, entity_id, name)
);

COMMENT ON TABLE budgets IS 'Плановые бюджеты для разделов, объектов, стадий и проектов';
COMMENT ON COLUMN budgets.entity_type IS 'Тип сущности: section, object, stage, project';
COMMENT ON COLUMN budgets.entity_id IS 'ID сущности (section_id, object_id, stage_id, project_id)';
COMMENT ON COLUMN budgets.name IS 'Название бюджета';
COMMENT ON COLUMN budgets.is_active IS 'Активен ли бюджет (soft delete)';

-- Индексы для быстрого поиска
CREATE INDEX idx_budgets_entity ON budgets(entity_type, entity_id);
CREATE INDEX idx_budgets_created_by ON budgets(created_by);
CREATE INDEX idx_budgets_active ON budgets(is_active) WHERE is_active = true;

-- Триггер для updated_at
CREATE OR REPLACE FUNCTION update_budgets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER budgets_updated_at_trigger
  BEFORE UPDATE ON budgets
  FOR EACH ROW
  EXECUTE FUNCTION update_budgets_updated_at();

-- ============================================================================
-- 4. BUDGET VERSIONS (история изменений сумм)
-- ============================================================================

CREATE TABLE budget_versions (
  version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES budgets(budget_id) ON DELETE CASCADE,
  planned_amount NUMERIC(15,2) NOT NULL CHECK (planned_amount >= 0),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  comment TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- effective_to должен быть >= effective_from
  CONSTRAINT budget_versions_dates_check CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

COMMENT ON TABLE budget_versions IS 'История изменений сумм бюджетов';
COMMENT ON COLUMN budget_versions.planned_amount IS 'Плановая сумма бюджета в BYN';
COMMENT ON COLUMN budget_versions.effective_from IS 'Дата начала действия этой суммы';
COMMENT ON COLUMN budget_versions.effective_to IS 'Дата окончания (NULL = текущая версия)';
COMMENT ON COLUMN budget_versions.comment IS 'Комментарий/причина изменения';

-- Индексы
CREATE INDEX idx_budget_versions_budget ON budget_versions(budget_id);
CREATE INDEX idx_budget_versions_current ON budget_versions(budget_id) WHERE effective_to IS NULL;
CREATE INDEX idx_budget_versions_dates ON budget_versions(effective_from, effective_to);

-- ============================================================================
-- 5. BUDGET TAG LINKS (связь бюджетов с тегами M2M)
-- ============================================================================

CREATE TABLE budget_tag_links (
  budget_id UUID NOT NULL REFERENCES budgets(budget_id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES budget_tags(tag_id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (budget_id, tag_id)
);

COMMENT ON TABLE budget_tag_links IS 'Связь бюджетов с тегами (M2M)';

-- Индекс для поиска бюджетов по тегу
CREATE INDEX idx_budget_tag_links_tag ON budget_tag_links(tag_id);

-- ============================================================================
-- 6. ALTER WORK_LOGS - добавляем budget_id
-- ============================================================================

ALTER TABLE work_logs
ADD COLUMN budget_id UUID REFERENCES budgets(budget_id) ON DELETE SET NULL;

COMMENT ON COLUMN work_logs.budget_id IS 'Бюджет, с которого списывается этот расход';

CREATE INDEX idx_work_logs_budget ON work_logs(budget_id) WHERE budget_id IS NOT NULL;

-- ============================================================================
-- 7. INITIAL DATA - начальные теги
-- ============================================================================

INSERT INTO budget_tags (name, color, description) VALUES
  ('Основной', '#1E7260', 'Основной бюджет раздела'),
  ('Премиальный', '#F59E0B', 'Премиальный фонд'),
  ('Дополнительный', '#6366F1', 'Дополнительный бюджет');
