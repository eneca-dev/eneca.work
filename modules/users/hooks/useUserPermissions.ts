import { usePermissionsHook as usePermissions, PERMISSIONS } from "@/modules/permissions"

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
    canEditAllUsers: hasPermission(PERMISSIONS.USERS.EDIT_ALL),
    canDeleteUsers: hasPermission(PERMISSIONS.USERS.DELETE),
    canEditStructures: hasPermission(PERMISSIONS.USERS.EDIT_STRUCTURE),
    // Hierarchy статусы
    isAdmin: hasPermission(PERMISSIONS.HIERARCHY.IS_ADMIN),
    isDepartmentHead: hasPermission(PERMISSIONS.HIERARCHY.IS_DEPARTMENT_HEAD),
    isProjectManager: hasPermission(PERMISSIONS.HIERARCHY.IS_PROJECT_MANAGER),
    isTeamLead: hasPermission(PERMISSIONS.HIERARCHY.IS_TEAM_LEAD),
    isUser: hasPermission(PERMISSIONS.HIERARCHY.IS_USER),
  }
} 