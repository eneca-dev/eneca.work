'use client'

/**
 * Hook for fetching stage statuses
 * Reference data - cached for a long time
 */

import { createSimpleCacheQuery, staleTimePresets, queryKeys } from '@/modules/cache'
import { getStageStatuses, type StageStatus } from '../actions'

// ============================================================================
// Hook
// ============================================================================

/**
 * Хук для получения списка статусов этапов
 * Справочные данные - кешируются 10 минут
 *
 * @example
 * const { data: statuses, isLoading } = useStageStatuses()
 */
export const useStageStatuses = createSimpleCacheQuery<StageStatus[]>({
  queryKey: queryKeys.stageStatuses.list(),
  queryFn: getStageStatuses,
  staleTime: staleTimePresets.static, // 10 минут - справочник редко меняется
})
