import { usePermissionsHook as usePermissions } from "@/modules/permissions"

export interface UserPermissions {
  canEditAllUsers: boolean
  canDeleteUsers: boolean
  canEditStructures: boolean
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
    // Hierarchy статусы
    isAdmin: hasPermission('hierarchy.is_admin'),
    isDepartmentHead: hasPermission('hierarchy.is_department_head'),
    isProjectManager: hasPermission('hierarchy.is_project_manager'),
    isTeamLead: hasPermission('hierarchy.is_team_lead'),
    isUser: hasPermission('hierarchy.is_user'),
  }
} 