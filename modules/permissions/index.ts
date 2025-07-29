// Экспорт основных типов
export type * from './types'

// Экспорт констант
export { PERMISSIONS, DATA_CONSTRAINTS, getPermissionParts, buildPermission, isSystemPermission } from './constants/permissions'
export { ROLE_TEMPLATES, SYSTEM_ROLES, ROLE_ASSIGNERS, canAssignRoles, getRolePermissions as getRoleTemplate, getRoleConstraints } from './constants/roles'

// Экспорт утилит
export { 
  checkPermission, 
  checkAnyPermission, 
  checkAllPermissions, 
  getPermissionLevel, 
  mergePermissions, 
  validatePermissionStructure,
  getUserDataScope,
  isDataLocked,
  getModulePermissions,
  canAssignRole,
  getPermissionDescription,
  groupPermissionsByModule
} from './utils/permissionUtils'

export { 
  isSystemRole as isSystemRoleUtil,
  canUserAssignRoles,
  getRolePermissionsById,
  getUserRoles,
  validateRoleName,
  validateRoleDescription,
  getRoleDisplayName,
  sortRolesByImportance,
  checkRoleConflicts,
  getRecommendedRoles
} from './utils/roleUtils'

// Экспорт хуков
export { 
  usePermissions as usePermissionsHook,
  useHasPermission as useHasPermissionHook,
  useHasAnyPermission as useHasAnyPermissionHook,
  useHasAllPermissions,
  usePermissionLevel as usePermissionLevelHook,
  useUsersPermissions,
  useProjectsPermissions,
  usePlanningPermissions,
  useCalendarPermissions,
  useAnnouncementsPermissions
} from './hooks/usePermissions'

export { 
  useDataConstraints,
  useFilterConstraints,
  useIsDataLocked as useIsDataLockedHook,
  useFilterOptions
} from './hooks/useDataConstraints'

// Экспорт компонентов
export * from './components/PermissionGuard'
export * from './components/RoleGuard'
export * from './components/PermissionBoundary'
export * from './components/DataScopeProvider'

// Экспорт хранилищ
export { 
  usePermissionsStore,
  usePermissions as usePermissionsSelector,
  useConstraints,
  useRoles,
  usePermissionsLoading,
  usePermissionsError,
  useHasPermission,
  useHasAnyPermission,
  usePermissionLevel
} from './store/usePermissionsStore'

export {
  useDataScopeStore,
  useDataScope,
  useAvailableProjects,
  useAvailableDepartments,
  useAvailableTeams,
  useLockedFilters,
  useIsDataLocked
} from './store/useDataScopeStore'

// Экспорт Supabase интеграции
export * from './supabase/supabasePermissions' 