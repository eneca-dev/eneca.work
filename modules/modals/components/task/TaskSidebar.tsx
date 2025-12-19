'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import * as FocusScope from '@radix-ui/react-focus-scope'
import * as Slider from '@radix-ui/react-slider'
import {
  X,
  Edit3,
  Loader2,
  Check,
  Clock,
  Target,
  User,
  Tag,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { DecompositionItem } from '@/modules/resource-graph/types'
import { getInitials } from '@/modules/resource-graph/utils'
import type { BaseModalProps } from '../../types'
import { useUpdateDecompositionItem } from '../../hooks'

// ============================================================================
// Constants
// ============================================================================

const ANIMATION_DURATION = 300
const PANEL_WIDTH = 380

// ============================================================================
// Schema
// ============================================================================

const taskFormSchema = z.object({
  description: z.string().min(1, 'Описание обязательно'),
  plannedHours: z.number().min(0, 'Часы не могут быть отрицательными'),
  progress: z.number().min(0).max(100),
})

type TaskFormData = z.infer<typeof taskFormSchema>

// ============================================================================
// Types
// ============================================================================

export interface TaskSidebarProps extends BaseModalProps {
  task: DecompositionItem
  taskId: string
  sectionId: string
  stageId?: string | null
}

// ============================================================================
// Component
// ============================================================================

export function TaskSidebar({
  isOpen,
  onClose,
  onSuccess,
  task,
  taskId,
  sectionId,
  stageId,
}: TaskSidebarProps) {
  // ─────────────────────────────────────────────────────────────────────────
  // Animation state
  // ─────────────────────────────────────────────────────────────────────────

  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsAnimating(true))
      })
    } else {
      setIsAnimating(false)
      const timer = setTimeout(() => setIsVisible(false), ANIMATION_DURATION)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // ─────────────────────────────────────────────────────────────────────────
  // Mutation hook
  // ─────────────────────────────────────────────────────────────────────────

  const updateMutation = useUpdateDecompositionItem()

  // ─────────────────────────────────────────────────────────────────────────
  // Form
  // ─────────────────────────────────────────────────────────────────────────

  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      description: task.description,
      plannedHours: task.plannedHours,
      progress: task.progress ?? 0,
    },
  })

  const { watch, setValue, reset } = form
  const watchedProgress = watch('progress')

  useEffect(() => {
    if (isOpen) {
      reset({
        description: task.description,
        plannedHours: task.plannedHours,
        progress: task.progress ?? 0,
      })
    }
  }, [isOpen, task, reset])

  // ─────────────────────────────────────────────────────────────────────────
  // UI State
  // ─────────────────────────────────────────────────────────────────────────

  const [editingDescription, setEditingDescription] = useState(false)
  const [editingHours, setEditingHours] = useState(false)
  const [savingField, setSavingField] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const descriptionInputRef = useRef<HTMLInputElement>(null)
  const hoursInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) {
      setEditingDescription(false)
      setEditingHours(false)
      setSaveError(null)
    }
  }, [isOpen])

  // Focus inputs when editing starts
  useEffect(() => {
    if (editingDescription && descriptionInputRef.current) {
      descriptionInputRef.current.focus()
      descriptionInputRef.current.select()
    }
  }, [editingDescription])

  useEffect(() => {
    if (editingHours && hoursInputRef.current) {
      hoursInputRef.current.focus()
      hoursInputRef.current.select()
    }
  }, [editingHours])

  // ─────────────────────────────────────────────────────────────────────────
  // Save handlers
  // ─────────────────────────────────────────────────────────────────────────

  const saveField = useCallback(
    async (field: keyof TaskFormData, value: string | number) => {
      setSavingField(field)
      setSaveError(null)

      try {
        const updateData: Record<string, unknown> = {}

        if (field === 'description') {
          updateData.description = value as string
        } else if (field === 'plannedHours') {
          updateData.plannedHours = value as number
        } else if (field === 'progress') {
          updateData.progress = value as number
        }

        await updateMutation.mutateAsync({
          itemId: taskId,
          sectionId,
          stageId,
          ...updateData,
        })
        onSuccess?.()
        return true
      } catch (err) {
        console.error('Save error:', err)
        setSaveError(err instanceof Error ? err.message : 'Ошибка сохранения')
        return false
      } finally {
        setSavingField(null)
      }
    },
    [taskId, sectionId, stageId, onSuccess, updateMutation]
  )

  const handleDescriptionSave = useCallback(async () => {
    const description = form.getValues('description')
    if (description.trim()) {
      const success = await saveField('description', description.trim())
      if (success) setEditingDescription(false)
    }
  }, [form, saveField])

  const handleHoursSave = useCallback(async () => {
    const hours = form.getValues('plannedHours')
    if (hours >= 0) {
      const success = await saveField('plannedHours', hours)
      if (success) setEditingHours(false)
    }
  }, [form, saveField])

  const handleProgressChange = useCallback(
    async (value: number[]) => {
      const progress = value[0]
      setValue('progress', progress)
      await saveField('progress', progress)
    },
    [setValue, saveField]
  )

  // ─────────────────────────────────────────────────────────────────────────
  // Keyboard handlers
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingDescription || editingHours) {
          setEditingDescription(false)
          setEditingHours(false)
          reset()
        } else {
          onClose()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, editingDescription, editingHours, onClose, reset])

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  if (!isVisible) return null

  const isCompleted = (task.progress ?? 0) >= 100

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          'fixed inset-0 z-50 transition-all duration-300',
          isAnimating
            ? 'bg-black/35 backdrop-blur-[2px]'
            : 'bg-transparent backdrop-blur-0'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-in Panel with Focus Trap */}
      <FocusScope.Root trapped={isAnimating} loop>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="task-sidebar-title"
          className={cn(
            'fixed inset-y-0 right-0 z-50',
            'bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950',
            'border-l border-slate-800/80',
            'shadow-[-8px_0_40px_-15px_rgba(0,0,0,0.6)]',
            'flex flex-col',
            'transition-all duration-300 ease-out',
            isAnimating
              ? 'translate-x-0 opacity-100'
              : 'translate-x-full opacity-95'
          )}
          style={{ width: PANEL_WIDTH }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <header className="relative px-5 pt-5 pb-4 border-b border-slate-800/60">
            {/* Close button */}
            <button
              onClick={onClose}
              aria-label="Закрыть"
              className={cn(
                'absolute top-4 right-4',
                'p-2 rounded-lg',
                'text-slate-500 hover:text-slate-300',
                'hover:bg-slate-800/50',
                'transition-all duration-200'
              )}
            >
              <X className="w-5 h-5" />
            </button>

            {/* Task label */}
            <div className="text-xs text-slate-500 mb-2 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" />
              Задача
            </div>

            {/* Editable description */}
            <div className="pr-10">
              {editingDescription ? (
                <div className="flex items-center gap-2">
                  <label htmlFor="task-description" className="sr-only">
                    Описание задачи
                  </label>
                  <input
                    id="task-description"
                    {...(() => {
                      const { ref, ...rest } = form.register('description')
                      return {
                        ...rest,
                        ref: (e: HTMLInputElement | null) => {
                          ref(e)
                          descriptionInputRef.current = e
                        },
                      }
                    })()}
                    className={cn(
                      'flex-1 px-3 py-1.5 text-base font-medium',
                      'bg-slate-800/80 border border-slate-600',
                      'rounded-lg text-slate-100',
                      'focus:outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20'
                    )}
                    disabled={savingField === 'description'}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleDescriptionSave()
                      if (e.key === 'Escape') {
                        setEditingDescription(false)
                        reset()
                      }
                    }}
                  />
                  <button
                    onClick={handleDescriptionSave}
                    disabled={savingField === 'description'}
                    aria-label="Сохранить описание"
                    className="p-2 text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                  >
                    {savingField === 'description' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                  </button>
                </div>
              ) : (
                <button
                  className="group flex items-start gap-2 text-left max-w-full"
                  onClick={() => setEditingDescription(true)}
                  aria-label="Редактировать описание"
                >
                  <h2
                    id="task-sidebar-title"
                    className="text-base font-medium text-slate-100 line-clamp-2"
                  >
                    {form.watch('description') || task.description || 'Без описания'}
                  </h2>
                  <Edit3 className="w-3.5 h-3.5 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
                </button>
              )}
            </div>

            {/* Status indicator */}
            <div className="mt-3 flex items-center gap-2">
              <div
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium',
                  isCompleted
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-amber-500/20 text-amber-400'
                )}
              >
                {isCompleted ? 'Завершено' : 'В работе'}
              </div>

              {task.status.name && (
                <div
                  className="px-2.5 py-1 rounded-full text-xs font-medium border"
                  style={{
                    backgroundColor: `${task.status.color || '#6b7280'}20`,
                    borderColor: `${task.status.color || '#6b7280'}40`,
                    color: task.status.color || '#6b7280',
                  }}
                >
                  {task.status.name}
                </div>
              )}
            </div>
          </header>

          {/* Error message */}
          {saveError && (
            <div
              role="alert"
              className="mx-5 mt-4 px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400"
            >
              {saveError}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Progress Slider */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-slate-400">Готовность</span>
                <span
                  className={cn(
                    'text-sm font-medium',
                    isCompleted ? 'text-emerald-400' : 'text-slate-200'
                  )}
                >
                  {watchedProgress}%
                </span>
              </div>
              <Slider.Root
                value={[watchedProgress]}
                onValueCommit={handleProgressChange}
                max={100}
                step={5}
                disabled={savingField === 'progress'}
                className="relative flex items-center select-none touch-none w-full h-5"
                aria-label="Готовность задачи"
              >
                <Slider.Track className="bg-slate-700 relative grow rounded-full h-2">
                  <Slider.Range
                    className={cn(
                      'absolute rounded-full h-full transition-colors',
                      isCompleted ? 'bg-emerald-500' : 'bg-amber-500'
                    )}
                  />
                </Slider.Track>
                <Slider.Thumb
                  className={cn(
                    'block w-5 h-5 rounded-full shadow-lg transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900',
                    isCompleted
                      ? 'bg-emerald-500 focus:ring-emerald-500'
                      : 'bg-amber-500 focus:ring-amber-500',
                    savingField === 'progress' && 'opacity-50'
                  )}
                />
              </Slider.Root>
            </div>

            {/* Planned Hours */}
            <div className="bg-slate-800/40 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-400">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">Плановые часы</span>
                </div>

                {editingHours ? (
                  <div className="flex items-center gap-2">
                    <input
                      id="task-hours"
                      type="number"
                      min="0"
                      step="0.5"
                      {...(() => {
                        const { ref, ...rest } = form.register('plannedHours', {
                          valueAsNumber: true,
                        })
                        return {
                          ...rest,
                          ref: (e: HTMLInputElement | null) => {
                            ref(e)
                            hoursInputRef.current = e
                          },
                        }
                      })()}
                      className={cn(
                        'w-20 px-2 py-1 text-sm text-right',
                        'bg-slate-800/80 border border-slate-600',
                        'rounded text-slate-100',
                        'focus:outline-none focus:border-amber-500/60'
                      )}
                      disabled={savingField === 'plannedHours'}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleHoursSave()
                        if (e.key === 'Escape') {
                          setEditingHours(false)
                          reset()
                        }
                      }}
                    />
                    <button
                      onClick={handleHoursSave}
                      disabled={savingField === 'plannedHours'}
                      aria-label="Сохранить часы"
                      className="p-1.5 text-amber-400 hover:bg-amber-500/10 rounded transition-colors"
                    >
                      {savingField === 'plannedHours' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ) : (
                  <button
                    className="group flex items-center gap-1.5 text-slate-200 hover:text-white transition-colors"
                    onClick={() => setEditingHours(true)}
                    aria-label="Редактировать плановые часы"
                  >
                    <span className="font-medium">
                      {form.watch('plannedHours')}ч
                    </span>
                    <Edit3 className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                )}
              </div>
            </div>

            {/* Responsible */}
            {task.responsible.id && (
              <div className="bg-slate-800/40 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-slate-400 shrink-0">
                    <User className="w-4 h-4" />
                    <span className="text-sm">Ответственный</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[10px] bg-slate-700">
                        {getInitials(task.responsible.firstName, task.responsible.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-slate-200 truncate">
                      {task.responsible.name || 'Не назначен'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Difficulty & Category */}
            <div className="flex gap-3">
              {task.difficulty.name && (
                <div className="flex-1 bg-slate-800/40 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">Сложность</div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 bg-slate-700/50 rounded text-xs font-medium text-slate-300">
                      {task.difficulty.abbr}
                    </span>
                    <span className="text-sm text-slate-300 truncate">
                      {task.difficulty.name}
                    </span>
                  </div>
                </div>
              )}

              {task.workCategoryName && (
                <div className="flex-1 bg-slate-800/40 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                    <Tag className="w-3 h-3" />
                    Категория
                  </div>
                  <div className="text-sm text-slate-300 truncate">
                    {task.workCategoryName}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </FocusScope.Root>
    </>
  )
}
