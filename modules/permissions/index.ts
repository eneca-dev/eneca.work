// Экспорт основных типов
export type * from './types'

// Экспорт констант
export { PERMISSIONS, getPermissionParts, buildPermission, isSystemPermission } from './constants/permissions'
export { 
  ROLE_NAMES,
  ROLE_DESCRIPTIONS,
  ROLE_COLORS,
  ROLE_TEMPLATES, 
  SYSTEM_ROLES, 
  ROLE_ASSIGNERS, 
  ROLE_HIERARCHY_LEVEL,
  isSystemRole,
  canUserAssignRoles,
  getRolePermissions,
  getRoleDescription,
  getRoleColor,
  getRoleHierarchyLevel,
  sortRolesByImportance,
  canAssignRole as canAssignRoleFromRoles,
  validateRoleName,
  validateRoleDescription,
  checkRoleConflicts,
  getRecommendedRoles
} from './constants/roles'

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
  getRolePermissionsById,
  getUserRoles,
  getRoleDisplayName
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

// Экспорт интеграционного слоя
export {
  useUserPermissionsSync,
  UserPermissionsSyncProvider
} from './integration/userStoreSync' 