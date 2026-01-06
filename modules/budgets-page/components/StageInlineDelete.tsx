/**
 * Stage Inline Delete Component
 *
 * Инлайн удаление этапа декомпозиции с optimistic updates.
 * BP-005: Использует Server Actions с auth check вместо прямых Supabase вызовов.
 */

'use client'

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/modules/cache'
import { InlineDeleteButton } from './InlineDeleteButton'
import { useOperationGuard } from '../hooks/use-operation-guard'
import { deleteDecompositionStage } from '../actions/decomposition'
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
      // Server Action с auth check (BP-005)
      const result = await deleteDecompositionStage({ stageId })

      if (!result.success) {
        throw new Error(result.error)
      }

      if (isOperationStale(operationId)) return

      await invalidateHierarchyCache(queryClient)
      onSuccess?.()
    } catch (err) {
      if (isOperationCurrent(operationId)) {
        rollbackOptimisticUpdate(queryClient, snapshot)
      }
      throw err
    }
  }, [stageId, queryClient, startOperation, isOperationStale, isOperationCurrent, onSuccess])

  return (
    <InlineDeleteButton
      entityName={stageName}
      onDelete={handleDelete}
      onSuccess={onSuccess}
    />
  )
}
