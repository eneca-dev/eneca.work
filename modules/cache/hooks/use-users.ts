'use client'

/**
 * Users Cache Hooks
 *
 * Хуки для кеширования списка пользователей.
 * Используются в модалках для избежания загрузки при каждом открытии.
 */

import { createSimpleCacheQuery } from './use-cache-query'
import { staleTimePresets } from '../client/query-client'
import { getUsers, getCurrentUser } from '../actions/users'
import { queryKeys } from '../keys/query-keys'
import type { CachedUser } from '../actions/users'

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Хук для получения списка всех пользователей
 *
 * Данные кешируются на длительное время, т.к. список пользователей
 * редко меняется. Хук предзагружается при старте приложения.
 *
 * @example
 * const { data: users, isLoading } = useUsers()
 * // users = [{ user_id: '...', full_name: '...', ... }, ...]
 */
export const useUsers = createSimpleCacheQuery<CachedUser[]>({
  queryKey: queryKeys.users.lists(),
  queryFn: getUsers,
  staleTime: staleTimePresets.static, // 10 минут - пользователи редко меняются
})

/**
 * Хук для получения текущего пользователя
 *
 * Кеширует данные текущего авторизованного пользователя.
 *
 * @example
 * const { data: currentUser, isLoading } = useCurrentUser()
 */
export const useCurrentUser = createSimpleCacheQuery<CachedUser | null>({
  queryKey: queryKeys.users.current(),
  queryFn: getCurrentUser,
  staleTime: staleTimePresets.fast, // 30 секунд - может меняться при переключении пользователя
})

// Re-export type for convenience
export type { CachedUser }
