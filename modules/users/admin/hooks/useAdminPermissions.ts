import { useUserStore } from "@/stores/useUserStore"
import { AdminPermissions } from "../types/admin"

export function useAdminPermissions(): AdminPermissions {
  const permissions = useUserStore((state) => state.permissions)

  return {
    canViewAdminPanel: permissions?.includes("can_view_user_admin_panel") ?? false,
    canManageRoles: permissions?.includes("role.manage") ?? false,
    canManageDepartments: permissions?.includes("department.manage") ?? false,
    canManageTeams: permissions?.includes("team.manage") ?? false,
    canManagePositions: permissions?.includes("position.manage") ?? false,
    canManageCategories: permissions?.includes("category.manage") ?? false,
  }
} 