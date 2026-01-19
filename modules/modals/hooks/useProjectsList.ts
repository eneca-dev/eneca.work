'use client'

/**
 * Loading Modal 2 - Hook для загрузки списка проектов
 *
 * Возвращает список проектов с фильтрацией (Мои/Все)
 * Используется в левой панели модального окна для выбора проекта
 */

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/modules/cache'
import { fetchProjectsList } from '../actions/projects-tree'
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

  return useQuery({
    queryKey: queryKeys.projects.listForModal(mode, userId),
    queryFn: async () => {
      const input: FetchProjectsListInput = { mode, userId }
      const result = await fetchProjectsList(input)

      if (!result.success) {
        throw new Error(result.error)
      }

      return result.data
    },
    enabled: enabled && Boolean(userId?.trim()),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (renamed from cacheTime in v5)
  })
}

export type { ProjectListItem }
