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

// Экспорт компонентов
export * from './components/PermissionGuard'
export * from './components/RoleGuard'
export * from './components/PermissionBoundary'
export { PermissionsErrorBoundary } from './components/PermissionsErrorBoundary'
export { PermissionsDebugPanel } from './components/PermissionsDebugPanel'

// Экспорт хранилищ
export { 
  usePermissionsStore,
  usePermissions as usePermissionsSelector,
  usePermissionsLoading,
  usePermissionsError,
  useHasPermission,
  useHasAnyPermission,
  usePermissionLevel
} from './store/usePermissionsStore'

// Экспорт Supabase интеграции
export * from './supabase/supabasePermissions'

// Экспорт интеграционного слоя
export {
  useUserPermissionsSync,
  UserPermissionsSyncProvider
} from './integration/userStoreSync' 