'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { X, Plus, LayoutGrid, GanttChart, Users, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTasksTabsStore, type TaskTab, type TasksViewMode } from '../stores'

// ============================================================================
// Types
// ============================================================================

interface TabModalProps {
  open: boolean
  onClose: () => void
  editingTab: TaskTab | null
}

// ============================================================================
// Constants
// ============================================================================

const VIEW_MODE_OPTIONS: {
  value: TasksViewMode
  label: string
  icon: typeof LayoutGrid
}[] = [
  { value: 'kanban', label: 'Канбан', icon: LayoutGrid },
  { value: 'timeline', label: 'График', icon: GanttChart },
  { value: 'departments', label: 'Отделы', icon: Users },
  { value: 'budgets', label: 'Бюджеты', icon: Wallet },
]

// ============================================================================
// Component
// ============================================================================

export function TabModal({ open, onClose, editingTab }: TabModalProps) {
  const { createTab, updateTab } = useTasksTabsStore()

  // Form state
  const [name, setName] = useState('')
  const [viewMode, setViewMode] = useState<TasksViewMode>('kanban')

  const isEditing = !!editingTab

  // Validation
  const isFormValid = useMemo(() => {
    return name.trim().length > 0 && name.trim().length <= 30
  }, [name])

  // Reset form on open
  useEffect(() => {
    if (open) {
      if (editingTab) {
        setName(editingTab.name)
        setViewMode(editingTab.viewMode)
      } else {
        setName('')
        setViewMode('kanban')
      }
    }
  }, [open, editingTab])

  // Handlers
  const handleSubmit = useCallback(() => {
    if (!isFormValid) return

    if (isEditing && editingTab) {
      updateTab(editingTab.id, {
        name: name.trim(),
        viewMode,
      })
    } else {
      createTab({
        name: name.trim(),
        viewMode,
      })
    }
    onClose()
  }, [isFormValid, isEditing, editingTab, name, viewMode, createTab, updateTab, onClose])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && isFormValid) {
        e.preventDefault()
        handleSubmit()
      }
      if (e.key === 'Escape') {
        onClose()
      }
    },
    [isFormValid, handleSubmit, onClose]
  )

  if (!open) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/20 dark:bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className={cn(
            'pointer-events-auto w-full max-w-sm',
            'bg-white border border-slate-300',
            'dark:bg-slate-900/95 dark:backdrop-blur-md dark:border-slate-700/50',
            'rounded-lg shadow-2xl',
            'shadow-slate-500/20 dark:shadow-black/50',
            'transform transition-all duration-200',
            open ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          )}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-300 dark:border-slate-700/50">
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {isEditing ? 'Редактировать вкладку' : 'Новая вкладка'}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-4 py-4 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Название
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Мои задачи"
                autoFocus
                maxLength={30}
                className={cn(
                  'w-full px-3 py-2 text-sm',
                  'bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700',
                  'rounded text-slate-800 dark:text-slate-200',
                  'placeholder:text-slate-400 dark:placeholder:text-slate-600',
                  'focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30',
                  'transition-colors'
                )}
              />
              <div className="mt-1 text-[10px] text-slate-400 dark:text-slate-500 text-right">
                {name.length}/30
              </div>
            </div>

            {/* View Mode */}
            <div>
              <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Тип отображения
              </label>
              <div className="grid grid-cols-2 gap-2">
                {VIEW_MODE_OPTIONS.map((option) => {
                  const Icon = option.icon
                  const isSelected = viewMode === option.value

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setViewMode(option.value)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded border text-sm transition-colors',
                        isSelected
                          ? 'border-primary bg-primary/10 text-slate-800 dark:text-slate-200'
                          : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      )}
                    >
                      <Icon className={cn('w-4 h-4', isSelected && 'text-primary')} />
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-slate-300 dark:border-slate-700/50">
            <button
              onClick={onClose}
              className={cn(
                'px-3 py-1.5 text-[11px] font-medium rounded',
                'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300',
                'border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600',
                'bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-800',
                'transition-colors'
              )}
            >
              Отмена
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isFormValid}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded',
                'text-white bg-primary hover:bg-primary/90',
                'transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-400 dark:disabled:bg-slate-700'
              )}
            >
              <Plus className="w-3 h-3" />
              {isEditing ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
