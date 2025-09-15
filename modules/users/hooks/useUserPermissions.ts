import { usePermissionsHook as usePermissions } from "@/modules/permissions"

export interface UserPermissions {
  canEditAllUsers: boolean
  canDeleteUsers: boolean
  canEditStructures: boolean
  // Новые детальные права редактирования
  canEditSelf: boolean
  canEditTeam: boolean
  canEditDepartment: boolean
  // Права на назначение ролей
  canAssignRoles: boolean
  canAssignAdminRole: boolean
  // Права на просмотр ставок
  canViewRateSelf: boolean
  canViewRateTeam: boolean
  canViewRateDepartment: boolean
  canViewRateAll: boolean
  // Hierarchy статусы
  isAdmin: boolean
  isDepartmentHead: boolean
  isProjectManager: boolean
  isTeamLead: boolean
  isUser: boolean
}

export function useUserPermissions(): UserPermissions {
  const { hasPermission } = usePermissions()

  return {
    canEditAllUsers: hasPermission('users.edit.all'),
    canDeleteUsers: hasPermission('users.delete'),
    canEditStructures: hasPermission('users.edit.structure'),

    canEditSelf: hasPermission('users.edit.self'),
    canEditTeam: hasPermission('users.edit.team'),
    canEditDepartment: hasPermission('users.edit.department'),

    // Права на назначение ролей
    canAssignRoles: hasPermission('users.assign_roles'),
    canAssignAdminRole: hasPermission('users.assign_admin_role'),

    canViewRateSelf: hasPermission('users.rates.view.self'),
    canViewRateTeam: hasPermission('users.rates.view.team'),
    canViewRateDepartment: hasPermission('users.rates.view.department'),
    canViewRateAll: hasPermission('users.rates.view.all'),

    // Hierarchy статусы
    isAdmin: hasPermission('hierarchy.is_admin'),
    isDepartmentHead: hasPermission('hierarchy.is_department_head'),
    isProjectManager: hasPermission('hierarchy.is_project_manager'),
    isTeamLead: hasPermission('hierarchy.is_team_lead'),
    isUser: hasPermission('hierarchy.is_user'),
  }
} 