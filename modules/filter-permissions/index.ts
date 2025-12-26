/**
 * Filter Permissions Module
 *
 * Система разрешений для inline-фильтров.
 * Обеспечивает 4 уровня защиты данных:
 *
 * 1. UI (Options Filtering) - пользователь видит только доступные опции
 * 2. Parser Validation - проверка токенов на соответствие scope
 * 3. Server Actions (Mandatory Filters) - принудительные ограничения
 * 4. RLS (Row Level Security) - защита на уровне БД
 *
 * @example
 * ```tsx
 * import {
 *   useFilterContext,
 *   useFilteredOptions,
 *   getLockedFilters,
 * } from '@/modules/filter-permissions'
 *
 * function TasksFilter() {
 *   const { data: filterContext } = useFilterContext()
 *   const filteredOptions = useFilteredOptions(allOptions, filterContext)
 *   const lockedFilters = getLockedFilters(filterContext)
 *
 *   return (
 *     <>
 *       {lockedFilters.map(lock => (
 *         <Badge key={lock.key}>
 *           <Lock /> {lock.key}: {lock.displayName}
 *         </Badge>
 *       ))}
 *       <InlineFilter options={filteredOptions} ... />
 *     </>
 *   )
 * }
 * ```
 */

// Types
export type {
  FilterScope,
  FilterScopeLevel,
  FilterScopePermission,
  UserFilterContext,
  LockableFilterKey,
  LockedFilter,
  FilterLocks,
  SystemRole,
} from './types'

export {
  ROLE_PRIORITY,
  PERMISSION_PRIORITY,
  PERMISSION_TO_SCOPE,
  getPrimaryRole,
} from './types'

// Hooks
export {
  useFilterContext,
  useFilteredOptions,
  getLockedFilters,
} from './hooks'

// Utils
export {
  resolveFilterScope,
  canAccessScope,
  applyMandatoryFilters,
  validateFilterForScope,
  getScopeSqlCondition,
} from './utils'

// Server
export { getFilterContext } from './server'
