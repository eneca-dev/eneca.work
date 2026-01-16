'use client'

import { useMemo } from 'react'
import { useUserStore } from '@/stores/useUserStore'
import { useHasPermission } from '@/modules/permissions/hooks/usePermissions'

/**
 * Хук для проверки прав доступа к управлению чекпоинтами раздела
 *
 * Логика (синхронизирована с server-side canManageCheckpoint):
 * 1. checkpoints.manage.all → разрешено (admin)
 * 2. Динамическая проверка контекста по ролям:
 *    - user: ТОЛЬКО свои разделы (где он ответственный)
 *    - project_manager: Я ответственный ИЛИ менеджер проекта
 *    - department_head: Я ответственный ИЛИ менеджер проекта ИЛИ ответственный из моего отдела
 *    - team_lead: Я ответственный ИЛИ менеджер проекта ИЛИ ответственный из моей команды
 * 3. Иначе → запрещено
 *
 * @param sectionResponsibleId - ID ответственного за раздел (section.section_responsible)
 * @param projectManagerId - ID менеджера проекта (опционально, для ролей кроме user)
 * @returns true если пользователь может управлять чекпоинтами раздела
 */
export function useCanManageCheckpoint(
  sectionResponsibleId: string | null,
  projectManagerId?: string | null
): boolean {
  const user = useUserStore((state) => state.user)
  const userRole = useUserStore((state) => state.userRole)
  const hasManageAll = useHasPermission('checkpoints.manage.all')

  return useMemo(() => {
    // Не авторизован
    if (!user || !userRole) return false

    // Admin с permission checkpoints.manage.all
    if (hasManageAll) return true

    // Я ответственный за раздел (работает для всех ролей)
    if (sectionResponsibleId === user.id) return true

    // СТРОГАЯ ПРОВЕРКА ДЛЯ РОЛИ USER:
    // Если роль user и он не ответственный — доступ запрещен
    if (userRole === 'user') return false

    // Для остальных ролей (project_manager, department_head, team_lead):
    // Проверяем, является ли пользователь менеджером проекта
    if (projectManagerId && projectManagerId === user.id) return true

    // Для department_head и team_lead:
    // Дополнительные проверки (ответственный из отдела/команды) выполняются на сервере.
    // На клиенте мы не можем получить эту информацию без дополнительных запросов,
    // поэтому полагаемся на server-side проверку в Actions.
    // Здесь возвращаем false, чтобы UI был строгим.
    return false
  }, [user, userRole, hasManageAll, sectionResponsibleId, projectManagerId])
}
