/**
 * Cache Module - Public API
 *
 * Централизованный модуль кеширования на базе TanStack Query + Server Actions
 */

// Types
export type {
  ActionResult,
  PaginatedActionResult,
  BaseFilters,
  RealtimePayload,
  RealtimeSubscriptionConfig,
  StaleTimePreset,
  // Database type helpers
  TableRow,
  TableInsert,
  TableUpdate,
  ViewRow,
  DbEnum,
  // Common DB types
  ProjectStatusEnum,
  ProjectRow,
  CacheProjectViewRow,
} from './types'

// Query Keys
export { queryKeys } from './keys/query-keys'
export type {
  UserFilters,
  ProjectFilters,
  SectionFilters,
  LoadingFilters,
  CheckpointFilters,
} from './keys/query-keys'

// Provider
export { QueryProvider } from './providers/query-provider'

// Client config
export { getQueryClient, staleTimePresets, resetQueryClient } from './client/query-client'

// Hook Factories
export {
  // Query factories
  createCacheQuery,
  createSimpleCacheQuery,
  createDetailCacheQuery,
  createInfiniteCacheQuery,
  useConditionalQuery,
  // Mutation factories
  createCacheMutation,
  createSimpleMutation,
  createDeleteMutation,
  createUpdateMutation,
} from './hooks'

export type {
  // Query types
  CreateQueryConfig,
  CreateInfiniteQueryConfig,
  QueryHookOptions,
  // Mutation types
  CreateMutationConfig,
  MutationHookOptions,
  InferMutationData,
  InferMutationInput,
} from './hooks'

// Server Actions - Projects
export {
  getProjects,
  getProjectById,
  getProjectsWithCounts,
  getProjectStructure,
  updateProject,
  type Project,
  type ProjectListItem,
  type ProjectStatus,
  type ProjectManager,
  type ProjectClient,
  type UpdateProjectInput,
  type ProjectWithCounts,
  type ProjectStructure,
  type CacheProjectRow,
} from './actions/projects'

// Server Actions - Users
export {
  getUsers,
  getCurrentUser,
  type CachedUser,
} from './actions/users'

// Server Actions - Work Categories
export {
  getWorkCategories,
  type WorkCategory,
} from './actions/work-categories'

// User Hooks (pre-built)
export { useUsers, useCurrentUser } from './hooks/use-users'

// Work Categories Hooks (pre-built)
export { useWorkCategories } from './hooks/use-work-categories'

// Base action utilities
export { safeAction } from './actions/base'

// Action helpers (non-server)
export { handleSupabaseError, createPaginatedResult } from './utils/action-helpers'

// Realtime
export { RealtimeSync, realtimeSubscriptions, REALTIME_CHANNEL_NAME } from './realtime'
export type { TableSubscription, RealtimeEvent } from './realtime'
