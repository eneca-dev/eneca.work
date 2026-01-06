/**
 * Item Difficulty Select Component
 *
 * Инлайн выбор сложности задачи.
 * BP-005: Использует Server Actions с auth check вместо прямых Supabase вызовов.
 * BP-014: Исправлен - убран сломанный optimistic update, используется invalidation.
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

interface ItemDifficultySelectProps {
  /** ID задачи */
  itemId: string
  /** Текущая сложность */
  difficulty: {
    id: string | null
    abbr: string | null
    name: string | null
  } | null
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
  const dropdownRef = useRef<HTMLDivElement>(null)

  const queryClient = useQueryClient()
  const { startOperation, isOperationStale, isOperationCurrent } = useOperationGuard()
  const { data: difficulties = [], isLoading, error } = useDifficultyLevels()

  // Debug: log difficulties loading state
  console.log('[ItemDifficultySelect] difficulties:', difficulties.length, 'loading:', isLoading, 'error:', error)

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
    console.log('[ItemDifficultySelect] handleSelect called with:', newDifficultyId, 'current:', difficulty?.id)

    if (newDifficultyId === difficulty?.id) {
      console.log('[ItemDifficultySelect] Same value, skipping')
      setIsOpen(false)
      return
    }

    setIsUpdating(true)
    setIsOpen(false)

    const operationId = startOperation()

    // Find new difficulty data for optimistic UI feedback
    const newDifficulty = newDifficultyId
      ? difficulties.find((d) => d.id === newDifficultyId)
      : null

    // NOTE: Skipping broken optimistic update - Project structure uses objects/sections/stages/items,
    // not children property. Will rely on cache invalidation instead.
    console.log('[ItemDifficultySelect] New difficulty:', newDifficulty)

    try {
      // Server Action с auth check (BP-005)
      console.log('[ItemDifficultySelect] Calling updateItemDifficulty:', { itemId, difficultyId: newDifficultyId })
      const result = await updateItemDifficulty({
        itemId,
        difficultyId: newDifficultyId,
      })
      console.log('[ItemDifficultySelect] Server action result:', result)

      if (!result.success) {
        throw new Error(result.error)
      }

      if (isOperationStale(operationId)) return

      await invalidateHierarchyCache(queryClient)
      onSuccess?.()
    } catch (err) {
      console.error('[ItemDifficultySelect] Error:', err)
    } finally {
      setIsUpdating(false)
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
          'hover:ring-1 hover:ring-offset-1 hover:ring-offset-slate-900',
          difficulty?.abbr
            ? 'bg-orange-500/20 text-orange-400 hover:ring-orange-500/50'
            : 'bg-slate-700/50 text-slate-500 hover:ring-slate-500/50',
          isUpdating && 'opacity-50 cursor-wait'
        )}
        title={difficulty?.name || 'Выбрать сложность'}
      >
        {difficulty?.abbr || '—'}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 top-full left-0 mt-1 min-w-[120px] bg-slate-800 border border-slate-700 rounded-md shadow-lg py-1">
          {/* Clear option */}
          <button
            onClick={() => handleSelect(null)}
            className={cn(
              'w-full px-3 py-1.5 text-left text-[11px] hover:bg-slate-700/50 transition-colors',
              !difficulty?.id && 'text-cyan-400'
            )}
          >
            — Не указано
          </button>
          {/* Difficulty options */}
          {difficulties.map((d) => (
            <button
              key={d.id}
              onClick={() => handleSelect(d.id)}
              className={cn(
                'w-full px-3 py-1.5 text-left text-[11px] hover:bg-slate-700/50 transition-colors flex items-center gap-2',
                difficulty?.id === d.id && 'text-cyan-400'
              )}
            >
              <span className="w-6 text-center font-medium text-orange-400">{d.abbr}</span>
              <span className="text-slate-300">{d.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
