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
  MessageSquare,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { CommentsPanel } from '@/modules/comments/components/CommentsPanel'
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

// ============================================================================
// Constants
// ============================================================================

const ANIMATION_DURATION = 300
const PANEL_WIDTH = 640

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
  const [isDescriptionFocused, setIsDescriptionFocused] = useState(false)
  const [savingField, setSavingField] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const originalDescription = useRef<string>('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) {
      setEditingName(false)
      setIsDescriptionFocused(false)
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

  const handleDescriptionBlur = useCallback(async () => {
    setIsDescriptionFocused(false)
    const description = form.getValues('description')?.trim() || null
    const original = originalDescription.current || null
    if (description !== original) {
      await saveField('description', description)
    }
  }, [form, saveField])

  const handleDescriptionFocus = useCallback(() => {
    setIsDescriptionFocused(true)
    originalDescription.current = form.getValues('description') || ''
  }, [form])

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
        } else if (isDescriptionFocused) {
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur()
          }
        } else {
          onClose()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, editingName, isDescriptionFocused, onClose, reset])

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

          {/* Content */}
          <main className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-slate-500" aria-label="Загрузка..." />
              </div>
            ) : (
              <div className="px-5 py-5 space-y-5">
                {/* Description */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="section-description"
                      className="text-[10px] font-medium text-slate-400 uppercase tracking-wider"
                    >
                      Описание
                    </label>
                    {savingField === 'description' && (
                      <div className="flex items-center gap-1.5 text-xs text-amber-400">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Сохранение...</span>
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <textarea
                      id="section-description"
                      {...form.register('description')}
                      onFocus={handleDescriptionFocus}
                      onBlur={handleDescriptionBlur}
                      placeholder="Описание раздела..."
                      disabled={savingField === 'description'}
                      className={cn(
                        'w-full px-4 py-3',
                        'text-sm leading-relaxed',
                        'bg-slate-800/30 rounded-xl',
                        'border transition-all duration-200',
                        'resize-none',
                        'h-[140px]',
                        'placeholder:text-slate-600',
                        !isDescriptionFocused && 'border-slate-800/50 text-slate-300',
                        isDescriptionFocused && 'border-amber-500/50 ring-2 ring-amber-500/15 text-slate-200 bg-slate-800/50',
                        savingField === 'description' && 'opacity-60 cursor-wait'
                      )}
                      style={{
                        wordBreak: 'break-word',
                        overflowWrap: 'anywhere',
                      }}
                    />
                    {isDescriptionFocused && (
                      <div className="absolute bottom-2.5 right-3 text-[10px] text-slate-600">
                        Esc для отмены
                      </div>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-slate-800/50" aria-hidden="true" />

                {/* Comments */}
                <section aria-labelledby="comments-heading">
                  <div className="flex items-center gap-2 mb-3">
                    <MessageSquare className="w-4 h-4 text-slate-500" aria-hidden="true" />
                    <h3
                      id="comments-heading"
                      className="text-[10px] font-medium text-slate-400 uppercase tracking-wider"
                    >
                      Комментарии
                    </h3>
                  </div>
                  <div className="bg-slate-800/20 rounded-xl border border-slate-800/40 overflow-hidden">
                    <CommentsPanel
                      sectionId={sectionId}
                      autoScrollOnMount={false}
                      autoScrollOnNewComment={true}
                    />
                  </div>
                </section>
              </div>
            )}
          </main>
        </div>
      </FocusScope.Root>
    </>
  )
}
