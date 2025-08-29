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

  if (Object.prototype.hasOwnProperty.call(defaults, 'department')) {
    orgStore.setDepartment(defaults.department ?? null)
    orgStore.setTeam(null)
    orgStore.setEmployee(null)
  }
  if (Object.prototype.hasOwnProperty.call(defaults, 'team')) {
    orgStore.setTeam(defaults.team ?? null)
    orgStore.setEmployee(null)
  }
  if (Object.prototype.hasOwnProperty.call(defaults, 'manager')) {
    // У нас нет явного менеджера как фильтра в отчётах, но используем его для ограничения проектов
    projStore.setProject(null)
    projStore.setStage(null)
    projStore.setObject(null)
    projStore.setSection(null)
  }

  // Догружаем проекты под PM, если есть лок по manager
  if (defaults.manager) {
    await useReportsProjectFiltersStore.getState().loadProjectsForManager?.(defaults.manager)
  } else {
    await useReportsProjectFiltersStore.getState().loadProjects?.()
  }

  // Проставим lockedFilters в оба стора для disable
  // @ts-ignore храним в runtime
  useReportsOrgFiltersStore.setState({ lockedFilters })
  // @ts-ignore
  useReportsProjectFiltersStore.setState({ lockedFilters })

  return { locked: new Set(lockedFilters) }
}


