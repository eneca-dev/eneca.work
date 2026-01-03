/**
 * Item Difficulty Select Component
 *
 * Инлайн выбор сложности задачи с optimistic updates.
 */

'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'
import { cn } from '@/lib/utils'
import { queryKeys } from '@/modules/cache'
import { useDifficultyLevels } from '../hooks/use-reference-data'
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
  const supabase = createClient()
  const { startOperation, isOperationStale, isOperationCurrent } = useOperationGuard()
  const { data: difficulties = [] } = useDifficultyLevels()

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

    setIsUpdating(true)
    setIsOpen(false)

    const operationId = startOperation()
    const snapshot = saveOptimisticSnapshot(queryClient)

    // Find new difficulty data
    const newDifficulty = newDifficultyId
      ? difficulties.find((d) => d.id === newDifficultyId)
      : null

    // Optimistic update
    queryClient.setQueriesData<HierarchyNode[]>(
      { queryKey: queryKeys.resourceGraph.all },
      (oldData) => {
        if (!oldData) return oldData
        return updateHierarchyNode(
          oldData,
          (node) => node.id === itemId,
          (node) => ({
            ...node,
            difficulty: newDifficulty
              ? { id: newDifficulty.id, abbr: newDifficulty.abbr, name: newDifficulty.name }
              : null,
          })
        )
      }
    )

    try {
      const { error } = await supabase
        .from('decomposition_items')
        .update({ decomposition_item_difficulty_id: newDifficultyId })
        .eq('decomposition_item_id', itemId)

      if (error) throw new Error(error.message)
      if (isOperationStale(operationId)) return

      await invalidateHierarchyCache(queryClient)
      onSuccess?.()
    } catch (err) {
      if (isOperationCurrent(operationId)) {
        rollbackOptimisticUpdate(queryClient, snapshot)
      }
      console.error('[ItemDifficultySelect] Error:', err)
    } finally {
      setIsUpdating(false)
    }
  }, [itemId, difficulty?.id, difficulties, queryClient, supabase, startOperation, isOperationStale, isOperationCurrent, onSuccess])

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
