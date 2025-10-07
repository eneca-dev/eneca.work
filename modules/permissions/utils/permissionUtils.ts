import type { DataConstraint, DataScope, UserPermissions } from '../types'

/**
 * Разбивает разрешение на части
 */
export const getPermissionParts = (permission: string): { module: string; action: string; scope?: string } => {
  const parts = permission.split('.')
  if (parts.length < 2) {
    throw new Error(`Неверный формат разрешения: ${permission}`)
  }
  
  return {
    module: parts[0],
    action: parts[1],
    scope: parts[2]
  }
}

/**
 * Проверяет является ли разрешение системным
 */
export const isSystemPermission = (permission: string): boolean => {
  return permission.startsWith('hierarchy.') || permission.startsWith('system.')
}

/**
 * Проверяет наличие разрешения у пользователя
 */
export const checkPermission = (userPermissions: string[], permission: string): boolean => {
  if (!userPermissions || !permission) return false
  
  return userPermissions.includes(permission)
}

/**
 * Проверяет наличие любого из разрешений
 */
export const checkAnyPermission = (userPermissions: string[], permissions: string[]): boolean => {
  if (!userPermissions || !permissions?.length) return false
  
  return permissions.some(permission => userPermissions.includes(permission))
}

/**
 * Проверяет наличие всех разрешений
 */
export const checkAllPermissions = (userPermissions: string[], permissions: string[]): boolean => {
  if (!userPermissions || !permissions?.length) return false
  
  return permissions.every(permission => userPermissions.includes(permission))
}

/**
 * Получает уровень доступа к модулю
 */
export const getPermissionLevel = (userPermissions: string[], module: string): 'none' | 'view' | 'edit' | 'admin' => {
  if (!userPermissions || !module) return 'none'
  
  const modulePermissions = userPermissions.filter(p => p.startsWith(module))
  
  if (modulePermissions.some(p => p.includes('.admin'))) return 'admin'
  if (modulePermissions.some(p => p.includes('.edit') || p.includes('.create') || p.includes('.delete'))) return 'edit'
  if (modulePermissions.some(p => p.includes('.view'))) return 'view'
  
  return 'none'
}

/**
 * Объединяет массивы разрешений без дубликатов
 */
export const mergePermissions = (permissionArrays: string[][]): string[] => {
  const allPermissions = permissionArrays.flat()
  return [...new Set(allPermissions)]
}

/**
 * Валидирует структуру разрешения
 */
export const validatePermissionStructure = (permission: string): boolean => {
  if (!permission || typeof permission !== 'string') return false
  
  const parts = permission.split('.')
  if (parts.length < 2 || parts.length > 3) return false
  
  const [module, action, scope] = parts
  
  // Проверяем валидность частей
  if (!module || !action) return false
  if (parts.length === 3 && !scope) return false
  
  return true
}

/**
 * Получает область данных пользователя на основе ограничений
 */
export const getUserDataScope = (constraints: DataConstraint[]): DataScope => {
  const scope: DataScope = {
    projects: 'participated',
    departments: 'own',
    teams: 'own',
    users: 'self'
  }
  
  constraints.forEach(constraint => {
    if (constraint.type === 'scope') {
      const [entity, , level] = constraint.target.split('.')
      if (entity && level) {
        switch (entity) {
          case 'projects':
            scope.projects = level as DataScope['projects']
            break
          case 'departments':
            scope.departments = level as DataScope['departments']
            break
          case 'teams':
            scope.teams = level as DataScope['teams']
            break
          case 'users':
            scope.users = level as DataScope['users']
            break
        }
      }
    }
  })
  
  return scope
}

/**
 * Проверяет заблокированность данных для пользователя
 */
export const isDataLocked = (constraints: DataConstraint[], dataType: keyof DataScope): boolean => {
  const dataScope = getUserDataScope(constraints)
  
  switch (dataType) {
    case 'departments':
      return dataScope.departments === 'own'
    case 'teams':
      return dataScope.teams === 'own'
    case 'projects':
      return dataScope.projects === 'managed' || dataScope.projects === 'participated'
    case 'users':
      return dataScope.users === 'self' || dataScope.users === 'team'
    default:
      return false
  }
}

/**
 * Фильтрует разрешения по модулю
 */
export const getModulePermissions = (userPermissions: string[], module: string): string[] => {
  return userPermissions.filter(permission => permission.startsWith(module))
}

/**
 * Проверяет может ли пользователь назначить роль
 */
export const canAssignRole = (currentUserPermissions: string[], targetRole: string): boolean => {
  // Проверяем есть ли право назначать роли
  if (!currentUserPermissions.includes('users.assign_roles')) return false
  
  // Администраторскую роль может назначать только тот, у кого есть специальное право
  if (targetRole === 'admin') {
    return currentUserPermissions.includes('users.assign_admin_role')
  }
  
  return true
}

/**
 * Получает человекочитаемое описание разрешения
 */
export const getPermissionDescription = (permission: string): string => {
  const { module, action, scope } = getPermissionParts(permission)
  
  const moduleLabels: Record<string, string> = {
    projects: 'Проекты',
    users: 'Пользователи',
    planning: 'Планирование',
    calendar: 'Календарь',
    announcements: 'Объявления'
  }
  
  const actionLabels: Record<string, string> = {
    view: 'Просмотр',
    edit: 'Редактирование',
    create: 'Создание',
    delete: 'Удаление',
    admin: 'Администрирование'
  }
  
  const scopeLabels: Record<string, string> = {
    all: 'всех',
    own: 'своих',
    managed: 'управляемых',
    department: 'отдела',
    team: 'команды'
  }
  
  const moduleLabel = moduleLabels[module] || module
  const actionLabel = actionLabels[action] || action
  const scopeLabel = scopeLabels[scope || ''] || scope
  
  return `${actionLabel} ${moduleLabel.toLowerCase()} ${scopeLabel}`
}

/**
 * Группирует разрешения по модулям
 */
export const groupPermissionsByModule = (permissions: string[]): Record<string, string[]> => {
  return permissions.reduce((groups, permission) => {
    const { module } = getPermissionParts(permission)
    if (!groups[module]) {
      groups[module] = []
    }
    groups[module].push(permission)
    return groups
  }, {} as Record<string, string[]>)
} 