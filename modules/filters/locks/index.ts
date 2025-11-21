// Универсальные функции для управления блокировками фильтров
// Не зависят от UI/сторов; только чистая логика

export type FilterType = 'subdivision' | 'manager' | 'project' | 'stage' | 'object' | 'department' | 'team' | 'employee'

export interface BasePermissionContext {
  permissions: string[]
}

export interface OrgContext {
  subdivisionId?: string | null
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

  // subdivision_head может видеть только своё подразделение
  if (permissions.includes('hierarchy.is_subdivision_head')) {
    locks.add('subdivision')
  }

  // department_head может видеть только свой отдел (и не может менять подразделение)
  if (permissions.includes('hierarchy.is_department_head')) {
    locks.add('subdivision')
    locks.add('department')
  }

  // team_lead и user могут видеть только свою команду (и не могут менять подразделение/отдел)
  if (permissions.includes('hierarchy.is_team_lead') || permissions.includes('hierarchy.is_user')) {
    locks.add('subdivision')
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

  // Subdivision блокируется для subdivision_head, department_head, team_lead, user
  if (locks.has('subdivision')) {
    defaults.subdivision = ctx.subdivisionId ?? null
    defaults.department = null
    defaults.team = null
    defaults.employee = null
  }

  // Department блокируется для department_head, team_lead, user
  if (locks.has('department')) {
    defaults.department = ctx.departmentId ?? null
    defaults.team = null
    defaults.employee = null
  }

  // Team блокируется для team_lead, user
  if (locks.has('team')) {
    defaults.team = ctx.teamId ?? null
    defaults.employee = null
  }

  // Manager блокируется для project_manager
  if (locks.has('manager')) {
    defaults.manager = ctx.managerId ?? null
    defaults.project = null
    defaults.stage = null
    defaults.object = null
  }

  return { lockedFilters: Array.from(locks), defaults }
}


