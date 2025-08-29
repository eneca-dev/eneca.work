import { computeDefaults, type FilterType } from '@/modules/filters/locks'
import { getFiltersPermissionContextAsync } from '@/modules/permissions/integration/filters-permission-context'
import { useUserStore } from '@/stores/useUserStore'
import { useProjectFilterStore } from '@/modules/projects/filters/store'

export async function applyProjectLocks(): Promise<{ locked: Set<FilterType> }> {
  // Собираем permissions + орг-контекст
  const base = await getFiltersPermissionContextAsync()
  const userId = useUserStore.getState().id ?? null

  // Вычисляем блокировки и дефолты
  const { lockedFilters, defaults } = computeDefaults({
    permissions: base.permissions,
    departmentId: base.departmentId,
    teamId: base.teamId,
    managerId: userId,
  })

  console.log('projects_filter_lock:context', {
    permissions: base.permissions,
    departmentId: base.departmentId,
    teamId: base.teamId,
    userId,
  })
  console.log('projects_filter_lock:computed', { lockedFilters, defaults })

  // Применяем дефолты ДО фиксации lockedFilters
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

  // Применяем изменения состояния
  if (Object.keys(updates).length > 0) {
    console.log('projects_filter_lock:apply_updates', updates)
    useProjectFilterStore.setState(updates)
  }

  // Догружаем проекты в зависимости от результата
  if (defaults.manager) {
    console.log('projects_filter_lock:load_projects_for_manager', { managerId: defaults.manager })
    await useProjectFilterStore.getState().loadProjects(defaults.manager)
  } else {
    console.log('projects_filter_lock:load_all_projects_admin_or_no_pm_lock')
    await useProjectFilterStore.getState().loadProjects(null)
  }

  // Фиксируем набор заблокированных фильтров в сторе (для совместимости)
  useProjectFilterStore.setState({ lockedFilters })
  console.log('projects_filter_lock:set_locked_filters', { lockedFilters })
  console.log('projects_filter_lock:final_state', {
    selectedManagerId: useProjectFilterStore.getState().selectedManagerId,
    lockedFilters: useProjectFilterStore.getState().lockedFilters,
  })

  return { locked: new Set(lockedFilters) }
}


