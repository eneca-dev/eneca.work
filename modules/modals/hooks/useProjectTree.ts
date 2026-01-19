'use client'

/**
 * Loading Modal 2 - Hook для загрузки дерева проекта
 *
 * Возвращает иерархию: project -> stage -> object -> section
 * Используется в левой панели для навигации по структуре проекта
 */

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/modules/cache'
import { fetchProjectTree } from '../actions/projects-tree'
import type { ProjectTreeNode, FetchProjectTreeInput } from '../actions/projects-tree'

export interface UseProjectTreeOptions {
  /** ID проекта */
  projectId: string | null
  /** Включить/отключить запрос */
  enabled?: boolean
}

export function useProjectTree(options: UseProjectTreeOptions) {
  const { projectId, enabled = true } = options

  return useQuery({
    queryKey: queryKeys.projects.tree(projectId || ''),
    queryFn: async () => {
      if (!projectId) {
        return []
      }

      const input: FetchProjectTreeInput = { projectId }
      const result = await fetchProjectTree(input)

      if (!result.success) {
        throw new Error(result.error)
      }

      return result.data
    },
    enabled: enabled && Boolean(projectId?.trim()),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

export type { ProjectTreeNode }
