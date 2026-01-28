'use client'

/**
 * Loading Modal New - Hook для загрузки списка проектов
 *
 * Возвращает список проектов с фильтрацией (Мои/Все)
 * Используется в левой панели модального окна для выбора проекта
 */

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/modules/cache'
import { fetchProjectsListRPC } from '../actions/projects-tree-rpc'
import type { ProjectListItem, FetchProjectsListInput } from '../actions/projects-tree'

export interface UseProjectsListOptions {
  /** Режим: 'my' - мои проекты, 'all' - все проекты */
  mode: 'my' | 'all'
  /** ID текущего пользователя (обязателен для режима 'my') */
  userId: string
  /** Включить/отключить запрос */
  enabled?: boolean
}

export function useProjectsList(options: UseProjectsListOptions) {
  const { mode, userId, enabled = true } = options

  console.log('🔍 useProjectsList debug:', {
    mode,
    userId,
    enabled,
    shouldQuery: enabled && Boolean(userId?.trim()),
  })

  return useQuery({
    queryKey: queryKeys.projects.listForModal(mode, userId),
    queryFn: async () => {
      const hookStartTime = performance.now()
      console.log('📡 [useProjectsList] Запрос списка проектов:', { mode, userId })
      const input: FetchProjectsListInput = { mode, userId }

      const fetchStartTime = performance.now()
      const result = await fetchProjectsListRPC(input)
      const fetchEndTime = performance.now()
      console.log(`⏱️ [useProjectsList] fetchProjectsListRPC took: ${(fetchEndTime - fetchStartTime).toFixed(2)}ms`)

      if (!result.success) {
        console.error('❌ Ошибка загрузки проектов:', result.error)
        throw new Error(result.error)
      }

      const totalHookTime = performance.now() - hookStartTime
      console.log(`✅ [useProjectsList] Total hook time: ${totalHookTime.toFixed(2)}ms | Projects: ${result.data.length}`)
      return result.data
    },
    enabled: enabled && Boolean(userId?.trim()),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (renamed from cacheTime in v5)
  })
}

export type { ProjectListItem }
