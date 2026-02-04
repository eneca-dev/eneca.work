/**
 * Item Inline Create Component
 *
 * Инлайн создание задачи (decomposition_item) с optimistic updates.
 * BP-005: Использует Server Actions с auth check вместо прямых Supabase вызовов.
 */

'use client'

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys, type CachedPaginatedData } from '@/modules/cache'
import { InlineCreateForm } from './InlineCreateForm'
import { useOperationGuard } from '../hooks/use-operation-guard'
import { createDecompositionItem } from '../actions/decomposition'
import {
  saveOptimisticSnapshot,
  rollbackOptimisticUpdate,
  addChildToParent,
  updateHierarchyNode,
  createOptimisticItem,
  invalidateHierarchyCache,
} from '../utils'
import type { HierarchyNode } from '../types'

// ============================================================================
// Types
// ============================================================================

type CachedResourceGraphData = CachedPaginatedData<HierarchyNode>

interface ItemInlineCreateProps {
  /** ID этапа декомпозиции */
  stageId: string
  /** ID раздела (для FK) */
  sectionId: string
  /** Callback при отмене */
  onCancel: () => void
  /** Callback при успехе */
  onSuccess?: () => void
}

// ============================================================================
// Component
// ============================================================================

export function ItemInlineCreate({
  stageId,
  sectionId,
  onCancel,
  onSuccess,
}: ItemInlineCreateProps) {
  const queryClient = useQueryClient()
  const { startOperation, isOperationStale, isOperationCurrent } = useOperationGuard()

  const handleSubmit = useCallback(
    async (value: string) => {
      const operationId = startOperation()
      const tempId = `temp-item-${operationId}`
      const snapshot = saveOptimisticSnapshot(queryClient)

      // Optimistic update
      queryClient.setQueriesData<CachedResourceGraphData>(
        { queryKey: queryKeys.resourceGraph.all },
        (oldData) => {
          if (!oldData?.data) return oldData
          return {
            ...oldData,
            data: addChildToParent(
              oldData.data,
              stageId,
              'decomposition_stage',
              createOptimisticItem(tempId, value, operationId)
            ),
          }
        }
      )

      try {
        // Server Action с auth check (BP-005)
        const result = await createDecompositionItem({
          stageId,
          sectionId,
          description: value,
        })

        if (!result.success) {
          throw new Error(result.error)
        }

        if (isOperationStale(operationId)) return

        // Заменяем temp ID на реальный
        queryClient.setQueriesData<CachedResourceGraphData>(
          { queryKey: queryKeys.resourceGraph.all },
          (oldData) => {
            if (!oldData?.data || !result.data) return oldData
            return {
              ...oldData,
              data: updateHierarchyNode(
                oldData.data,
                (node) => node.id === tempId,
                (node) => ({ ...node, id: result.data.decomposition_item_id })
              ),
            }
          }
        )

        await invalidateHierarchyCache(queryClient)
        onSuccess?.()
      } catch (err) {
        if (isOperationCurrent(operationId)) {
          rollbackOptimisticUpdate(queryClient, snapshot)
        }
        throw err
      }
    },
    [stageId, sectionId, queryClient, startOperation, isOperationStale, isOperationCurrent, onSuccess]
  )

  return (
    <InlineCreateForm
      placeholder="Название задачи..."
      onSubmit={handleSubmit}
      onCancel={onCancel}
      variant="item"
    />
  )
}
