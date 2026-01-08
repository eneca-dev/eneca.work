/**
 * Item Category Select Component
 *
 * Инлайн выбор категории работ задачи с optimistic updates.
 * BP-005: Использует Server Actions с auth check вместо прямых Supabase вызовов.
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

interface CategoryData {
  id: string | null
  name: string | null
}

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
  const [optimisticValue, setOptimisticValue] = useState<CategoryData | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const queryClient = useQueryClient()
  const { startOperation, isOperationStale } = useOperationGuard()
  const { data: categories = [] } = useWorkCategories()

  // Отображаемые значения: оптимистичные (если есть) или серверные
  const displayId = isUpdating && optimisticValue !== null ? optimisticValue.id : categoryId
  const displayName = isUpdating && optimisticValue !== null ? optimisticValue.name : categoryName

  // Сокращённое название категории для компактного отображения
  const shortName = displayName
    ? displayName.length > 12 ? displayName.slice(0, 10) + '...' : displayName
    : '—'

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

    // Find new category data for optimistic display
    // Handle both mapped format (id/name) and raw DB format
    const newCategoryData = categories.find((c: any) =>
      (c.id || c.work_category_id) === newCategoryId
    )

    const optimistic: CategoryData = newCategoryData
      ? {
          id: (newCategoryData as any).id || (newCategoryData as any).work_category_id,
          name: (newCategoryData as any).name || (newCategoryData as any).work_category_name,
        }
      : { id: newCategoryId, name: null }

    // Optimistic update - показываем сразу
    setOptimisticValue(optimistic)
    setIsUpdating(true)
    setIsOpen(false)

    const operationId = startOperation()

    try {
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
      // Revert optimistic - очищаем, вернётся к серверному значению
      setOptimisticValue(null)
    } finally {
      setIsUpdating(false)
      setOptimisticValue(null)
    }
  }, [itemId, categoryId, categories, queryClient, startOperation, isOperationStale, onSuccess])

  return (
    <div ref={dropdownRef} className="relative">
      {/* Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isUpdating}
        className={cn(
          'flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] transition-all cursor-pointer',
          'hover:bg-slate-700/50',
          displayName ? 'text-slate-400' : 'text-slate-600',
          isUpdating && 'opacity-50 cursor-wait'
        )}
        title={displayName || 'Выбрать категорию'}
      >
        <span className="truncate max-w-[80px]">{shortName}</span>
        <ChevronDown className="h-3 w-3 text-slate-600 shrink-0" />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 top-full left-0 mt-1 min-w-[160px] max-h-[240px] overflow-y-auto bg-slate-800 border border-slate-700 rounded-md shadow-lg py-1">
          {categories.map((c: any, index) => {
            // Handle both mapped format (id/name) and raw DB format
            const optionId = c.id || c.work_category_id
            const optionName = c.name || c.work_category_name
            return (
              <button
                key={optionId || `cat-${index}`}
                onClick={() => handleSelect(optionId)}
                className={cn(
                  'w-full px-3 py-1.5 text-left text-[11px] hover:bg-slate-700/50 transition-colors',
                  displayId === optionId && 'text-cyan-400 bg-slate-700/30'
                )}
              >
                {optionName}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
