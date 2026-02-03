/**
 * Section Rate Edit Component
 *
 * Инлайн редактирование часовой ставки раздела с optimistic updates.
 * BP-003: Ставка используется для расчёта бюджета раздела.
 */

'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { queryKeys } from '@/modules/cache'
import { useOperationGuard } from '../hooks/use-operation-guard'
import { updateSectionHourlyRate } from '../actions/decomposition'
import {
  saveOptimisticSnapshot,
  rollbackOptimisticUpdate,
  updateHierarchyNode,
  invalidateHierarchyCache,
} from '../utils'
import { MOCK_HOURLY_RATE } from '../config/constants'
import type { HierarchyNode } from '../types'

// ============================================================================
// Types
// ============================================================================

/**
 * Тип кешированных данных Resource Graph (с пагинацией)
 */
type CachedResourceGraphData = {
  success: true
  data: HierarchyNode[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

interface SectionRateEditProps {
  /** ID раздела */
  sectionId: string
  /** Текущая ставка (null = использовать default) */
  value: number | null
  /** Callback при успехе */
  onSuccess?: () => void
}

// ============================================================================
// Component
// ============================================================================

export function SectionRateEdit({
  sectionId,
  value,
  onSuccess,
}: SectionRateEditProps) {
  const queryClient = useQueryClient()
  const { startOperation, isOperationStale, isOperationCurrent } = useOperationGuard()

  // Эффективная ставка (используем default если null)
  const effectiveRate = value ?? MOCK_HOURLY_RATE
  const isDefault = value === null

  const [isEditing, setIsEditing] = useState(false)
  const [localValue, setLocalValue] = useState(effectiveRate.toString())
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync с внешним значением
  useEffect(() => {
    if (!isEditing) {
      setLocalValue(effectiveRate.toString())
    }
  }, [effectiveRate, isEditing])

  // Focus при входе в режим редактирования
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleClick = useCallback(() => {
    setIsEditing(true)
  }, [])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // Разрешаем только цифры и точку для десятичных
    const raw = e.target.value.replace(/[^\d.]/g, '')
    // Не более одной точки
    const parts = raw.split('.')
    if (parts.length > 2) return
    setLocalValue(raw)
  }, [])

  const handleSave = useCallback(async () => {
    const newValue = parseFloat(localValue) || 0
    const newRate = newValue > 0 ? newValue : null // 0 означает "сбросить к default"

    setIsEditing(false)

    // Если значение не изменилось
    if (newRate === value || (newRate === null && isDefault)) {
      return
    }

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
            (node) => node.id === sectionId,
            (node) => ({ ...node, hourlyRate: newRate })
          ),
        }
      }
    )

    try {
      const result = await updateSectionHourlyRate({
        sectionId,
        hourlyRate: newRate,
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
      console.error('[SectionRateEdit] Error:', err)
    }
  }, [localValue, value, isDefault, sectionId, queryClient, startOperation, isOperationStale, isOperationCurrent, onSuccess])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      setLocalValue(effectiveRate.toString())
      setIsEditing(false)
    }
  }, [handleSave, effectiveRate])

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={localValue}
        onChange={handleChange}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={cn(
          'w-14 h-5 px-1 text-[11px] tabular-nums text-right',
          'bg-muted border border-border rounded outline-none',
          'focus:border-primary focus:ring-1 focus:ring-primary/30'
        )}
      />
    )
  }

  return (
    <span
      onClick={handleClick}
      className={cn(
        'text-[11px] tabular-nums cursor-pointer hover:text-primary',
        isDefault ? 'text-muted-foreground/50' : 'text-muted-foreground'
      )}
      title={isDefault ? 'Ставка по умолчанию. Нажмите для изменения.' : 'Нажмите для изменения'}
    >
      {effectiveRate}
    </span>
  )
}
