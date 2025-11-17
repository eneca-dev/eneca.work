// Типы для админ-панели

export interface AdminPermissions {
  canViewAdminPanel: boolean
  isAdmin: boolean
  canManageRoles: boolean
  canManageDepartments: boolean
  canManageTeams: boolean
  canManagePositions: boolean
  canManageCategories: boolean
  // Редакторские права уровня подразделения
  canEditSubdivision: boolean
  canEditSalarySubdivision: boolean
  canViewRateSubdivision: boolean
  canDeleteDepartment: boolean
  canManageDepartmentHead: boolean
  // Редакторские права уровня отдела/команды
  canEditDepartment: boolean
  canEditTeam: boolean
  canDeleteTeam: boolean
  canManageTeamLead: boolean
  canChangeRoles: boolean
  canAddAdminRole: boolean
}

export interface AdminTabProps {
  // Общие пропсы для табов админ-панели
}

export type AdminTab = 'departments' | 'teams' | 'positions' | 'categories' | 'roles' 