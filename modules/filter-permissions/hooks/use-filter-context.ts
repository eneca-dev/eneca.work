'use client'

/**
 * Hook для получения контекста фильтрации пользователя
 *
 * Использует TanStack Query для кэширования.
 * Контекст загружается один раз и редко меняется.
 *
 * Поддерживает debug mode с переопределением ролей через DebugPanel.
 */

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/modules/cache'
import { getFilterContext } from '../server/get-filter-context'
import { resolveFilterScope } from '../utils/scope-resolver'
import { useDebugStore, isDebugMode } from '@/stores/debug-store'
import { debugLog, debugGroup } from '@/lib/debug-logger'
import type { UserFilterContext, FilterScopePermission, SystemRole } from '../types'
import { PERMISSION_TO_SCOPE } from '../types'

/**
 * Маппинг роли → permission для debug mode
 */
const ROLE_TO_PERMISSION: Record<SystemRole, FilterScopePermission> = {
  admin: 'filters.scope.all',
  subdivision_head: 'filters.scope.subdivision',
  department_head: 'filters.scope.department',
  project_manager: 'filters.scope.managed_projects',
  team_lead: 'filters.scope.team',
  user: 'filters.scope.team',
}

/**
 * Хук для получения контекста фильтрации текущего пользователя.
 *
 * В debug mode учитывает roleOverride из DebugPanel.
 *
 * @returns Контекст фильтрации с информацией о scope и разрешениях
 *
 * @example
 * ```tsx
 * const { data: filterContext, isLoading } = useFilterContext()
 *
 * if (filterContext?.scope.isLocked) {
 *   // Показываем locked badge
 * }
 * ```
 */
export function useFilterContext() {
  const roleOverride = useDebugStore((s) => s.roleOverride)
  const isDebug = isDebugMode()

  const query = useQuery<UserFilterContext | null>({
    queryKey: queryKeys.filterPermissions.context(),
    queryFn: async () => {
      debugLog.info('filter-permissions', 'Loading filter context from server...')
      const context = await getFilterContext()
      debugLog.info('filter-permissions', 'Filter context loaded', {
        userId: context?.userId,
        roles: context?.roles,
        filterPermissions: context?.filterPermissions,
        scopeLevel: context?.scope.level,
      })
      return context
    },
    staleTime: 10 * 60 * 1000, // 10 минут - контекст редко меняется
    gcTime: 30 * 60 * 1000, // 30 минут в кэше
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  // Применяем debug override если активен
  const data = useMemo(() => {
    if (!query.data) return null
    if (!isDebug || !roleOverride) return query.data

    debugGroup('Debug Role Override', () => {
      debugLog.warn('filter-permissions', 'Applying debug role override', {
        originalRole: query.data.primaryRole,
        overrideRole: roleOverride.role,
      })
    })

    // Создаём новый контекст с переопределённой ролью
    const overriddenPermissions: FilterScopePermission[] = [
      ROLE_TO_PERMISSION[roleOverride.role],
    ]

    // Вычисляем новый scope на основе переопределённой роли
    const overriddenScope = resolveFilterScope(overriddenPermissions, {
      ownTeamId: query.data.ownTeamId,
      ownDepartmentId: query.data.ownDepartmentId,
      ownSubdivisionId: query.data.ownSubdivisionId,
      leadTeamId: roleOverride.teamId || query.data.leadTeamId,
      headDepartmentId: roleOverride.departmentId || query.data.headDepartmentId,
      headSubdivisionId: roleOverride.subdivisionId || query.data.headSubdivisionId,
      managedProjectIds: roleOverride.projectIds || query.data.managedProjectIds,
    })

    debugLog.info('filter-permissions', 'Overridden scope computed', {
      level: overriddenScope.level,
      isLocked: overriddenScope.isLocked,
      teamIds: overriddenScope.teamIds,
      departmentIds: overriddenScope.departmentIds,
    })

    return {
      ...query.data,
      roles: [roleOverride.role],
      primaryRole: roleOverride.role,
      filterPermissions: overriddenPermissions,
      scope: overriddenScope,
      // Маркируем что это debug override
      _debugOverride: true,
    } as UserFilterContext & { _debugOverride?: boolean }
  }, [query.data, isDebug, roleOverride])

  return {
    ...query,
    data,
  }
}
