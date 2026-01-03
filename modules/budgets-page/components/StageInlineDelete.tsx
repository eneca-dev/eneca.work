/**
 * Stage Inline Delete Component
 *
 * Инлайн удаление этапа декомпозиции с optimistic updates.
 */

'use client'

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'
import { queryKeys } from '@/modules/cache'
import { InlineDeleteButton } from './InlineDeleteButton'
import { useOperationGuard } from '../hooks/use-operation-guard'
import {
  saveOptimisticSnapshot,
  rollbackOptimisticUpdate,
  removeHierarchyNode,
  invalidateHierarchyCache,
} from '../utils'
import type { HierarchyNode } from '../types'

// ============================================================================
// Types
// ============================================================================

interface StageInlineDeleteProps {
  /** ID этапа */
  stageId: string
  /** Название этапа (для подтверждения) */
  stageName: string
  /** Callback при успехе */
  onSuccess?: () => void
}

// ============================================================================
// Component
// ============================================================================

export function StageInlineDelete({
  stageId,
  stageName,
  onSuccess,
}: StageInlineDeleteProps) {
  const queryClient = useQueryClient()
  const supabase = createClient()
  const { startOperation, isOperationStale, isOperationCurrent } = useOperationGuard()

  const handleDelete = useCallback(async () => {
    const operationId = startOperation()
    const snapshot = saveOptimisticSnapshot(queryClient)

    // Optimistic update
    queryClient.setQueriesData<HierarchyNode[]>(
      { queryKey: queryKeys.resourceGraph.all },
      (oldData) => {
        if (!oldData) return oldData
        return removeHierarchyNode(oldData, stageId)
      }
    )

    try {
      const { error } = await supabase
        .from('decomposition_stages')
        .delete()
        .eq('decomposition_stage_id', stageId)

      if (error) throw new Error(error.message)
      if (isOperationStale(operationId)) return

      await invalidateHierarchyCache(queryClient)
      onSuccess?.()
    } catch (err) {
      if (isOperationCurrent(operationId)) {
        rollbackOptimisticUpdate(queryClient, snapshot)
      }
      throw err
    }
  }, [stageId, queryClient, supabase, startOperation, isOperationStale, isOperationCurrent, onSuccess])

  return (
    <InlineDeleteButton
      entityName={stageName}
      onDelete={handleDelete}
      onSuccess={onSuccess}
    />
  )
}
