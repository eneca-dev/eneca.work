/**
 * Item Inline Create Component
 *
 * Инлайн создание задачи (decomposition_item) с optimistic updates.
 */

'use client'

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'
import { queryKeys } from '@/modules/cache'
import { InlineCreateForm } from './InlineCreateForm'
import { useOperationGuard } from '../hooks/use-operation-guard'
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
// Constants
// ============================================================================

/** Default work category ID (Проектирование) */
const DEFAULT_WORK_CATEGORY_ID = '89a560a5-e740-4cec-b2df-e4edd49f95b2'

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
  const supabase = createClient()
  const { startOperation, isOperationStale, isOperationCurrent } = useOperationGuard()

  const handleSubmit = useCallback(
    async (value: string) => {
      const operationId = startOperation()
      const tempId = `temp-item-${operationId}`
      const snapshot = saveOptimisticSnapshot(queryClient)

      // Optimistic update
      queryClient.setQueriesData<HierarchyNode[]>(
        { queryKey: queryKeys.resourceGraph.all },
        (oldData) => {
          if (!oldData) return oldData
          return addChildToParent(
            oldData,
            stageId,
            'decomposition_stage',
            createOptimisticItem(tempId, value, operationId)
          )
        }
      )

      try {
        // Получаем максимальный order
        const { data: maxOrderData } = await supabase
          .from('decomposition_items')
          .select('decomposition_item_order')
          .eq('decomposition_item_stage_id', stageId)
          .order('decomposition_item_order', { ascending: false })
          .limit(1)

        const nextOrder = (maxOrderData?.[0]?.decomposition_item_order ?? -1) + 1

        // Создаём в БД
        const { data, error } = await supabase
          .from('decomposition_items')
          .insert({
            decomposition_item_description: value,
            decomposition_item_section_id: sectionId,
            decomposition_item_stage_id: stageId,
            decomposition_item_work_category_id: DEFAULT_WORK_CATEGORY_ID,
            decomposition_item_planned_hours: 0,
            decomposition_item_order: nextOrder,
          })
          .select('decomposition_item_id')
          .single()

        if (error) throw new Error(error.message)
        if (isOperationStale(operationId)) return

        // Заменяем temp ID на реальный
        queryClient.setQueriesData<HierarchyNode[]>(
          { queryKey: queryKeys.resourceGraph.all },
          (oldData) => {
            if (!oldData || !data) return oldData
            return updateHierarchyNode(
              oldData,
              (node) => node.id === tempId,
              (node) => ({ ...node, id: data.decomposition_item_id })
            )
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
    [stageId, sectionId, queryClient, supabase, startOperation, isOperationStale, isOperationCurrent, onSuccess]
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
