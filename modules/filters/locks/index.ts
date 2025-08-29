// Универсальные функции для управления блокировками фильтров
// Не зависят от UI/сторов; только чистая логика

export type FilterType = 'manager' | 'project' | 'stage' | 'object' | 'department' | 'team' | 'employee'

export interface BasePermissionContext {
  permissions: string[]
}

export interface OrgContext {
  departmentId?: string | null
  teamId?: string | null
}

export interface ProjectContext {
  managerId?: string | null
}

export type PermissionContext = BasePermissionContext & Partial<OrgContext & ProjectContext>

export interface LockResult<TExtra extends Record<string, any> = {}> {
  lockedFilters: FilterType[]
  defaults: Partial<Record<FilterType, string | null>> & TExtra
}

export function deriveLockedFilters(permissions: string[]): Set<FilterType> {
  const locks = new Set<FilterType>()
  if (!permissions || permissions.length === 0) return locks

  if (permissions.includes('hierarchy.is_admin')) {
    return new Set<FilterType>()
  }

  if (permissions.includes('hierarchy.is_department_head')) {
    locks.add('department')
  }

  if (permissions.includes('hierarchy.is_team_lead') || permissions.includes('hierarchy.is_user')) {
    locks.add('department')
    locks.add('team')
  }

  if (permissions.includes('hierarchy.is_project_manager')) {
    locks.add('manager')
  }

  return locks
}

export function computeDefaults(ctx: PermissionContext): LockResult<{ managerId?: string | null }> {
  const locks = deriveLockedFilters(ctx.permissions || [])
  const defaults: Partial<Record<FilterType, string | null>> & { managerId?: string | null } = {}

  if (locks.has('department')) {
    defaults.department = ctx.departmentId ?? null
    defaults.team = null
    defaults.employee = null
  }

  if (locks.has('team')) {
    defaults.team = ctx.teamId ?? null
    defaults.employee = null
  }

  if (locks.has('manager')) {
    defaults.manager = ctx.managerId ?? null
    defaults.project = null
    defaults.stage = null
    defaults.object = null
  }

  return { lockedFilters: Array.from(locks), defaults }
}


