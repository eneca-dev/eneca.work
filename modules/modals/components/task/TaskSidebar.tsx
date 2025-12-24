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
  Clock,
  Target,
  User,
  Tag,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import type { DecompositionItem } from '@/modules/resource-graph/types'
import { getInitials } from '@/modules/resource-graph/utils'
import type { BaseModalProps } from '../../types'
import { useUpdateDecompositionItem } from '../../hooks'

// ============================================================================
// Constants
// ============================================================================

const ANIMATION_DURATION = 200
const PANEL_WIDTH = 420

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
        if (editingDescription) {
          setEditingDescription(false)
          setValue('description', task.description)
        } else if (editingHours) {
          setEditingHours(false)
          setValue('plannedHours', task.plannedHours)
        } else {
          onClose()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, editingDescription, editingHours, onClose, setValue, task.description, task.plannedHours])

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
          'fixed inset-0 z-50 transition-all',
          isAnimating
            ? 'bg-black/50 backdrop-blur-sm'
            : 'bg-transparent backdrop-blur-0'
        )}
        style={{ transitionDuration: `${ANIMATION_DURATION}ms` }}
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
            'bg-slate-900/95 backdrop-blur-md',
            'border-l border-slate-700/50',
            'shadow-2xl shadow-black/50',
            'flex flex-col',
            'transition-transform',
            isAnimating ? 'translate-x-0' : 'translate-x-full'
          )}
          style={{ width: PANEL_WIDTH, transitionDuration: `${ANIMATION_DURATION}ms` }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <header className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/50">
            <div className="flex items-center gap-2 min-w-0">
              <Target className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-xs font-medium text-slate-300">Задача</span>
              <span className="text-[10px] text-slate-500">·</span>
              {editingDescription ? (
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <input
                    ref={descriptionInputRef}
                    {...form.register('description')}
                    className={cn(
                      'flex-1 min-w-0 px-2 py-1 text-xs font-medium',
                      'bg-slate-800 border border-slate-600 rounded',
                      'text-slate-100',
                      'focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20'
                    )}
                    disabled={savingField === 'description'}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleDescriptionSave()
                      if (e.key === 'Escape') {
                        setEditingDescription(false)
                        setValue('description', task.description)
                      }
                    }}
                    onBlur={handleDescriptionSave}
                  />
                  {savingField === 'description' && (
                    <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
                  )}
                </div>
              ) : (
                <button
                  className="group flex items-center gap-1.5 min-w-0"
                  onClick={() => setEditingDescription(true)}
                >
                  <span
                    id="task-sidebar-title"
                    className="text-xs text-slate-200 truncate max-w-[200px]"
                    title={task.description}
                  >
                    {form.watch('description') || task.description || 'Без описания'}
                  </span>
                  <Edit3 className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 shrink-0" />
                </button>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          {/* Error */}
          {saveError && (
            <div className="mx-4 mt-3 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded text-[11px] text-red-400">
              {saveError}
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {/* Status badges */}
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'px-2 py-1 rounded text-[10px] font-medium',
                    isCompleted
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-amber-500/20 text-amber-400'
                  )}
                >
                  {isCompleted ? 'Завершено' : 'В работе'}
                </div>

                {task.status.name && (
                  <div
                    className="px-2 py-1 rounded text-[10px] font-medium border"
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

              {/* Progress Slider */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Готовность</span>
                  <span
                    className={cn(
                      'text-xs font-medium',
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
                  className="relative flex items-center select-none touch-none w-full h-4"
                  aria-label="Готовность задачи"
                >
                  <Slider.Track className="bg-slate-700 relative grow rounded-full h-1.5">
                    <Slider.Range
                      className={cn(
                        'absolute rounded-full h-full transition-colors',
                        isCompleted ? 'bg-emerald-500' : 'bg-amber-500'
                      )}
                    />
                  </Slider.Track>
                  <Slider.Thumb
                    className={cn(
                      'block w-4 h-4 rounded-full shadow-lg transition-colors',
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
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-slate-500 text-[10px]">
                    <Clock className="w-3 h-3" />
                    Плановые часы
                  </div>

                  {editingHours ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        ref={hoursInputRef}
                        type="number"
                        min="0"
                        step="0.5"
                        {...form.register('plannedHours', { valueAsNumber: true })}
                        className={cn(
                          'w-16 px-2 py-0.5 text-xs text-right',
                          'bg-slate-800 border border-slate-600 rounded',
                          'text-slate-100',
                          'focus:outline-none focus:border-amber-500/50'
                        )}
                        disabled={savingField === 'plannedHours'}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleHoursSave()
                          if (e.key === 'Escape') {
                            setEditingHours(false)
                            setValue('plannedHours', task.plannedHours)
                          }
                        }}
                        onBlur={handleHoursSave}
                      />
                      {savingField === 'plannedHours' && (
                        <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
                      )}
                    </div>
                  ) : (
                    <button
                      className="group flex items-center gap-1 text-slate-200 hover:text-white transition-colors"
                      onClick={() => setEditingHours(true)}
                    >
                      <span className="text-sm font-medium">
                        {form.watch('plannedHours')}ч
                      </span>
                      <Edit3 className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100" />
                    </button>
                  )}
                </div>
              </div>

              {/* Responsible */}
              {task.responsible.id && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-slate-500 text-[10px] shrink-0">
                      <User className="w-3 h-3" />
                      Ответственный
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[9px] bg-slate-700">
                          {getInitials(task.responsible.firstName, task.responsible.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-slate-200 truncate">
                        {task.responsible.name || 'Не назначен'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Difficulty & Category */}
              <div className="grid grid-cols-2 gap-2">
                {task.difficulty.name && (
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-2.5">
                    <div className="text-[10px] text-slate-500 mb-1">Сложность</div>
                    <div className="flex items-center gap-1.5">
                      <span className="px-1 py-0.5 bg-slate-700/50 rounded text-[10px] font-medium text-slate-300">
                        {task.difficulty.abbr}
                      </span>
                      <span className="text-xs text-slate-300 truncate">
                        {task.difficulty.name}
                      </span>
                    </div>
                  </div>
                )}

                {task.workCategoryName && (
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-2.5">
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-1">
                      <Tag className="w-3 h-3" />
                      Категория
                    </div>
                    <div className="text-xs text-slate-300 truncate">
                      {task.workCategoryName}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </FocusScope.Root>
    </>
  )
}
