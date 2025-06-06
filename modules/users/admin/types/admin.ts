// Типы для админ-панели

export interface AdminPermissions {
  canViewAdminPanel: boolean
  canManageRoles: boolean
  canManageDepartments: boolean
  canManageTeams: boolean
  canManagePositions: boolean
  canManageCategories: boolean
  canChangeRoles: boolean
  canAddAdminRole: boolean
}

export interface AdminTabProps {
  // Общие пропсы для табов админ-панели
}

export type AdminTab = 'departments' | 'teams' | 'positions' | 'categories' | 'roles' 