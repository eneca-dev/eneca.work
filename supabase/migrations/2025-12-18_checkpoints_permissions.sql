-- ============================================================================
-- Миграция: Добавление permissions для модуля Checkpoints
-- ============================================================================
-- Описание:
-- - Добавляет 2 permission для управления чекпоинтами
-- - checkpoints.manage.all — CRUD на всех проектах (только admin)
-- - checkpoints.types.manage — управление справочником типов (только admin)
-- - Остальные роли управляют чекпоинтами через динамическую проверку контекста
-- ============================================================================

-- 1. Добавить permissions для чекпоинтов
INSERT INTO public.permissions (name, description)
VALUES
  ('checkpoints.manage.all', 'CRUD чекпоинтов на всех проектах (только admin)'),
  ('checkpoints.types.manage', 'Управление справочником типов чекпоинтов (только admin)')
ON CONFLICT (name) DO NOTHING;

-- 2. Назначить permissions только роли admin
-- Остальные роли (department_head, project_manager, team_lead, user)
-- управляют чекпоинтами через динамическую проверку контекста в canManageCheckpoint()
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'admin'
  AND p.name IN ('checkpoints.manage.all', 'checkpoints.types.manage')
ON CONFLICT DO NOTHING;
