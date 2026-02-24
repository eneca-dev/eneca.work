/**
 * Cache Hooks
 *
 * Фабрики для создания типизированных хуков запросов и мутаций
 */

// Query factories
export {
  createCacheQuery,
  createSimpleCacheQuery,
  createDetailCacheQuery,
  createInfiniteCacheQuery,
  useConditionalQuery,
  type CreateQueryConfig,
  type CreateInfiniteQueryConfig,
  type QueryHookOptions,
} from './use-cache-query'

// Mutation factories
export {
  createCacheMutation,
  createSimpleMutation,
  createDeleteMutation,
  createUpdateMutation,
  type CreateMutationConfig,
  type MutationHookOptions,
  type InferMutationData,
  type InferMutationInput,
} from './use-cache-mutation'
