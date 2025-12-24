'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { X, ListTodo, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useWorkCategories, queryKeys } from '@/modules/cache'
import { createDecompositionItem } from '@/modules/resource-graph/actions'
import type { BaseModalProps } from '../../types'

// ============================================================================
// Types
// ============================================================================

export interface TaskCreateModalProps extends BaseModalProps {
  /** ID раздела */
  sectionId: string
  /** ID этапа декомпозиции */
  stageId: string
  /** Название этапа (для отображения в заголовке) */
  stageName: string
}

// ============================================================================
// Component
// ============================================================================

export function TaskCreateModal({
  isOpen,
  onClose,
  onSuccess,
  sectionId,
  stageId,
  stageName,
}: TaskCreateModalProps) {
  // Form state
  const [description, setDescription] = useState('')
  const [hoursString, setHoursString] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('')

  const queryClient = useQueryClient()

  // Query: Work categories (from cache module)
  const { data: categories = [], isLoading: categoriesLoading } = useWorkCategories()

  // Mutation: Create task
  const { mutate: createTask, isPending: isCreating } = useMutation({
    mutationFn: async (data: {
      sectionId: string
      stageId: string
      description: string
      plannedHours: number
      workCategoryId: string
    }) => {
      const result = await createDecompositionItem(data)
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    onSuccess: () => {
      // Invalidate resource graph data to refresh the tree
      queryClient.invalidateQueries({ queryKey: queryKeys.resourceGraph.all })
      onSuccess?.()
      onClose()
    },
  })

  // Derived state
  const hours = useMemo(() => {
    const parsed = parseFloat(hoursString.replace(',', '.'))
    return isNaN(parsed) ? 0 : parsed
  }, [hoursString])

  const isFormValid = useMemo(() => {
    return (
      description.trim() !== '' &&
      hours > 0 &&
      selectedCategoryId !== ''
    )
  }, [description, hours, selectedCategoryId])

  // Reset form on open
  useEffect(() => {
    if (isOpen) {
      setDescription('')
      setHoursString('')
      setSelectedCategoryId('')
    }
  }, [isOpen])

  // Auto-select first category if only one
  useEffect(() => {
    if (categories.length === 1 && !selectedCategoryId) {
      setSelectedCategoryId(categories[0].work_category_id)
    }
  }, [categories, selectedCategoryId])

  // Handlers
  const handleSubmit = useCallback(() => {
    if (!isFormValid || isCreating) return

    createTask({
      sectionId,
      stageId,
      description: description.trim(),
      plannedHours: hours,
      workCategoryId: selectedCategoryId,
    })
  }, [isFormValid, isCreating, createTask, sectionId, stageId, description, hours, selectedCategoryId])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && isFormValid && !isCreating) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') {
      onClose()
    }
  }, [handleSubmit, onClose, isFormValid, isCreating])

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className={cn(
            'pointer-events-auto w-full max-w-md',
            'bg-slate-900/95 backdrop-blur-md',
            'border border-slate-700/50',
            'rounded-lg shadow-2xl shadow-black/50',
            'transform transition-all duration-200',
            isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          )}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/50">
            <div className="flex items-center gap-2 min-w-0">
              <ListTodo className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-xs font-medium text-slate-300">Создать задачу</span>
              <span className="text-[10px] text-slate-500">·</span>
              <span className="text-[10px] text-slate-400 truncate" title={stageName}>
                {stageName}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-4 py-3 space-y-3">
            {/* Task description */}
            <div>
              <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1.5">
                Название задачи
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Что нужно сделать..."
                autoFocus
                className={cn(
                  'w-full px-2.5 py-1.5 text-xs',
                  'bg-slate-800/50 border border-slate-700',
                  'rounded text-slate-200',
                  'placeholder:text-slate-600',
                  'focus:outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600/50',
                  'transition-colors'
                )}
                disabled={isCreating}
              />
            </div>

            {/* Hours + Category in one row */}
            <div className="grid grid-cols-2 gap-3">
              {/* Hours */}
              <div>
                <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1.5">
                  Плановые часы
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={hoursString}
                    onChange={(e) => setHoursString(e.target.value.replace(/[^\d,\.]/g, ''))}
                    placeholder="0"
                    className={cn(
                      'w-full px-2.5 py-1.5 pr-6 text-xs',
                      'bg-slate-800/50 border border-slate-700',
                      'rounded text-slate-200 font-mono',
                      'placeholder:text-slate-600',
                      'focus:outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600/50',
                      'transition-colors'
                    )}
                    disabled={isCreating}
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">
                    ч
                  </span>
                </div>
              </div>

              {/* Work category */}
              <div>
                <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1.5">
                  Категория работ
                </label>
                {categoriesLoading ? (
                  <div className="flex items-center justify-center h-[30px]">
                    <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                  </div>
                ) : (
                  <select
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    className={cn(
                      'w-full px-2.5 py-1.5 text-xs',
                      'bg-slate-800/50 border border-slate-700',
                      'rounded text-slate-200',
                      'focus:outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600/50',
                      'transition-colors',
                      !selectedCategoryId && 'text-slate-600'
                    )}
                    disabled={isCreating}
                  >
                    <option value="">Выберите...</option>
                    {categories.map((cat) => (
                      <option key={cat.work_category_id} value={cat.work_category_id}>
                        {cat.work_category_name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-slate-700/50">
            <button
              onClick={onClose}
              disabled={isCreating}
              className={cn(
                'px-3 py-1.5 text-[11px] font-medium rounded',
                'text-slate-400 hover:text-slate-300',
                'border border-slate-700 hover:border-slate-600',
                'bg-slate-800/50 hover:bg-slate-800',
                'transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              Отмена
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isFormValid || isCreating}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded',
                'text-slate-900 bg-amber-500 hover:bg-amber-400',
                'transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500'
              )}
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Создание...
                </>
              ) : (
                <>
                  <ListTodo className="w-3 h-3" />
                  Создать
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
