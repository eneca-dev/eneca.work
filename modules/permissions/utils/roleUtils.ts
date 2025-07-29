import type { Role, Permission } from '../types'
import { SYSTEM_ROLES, ROLE_ASSIGNERS, getRolePermissions, getRoleConstraints } from '../constants/roles'

/**
 * Проверяет является ли роль системной
 */
export const isSystemRole = (roleName: string): boolean => {
  return SYSTEM_ROLES.includes(roleName as any)
}

/**
 * Проверяет может ли пользователь назначать роли
 */
export const canUserAssignRoles = (userRole: string): boolean => {
  return ROLE_ASSIGNERS.includes(userRole as any)
}

/**
 * Получает разрешения для роли
 */
export const getRolePermissionsById = async (roleId: string): Promise<string[]> => {
  // Это будет реализовано через Supabase
  // Пока возвращаем пустой массив
  return []
}

/**
 * Получает роли пользователя
 */
export const getUserRoles = async (userId: string): Promise<Role[]> => {
  // Это будет реализовано через Supabase
  // Пока возвращаем пустой массив
  return []
}

/**
 * Проверяет может ли текущий пользователь назначить роль целевому пользователю
 */
export const canAssignRole = (currentUserRoles: string[], targetRole: string): boolean => {
  // Только администратор может назначать административную роль
  if (targetRole === 'admin') {
    return currentUserRoles.includes('admin')
  }
  
  // Руководитель отдела может назначать роли в своем отделе
  if (currentUserRoles.includes('department_head')) {
    const allowedRoles = ['user', 'team_lead']
    return allowedRoles.includes(targetRole)
  }
  
  // Администратор может назначать любые роли
  if (currentUserRoles.includes('admin')) {
    return true
  }
  
  return false
}

/**
 * Валидирует название роли
 */
export const validateRoleName = (name: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = []
  
  if (!name || name.trim().length === 0) {
    errors.push('Название роли не может быть пустым')
  }
  
  if (name.length > 50) {
    errors.push('Название роли не может быть длиннее 50 символов')
  }
  
  if (!/^[a-zA-Z0-9_\-\s]+$/.test(name)) {
    errors.push('Название роли может содержать только буквы, цифры, пробелы, дефисы и подчеркивания')
  }
  
  if (isSystemRole(name.toLowerCase())) {
    errors.push('Это название зарезервировано для системных ролей')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Валидирует описание роли
 */
export const validateRoleDescription = (description: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = []
  
  if (description && description.length > 255) {
    errors.push('Описание роли не может быть длиннее 255 символов')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Получает человекочитаемое название роли
 */
export const getRoleDisplayName = (roleName: string): string => {
  const roleLabels: Record<string, string> = {
    admin: 'Администратор',
    project_manager: 'Руководитель проекта',
    department_head: 'Руководитель отдела',
    team_lead: 'Руководитель команды',
    user: 'Пользователь'
  }
  
  return roleLabels[roleName] || roleName
}

/**
 * Сортирует роли по важности
 */
export const sortRolesByImportance = (roles: Role[]): Role[] => {
  const roleOrder = ['admin', 'department_head', 'project_manager', 'team_lead', 'user']
  
  return roles.sort((a, b) => {
    const aIndex = roleOrder.indexOf(a.name)
    const bIndex = roleOrder.indexOf(b.name)
    
    // Если роли нет в списке, помещаем в конец
    const aOrder = aIndex === -1 ? roleOrder.length : aIndex
    const bOrder = bIndex === -1 ? roleOrder.length : bIndex
    
    return aOrder - bOrder
  })
}

/**
 * Проверяет конфликты между ролями
 */
export const checkRoleConflicts = (userRoles: string[]): string[] => {
  const conflicts: string[] = []
  
  // Пример: пользователь не может быть одновременно админом и обычным пользователем
  if (userRoles.includes('admin') && userRoles.includes('user')) {
    conflicts.push('Пользователь не может одновременно быть администратором и обычным пользователем')
  }
  
  // Руководитель отдела не может быть обычным пользователем
  if (userRoles.includes('department_head') && userRoles.includes('user')) {
    conflicts.push('Руководитель отдела не может быть обычным пользователем')
  }
  
  return conflicts
}

/**
 * Получает рекомендуемые роли на основе текущих
 */
export const getRecommendedRoles = (currentRoles: string[], userDepartment?: string, userTeam?: string): string[] => {
  const recommended: string[] = []
  
  // Если пользователь руководитель команды, можно предложить руководителя отдела
  if (currentRoles.includes('team_lead') && !currentRoles.includes('department_head')) {
    recommended.push('department_head')
  }
  
  // Если пользователь руководитель отдела, можно предложить руководителя проекта
  if (currentRoles.includes('department_head') && !currentRoles.includes('project_manager')) {
    recommended.push('project_manager')
  }
  
  return recommended
} 