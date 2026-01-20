'use client'

/**
 * Loading Modal 2 - Hook для загрузки breadcrumbs по node_id
 */

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/modules/cache'
import { fetchBreadcrumbs } from '../actions/projects-tree'
import type { BreadcrumbItem } from '../actions/projects-tree'

export interface UseBreadcrumbsOptions {
  /** ID узла (section или decomposition_stage) */
  nodeId: string | null
  /** Включить/отключить запрос */
  enabled?: boolean
}

export interface UseBreadcrumbsResult {
  /** Breadcrumbs от проекта до узла */
  breadcrumbs: BreadcrumbItem[] | null
  /** ID проекта */
  projectId: string | null
  /** Загрузка */
  isLoading: boolean
  /** Ошибка */
  error: Error | null
}

export function useBreadcrumbs(options: UseBreadcrumbsOptions): UseBreadcrumbsResult {
  const { nodeId, enabled = true } = options

  const query = useQuery({
    queryKey: queryKeys.projects.breadcrumbs(nodeId || ''),
    queryFn: async () => {
      if (!nodeId) {
        return { breadcrumbs: null, projectId: null }
      }

      const result = await fetchBreadcrumbs({ nodeId })

      if (!result.success) {
        throw new Error(result.error)
      }

      return {
        breadcrumbs: result.data.breadcrumbs,
        projectId: result.data.projectId,
      }
    },
    enabled: enabled && Boolean(nodeId?.trim()),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })

  return {
    breadcrumbs: query.data?.breadcrumbs ?? null,
    projectId: query.data?.projectId ?? null,
    isLoading: query.isLoading,
    error: query.error,
  }
}

export type { BreadcrumbItem }
