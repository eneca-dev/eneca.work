'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { X, Plus, LayoutGrid, GanttChart, Users, Wallet, FolderTree } from 'lucide-react'
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
  { value: 'sections', label: 'Разделы', icon: FolderTree },
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
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className={cn(
            'pointer-events-auto w-full max-w-sm',
            'bg-background border border-border',
            'rounded-lg shadow-lg',
            'transform transition-all duration-200',
            open ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          )}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-foreground">
                {isEditing ? 'Редактировать вкладку' : 'Новая вкладка'}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-4 py-4 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
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
                  'bg-background border border-input',
                  'rounded-md text-foreground',
                  'placeholder:text-muted-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                  'transition-colors'
                )}
              />
              <div className="mt-1 text-[10px] text-muted-foreground text-right">
                {name.length}/30
              </div>
            </div>

            {/* View Mode */}
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
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
                        'flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors',
                        isSelected
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-input text-muted-foreground hover:border-primary/50 hover:bg-muted'
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
          <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-border">
            <button
              onClick={onClose}
              className={cn(
                'px-3 py-1.5 text-[11px] font-medium rounded-md',
                'text-muted-foreground hover:text-foreground',
                'border border-input hover:bg-muted',
                'transition-colors'
              )}
            >
              Отмена
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isFormValid}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-md',
                'text-primary-foreground bg-primary hover:bg-primary/90',
                'transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed'
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
