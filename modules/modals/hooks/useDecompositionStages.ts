'use client'

/**
 * Hook для загрузки этапов декомпозиции конкретного раздела
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchDecompositionStages } from '../actions/decomposition-stages'
import { queryKeys } from '@/modules/cache'
import { findSectionStagesInCache } from './project-tree-cache'

export interface DecompositionStage {
  id: string
  name: string
  description: string | null
  startDate: string | null
  endDate: string | null
  order: number | null
}

export interface UseDecompositionStagesOptions {
  /** ID раздела */
  sectionId: string | null
  /** Включить/отключить запрос */
  enabled?: boolean
}

export function useDecompositionStages(options: UseDecompositionStagesOptions) {
  const { sectionId, enabled = true } = options
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: queryKeys.decompositionStages.list(sectionId ?? ''),
    queryFn: async () => {
      if (!sectionId) {
        return []
      }

      // cache-first: этапы уже есть в загруженном дереве проекта — без сетевого запроса
      const cached = findSectionStagesInCache(queryClient, sectionId)
      if (cached) {
        return cached
      }

      const result = await fetchDecompositionStages({ sectionId })

      if (!result.success) {
        console.error('❌ Ошибка загрузки этапов:', result.error)
        throw new Error(result.error)
      }

      return result.data
    },
    enabled: enabled && Boolean(sectionId),
    staleTime: 5 * 60 * 1000, // 5 minutes — после устаревания фоновый рефетч (без спиннера)
    gcTime: Infinity, // не удаляем из кэша в течение сессии → нет крутилки в селекторе этапов
  })
}

export type { UseDecompositionStagesOptions }
