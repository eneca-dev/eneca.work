import { useUserStore } from "@/stores/useUserStore"
import { PERMISSIONS } from "@/modules/permissions"
import { AdminPermissions } from "../types/admin"

export function useAdminPermissions(): AdminPermissions {
  const permissions = useUserStore((state) => state.permissions)

  return {
    canViewAdminPanel: permissions?.includes(PERMISSIONS.USERS.ADMIN_PANEL) ?? false,
    canManageRoles: permissions?.includes(PERMISSIONS.USERS.MANAGE_ROLES) ?? false,
    canManageDepartments: permissions?.includes(PERMISSIONS.USERS.MANAGE_DEPARTMENTS) ?? false,
    canManageTeams: permissions?.includes(PERMISSIONS.USERS.MANAGE_TEAMS) ?? false,
    canManagePositions: permissions?.includes(PERMISSIONS.USERS.MANAGE_POSITIONS) ?? false,
    canManageCategories: permissions?.includes(PERMISSIONS.USERS.MANAGE_CATEGORIES) ?? false,
    canChangeRoles: permissions?.includes(PERMISSIONS.USERS.ASSIGN_ROLES) ?? false,
    canAddAdminRole: permissions?.includes(PERMISSIONS.USERS.ASSIGN_ADMIN_ROLE) ?? false,
  }
} 