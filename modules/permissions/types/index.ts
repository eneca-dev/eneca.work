// Основные типы для системы разрешений

// Filter Scope types (перенесены из filter-permissions)
export type {
  FilterScopePermission,
  FilterScopeLevel,
  FilterScope,
  UserFilterContext,
  LockableFilterKey,
  LockedFilter,
  FilterLocks,
  SystemRole,
} from './filter-scope'

export {
  PERMISSION_PRIORITY,
  PERMISSION_TO_SCOPE,
  ROLE_PRIORITY,
  getPrimaryRole,
} from './filter-scope'

// === Org Context (для unified permissions store) ===

/**
 * Организационный контекст пользователя.
 * Содержит информацию о позиции в орг. структуре и руководящих ролях.
 */
export interface OrgContext {
  /** ID команды пользователя */
  ownTeamId: string | null
  /** ID отдела пользователя */
  ownDepartmentId: string | null
  /** ID подразделения пользователя */
  ownSubdivisionId: string | null

  /** ID команды, которой руководит (team_lead) */
  leadTeamId: string | null
  /** ID отдела, которым руководит (department_head) */
  headDepartmentId: string | null
  /** ID подразделения, которым руководит (subdivision_head) */
  headSubdivisionId: string | null

  /** ID управляемых проектов (project_manager / lead_engineer) */
  managedProjectIds: string[]
}

export interface Permission {
  id: string
  name: string
  description: string
  created_at: string
}

export interface Role {
  id: string
  name: string
  description: string | null
  created_at: string
}

export interface RolePermission {
  id: string
  role_id: string
  permission_id: string
  created_at: string
}

export interface UserRole {
  user_id: string
  role_id: string
}

export interface DataConstraint {
  type: 'scope' | 'filter' | 'access'
  target: string
  restriction: string
}

export interface UserPermissions {
  permissions: string[]
  constraints: DataConstraint[]
  roles: string[]
}

export interface ModulePermissions {
  canView: boolean
  canEdit: boolean
  canCreate: boolean
  canDelete: boolean
  canAdmin: boolean
}

export interface DataScope {
  projects: 'all' | 'managed' | 'participated'
  departments: 'all' | 'own' | 'managed'
  teams: 'all' | 'department' | 'own'
  users: 'all' | 'department' | 'team' | 'self'
}

export interface FilterConstraint {
  filterType: string
  isLocked: boolean
  availableOptions: any[]
  defaultValue?: string
}

// Типы для хуков
export interface UsePermissionsReturn {
  permissions: string[]
  isLoading: boolean
  error: string | null
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
  hasAllPermissions: (permissions: string[]) => boolean
  getPermissionLevel: (module: string) => 'none' | 'view' | 'edit' | 'admin'
}

export interface UseDataConstraintsReturn {
  constraints: DataConstraint[]
  dataScope: DataScope
  getAvailableProjects: () => Promise<any[]>
  getAvailableDepartments: () => Promise<any[]>
  getAvailableTeams: () => Promise<any[]>
  isDataLocked: (dataType: keyof DataScope) => boolean
}

// Константы типов
export type PermissionAction = 'view' | 'edit' | 'create' | 'delete' | 'admin'
export type PermissionScope = 'all' | 'own' | 'department' | 'team' | 'managed'
export type ModuleName = 'projects' | 'users' | 'planning' | 'calendar' | 'announcements' 