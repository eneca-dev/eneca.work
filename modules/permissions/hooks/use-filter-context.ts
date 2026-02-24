'use client'

/**
 * Hook для получения контекста фильтрации пользователя
 *
 * Использует TanStack Query для кэширования.
 * Контекст загружается один раз и редко меняется.
 */

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/modules/cache'
import { getFilterContext } from '../server/get-filter-context'
import type { UserFilterContext } from '../types'

/**
 * Хук для получения контекста фильтрации текущего пользователя.
 *
 * @returns Контекст фильтрации с информацией о scope и разрешениях
 *
 * @example
 * ```tsx
 * const { data: filterContext, isLoading } = useFilterContext()
 *
 * if (filterContext?.scope.isLocked) {
 *   // Показываем locked badge
 * }
 * ```
 */
export function useFilterContext() {
  return useQuery<UserFilterContext | null>({
    queryKey: queryKeys.filterPermissions.context(),
    queryFn: async () => {
      const result = await getFilterContext()

      if (!result.success) {
        throw new Error(result.error)
      }

      return result.data
    },
    staleTime: 10 * 60 * 1000, // 10 минут - контекст редко меняется
    gcTime: 30 * 60 * 1000, // 30 минут в кэше
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })
}
