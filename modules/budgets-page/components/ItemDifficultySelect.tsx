/**
 * Item Difficulty Select Component
 *
 * Инлайн выбор сложности задачи с optimistic updates.
 * BP-005: Использует Server Actions с auth check вместо прямых Supabase вызовов.
 */

'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { useDifficultyLevels } from '../hooks/use-reference-data'
import { useOperationGuard } from '../hooks/use-operation-guard'
import { updateItemDifficulty } from '../actions/decomposition'
import { invalidateHierarchyCache } from '../utils'

// ============================================================================
// Types
// ============================================================================

interface DifficultyData {
  id: string | null
  abbr: string | null
  name: string | null
}

interface ItemDifficultySelectProps {
  /** ID задачи */
  itemId: string
  /** Текущая сложность */
  difficulty: DifficultyData | null
  /** Callback при успехе */
  onSuccess?: () => void
}

// ============================================================================
// Component
// ============================================================================

export function ItemDifficultySelect({
  itemId,
  difficulty,
  onSuccess,
}: ItemDifficultySelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [optimisticValue, setOptimisticValue] = useState<DifficultyData | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const queryClient = useQueryClient()
  const { startOperation, isOperationStale } = useOperationGuard()
  const { data: difficulties = [] } = useDifficultyLevels()

  // Отображаемое значение: оптимистичное (если есть) или серверное
  const displayValue = isUpdating && optimisticValue !== null ? optimisticValue : difficulty

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = useCallback(async (newDifficultyId: string | null) => {
    if (newDifficultyId === difficulty?.id) {
      setIsOpen(false)
      return
    }

    // Find new difficulty data for optimistic display
    // Handle both mapped format (id/abbr/name) and raw DB format
    const newDifficultyData = newDifficultyId
      ? difficulties.find((d: any) => (d.id || d.difficulty_id) === newDifficultyId)
      : null

    const optimistic: DifficultyData = newDifficultyData
      ? {
          id: (newDifficultyData as any).id || (newDifficultyData as any).difficulty_id,
          abbr: (newDifficultyData as any).abbr || (newDifficultyData as any).difficulty_abbr,
          name: (newDifficultyData as any).name || (newDifficultyData as any).difficulty_definition,
        }
      : { id: null, abbr: null, name: null }

    // Optimistic update - показываем сразу
    setOptimisticValue(optimistic)
    setIsUpdating(true)
    setIsOpen(false)

    const operationId = startOperation()

    try {
      const result = await updateItemDifficulty({
        itemId,
        difficultyId: newDifficultyId,
      })

      if (!result.success) {
        throw new Error(result.error)
      }

      if (isOperationStale(operationId)) return

      await invalidateHierarchyCache(queryClient)
      onSuccess?.()
    } catch (err) {
      console.error('[ItemDifficultySelect] Error:', err)
      // Revert optimistic - очищаем, вернётся к серверному значению
      setOptimisticValue(null)
    } finally {
      setIsUpdating(false)
      setOptimisticValue(null)
    }
  }, [itemId, difficulty?.id, difficulties, queryClient, startOperation, isOperationStale, onSuccess])

  return (
    <div ref={dropdownRef} className="relative">
      {/* Badge/Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isUpdating}
        className={cn(
          'px-1.5 py-0.5 rounded text-[9px] font-medium transition-all cursor-pointer',
          'hover:ring-1 hover:ring-offset-1 hover:ring-offset-background',
          displayValue?.abbr
            ? 'bg-orange-500/20 text-orange-400 hover:ring-orange-500/50'
            : 'bg-muted text-muted-foreground hover:ring-muted-foreground/50',
          isUpdating && 'opacity-50 cursor-wait'
        )}
        title={displayValue?.name || 'Выбрать сложность'}
      >
        {displayValue?.abbr || '—'}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 top-full left-0 mt-1 min-w-[120px] bg-popover border border-border rounded-md shadow-lg py-1">
          {/* Clear option */}
          <button
            onClick={() => handleSelect(null)}
            className={cn(
              'w-full px-3 py-1.5 text-left text-[11px] hover:bg-muted transition-colors',
              !displayValue?.id && 'text-primary'
            )}
          >
            — Не указано
          </button>
          {/* Difficulty options */}
          {difficulties.map((d: any, index) => {
            // Handle both mapped format (id/abbr/name) and raw DB format
            const optionId = d.id || d.difficulty_id
            const optionAbbr = d.abbr || d.difficulty_abbr
            const optionName = d.name || d.difficulty_definition
            return (
              <button
                key={optionId || `diff-${index}`}
                onClick={() => handleSelect(optionId)}
                className={cn(
                  'w-full px-3 py-1.5 text-left text-[11px] hover:bg-muted transition-colors flex items-center gap-2',
                  displayValue?.id === optionId && 'text-primary'
                )}
              >
                <span className="w-6 text-center font-medium text-orange-400">{optionAbbr}</span>
                <span className="text-foreground">{optionName}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
