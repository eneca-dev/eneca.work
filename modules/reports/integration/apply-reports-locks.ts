import { computeDefaults, type FilterType } from '@/modules/filters/locks'
import { getFiltersPermissionContextAsync } from '@/modules/permissions/integration/filters-permission-context'
import { useReportsOrgFiltersStore } from '@/modules/reports/filters/store'
import { useReportsProjectFiltersStore } from '@/modules/reports/filters/projectStore'
import { useUserStore } from '@/stores/useUserStore'

export async function applyReportsLocks(): Promise<{ locked: Set<FilterType> }> {
  const base = await getFiltersPermissionContextAsync()
  const userId = useUserStore.getState().id ?? null

  const { lockedFilters, defaults } = computeDefaults({
    permissions: base.permissions,
    departmentId: base.departmentId,
    teamId: base.teamId,
    managerId: userId,
  })

  const orgStore = useReportsOrgFiltersStore.getState()
  const projStore = useReportsProjectFiltersStore.getState()

  // setSecurityDefaults автоматически применяет defaults к locked filters
  // Это защищает от использования persisted значений из localStorage, которые нарушают права доступа
  orgStore.setSecurityDefaults({
    defaultDepartmentId: defaults.department ?? null,
    defaultTeamId: defaults.team ?? null,
    defaultEmployeeId: null, // обычно employee не локается
    lockedFilters: lockedFilters.filter(f =>
      ['department', 'team', 'employee'].includes(f)
    ) as Array<'department' | 'team' | 'employee'>
  })

  projStore.setSecurityDefaults({
    defaultProjectId: null, // обычно проекты не локаются по умолчанию
    lockedFilters: lockedFilters.filter(f =>
      ['manager', 'project', 'stage', 'object', 'section'].includes(f)
    ) as Array<'manager' | 'project' | 'stage' | 'object' | 'department' | 'team' | 'employee'>
  })

  return { locked: new Set(lockedFilters) }
}


