'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import * as FocusScope from '@radix-ui/react-focus-scope'
import {
  X,
  Edit3,
  Loader2,
  Check,
  ListTodo,
  Users,
  Clock,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useUsers, type CachedUser } from '@/modules/cache'
import type { DecompositionStage, DecompositionItem } from '@/modules/resource-graph/types'
import { getInitials } from '@/modules/resource-graph/utils'
import type { BaseModalProps } from '../../types'
import { useUpdateDecompositionStage, useStageStatuses } from '../../hooks'
import { StatusDropdown, type StatusOption } from '../section/StatusDropdown'
import { DateRangeInput } from '../section/DateRangeInput'
import { ResponsiblesDropdown } from './ResponsiblesDropdown'

// ============================================================================
// Constants
// ============================================================================

const ANIMATION_DURATION = 300
const PANEL_WIDTH = 480

// ============================================================================
// Schema
// ============================================================================

const stageFormSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  statusId: z.string().nullable().optional(),
  responsibles: z.array(z.string()).optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
})

type StageFormData = z.infer<typeof stageFormSchema>

// ============================================================================
// Types
// ============================================================================

export interface StageModalProps extends BaseModalProps {
  stage: DecompositionStage
  stageId: string
  sectionId: string
}

// ============================================================================
// Component
// ============================================================================

export function StageModal({
  isOpen,
  onClose,
  onSuccess,
  stage,
  stageId,
  sectionId,
}: StageModalProps) {
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
  // Data fetching
  // ─────────────────────────────────────────────────────────────────────────

  const { data: statuses, isLoading: statusesLoading } = useStageStatuses()
  const { data: users, isLoading: usersLoading } = useUsers()

  // ─────────────────────────────────────────────────────────────────────────
  // Mutation hook
  // ─────────────────────────────────────────────────────────────────────────

  const updateMutation = useUpdateDecompositionStage()

  // ─────────────────────────────────────────────────────────────────────────
  // Form
  // ─────────────────────────────────────────────────────────────────────────

  // Extract responsible IDs from stage - we'll need to load them
  const initialResponsibles: string[] = []

  const form = useForm<StageFormData>({
    resolver: zodResolver(stageFormSchema),
    defaultValues: {
      name: stage.name,
      statusId: stage.status.id || null,
      responsibles: initialResponsibles,
      startDate: stage.startDate || null,
      endDate: stage.finishDate || null,
    },
  })

  const { watch, setValue, reset } = form
  const watchedStatusId = watch('statusId')
  const watchedResponsibles = watch('responsibles')
  const watchedStartDate = watch('startDate')
  const watchedEndDate = watch('endDate')

  useEffect(() => {
    if (isOpen) {
      reset({
        name: stage.name,
        statusId: stage.status.id || null,
        responsibles: initialResponsibles,
        startDate: stage.startDate || null,
        endDate: stage.finishDate || null,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, stage, reset])

  // ─────────────────────────────────────────────────────────────────────────
  // UI State
  // ─────────────────────────────────────────────────────────────────────────

  const [editingName, setEditingName] = useState(false)
  const [savingField, setSavingField] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) {
      setEditingName(false)
      setSaveError(null)
    }
  }, [isOpen])

  // Focus name input when editing starts
  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus()
      nameInputRef.current.select()
    }
  }, [editingName])

  // ─────────────────────────────────────────────────────────────────────────
  // Derived data
  // ─────────────────────────────────────────────────────────────────────────

  const selectedStatus = useMemo((): StatusOption | null => {
    const found = (statuses || []).find((s) => s.id === watchedStatusId)
    if (!found) return null
    return { id: found.id, name: found.name, color: found.color }
  }, [statuses, watchedStatusId])

  const statusOptions = useMemo((): StatusOption[] => {
    return (statuses || []).map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
    }))
  }, [statuses])

  const selectedResponsibles = useMemo((): CachedUser[] => {
    if (!users || !watchedResponsibles) return []
    return watchedResponsibles
      .map((id) => users.find((u) => u.user_id === id))
      .filter((u): u is CachedUser => u !== undefined)
  }, [users, watchedResponsibles])

  // Calculate metrics
  const totalTasks = stage.items.length
  const totalHours = stage.items.reduce(
    (sum, item) => sum + (item.plannedHours || 0),
    0
  )
  const completedTasks = stage.items.filter(
    (item) => (item.progress ?? 0) >= 100
  ).length
  const avgProgress =
    totalTasks > 0
      ? Math.round(
          stage.items.reduce((sum, item) => sum + (item.progress ?? 0), 0) /
            totalTasks
        )
      : 0

  // ─────────────────────────────────────────────────────────────────────────
  // Save handlers
  // ─────────────────────────────────────────────────────────────────────────

  const saveField = useCallback(
    async (field: keyof StageFormData, value: string | string[] | null) => {
      setSavingField(field)
      setSaveError(null)

      try {
        const updateData: Record<string, unknown> = {}

        if (field === 'name') {
          updateData.name = value as string
        } else if (field === 'statusId') {
          updateData.statusId = value as string | null
        } else if (field === 'responsibles') {
          updateData.responsibles = value as string[]
        } else if (field === 'startDate') {
          updateData.startDate = value as string | null
        } else if (field === 'endDate') {
          updateData.endDate = value as string | null
        }

        await updateMutation.mutateAsync({
          stageId,
          sectionId,
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
    [stageId, sectionId, onSuccess, updateMutation]
  )

  const handleStatusChange = useCallback(
    async (statusId: string | null) => {
      setValue('statusId', statusId)
      await saveField('statusId', statusId)
    },
    [setValue, saveField]
  )

  const handleResponsiblesChange = useCallback(
    async (responsibleIds: string[]) => {
      setValue('responsibles', responsibleIds)
      await saveField('responsibles', responsibleIds)
    },
    [setValue, saveField]
  )

  const handleNameSave = useCallback(async () => {
    const name = form.getValues('name')
    if (name.trim()) {
      const success = await saveField('name', name.trim())
      if (success) setEditingName(false)
    }
  }, [form, saveField])

  const handleStartDateChange = useCallback(
    async (value: string) => {
      const dateValue = value || null
      setValue('startDate', dateValue)
      await saveField('startDate', dateValue)
    },
    [setValue, saveField]
  )

  const handleEndDateChange = useCallback(
    async (value: string) => {
      const dateValue = value || null
      setValue('endDate', dateValue)
      await saveField('endDate', dateValue)
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
        if (editingName) {
          setEditingName(false)
          reset()
        } else {
          onClose()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, editingName, onClose, reset])

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  if (!isVisible) return null

  const isLoading = statusesLoading || usersLoading

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
          aria-labelledby="stage-modal-title"
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

            {/* Editable name */}
            <div className="pr-10">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <label htmlFor="stage-name" className="sr-only">
                    Название этапа
                  </label>
                  <input
                    id="stage-name"
                    {...(() => {
                      const { ref, ...rest } = form.register('name')
                      return {
                        ...rest,
                        ref: (e: HTMLInputElement | null) => {
                          ref(e)
                          nameInputRef.current = e
                        },
                      }
                    })()}
                    className={cn(
                      'flex-1 px-3 py-1.5 text-base font-semibold',
                      'bg-slate-800/80 border border-slate-600',
                      'rounded-lg text-slate-100',
                      'focus:outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20'
                    )}
                    disabled={savingField === 'name'}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleNameSave()
                      if (e.key === 'Escape') {
                        setEditingName(false)
                        reset()
                      }
                    }}
                  />
                  <button
                    onClick={handleNameSave}
                    disabled={savingField === 'name'}
                    aria-label="Сохранить название"
                    className="p-2 text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                  >
                    {savingField === 'name' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                  </button>
                </div>
              ) : (
                <button
                  className="group flex items-center gap-2 text-left max-w-full"
                  onClick={() => setEditingName(true)}
                  aria-label="Редактировать название"
                >
                  <h2
                    id="stage-modal-title"
                    className="text-lg font-semibold text-slate-100 truncate"
                  >
                    {form.watch('name') || stage.name}
                  </h2>
                  <Edit3 className="w-3.5 h-3.5 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              )}

              {/* Status badge */}
              <div className="mt-3">
                <StatusDropdown
                  id="stage-status"
                  value={selectedStatus}
                  options={statusOptions}
                  onChange={handleStatusChange}
                  isLoading={savingField === 'statusId'}
                  disabled={statusesLoading}
                />
              </div>
            </div>

            {/* Dates */}
            <div className="mt-4">
              <DateRangeInput
                idPrefix="stage-date"
                startDate={watchedStartDate ?? null}
                endDate={watchedEndDate ?? null}
                onStartDateChange={handleStartDateChange}
                onEndDateChange={handleEndDateChange}
                savingField={
                  savingField === 'startDate' || savingField === 'endDate'
                    ? (savingField as 'startDate' | 'endDate')
                    : null
                }
              />
            </div>

            {/* Responsibles */}
            <div className="mt-4">
              <ResponsiblesDropdown
                id="stage-responsibles"
                value={selectedResponsibles}
                users={users || []}
                onChange={handleResponsiblesChange}
                isLoading={savingField === 'responsibles'}
                disabled={usersLoading}
              />
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
          <div className="flex-1 overflow-y-auto p-5">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2
                  className="h-6 w-6 animate-spin text-slate-500"
                  aria-label="Загрузка..."
                />
              </div>
            ) : (
              <>
                {/* Metrics */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                      <ListTodo className="w-3.5 h-3.5" />
                      Задачи
                    </div>
                    <div className="text-slate-200 font-medium">
                      {completedTasks} / {totalTasks}
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                      <Clock className="w-3.5 h-3.5" />
                      План. часы
                    </div>
                    <div className="text-slate-200 font-medium">
                      {totalHours}ч
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3 col-span-2">
                    <div className="flex items-center gap-2 text-slate-500 text-xs mb-2">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Готовность
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all"
                          style={{ width: `${avgProgress}%` }}
                        />
                      </div>
                      <span className="text-slate-200 font-medium text-sm w-10 text-right">
                        {avgProgress}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tasks list */}
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-medium text-slate-400 mb-3">
                    <ListTodo className="w-4 h-4" />
                    Задачи ({totalTasks})
                  </h3>

                  {stage.items.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-sm">
                      Нет задач в этапе
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {stage.items.map((item) => (
                        <TaskRow key={item.id} item={item} />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </FocusScope.Root>
    </>
  )
}

// ============================================================================
// Task Row Component
// ============================================================================

function TaskRow({ item }: { item: DecompositionItem }) {
  const progress = item.progress ?? 0
  const isCompleted = progress >= 100

  return (
    <div
      className={cn(
        'px-3 py-2.5 rounded-lg border transition-colors',
        isCompleted
          ? 'bg-emerald-500/5 border-emerald-500/20'
          : 'bg-slate-800/30 border-slate-700/50 hover:bg-slate-800/50'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm text-slate-300 truncate">
            {item.description || 'Без описания'}
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
            {item.difficulty.abbr && (
              <span className="px-1.5 py-0.5 bg-slate-700/50 rounded">
                {item.difficulty.abbr}
              </span>
            )}
            {item.plannedHours > 0 && <span>{item.plannedHours}ч</span>}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                isCompleted ? 'bg-emerald-500' : 'bg-amber-500'
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span
            className={cn(
              'text-xs font-medium w-8 text-right',
              isCompleted ? 'text-emerald-400' : 'text-slate-400'
            )}
          >
            {progress}%
          </span>
        </div>
      </div>
    </div>
  )
}
