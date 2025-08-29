import { usePermissionsStore } from '../store/usePermissionsStore'
import type { UsePermissionsReturn } from '../types'

/**
 * Основной хук для работы с разрешениями
 */
export const usePermissions = (): UsePermissionsReturn => {
  const {
    permissions,
    isLoading,
    error,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    getPermissionLevel
  } = usePermissionsStore()

  // УБРАНО: Автозагрузка разрешений - теперь это делает UserPermissionsSyncProvider
  // Избегаем дублирования запросов к Supabase

  return {
    permissions,
    isLoading,
    error,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    getPermissionLevel
  }
}

/**
 * Хук для проверки конкретного разрешения
 */
export const useHasPermission = (permission: string): boolean => {
  const { hasPermission } = usePermissions()
  return hasPermission(permission)
}

/**
 * Хук для проверки любого из списка разрешений
 */
export const useHasAnyPermission = (permissions: string[]): boolean => {
  const { hasAnyPermission } = usePermissions()
  return hasAnyPermission(permissions)
}

/**
 * Хук для проверки всех разрешений из списка
 */
export const useHasAllPermissions = (permissions: string[]): boolean => {
  const { hasAllPermissions } = usePermissions()
  return hasAllPermissions(permissions)
}

/**
 * Хук для получения уровня доступа к модулю
 */
export const usePermissionLevel = (module: string): 'none' | 'view' | 'edit' | 'admin' => {
  const { getPermissionLevel } = usePermissions()
  return getPermissionLevel(module)
}

/**
 * Хук для работы с модулем пользователей
 */
export const useUsersPermissions = () => {
  const { hasPermission } = usePermissions()
  
  return {
    canViewAll: hasPermission('users.view.all'),
    canViewDepartment: hasPermission('users.view.department'),
    canViewTeam: hasPermission('users.view.team'),
    canEditAll: hasPermission('users.edit.all'),
    canEditDepartment: hasPermission('users.edit.department'),
    canEditTeam: hasPermission('users.edit.team'),
    canEditSelf: hasPermission('users.edit.self'),
    canCreate: hasPermission('users.create'),
    canDelete: hasPermission('users.delete'),
    canAccessAdminPanel: hasPermission('users.admin_panel'),
    canAssignRoles: hasPermission('users.assign_roles'),
    canAssignAdminRole: hasPermission('users.assign_admin_role'),
    
    // Логические комбинации
    canViewUsers: hasPermission('users.view.all') || 
                  hasPermission('users.view.department') ||
                  hasPermission('users.view.team'),
    canEditUsers: hasPermission('users.edit.all') ||
                  hasPermission('users.edit.department') ||
                  hasPermission('users.edit.team')
  }
}

/**
 * Хук для работы с модулем проектов
 */
export const useProjectsPermissions = () => {
  const { hasPermission } = usePermissions()
  
  return {
    canViewAll: hasPermission('projects.view.all'),
    canViewManaged: hasPermission('projects.view.managed'),
    canViewParticipated: hasPermission('projects.view.participated'),
    canCreate: hasPermission('projects.create'),
    canEditAll: hasPermission('projects.edit.all'),
    canEditManaged: hasPermission('projects.edit.managed'),
    canEditOwn: hasPermission('projects.edit.own'),
    canDelete: hasPermission('projects.delete'),
    canAssignResponsible: hasPermission('projects.assign_responsible'),
    canAdmin: hasPermission('projects.admin'),
    
    // Логические комбинации
    canViewProjects: hasPermission('projects.view.all') ||
                     hasPermission('projects.view.managed') ||
                     hasPermission('projects.view.participated'),
    canEditProjects: hasPermission('projects.edit.all') ||
                     hasPermission('projects.edit.managed') ||
                     hasPermission('projects.edit.own')
  }
}

/**
 * Хук для работы с модулем планирования
 */
export const usePlanningPermissions = () => {
  const { hasPermission } = usePermissions()
  
  return {
    canViewAll: hasPermission('planning.view.all'),
    canViewDepartment: hasPermission('planning.view.department'),
    canViewTeam: hasPermission('planning.view.team'),
    canViewOwn: hasPermission('planning.view.own'),
    canEditLoadings: hasPermission('planning.edit.loadings'),
    canCreatePlanLoadings: hasPermission('planning.create.plan_loadings'),
    canManageSections: hasPermission('planning.manage.sections'),
    canAdmin: hasPermission('planning.admin'),
    
    // Логические комбинации
    canViewPlanning: hasPermission('planning.view.all') ||
                     hasPermission('planning.view.department') ||
                     hasPermission('planning.view.team') ||
                     hasPermission('planning.view.own')
  }
}

/**
 * Хук для работы с модулем календаря
 */
export const useCalendarPermissions = () => {
  const { hasPermission } = usePermissions()
  
  return {
    canView: hasPermission('calendar.view'),
    canCreatePersonal: hasPermission('calendar.create.personal'),
    canCreateGlobal: hasPermission('calendar.create.global'),
    canEditPersonal: hasPermission('calendar.edit.personal'),
    canEditGlobal: hasPermission('calendar.edit.global'),
    canDeletePersonal: hasPermission('calendar.delete.personal'),
    canDeleteGlobal: hasPermission('calendar.delete.global'),
    canManageWorkSchedule: hasPermission('calendar.manage.work_schedule'),
    canAdmin: hasPermission('calendar.admin'),
    
    // Логические комбинации
    canCreateEvents: hasPermission('calendar.create.personal') ||
                     hasPermission('calendar.create.global'),
    canManageGlobalEvents: hasPermission('calendar.create.global') ||
                          hasPermission('calendar.edit.global') ||
                          hasPermission('calendar.delete.global')
  }
}

/**
 * Хук для работы с модулем объявлений
 */
export const useAnnouncementsPermissions = () => {
  const { hasPermission } = usePermissions()
  
  // Локальные булевы переменные для избежания повторных вызовов
  const canManage = hasPermission('announcements.manage')
  
  return {
    canView: true,
    canCreate: canManage,
    canEditAll: canManage,
    canEditOwn: canManage,
    canDeleteAll: canManage,
    canDeleteOwn: canManage,
    
    // Логические комбинации
    canEditAnnouncements: canManage,
    canDeleteAnnouncements: canManage,
    canManage: canManage
  }
} 