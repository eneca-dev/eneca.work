-- ============================================================================
-- Migration: Budgets System - Permissions
-- Description: Add budget permissions and assign to roles
-- Date: 2025-12-09
-- ============================================================================

-- ============================================================================
-- 1. Добавляем permissions для бюджетов
-- ============================================================================

INSERT INTO permissions (name, description) VALUES
  ('budgets.view.all', 'Просмотр всех бюджетов (обходит RLS)'),
  ('budgets.create', 'Создание бюджетов'),
  ('budgets.edit', 'Редактирование бюджетов (изменение суммы, тегов)'),
  ('budgets.delete', 'Удаление/деактивация бюджетов'),
  ('budgets.manage_tags', 'Управление справочником тегов бюджетов');

-- ============================================================================
-- 2. Назначаем permissions ролям
-- ============================================================================

-- Admin - все права
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin'
AND p.name IN (
  'budgets.view.all',
  'budgets.create',
  'budgets.edit',
  'budgets.delete',
  'budgets.manage_tags'
);

-- Subdivision Head (начальник подразделения) - просмотр всех + создание/редактирование
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'subdivision_head'
AND p.name IN (
  'budgets.view.all',
  'budgets.create',
  'budgets.edit'
);

-- Department Head (руководитель отдела) - создание и редактирование
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'department_head'
AND p.name IN (
  'budgets.create',
  'budgets.edit'
);

-- Project Manager - создание и редактирование (для своих проектов через RLS)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'project_manager'
AND p.name IN (
  'budgets.create',
  'budgets.edit'
);

-- Team Lead - только просмотр (через RLS увидит только свои разделы)
-- Нет дополнительных прав, RLS сам даст доступ к своим разделам

-- User - нет прав на бюджеты
