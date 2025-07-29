import { useUserStore } from "@/stores/useUserStore"
import { AdminPermissions } from "../types/admin"

export function useAdminPermissions(): AdminPermissions {
  const permissions = useUserStore((state) => state.permissions)

  return {
    canViewAdminPanel: permissions?.includes("users.admin_panel") ?? false,
    canManageRoles: permissions?.includes("role.manage") ?? false,
    canManageDepartments: permissions?.includes("department.manage") ?? false,
    canManageTeams: permissions?.includes("team.manage") ?? false,
    canManagePositions: permissions?.includes("position.manage") ?? false,
    canManageCategories: permissions?.includes("category.manage") ?? false,
    canChangeRoles: permissions?.includes("users.assign_roles") ?? false,
    canAddAdminRole: permissions?.includes("users.assign_admin_role") ?? false,
  }
} 