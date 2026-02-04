/**
 * Item Hours Edit Component
 *
 * Инлайн редактирование плановых часов задачи с optimistic updates.
 * BP-005: Использует Server Actions с auth check вместо прямых Supabase вызовов.
 */

'use client'

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys, type CachedPaginatedData } from '@/modules/cache'
import { HoursInput } from './HoursInput'
import { useOperationGuard } from '../hooks/use-operation-guard'
import { updateItemPlannedHours } from '../actions/decomposition'
import {
  saveOptimisticSnapshot,
  rollbackOptimisticUpdate,
  updateHierarchyNode,
  invalidateHierarchyCache,
} from '../utils'
import type { HierarchyNode } from '../types'

// Алиас для удобства чтения
type CachedResourceGraphData = CachedPaginatedData<HierarchyNode>

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
  const { startOperation, isOperationStale, isOperationCurrent } = useOperationGuard()

  const handleChange = useCallback(async (newValue: number) => {
    if (newValue === value) return

    const operationId = startOperation()
    const snapshot = saveOptimisticSnapshot(queryClient)

    // Optimistic update
    queryClient.setQueriesData<CachedResourceGraphData>(
      { queryKey: queryKeys.resourceGraph.all },
      (oldData) => {
        if (!oldData?.data) return oldData
        return {
          ...oldData,
          data: updateHierarchyNode(
            oldData.data,
            (node) => node.id === itemId,
            (node) => ({ ...node, plannedHours: newValue })
          ),
        }
      }
    )

    try {
      // Server Action с auth check (BP-005)
      const result = await updateItemPlannedHours({
        itemId,
        plannedHours: newValue,
      })

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
      console.error('[ItemHoursEdit] Error:', err)
    }
  }, [itemId, value, queryClient, startOperation, isOperationStale, isOperationCurrent, onSuccess])

  return (
    <HoursInput
      value={value}
      onChange={handleChange}
      dimIfZero
      highlighted
    />
  )
}
