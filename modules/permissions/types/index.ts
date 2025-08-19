// Основные типы для системы разрешений

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