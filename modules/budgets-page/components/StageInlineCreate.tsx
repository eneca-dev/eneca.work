/**
 * Stage Inline Create Component
 *
 * Инлайн создание этапа декомпозиции с optimistic updates.
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
  createOptimisticStage,
  invalidateHierarchyCache,
} from '../utils'
import type { HierarchyNode } from '../types'

// ============================================================================
// Types
// ============================================================================

interface StageInlineCreateProps {
  /** ID раздела */
  sectionId: string
  /** Название раздела (для UX) */
  sectionName: string
  /** Callback при отмене */
  onCancel: () => void
  /** Callback при успехе */
  onSuccess?: () => void
}

// ============================================================================
// Component
// ============================================================================

export function StageInlineCreate({
  sectionId,
  sectionName,
  onCancel,
  onSuccess,
}: StageInlineCreateProps) {
  const queryClient = useQueryClient()
  const supabase = createClient()
  const { startOperation, isOperationStale, isOperationCurrent } = useOperationGuard()

  const handleSubmit = useCallback(
    async (value: string) => {
      const operationId = startOperation()
      const tempId = `temp-stage-${operationId}`
      const snapshot = saveOptimisticSnapshot(queryClient)

      // Optimistic update
      queryClient.setQueriesData<HierarchyNode[]>(
        { queryKey: queryKeys.resourceGraph.all },
        (oldData) => {
          if (!oldData) return oldData
          return addChildToParent(
            oldData,
            sectionId,
            'section',
            createOptimisticStage(tempId, value, operationId)
          )
        }
      )

      try {
        // Получаем максимальный order
        const { data: maxOrderData } = await supabase
          .from('decomposition_stages')
          .select('decomposition_stage_order')
          .eq('decomposition_stage_section_id', sectionId)
          .order('decomposition_stage_order', { ascending: false })
          .limit(1)

        const nextOrder = (maxOrderData?.[0]?.decomposition_stage_order ?? -1) + 1

        // Создаём в БД
        const { data, error } = await supabase
          .from('decomposition_stages')
          .insert({
            decomposition_stage_name: value,
            decomposition_stage_section_id: sectionId,
            decomposition_stage_order: nextOrder,
          })
          .select('decomposition_stage_id')
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
              (node) => ({ ...node, id: data.decomposition_stage_id })
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
    [sectionId, queryClient, supabase, startOperation, isOperationStale, isOperationCurrent, onSuccess]
  )

  return (
    <InlineCreateForm
      placeholder="Название этапа..."
      onSubmit={handleSubmit}
      onCancel={onCancel}
      variant="stage"
    />
  )
}
