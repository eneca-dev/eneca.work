'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import * as FocusScope from '@radix-ui/react-focus-scope'
import * as Tabs from '@radix-ui/react-tabs'
import {
  X,
  Edit3,
  Loader2,
  Check,
  FileText,
  ListTodo,
  Target,
  Trash2,
  CalendarDays,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useSectionStatuses } from '@/modules/statuses-tags/statuses/hooks/useSectionStatuses'
import { useUsers, type CachedUser } from '@/modules/cache'
import type { Section } from '@/modules/resource-graph/types'
import { getInitials } from '@/modules/resource-graph/utils'
import type { BaseModalProps } from '../../types'
import { useUpdateSection, usePendingDates } from '../../hooks'
import { SectionMetrics } from './SectionMetrics'
import { StatusDropdown, type StatusOption } from './StatusDropdown'
import { ResponsibleDropdown } from './ResponsibleDropdown'
import { DateRangeInput } from './DateRangeInput'
import { OverviewTab, TasksTab, ReadinessTab } from './tabs'
import { DeleteSectionModal } from './DeleteSectionModal'

// ============================================================================
// Constants
// ============================================================================

const ANIMATION_DURATION = 300
const PANEL_WIDTH = 900  // Более компактная ширина

// ============================================================================
// Schema
// ============================================================================

const sectionFormSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  description: z.string().optional(),
  statusId: z.string().nullable().optional(),
  responsibleId: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
})

type SectionFormData = z.infer<typeof sectionFormSchema>

// ============================================================================
// Types
// ============================================================================

export interface SectionModalProps extends BaseModalProps {
  section: Section
  sectionId: string
  initialTab?: 'overview' | 'tasks' | 'readiness'
}

// ============================================================================
// Component
// ============================================================================

export function SectionModal({
  isOpen,
  onClose,
  onSuccess,
  section,
  sectionId,
  initialTab = 'overview',
}: SectionModalProps) {
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
  // Data fetching via cache hooks
  // ─────────────────────────────────────────────────────────────────────────

  const { statuses, isLoading: statusesLoading } = useSectionStatuses()
  const { data: users, isLoading: usersLoading } = useUsers()

  // ─────────────────────────────────────────────────────────────────────────
  // Mutation hook
  // ─────────────────────────────────────────────────────────────────────────

  const updateMutation = useUpdateSection()

  // ─────────────────────────────────────────────────────────────────────────
  // Form
  // ─────────────────────────────────────────────────────────────────────────

  const form = useForm<SectionFormData>({
    resolver: zodResolver(sectionFormSchema),
    defaultValues: {
      name: section.name,
      description: section.description || '',
      statusId: section.status.id || null,
      responsibleId: section.responsible.id || null,
      startDate: section.startDate || null,
      endDate: section.endDate || null,
    },
  })

  const { watch, setValue, reset } = form
  const watchedStatusId = watch('statusId')
  const watchedResponsibleId = watch('responsibleId')
  const watchedStartDate = watch('startDate')
  const watchedEndDate = watch('endDate')

  useEffect(() => {
    if (isOpen) {
      reset({
        name: section.name,
        description: section.description || '',
        statusId: section.status.id || null,
        responsibleId: section.responsible.id || null,
        startDate: section.startDate || null,
        endDate: section.endDate || null,
      })
    }
  }, [isOpen, section, reset])

  // ─────────────────────────────────────────────────────────────────────────
  // UI State
  // ─────────────────────────────────────────────────────────────────────────

  const [editingName, setEditingName] = useState(false)
  const [savingField, setSavingField] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'readiness'>(initialTab)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  // Pending dates через хук
  const dates = usePendingDates({
    onSave: async (pendingDates) => {
      setSavingField('dates')
      try {
        await updateMutation.mutateAsync({
          sectionId,
          data: {
            startDate: pendingDates.start,
            endDate: pendingDates.end,
          },
        })
        setValue('startDate', pendingDates.start)
        setValue('endDate', pendingDates.end)
      } finally {
        setSavingField(null)
      }
    },
    onSaveError: (err) => setSaveError(err.message),
  })

  const originalDescription = useRef<string>('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab)
    }
    if (!isOpen) {
      setEditingName(false)
      setSaveError(null)
      dates.reset()
    }
  }, [isOpen, initialTab, dates.reset])

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
    const found = statuses.find((s) => s.id === watchedStatusId)
    if (!found) return null
    return { id: found.id, name: found.name, color: found.color }
  }, [statuses, watchedStatusId])

  const statusOptions = useMemo((): StatusOption[] => {
    return statuses.map((s) => ({ id: s.id, name: s.name, color: s.color }))
  }, [statuses])

  const selectedResponsible = useMemo((): CachedUser | null => {
    if (!users || !watchedResponsibleId) return null
    return users.find((u) => u.user_id === watchedResponsibleId) || null
  }, [users, watchedResponsibleId])

  // ─────────────────────────────────────────────────────────────────────────
  // Save handlers
  // ─────────────────────────────────────────────────────────────────────────

  const saveField = useCallback(
    async (field: keyof SectionFormData, value: string | null) => {
      setSavingField(field)
      setSaveError(null)

      try {
        await updateMutation.mutateAsync({
          sectionId,
          data: { [field]: value },
        })
        // НЕ вызываем onSuccess здесь - это inline-сохранение поля,
        // модалка должна оставаться открытой.
        // Кеш инвалидируется автоматически через useUpdateSection.invalidateKeys
        return true
      } catch (err) {
        console.error('Save error:', err)
        setSaveError(err instanceof Error ? err.message : 'Ошибка сохранения')
        return false
      } finally {
        setSavingField(null)
      }
    },
    [sectionId, updateMutation]
  )

  const handleStatusChange = useCallback(
    async (statusId: string | null) => {
      setValue('statusId', statusId)
      await saveField('statusId', statusId)
    },
    [setValue, saveField]
  )

  const handleResponsibleChange = useCallback(
    async (responsibleId: string | null) => {
      setValue('responsibleId', responsibleId)
      await saveField('responsibleId', responsibleId)
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

  const handleSaveDescription = useCallback(
    async (description: string | null) => {
      await saveField('description', description)
    },
    [saveField]
  )

  // Handlers для дат используем из хука dates.*
  const handleDatesEdit = useCallback(() => {
    dates.handleEdit(watchedStartDate, watchedEndDate)
  }, [dates, watchedStartDate, watchedEndDate])

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
  const displayResponsible = selectedResponsible || {
    user_id: section.responsible.id || '',
    first_name: section.responsible.firstName,
    last_name: section.responsible.lastName,
    email: '',
    avatar_url: section.responsible.avatarUrl,
    full_name: section.responsible.name || 'Не назначен',
    salary: null,
  }

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          'fixed inset-0 z-50 transition-all duration-300',
          isAnimating ? 'bg-black/35 backdrop-blur-[2px]' : 'bg-transparent backdrop-blur-0'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-in Panel with Focus Trap */}
      <FocusScope.Root trapped={isAnimating} loop>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="section-modal-title"
          className={cn(
            'fixed inset-y-0 right-0 z-50',
            'bg-card',
            'border-l border-border/80',
            'shadow-[-8px_0_40px_-15px_rgba(0,0,0,0.6)]',
            'flex flex-col',
            'transition-all duration-300 ease-out',
            isAnimating ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-95'
          )}
          style={{ width: PANEL_WIDTH }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header - компактный с amber акцентами */}
          <header className="relative px-4 pt-3 pb-3 border-b border-border/50">
            {/* Close button */}
            <button
              onClick={onClose}
              aria-label="Закрыть"
              className={cn(
                'absolute top-2.5 right-3',
                'p-1.5 rounded',
                'text-muted-foreground hover:text-foreground',
                'hover:bg-muted/50',
                'transition-all duration-200'
              )}
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header content - компактный grid */}
            <div className="flex gap-3">
              {/* Left column - Avatar & Name */}
              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                {/* Avatar - меньший размер */}
                <Avatar className="h-10 w-10 shrink-0 border border-border/50 shadow">
                  {displayResponsible.avatar_url && (
                    <AvatarImage src={displayResponsible.avatar_url} />
                  )}
                  <AvatarFallback className="bg-muted text-foreground text-sm font-medium">
                    {getInitials(displayResponsible.first_name, displayResponsible.last_name)}
                  </AvatarFallback>
                </Avatar>

                {/* Name & Responsible */}
                <div className="flex-1 min-w-0">
                  {/* Editable name */}
                  {editingName ? (
                    <div className="flex items-center gap-1.5">
                      <label htmlFor="section-name" className="sr-only">
                        Название раздела
                      </label>
                      <input
                        id="section-name"
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
                          'flex-1 px-2.5 py-1 text-sm font-semibold',
                          'bg-muted/80 border border-border',
                          'rounded text-foreground',
                          'focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20'
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
                        className="p-1.5 text-primary hover:bg-primary/10 rounded transition-colors"
                      >
                        {savingField === 'name' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ) : (
                    <button
                      className="group flex items-center gap-1.5 text-left max-w-full"
                      onClick={() => setEditingName(true)}
                      aria-label="Редактировать название"
                    >
                      <h2
                        id="section-modal-title"
                        className="text-sm font-semibold text-foreground truncate"
                      >
                        {form.watch('name') || section.name}
                      </h2>
                      <Edit3 className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </button>
                  )}

                  {/* Responsible selector - компактнее */}
                  <div className="mt-1">
                    <ResponsibleDropdown
                      id="section-responsible"
                      value={selectedResponsible}
                      users={users || []}
                      onChange={handleResponsibleChange}
                      isLoading={savingField === 'responsibleId'}
                      disabled={usersLoading}
                    />
                  </div>
                </div>
              </div>

              {/* Right column - Status & Dates & Delete - в одну линию */}
              <div className="flex items-center gap-2 pr-6">
                {/* Status badge */}
                <StatusDropdown
                  id="section-status"
                  value={selectedStatus}
                  options={statusOptions}
                  onChange={handleStatusChange}
                  isLoading={savingField === 'statusId'}
                  disabled={statusesLoading}
                />

                {/* Divider */}
                <div className="h-4 w-px bg-border/50" />

                {/* Dates - with save/cancel */}
                <div className="flex items-center gap-2">
                  {dates.isEditing ? (
                    <>
                      <DateRangeInput
                        idPrefix="section-date"
                        startDate={dates.pendingDates.start}
                        endDate={dates.pendingDates.end}
                        onStartDateChange={dates.handleStartDateChange}
                        onEndDateChange={dates.handleEndDateChange}
                      />
                      <button
                        onClick={dates.handleSave}
                        disabled={savingField === 'dates'}
                        className={cn(
                          'p-1 rounded text-green-600 hover:bg-green-500/10',
                          'transition-colors',
                          savingField === 'dates' && 'opacity-50'
                        )}
                        aria-label="Сохранить даты"
                      >
                        {savingField === 'dates' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={dates.handleCancel}
                        disabled={savingField === 'dates'}
                        className="p-1 rounded text-muted-foreground hover:bg-muted/50 transition-colors"
                        aria-label="Отменить"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleDatesEdit}
                      className="group flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Редактировать даты"
                    >
                      <CalendarDays className="w-3.5 h-3.5" />
                      <span>
                        {watchedStartDate && watchedEndDate
                          ? `${new Date(watchedStartDate).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })} - ${new Date(watchedEndDate).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}`
                          : 'Не указаны'}
                      </span>
                      <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  )}
                </div>

                {/* Divider */}
                <div className="h-4 w-px bg-border/50" />

                {/* Delete button - компактная */}
                <button
                  onClick={() => setIsDeleteModalOpen(true)}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded',
                    'text-[10px] text-muted-foreground hover:text-red-400',
                    'hover:bg-red-500/10',
                    'transition-all duration-200'
                  )}
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Удалить</span>
                </button>
              </div>
            </div>

            {/* Metrics row - компактнее */}
            <div className="mt-2.5 pt-2.5 border-t border-border/40">
              <SectionMetrics section={section} compact />
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

          {/* Content with Tabs */}
          <Tabs.Root
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as 'overview' | 'tasks' | 'readiness')}
            className="flex-1 flex flex-col overflow-hidden"
          >
            {/* Tab List - компактный с amber акцентами */}
            <Tabs.List className="flex gap-0.5 px-4 py-1.5 border-b border-border/40 bg-card/30">
              <Tabs.Trigger
                value="overview"
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-all',
                  'data-[state=active]:bg-primary/10 data-[state=active]:text-primary',
                  'data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-muted/50'
                )}
              >
                <FileText className="w-3.5 h-3.5" />
                Обзор
              </Tabs.Trigger>
              <Tabs.Trigger
                value="tasks"
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-all',
                  'data-[state=active]:bg-primary/10 data-[state=active]:text-primary',
                  'data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-muted/50'
                )}
              >
                <ListTodo className="w-3.5 h-3.5" />
                Задачи
              </Tabs.Trigger>
              <Tabs.Trigger
                value="readiness"
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-all',
                  'data-[state=active]:bg-primary/10 data-[state=active]:text-primary',
                  'data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-muted/50'
                )}
              >
                <Target className="w-3.5 h-3.5" />
                План
              </Tabs.Trigger>
            </Tabs.List>

            {/* Tab Content */}
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Загрузка..." />
              </div>
            ) : (
              <>
                <Tabs.Content value="overview" className="flex-1 overflow-y-auto">
                  <OverviewTab
                    sectionId={sectionId}
                    form={form}
                    savingField={savingField}
                    onSaveDescription={handleSaveDescription}
                  />
                </Tabs.Content>

                <Tabs.Content value="tasks" className="flex-1 overflow-hidden">
                  <TasksTab sectionId={sectionId} />
                </Tabs.Content>

                <Tabs.Content value="readiness" className="flex-1 overflow-y-auto">
                  <ReadinessTab sectionId={sectionId} />
                </Tabs.Content>
              </>
            )}
          </Tabs.Root>
        </div>
      </FocusScope.Root>

      {/* Delete Section Modal */}
      <DeleteSectionModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        sectionId={sectionId}
        sectionName={section.name}
        onSuccess={() => {
          setIsDeleteModalOpen(false)
          onClose()
          onSuccess?.()
        }}
      />
    </>
  )
}
