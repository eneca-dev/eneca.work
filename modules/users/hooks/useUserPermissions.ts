import { useUserStore } from "@/stores/useUserStore"

export interface UserPermissions {
  canEditAllUsers: boolean
  canDeleteUsers: boolean
  canEditStructures: boolean
}

export function useUserPermissions(): UserPermissions {
  const permissions = useUserStore((state) => state.permissions)

  return {
    canEditAllUsers: permissions?.includes("users_can_edit_all") ?? false,
    canDeleteUsers: permissions?.includes("user.delete") ?? false,
    canEditStructures: permissions?.includes("structure.edit") ?? false,
  }
} 