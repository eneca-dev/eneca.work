import { useUserStore } from "@/stores/useUserStore"
import { PERMISSIONS } from "@/modules/permissions"

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
  const permissions = useUserStore((state) => state.permissions)

  return {
    canEditAllUsers: permissions?.includes("users.edit.all") ?? false,
    canDeleteUsers: permissions?.includes("users.delete") ?? false,
    canEditStructures: permissions?.includes("structure.edit") ?? false,
    // Hierarchy статусы
    isAdmin: permissions?.includes(PERMISSIONS.HIERARCHY.IS_ADMIN) ?? false,
    isDepartmentHead: permissions?.includes(PERMISSIONS.HIERARCHY.IS_DEPARTMENT_HEAD) ?? false,
    isProjectManager: permissions?.includes(PERMISSIONS.HIERARCHY.IS_PROJECT_MANAGER) ?? false,
    isTeamLead: permissions?.includes(PERMISSIONS.HIERARCHY.IS_TEAM_LEAD) ?? false,
    isUser: permissions?.includes(PERMISSIONS.HIERARCHY.IS_USER) ?? false,
  }
} 