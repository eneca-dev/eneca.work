// Экспорт основных типов
export type * from './types'

// Экспорт утилит (константы теперь встроены в утилиты)
export {
  checkPermission,
  checkAnyPermission,
  checkAllPermissions,
  getPermissionLevel,
  mergePermissions,
  validatePermissionStructure,
  getModulePermissions,
  canAssignRole,
  getPermissionDescription,
  groupPermissionsByModule,
  getPermissionParts,
  isSystemPermission
} from './utils/permissionUtils'

export {
  getRolePermissionsById,
  getUserRoles,
  getRoleDisplayName
} from './utils/roleUtils'

// Filter scope utils (перенесено из filter-permissions)
export { resolveFilterScope } from './utils/scope-resolver'
export type { ScopeContext } from './utils/scope-resolver'
export { applyMandatoryFilters } from './utils/mandatory-filters'

// Server actions
export { getFilterContext } from './server/get-filter-context'

// Экспорт хуков
export {
  usePermissions,
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

export { usePermissionsLoader } from './hooks/usePermissionsLoader'

// Filter scope hooks (перенесено из filter-permissions)
export { useFilterContext } from './hooks/use-filter-context'
export { useFilteredOptions, getLockedFilters } from './hooks/use-filtered-options'
export type { HierarchyContext } from './hooks/use-filtered-options'

// Экспорт компонентов
export * from './components/PermissionGuard'
export * from './components/RoleGuard'
export * from './components/PermissionBoundary'
export { PermissionsErrorBoundary } from './components/PermissionsErrorBoundary'

// Экспорт хранилищ
export {
  usePermissionsStore,
  usePermissions as usePermissionsSelector,
  usePermissionsLoading,
  usePermissionsError,
  useHasPermission,
  useHasAnyPermission,
  usePermissionLevel,
  // Unified permissions exports
  useFilterScope,
  useOrgContext,
  useIsAdmin,
  selectFilterScope,
  selectOrgContext,
  selectIsAdmin,
} from './store/usePermissionsStore'

// Экспорт Supabase интеграции
export * from './supabase/supabasePermissions'

// Экспорт интеграционного слоя
export {
  useUserPermissionsSync,
  UserPermissionsSyncProvider
} from './integration/userStoreSync' 