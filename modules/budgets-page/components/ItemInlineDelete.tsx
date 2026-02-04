/**
 * Item Inline Delete Component
 *
 * Инлайн удаление задачи (decomposition_item) с optimistic updates.
 * BP-005: Использует Server Actions с auth check вместо прямых Supabase вызовов.
 */

'use client'

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys, type CachedPaginatedData } from '@/modules/cache'
import { InlineDeleteButton } from './InlineDeleteButton'
import { useOperationGuard } from '../hooks/use-operation-guard'
import { deleteDecompositionItem } from '../actions/decomposition'
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

type CachedResourceGraphData = CachedPaginatedData<HierarchyNode>

interface ItemInlineDeleteProps {
  /** ID задачи */
  itemId: string
  /** Название задачи (для подтверждения) */
  itemName: string
  /** Callback при успехе */
  onSuccess?: () => void
}

// ============================================================================
// Component
// ============================================================================

export function ItemInlineDelete({
  itemId,
  itemName,
  onSuccess,
}: ItemInlineDeleteProps) {
  const queryClient = useQueryClient()
  const { startOperation, isOperationStale, isOperationCurrent } = useOperationGuard()

  const handleDelete = useCallback(async () => {
    const operationId = startOperation()
    const snapshot = saveOptimisticSnapshot(queryClient)

    // Optimistic update
    queryClient.setQueriesData<CachedResourceGraphData>(
      { queryKey: queryKeys.resourceGraph.all },
      (oldData) => {
        if (!oldData?.data) return oldData
        return {
          ...oldData,
          data: removeHierarchyNode(oldData.data, itemId),
        }
      }
    )

    try {
      // Server Action с auth check (BP-005)
      const result = await deleteDecompositionItem({ itemId })

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
  }, [itemId, queryClient, startOperation, isOperationStale, isOperationCurrent, onSuccess])

  return (
    <InlineDeleteButton
      entityName={itemName}
      onDelete={handleDelete}
      iconSize="sm"
      onSuccess={onSuccess}
    />
  )
}
