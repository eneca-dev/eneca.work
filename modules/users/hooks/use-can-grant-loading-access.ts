'use client'

/**
 * Клиентская проверка: может ли текущий пользователь выдавать/отзывать гранты
 * на указанного сотрудника. Зеркалит assertCanGrantLoadingAccess на сервере.
 */

import { useMemo } from 'react'
import { useFilterContext } from '@/modules/permissions/hooks/use-filter-context'

interface UseCanGrantArgs {
  employeeDepartmentId: string | null | undefined
  employeeTeamId: string | null | undefined
}

export function useCanGrantLoadingAccess({
  employeeDepartmentId,
  employeeTeamId,
}: UseCanGrantArgs): boolean {
  const { data: ctx } = useFilterContext()

  return useMemo(() => {
    if (!ctx) return false
    const has = (p: string) => ctx.permissions.includes(p)

    if (has('loadings.edit.scope.all')) return true

    if (has('loadings.edit.scope.department') && employeeDepartmentId) {
      const myDepts = [ctx.ownDepartmentId, ctx.headDepartmentId].filter(Boolean)
      if (myDepts.includes(employeeDepartmentId)) return true
    }

    if (has('loadings.edit.scope.team') && employeeTeamId) {
      const myTeams = [ctx.ownTeamId, ctx.leadTeamId].filter(Boolean)
      if (myTeams.includes(employeeTeamId)) return true
    }

    return false
  }, [ctx, employeeDepartmentId, employeeTeamId])
}
