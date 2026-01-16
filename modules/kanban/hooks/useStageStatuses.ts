/**
 * Hook for stage statuses (Kanban columns)
 *
 * Uses TanStack Query for caching - data is fetched once and reused
 */

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'
import { queryKeys } from '@/modules/cache/keys/query-keys'

// ============================================================================
// Types
// ============================================================================

export interface StageStatus {
  id: string
  name: string
  color: string
  description: string | null
  kanban_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface StageStatusFormData {
  name: string
  color: string
  description?: string | null
}

// ============================================================================
// Query function
// ============================================================================

async function fetchStageStatuses(): Promise<StageStatus[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('stage_statuses')
    .select('*')
    .eq('is_active', true)
    .order('kanban_order')

  if (error) {
    throw new Error(error.message || 'Ошибка загрузки статусов')
  }

  return data || []
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Хук для работы со статусами этапов канбан-доски
 *
 * Использует TanStack Query с staleTime: Infinity - данные загружаются
 * один раз и кешируются до перезагрузки страницы или явной инвалидации.
 */
export function useStageStatuses() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.stageStatuses.list(),
    queryFn: fetchStageStatuses,
    staleTime: Infinity, // Статусы редко меняются - кешируем навсегда
    gcTime: 24 * 60 * 60 * 1000, // 24 часа
  })

  return {
    statuses: data ?? [],
    isLoading,
    error: error?.message ?? null,
    loadStatuses: refetch,
  }
}
