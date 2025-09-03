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

  // Применяем дефолты ДО фиксации lockedFilters, НЕ затирая уже выбранные пользователем значения
  const current = useProjectFilterStore.getState()
  const updates: any = {}

  if (Object.prototype.hasOwnProperty.call(defaults, 'department') && !current.selectedDepartmentId) {
    updates.selectedDepartmentId = defaults.department ?? null
    // дочерние только если мы действительно меняем department
    if (updates.selectedDepartmentId) {
      updates.selectedTeamId = null
      updates.selectedEmployeeId = null
    }
  }
  if (Object.prototype.hasOwnProperty.call(defaults, 'team') && !current.selectedTeamId) {
    updates.selectedTeamId = defaults.team ?? null
    if (updates.selectedTeamId) {
      updates.selectedEmployeeId = null
    }
  }
  if (Object.prototype.hasOwnProperty.call(defaults, 'manager') && !current.selectedManagerId) {
    updates.selectedManagerId = defaults.manager ?? null
    if (updates.selectedManagerId) {
      updates.selectedProjectId = null
      updates.selectedStageId = null
      updates.selectedObjectId = null
    }
  }

  // Применяем изменения состояния
  if (Object.keys(updates).length > 0) {
    console.log('projects_filter_lock:apply_updates', updates)
    useProjectFilterStore.setState(updates)
  }

  // Догружаем проекты только при первом выставлении менеджера
  if (!current.selectedManagerId && defaults.manager) {
    console.log('projects_filter_lock:load_projects_for_manager', { managerId: defaults.manager })
    await useProjectFilterStore.getState().loadProjects(defaults.manager)
  } else {
    // если менеджер уже выбран, не трогаем текущие проекты/фильтры
    console.log('projects_filter_lock:keep_existing_projects_selection')
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


