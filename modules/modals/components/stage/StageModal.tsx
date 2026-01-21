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
  ListTodo,
  Clock,
  CheckCircle2,
  Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUsers, type CachedUser } from '@/modules/cache'
import type { DecompositionStage, DecompositionItem } from '@/modules/resource-graph/types'
import { useStageResponsibles } from '@/modules/resource-graph/hooks'
import type { BaseModalProps } from '../../types'
import { useUpdateDecompositionStage, useStageStatuses } from '../../hooks'
import { StatusDropdown, type StatusOption } from '../section/StatusDropdown'
import { DateRangeInput } from '../section/DateRangeInput'
import { ResponsiblesDropdown } from './ResponsiblesDropdown'

// ============================================================================
// Constants
// ============================================================================

const ANIMATION_DURATION = 200
const PANEL_WIDTH = 420

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
  const { data: stageResponsiblesMap, isLoading: responsiblesLoading } = useStageResponsibles(sectionId, {
    enabled: isOpen,
  })

  // Extract responsibles for this stage from the map
  const stageResponsibles = useMemo(() => {
    if (!stageResponsiblesMap) return []
    return stageResponsiblesMap[stageId] || []
  }, [stageResponsiblesMap, stageId])

  // ─────────────────────────────────────────────────────────────────────────
  // Mutation
  // ─────────────────────────────────────────────────────────────────────────

  const updateMutation = useUpdateDecompositionStage()

  // ─────────────────────────────────────────────────────────────────────────
  // Form
  // ─────────────────────────────────────────────────────────────────────────

  const form = useForm<StageFormData>({
    resolver: zodResolver(stageFormSchema),
    defaultValues: {
      name: stage.name,
      statusId: stage.status.id || null,
      responsibles: [],
      startDate: stage.startDate || null,
      endDate: stage.finishDate || null,
    },
  })

  const { watch, setValue, reset } = form
  const watchedStatusId = watch('statusId')
  const watchedResponsibles = watch('responsibles')
  const watchedStartDate = watch('startDate')
  const watchedEndDate = watch('endDate')

  // Initialize responsibles when they load
  const initialResponsibleIds = useMemo(() => {
    return stageResponsibles.map((r) => r.id)
  }, [stageResponsibles])

  useEffect(() => {
    if (isOpen) {
      reset({
        name: stage.name,
        statusId: stage.status.id || null,
        responsibles: initialResponsibleIds,
        startDate: stage.startDate || null,
        endDate: stage.finishDate || null,
      })
    }
  }, [isOpen, stage, reset, initialResponsibleIds])

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

  // Metrics
  const totalTasks = stage.items.length
  const totalHours = stage.items.reduce((sum, item) => sum + (item.plannedHours || 0), 0)
  const completedTasks = stage.items.filter((item) => (item.progress ?? 0) >= 100).length
  const avgProgress = totalTasks > 0
    ? Math.round(stage.items.reduce((sum, item) => sum + (item.progress ?? 0), 0) / totalTasks)
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

        if (field === 'name') updateData.name = value as string
        else if (field === 'statusId') updateData.statusId = value as string | null
        else if (field === 'responsibles') updateData.responsibles = value as string[]
        else if (field === 'startDate') updateData.startDate = value as string | null
        else if (field === 'endDate') updateData.endDate = value as string | null

        await updateMutation.mutateAsync({ stageId, sectionId, ...updateData })
        // НЕ вызываем onSuccess() здесь - модалка не должна закрываться при изменении полей
        // Кэш инвалидируется через useUpdateDecompositionStage
        return true
      } catch (err) {
        console.error('Save error:', err)
        setSaveError(err instanceof Error ? err.message : 'Ошибка сохранения')
        return false
      } finally {
        setSavingField(null)
      }
    },
    [stageId, sectionId, updateMutation]
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

  const handleDateChange = useCallback(
    async (field: 'startDate' | 'endDate', value: string) => {
      const dateValue = value || null
      setValue(field, dateValue)
      await saveField(field, dateValue)
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

  const isLoading = statusesLoading || usersLoading || responsiblesLoading

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

      {/* Slide-in Panel */}
      <FocusScope.Root trapped={isAnimating} loop>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="stage-modal-title"
          className={cn(
            'fixed inset-y-0 right-0 z-50',
            'bg-card/95 backdrop-blur-md',
            'border-l border-border/50',
            'shadow-2xl shadow-black/50',
            'flex flex-col',
            'transition-transform',
            isAnimating ? 'translate-x-0' : 'translate-x-full'
          )}
          style={{ width: PANEL_WIDTH, transitionDuration: `${ANIMATION_DURATION}ms` }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <header className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
            <div className="flex items-center gap-2 min-w-0">
              <Layers className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs font-medium text-foreground">Этап</span>
              <span className="text-[10px] text-muted-foreground">·</span>
              {editingName ? (
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <input
                    ref={nameInputRef}
                    {...form.register('name')}
                    className={cn(
                      'flex-1 min-w-0 px-2 py-1 text-xs font-medium',
                      'bg-muted border border-border rounded',
                      'text-foreground',
                      'focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20'
                    )}
                    disabled={savingField === 'name'}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleNameSave()
                      if (e.key === 'Escape') {
                        setEditingName(false)
                        setValue('name', stage.name) // Only reset name, not entire form
                      }
                    }}
                    onBlur={handleNameSave}
                  />
                  {savingField === 'name' && (
                    <Loader2 className="w-3 h-3 animate-spin text-primary" />
                  )}
                </div>
              ) : (
                <button
                  className="group flex items-center gap-1.5 min-w-0"
                  onClick={() => setEditingName(true)}
                >
                  <span
                    id="stage-modal-title"
                    className="text-xs text-foreground truncate max-w-[180px]"
                    title={stage.name}
                  >
                    {form.watch('name') || stage.name}
                  </span>
                  <Edit3 className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                </button>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
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
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Status */}
                <div>
                  <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                    Статус
                  </label>
                  <StatusDropdown
                    id="stage-status"
                    value={selectedStatus}
                    options={statusOptions}
                    onChange={handleStatusChange}
                    isLoading={savingField === 'statusId'}
                    disabled={statusesLoading}
                  />
                </div>

                {/* Period - full width to prevent overflow */}
                <div>
                  <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                    Период
                  </label>
                  <DateRangeInput
                    idPrefix="stage-date"
                    startDate={watchedStartDate ?? null}
                    endDate={watchedEndDate ?? null}
                    onStartDateChange={(v) => handleDateChange('startDate', v)}
                    onEndDateChange={(v) => handleDateChange('endDate', v)}
                    savingField={
                      savingField === 'startDate' || savingField === 'endDate'
                        ? (savingField as 'startDate' | 'endDate')
                        : null
                    }
                  />
                </div>

                {/* Responsibles - Full Width */}
                <div>
                  <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                    Ответственные
                  </label>
                  <ResponsiblesDropdown
                    id="stage-responsibles"
                    value={selectedResponsibles}
                    users={users || []}
                    onChange={handleResponsiblesChange}
                    isLoading={savingField === 'responsibles'}
                    disabled={usersLoading}
                  />
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-3 gap-2">
                  <MetricCard
                    icon={<ListTodo className="w-3 h-3" />}
                    label="Задачи"
                    value={`${completedTasks}/${totalTasks}`}
                  />
                  <MetricCard
                    icon={<Clock className="w-3 h-3" />}
                    label="Часы"
                    value={`${totalHours}ч`}
                  />
                  <MetricCard
                    icon={<CheckCircle2 className="w-3 h-3" />}
                    label="Готовность"
                    value={`${avgProgress}%`}
                    progress={avgProgress}
                  />
                </div>

                {/* Tasks list */}
                <div>
                  <h3 className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    <ListTodo className="w-3 h-3" />
                    Задачи ({totalTasks})
                  </h3>

                  {stage.items.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground text-xs">
                      Нет задач в этапе
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {stage.items.map((item) => (
                        <TaskRow key={item.id} item={item} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </FocusScope.Root>
    </>
  )
}

// ============================================================================
// Metric Card Component
// ============================================================================

interface MetricCardProps {
  icon: React.ReactNode
  label: string
  value: string
  progress?: number
}

function MetricCard({ icon, label, value, progress }: MetricCardProps) {
  return (
    <div className="bg-muted/50 border border-border/50 rounded-lg p-2.5">
      <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] mb-1">
        {icon}
        {label}
      </div>
      <div className="text-foreground text-sm font-medium">{value}</div>
      {progress !== undefined && (
        <div className="mt-1.5 h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
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
        'flex items-center gap-2 px-2.5 py-2 rounded border transition-colors',
        isCompleted
          ? 'bg-emerald-500/5 border-emerald-500/20'
          : 'bg-muted/30 border-border/50 hover:bg-muted/50'
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="text-xs text-foreground truncate">
          {item.description || 'Без описания'}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-muted-foreground">
          {item.difficulty.abbr && (
            <span className="px-1 py-0.5 bg-muted/50 rounded text-[9px]">
              {item.difficulty.abbr}
            </span>
          )}
          {item.plannedHours > 0 && <span>{item.plannedHours}ч</span>}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              isCompleted ? 'bg-emerald-500' : 'bg-primary'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span
          className={cn(
            'text-[10px] font-medium w-7 text-right',
            isCompleted ? 'text-emerald-400' : 'text-muted-foreground'
          )}
        >
          {progress}%
        </span>
      </div>
    </div>
  )
}
