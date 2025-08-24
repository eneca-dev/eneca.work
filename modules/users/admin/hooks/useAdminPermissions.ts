import { usePermissionsHook as usePermissions } from "@/modules/permissions"
import { AdminPermissions } from "../types/admin"

export function useAdminPermissions(): AdminPermissions {
  const { hasPermission } = usePermissions()

  return {
    canViewAdminPanel: hasPermission('users.admin_panel'),
    canManageRoles: hasPermission('users.manage.roles'),
    canManageDepartments: hasPermission('users.manage.departments'),
    canManageTeams: hasPermission('users.manage.teams'),
    canManagePositions: hasPermission('users.manage.positions'),
    canManageCategories: hasPermission('users.manage.categories'),
    canChangeRoles: hasPermission('users.assign_roles'),
    canAddAdminRole: hasPermission('users.assign_admin_role'),
  }
} 