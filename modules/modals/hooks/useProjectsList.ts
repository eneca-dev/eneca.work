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

  return useQuery({
    queryKey: queryKeys.projects.listForModal(mode, userId),
    queryFn: async () => {
      const input: FetchProjectsListInput = { mode, userId }
      const result = await fetchProjectsListRPC(input)

      if (!result.success) {
        throw new Error(result.error)
      }

      return result.data
    },
    enabled: enabled && Boolean(userId?.trim()),
    staleTime: 5 * 60 * 1000, // 5 minutes — после устаревания фоновый рефетч (без спиннера)
    gcTime: Infinity, // не удаляем из кэша в течение сессии → нет крутилки при открытии модалки
  })
}

export type { ProjectListItem }
