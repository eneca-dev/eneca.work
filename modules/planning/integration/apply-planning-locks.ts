import { computeDefaults, type FilterType } from '@/modules/filters/locks'
import { getFiltersPermissionContextAsync } from '@/modules/permissions/integration/filters-permission-context'
import { useFilterStore } from '@/modules/planning/filters/store'
import { useUserStore } from '@/stores/useUserStore'

// Применение блокировок фильтров для модуля Планирование (по аналогии с projects)
export async function applyPlanningLocks(): Promise<{ locked: Set<FilterType> }> {
  const base = await getFiltersPermissionContextAsync()
  const userId = useUserStore.getState().id ?? null

  const { lockedFilters, defaults } = computeDefaults({
    permissions: base.permissions,
    departmentId: base.departmentId,
    teamId: base.teamId,
    managerId: userId,
  })

  const updates: any = {}

  if (Object.prototype.hasOwnProperty.call(defaults, 'department')) {
    updates.selectedDepartmentId = defaults.department ?? null
    updates.selectedTeamId = null
    updates.selectedEmployeeId = null
  }
  if (Object.prototype.hasOwnProperty.call(defaults, 'team')) {
    updates.selectedTeamId = defaults.team ?? null
    updates.selectedEmployeeId = null
  }
  if (Object.prototype.hasOwnProperty.call(defaults, 'manager')) {
    updates.selectedManagerId = defaults.manager ?? null
    updates.selectedProjectId = null
    updates.selectedStageId = null
    updates.selectedObjectId = null
  }

  if (Object.keys(updates).length > 0) {
    useFilterStore.setState(updates)
  }

  // Загрузка данных в зависимости от блокировок
  if (defaults.manager) {
    await useFilterStore.getState().loadProjects(defaults.manager)
  } else {
    await useFilterStore.getState().loadProjects(null)
  }

  useFilterStore.setState({ lockedFilters })
  return { locked: new Set(lockedFilters) }
}


