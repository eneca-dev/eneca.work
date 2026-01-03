/**
 * Item Hours Edit Component
 *
 * Инлайн редактирование плановых часов задачи с optimistic updates.
 */

'use client'

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'
import { queryKeys } from '@/modules/cache'
import { HoursInput } from './HoursInput'
import { useOperationGuard } from '../hooks/use-operation-guard'
import {
  saveOptimisticSnapshot,
  rollbackOptimisticUpdate,
  updateHierarchyNode,
  invalidateHierarchyCache,
} from '../utils'
import type { HierarchyNode } from '../types'

// ============================================================================
// Types
// ============================================================================

interface ItemHoursEditProps {
  /** ID задачи */
  itemId: string
  /** Текущее значение часов */
  value: number
  /** Callback при успехе */
  onSuccess?: () => void
}

// ============================================================================
// Component
// ============================================================================

export function ItemHoursEdit({
  itemId,
  value,
  onSuccess,
}: ItemHoursEditProps) {
  const queryClient = useQueryClient()
  const supabase = createClient()
  const { startOperation, isOperationStale, isOperationCurrent } = useOperationGuard()

  const handleChange = useCallback(async (newValue: number) => {
    if (newValue === value) return

    const operationId = startOperation()
    const snapshot = saveOptimisticSnapshot(queryClient)

    // Optimistic update
    queryClient.setQueriesData<HierarchyNode[]>(
      { queryKey: queryKeys.resourceGraph.all },
      (oldData) => {
        if (!oldData) return oldData
        return updateHierarchyNode(
          oldData,
          (node) => node.id === itemId,
          (node) => ({ ...node, plannedHours: newValue })
        )
      }
    )

    try {
      const { error } = await supabase
        .from('decomposition_items')
        .update({ decomposition_item_planned_hours: newValue })
        .eq('decomposition_item_id', itemId)

      if (error) throw new Error(error.message)
      if (isOperationStale(operationId)) return

      await invalidateHierarchyCache(queryClient)
      onSuccess?.()
    } catch (err) {
      if (isOperationCurrent(operationId)) {
        rollbackOptimisticUpdate(queryClient, snapshot)
      }
      console.error('[ItemHoursEdit] Error:', err)
    }
  }, [itemId, value, queryClient, supabase, startOperation, isOperationStale, isOperationCurrent, onSuccess])

  return (
    <HoursInput
      value={value}
      onChange={handleChange}
      dimIfZero
      highlighted
    />
  )
}
