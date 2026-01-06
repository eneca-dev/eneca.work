/**
 * Item Category Select Component
 *
 * Инлайн выбор категории работ задачи.
 * BP-005: Использует Server Actions с auth check вместо прямых Supabase вызовов.
 * BP-014: Исправлен - убран сломанный optimistic update, используется invalidation.
 */

'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'
import { useWorkCategories } from '../hooks/use-reference-data'
import { useOperationGuard } from '../hooks/use-operation-guard'
import { updateItemCategory } from '../actions/decomposition'
import { invalidateHierarchyCache } from '../utils'

// ============================================================================
// Types
// ============================================================================

interface ItemCategorySelectProps {
  /** ID задачи */
  itemId: string
  /** ID текущей категории */
  categoryId: string | null
  /** Название текущей категории */
  categoryName: string | null
  /** Callback при успехе */
  onSuccess?: () => void
}

// ============================================================================
// Component
// ============================================================================

export function ItemCategorySelect({
  itemId,
  categoryId,
  categoryName,
  onSuccess,
}: ItemCategorySelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const queryClient = useQueryClient()
  const { startOperation, isOperationStale } = useOperationGuard()
  const { data: categories = [] } = useWorkCategories()

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

  const handleSelect = useCallback(async (newCategoryId: string) => {
    if (newCategoryId === categoryId) {
      setIsOpen(false)
      return
    }

    setIsUpdating(true)
    setIsOpen(false)

    const operationId = startOperation()

    // Find new category data for logging
    const newCategory = categories.find((c) => c.id === newCategoryId)
    console.log('[ItemCategorySelect] Updating to:', newCategory?.name)

    // NOTE: Skipping broken optimistic update - Project structure uses objects/sections/stages/items,
    // not children property. Will rely on cache invalidation instead.

    try {
      // Server Action с auth check (BP-005)
      const result = await updateItemCategory({
        itemId,
        categoryId: newCategoryId,
      })

      if (!result.success) {
        throw new Error(result.error)
      }

      if (isOperationStale(operationId)) return

      await invalidateHierarchyCache(queryClient)
      onSuccess?.()
    } catch (err) {
      console.error('[ItemCategorySelect] Error:', err)
    } finally {
      setIsUpdating(false)
    }
  }, [itemId, categoryId, categories, queryClient, startOperation, isOperationStale, onSuccess])

  // Сокращённое название категории для компактного отображения
  const shortName = categoryName
    ? categoryName.length > 12 ? categoryName.slice(0, 10) + '...' : categoryName
    : '—'

  return (
    <div ref={dropdownRef} className="relative">
      {/* Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isUpdating}
        className={cn(
          'flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] transition-all cursor-pointer',
          'hover:bg-slate-700/50',
          categoryName ? 'text-slate-400' : 'text-slate-600',
          isUpdating && 'opacity-50 cursor-wait'
        )}
        title={categoryName || 'Выбрать категорию'}
      >
        <span className="truncate max-w-[80px]">{shortName}</span>
        <ChevronDown className="h-3 w-3 text-slate-600 shrink-0" />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 top-full left-0 mt-1 min-w-[160px] max-h-[240px] overflow-y-auto bg-slate-800 border border-slate-700 rounded-md shadow-lg py-1">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => handleSelect(c.id)}
              className={cn(
                'w-full px-3 py-1.5 text-left text-[11px] hover:bg-slate-700/50 transition-colors',
                categoryId === c.id && 'text-cyan-400 bg-slate-700/30'
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
