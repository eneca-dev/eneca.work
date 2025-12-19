-- ============================================================================
-- Migration: Project Reports System
-- Description: Отчеты руководителей проектов к стадиям
-- Date: 2025-12-18
-- Author: Claude Code
-- ============================================================================

-- ============================================================================
-- ШАГ 1: PERMISSIONS (сначала добавляем разрешения)
-- ============================================================================

INSERT INTO permissions (name, description) VALUES
  ('project_reports.create', 'Создание отчетов к стадиям'),
  ('project_reports.edit', 'Редактирование и удаление отчетов к стадиям');

-- ============================================================================
-- ШАГ 2: ROLE PERMISSIONS (назначаем права ролям)
-- ============================================================================

-- Admin: все права
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin'
  AND p.name IN (
    'project_reports.create',
    'project_reports.edit'
  );

-- Project Manager: все права
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'project_manager'
  AND p.name IN (
    'project_reports.create',
    'project_reports.edit'
  );

-- ============================================================================
-- ШАГ 3: CREATE TABLE
-- ============================================================================

CREATE TABLE project_reports (
  report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL REFERENCES stages(stage_id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE project_reports IS 'Отчеты руководителей проектов к стадиям';
COMMENT ON COLUMN project_reports.report_id IS 'Уникальный идентификатор отчета';
COMMENT ON COLUMN project_reports.stage_id IS 'Стадия, к которой относится отчет';
COMMENT ON COLUMN project_reports.comment IS 'Комментарий руководителя проекта';
COMMENT ON COLUMN project_reports.created_by IS 'Автор отчета';
COMMENT ON COLUMN project_reports.created_at IS 'Дата создания';
COMMENT ON COLUMN project_reports.updated_at IS 'Дата последнего обновления';

-- ============================================================================
-- ШАГ 4: INDEXES
-- ============================================================================

-- Основной индекс для поиска отчетов по стадии
CREATE INDEX idx_project_reports_stage_id ON project_reports(stage_id);

-- Индекс для сортировки по дате (последние отчеты)
CREATE INDEX idx_project_reports_created_at ON project_reports(created_at DESC);

-- ============================================================================
-- ШАГ 5: TRIGGERS
-- ============================================================================

-- Автообновление updated_at при изменении
CREATE TRIGGER update_project_reports_updated_at
  BEFORE UPDATE ON project_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ШАГ 6: ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE project_reports ENABLE ROW LEVEL SECURITY;

-- SELECT: все authenticated пользователи могут просматривать отчеты
CREATE POLICY project_reports_select_policy ON project_reports
FOR SELECT USING (
  auth.uid() IS NOT NULL
);

-- INSERT: только с разрешением project_reports.create
CREATE POLICY project_reports_insert_policy ON project_reports
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions perm ON perm.id = rp.permission_id
    WHERE ur.user_id = auth.uid()
      AND perm.name = 'project_reports.create'
  )
);

-- UPDATE: только с разрешением project_reports.edit
CREATE POLICY project_reports_update_policy ON project_reports
FOR UPDATE USING (
  EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions perm ON perm.id = rp.permission_id
    WHERE ur.user_id = auth.uid()
      AND perm.name = 'project_reports.edit'
  )
);

-- DELETE: используем то же разрешение project_reports.edit
CREATE POLICY project_reports_delete_policy ON project_reports
FOR DELETE USING (
  EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions perm ON perm.id = rp.permission_id
    WHERE ur.user_id = auth.uid()
      AND perm.name = 'project_reports.edit'
  )
);

-- ============================================================================
-- ШАГ 7: VERIFICATION
-- ============================================================================

-- Проверяем permissions
DO $$
BEGIN
  RAISE NOTICE 'Проверка permissions:';
END $$;

SELECT name, description
FROM permissions
WHERE name LIKE 'project_reports.%'
ORDER BY name;

-- Проверяем назначение прав
DO $$
BEGIN
  RAISE NOTICE 'Проверка role_permissions:';
END $$;

SELECT r.name as role, p.name as permission
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
JOIN permissions p ON p.id = rp.permission_id
WHERE p.name LIKE 'project_reports.%'
ORDER BY r.name, p.name;

-- Проверяем таблицу
DO $$
BEGIN
  RAISE NOTICE 'Проверка таблицы project_reports:';
END $$;

SELECT
  table_name,
  (SELECT count(*) FROM information_schema.columns WHERE table_name = 'project_reports') as columns_count
FROM information_schema.tables
WHERE table_name = 'project_reports';

-- Проверяем индексы
DO $$
BEGIN
  RAISE NOTICE 'Проверка индексов:';
END $$;

SELECT indexname
FROM pg_indexes
WHERE tablename = 'project_reports'
ORDER BY indexname;

-- Проверяем RLS
DO $$
BEGIN
  RAISE NOTICE 'Проверка RLS:';
END $$;

SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'project_reports';

-- Проверяем политики
DO $$
BEGIN
  RAISE NOTICE 'Проверка RLS политик:';
END $$;

SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'project_reports'
ORDER BY cmd;
