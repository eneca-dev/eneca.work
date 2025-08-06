import { usePermissionsHook as usePermissions, PERMISSIONS } from "@/modules/permissions"
import { AdminPermissions } from "../types/admin"

export function useAdminPermissions(): AdminPermissions {
  const { hasPermission } = usePermissions()

  return {
    canViewAdminPanel: hasPermission(PERMISSIONS.USERS.ADMIN_PANEL),
    canManageRoles: hasPermission(PERMISSIONS.USERS.MANAGE_ROLES),
    canManageDepartments: hasPermission(PERMISSIONS.USERS.MANAGE_DEPARTMENTS),
    canManageTeams: hasPermission(PERMISSIONS.USERS.MANAGE_TEAMS),
    canManagePositions: hasPermission(PERMISSIONS.USERS.MANAGE_POSITIONS),
    canManageCategories: hasPermission(PERMISSIONS.USERS.MANAGE_CATEGORIES),
    canChangeRoles: hasPermission(PERMISSIONS.USERS.ASSIGN_ROLES),
    canAddAdminRole: hasPermission(PERMISSIONS.USERS.ASSIGN_ADMIN_ROLE),
  }
} 