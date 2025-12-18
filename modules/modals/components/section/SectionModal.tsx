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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useSectionStatuses } from '@/modules/statuses-tags/statuses/hooks/useSectionStatuses'
import { useUsers, type CachedUser } from '@/modules/cache'
import type { Section } from '@/modules/resource-graph/types'
import { getInitials } from '@/modules/resource-graph/utils'
import type { BaseModalProps } from '../../types'
import { useUpdateSection } from '../../hooks/useUpdateSection'
import { SectionMetrics } from './SectionMetrics'
import { StatusDropdown, type StatusOption } from './StatusDropdown'
import { ResponsibleDropdown } from './ResponsibleDropdown'
import { DateRangeInput } from './DateRangeInput'
import { OverviewTab, TasksTab } from './tabs'

// ============================================================================
// Constants
// ============================================================================

const ANIMATION_DURATION = 300
const PANEL_WIDTH = 1100

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
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks'>('overview')

  const originalDescription = useRef<string>('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) {
      setEditingName(false)
      setSaveError(null)
      setActiveTab('overview')
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
    [sectionId, onSuccess, updateMutation]
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
            'bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950',
            'border-l border-slate-800/80',
            'shadow-[-8px_0_40px_-15px_rgba(0,0,0,0.6)]',
            'flex flex-col',
            'transition-all duration-300 ease-out',
            isAnimating ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-95'
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

            {/* Header content - 2 column grid */}
            <div className="flex gap-4">
              {/* Left column - Avatar & Name */}
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {/* Avatar */}
                <Avatar className="h-14 w-14 shrink-0 border-2 border-slate-700/50 shadow-lg">
                  {displayResponsible.avatar_url && (
                    <AvatarImage src={displayResponsible.avatar_url} />
                  )}
                  <AvatarFallback className="bg-gradient-to-br from-slate-700 to-slate-800 text-slate-300 text-base font-medium">
                    {getInitials(displayResponsible.first_name, displayResponsible.last_name)}
                  </AvatarFallback>
                </Avatar>

                {/* Name & Responsible */}
                <div className="flex-1 min-w-0 pt-0.5">
                  {/* Editable name */}
                  {editingName ? (
                    <div className="flex items-center gap-2">
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
                        id="section-modal-title"
                        className="text-lg font-semibold text-slate-100 truncate"
                      >
                        {form.watch('name') || section.name}
                      </h2>
                      <Edit3 className="w-3.5 h-3.5 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </button>
                  )}

                  {/* Responsible selector */}
                  <div className="mt-2">
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

              {/* Right column - Status & Dates */}
              <div className="flex flex-col items-end gap-3 pr-8">
                {/* Status badge */}
                <StatusDropdown
                  id="section-status"
                  value={selectedStatus}
                  options={statusOptions}
                  onChange={handleStatusChange}
                  isLoading={savingField === 'statusId'}
                  disabled={statusesLoading}
                />

                {/* Dates */}
                <DateRangeInput
                  idPrefix="section-date"
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
            </div>

            {/* Metrics row */}
            <div className="mt-4 pt-3 border-t border-slate-800/60">
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
            onValueChange={(value) => setActiveTab(value as 'overview' | 'tasks')}
            className="flex-1 flex flex-col overflow-hidden"
          >
            {/* Tab List */}
            <Tabs.List className="flex gap-1 px-5 py-2 border-b border-slate-800/50 bg-slate-900/50">
              <Tabs.Trigger
                value="overview"
                className={cn(
                  'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all',
                  'data-[state=active]:bg-slate-800 data-[state=active]:text-slate-100',
                  'data-[state=inactive]:text-slate-400 data-[state=inactive]:hover:text-slate-300 data-[state=inactive]:hover:bg-slate-800/50'
                )}
              >
                <FileText className="w-4 h-4" />
                Обзор
              </Tabs.Trigger>
              <Tabs.Trigger
                value="tasks"
                className={cn(
                  'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all',
                  'data-[state=active]:bg-slate-800 data-[state=active]:text-slate-100',
                  'data-[state=inactive]:text-slate-400 data-[state=inactive]:hover:text-slate-300 data-[state=inactive]:hover:bg-slate-800/50'
                )}
              >
                <ListTodo className="w-4 h-4" />
                Задачи
              </Tabs.Trigger>
            </Tabs.List>

            {/* Tab Content */}
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-slate-500" aria-label="Загрузка..." />
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
              </>
            )}
          </Tabs.Root>
        </div>
      </FocusScope.Root>
    </>
  )
}
