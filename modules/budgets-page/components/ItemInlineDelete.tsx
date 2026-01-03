/**
 * Item Inline Delete Component
 *
 * Инлайн удаление задачи (decomposition_item) с optimistic updates.
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
        return removeHierarchyNode(oldData, itemId)
      }
    )

    try {
      const { error } = await supabase
        .from('decomposition_items')
        .delete()
        .eq('decomposition_item_id', itemId)

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
  }, [itemId, queryClient, supabase, startOperation, isOperationStale, isOperationCurrent, onSuccess])

  return (
    <InlineDeleteButton
      entityName={itemName}
      onDelete={handleDelete}
      iconSize="sm"
      onSuccess={onSuccess}
    />
  )
}
