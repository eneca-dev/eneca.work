'use client'

/**
 * Hooks для проверки прав на загрузки.
 *
 * Используют один pure-helper `canEditLoading` (общий с сервером) — гарантия
 * что клиент и сервер принимают одинаковые решения. Никаких доп. запросов:
 * UserFilterContext уже в TanStack Query кэше (10min staleTime).
 */

import { useMemo } from 'react'
import { useFilterContext } from './use-filter-context'
import {
  canEditLoading,
  canBulkShiftDepartment,
  isRestrictedToOwnDepartment,
  type LoadingPermissionContext,
} from '../utils/can-edit-loading'

/**
 * Может ли юзер редактировать данную загрузку.
 *
 * Возвращает false для null/loading state — UI скрывает действия пока контекст
 * не подгружен.
 *
 * Subdivision shortcut: если у юзера `loadings.edit.scope.subdivision` и
 * `loading.subdivisionId` не пробросили (равно null) — оптимистично возвращаем
 * true. Server-side проверка отсечёт реальные нарушения. См. spec §6.3.
 */
export function useCanEditLoading(
  loading: LoadingPermissionContext | null
): boolean {
  const { data: ctx } = useFilterContext()

  return useMemo(() => {
    if (!loading || !ctx) return false

    // Optimistic UI shortcuts: если поле scope не пробросили на клиент
    // (например, sections-page view не отдаёт team_id) — доверяем view scope
    // + серверной проверке. Server-side check отсечёт ложные позитивы.
    const has = (p: string) => ctx.permissions.includes(p)

    if (loading.subdivisionId === null && has('loadings.edit.scope.subdivision')) {
      return true
    }
    if (loading.teamId === null && has('loadings.edit.scope.team')) {
      return true
    }

    return canEditLoading(loading, ctx)
  }, [loading, ctx])
}

/**
 * Может ли юзер запустить bulk shift для данного отдела.
 */
export function useCanBulkShiftDepartment(departmentId: string | null): boolean {
  const { data: ctx } = useFilterContext()

  return useMemo(() => {
    if (!departmentId || !ctx) return false
    return canBulkShiftDepartment(departmentId, ctx)
  }, [departmentId, ctx])
}

/**
 * Применяется ли к юзеру правило "строго в своём отделе".
 * Используется в модалке для ограничения списка сотрудников/разделов.
 */
export function useIsRestrictedToOwnDepartment(): boolean {
  const { data: ctx } = useFilterContext()
  return useMemo(() => (ctx ? isRestrictedToOwnDepartment(ctx) : false), [ctx])
}

/**
 * Есть ли у юзера хотя бы одна edit-scope permission на загрузки.
 * Полезно для гейтинга "глобальной" кнопки создания загрузки на разделе.
 */
export function useHasAnyLoadingEditPermission(): boolean {
  const { data: ctx } = useFilterContext()
  return useMemo(() => {
    if (!ctx) return false
    return ctx.permissions.some((p) => p.startsWith('loadings.edit.scope.'))
  }, [ctx])
}
