'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { X, Users, Loader2, Search, Trash2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { useUsers, type CachedUser } from '@/modules/cache'
import {
  useUpdateLoading,
  useDeleteLoading,
  useCreateLoading,
} from '@/modules/resource-graph/hooks'
import type { Loading } from '@/modules/resource-graph/types'
import type { BaseModalProps } from '../../types'

// ============================================================================
// Types
// ============================================================================

interface BaseLoadingModalProps extends BaseModalProps {
  /** ID раздела (для мутаций) */
  sectionId: string
}

interface EditModeProps extends BaseLoadingModalProps {
  mode: 'edit'
  loading: Loading
}

interface CreateModeProps extends BaseLoadingModalProps {
  mode: 'create'
  stageId: string
  defaultStartDate: string
  defaultEndDate: string
}

export type LoadingModalProps = EditModeProps | CreateModeProps

// ============================================================================
// Constants
// ============================================================================

const RATE_PRESETS = [
  { value: 0.25, label: '25%' },
  { value: 0.5, label: '50%' },
  { value: 0.75, label: '75%' },
  { value: 1, label: '100%' },
] as const

// ============================================================================
// Helpers
// ============================================================================

function getInitials(user: CachedUser): string {
  const first = user.first_name?.[0] || ''
  const last = user.last_name?.[0] || ''
  return (first + last).toUpperCase() || '?'
}

function formatRate(rate: number): string {
  return `${Math.round(rate * 100)}%`
}

function parseRateInput(value: string): number | null {
  // Remove % symbol and spaces
  const cleaned = value.replace(/[%\s]/g, '')
  const parsed = parseFloat(cleaned)

  if (isNaN(parsed)) return null

  // Convert from percentage (0-100) to decimal (0-1)
  const decimal = parsed > 1 ? parsed / 100 : parsed

  // Clamp between 0.01 and 1
  return Math.min(1, Math.max(0.01, decimal))
}

// ============================================================================
// Component
// ============================================================================

export function LoadingModal(props: LoadingModalProps) {
  const { mode, isOpen, onClose, onSuccess, sectionId } = props
  const isEditMode = mode === 'edit'

  // Form state
  const [responsibleId, setResponsibleId] = useState('')
  const [rateInput, setRateInput] = useState('')
  const [comment, setComment] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Queries
  const { data: users = [], isLoading: usersLoading } = useUsers()

  // Mutations
  const updateMutation = useUpdateLoading()
  const deleteMutation = useDeleteLoading()
  const createMutation = useCreateLoading()

  // Derived state
  const selectedUser = useMemo(
    () => users.find((u) => u.user_id === responsibleId),
    [users, responsibleId]
  )

  const rate = useMemo(() => parseRateInput(rateInput), [rateInput])

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users

    const query = searchQuery.toLowerCase()
    return users.filter(
      (user) =>
        user.full_name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
    )
  }, [users, searchQuery])

  // Validation
  const isFormValid = useMemo(() => {
    if (!responsibleId) return false
    if (rate === null || rate <= 0) return false
    return true
  }, [responsibleId, rate])

  const hasChanges = useMemo(() => {
    if (!isEditMode) return responsibleId !== ''

    const loading = (props as EditModeProps).loading
    return (
      responsibleId !== loading.employee.id ||
      rate !== loading.rate ||
      comment !== (loading.comment || '')
    )
  }, [isEditMode, props, responsibleId, rate, comment])

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('')
      setShowDeleteConfirm(false)

      if (isEditMode) {
        const loading = (props as EditModeProps).loading
        setResponsibleId(loading.employee.id || '')
        setRateInput(formatRate(loading.rate))
        setComment(loading.comment || '')
      } else {
        setResponsibleId('')
        setRateInput('100%')
        setComment('')
      }
    }
  }, [isOpen, isEditMode, props])

  // Handlers
  const handleSelectUser = useCallback((userId: string) => {
    setResponsibleId(userId)
    setSearchQuery('')
  }, [])

  const handleRatePreset = useCallback((presetRate: number) => {
    setRateInput(formatRate(presetRate))
  }, [])

  const handleRateInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setRateInput(e.target.value)
  }, [])

  const handleRateInputBlur = useCallback(() => {
    const parsedRate = parseRateInput(rateInput)
    if (parsedRate !== null) {
      setRateInput(formatRate(parsedRate))
    }
  }, [rateInput])

  const handleSave = useCallback(() => {
    if (!isFormValid || rate === null) return

    if (isEditMode) {
      if (!hasChanges) {
        onClose()
        return
      }

      const loading = (props as EditModeProps).loading
      const updates: Record<string, unknown> = {}

      if (responsibleId !== loading.employee.id) {
        updates.responsibleId = responsibleId
      }
      if (rate !== loading.rate) {
        updates.rate = rate
      }
      if (comment !== (loading.comment || '')) {
        updates.comment = comment
      }

      onClose()

      updateMutation.mutate(
        {
          loadingId: loading.id,
          sectionId,
          updates,
        },
        {
          onSuccess: () => onSuccess?.(),
        }
      )
    } else {
      // Create mode
      if (!selectedUser) return

      const createProps = props as CreateModeProps

      onClose()

      createMutation.mutate(
        {
          sectionId,
          stageId: createProps.stageId,
          responsibleId,
          startDate: createProps.defaultStartDate,
          endDate: createProps.defaultEndDate,
          rate,
          comment: comment || undefined,
          employee: {
            firstName: selectedUser.first_name,
            lastName: selectedUser.last_name,
            name: selectedUser.full_name,
            avatarUrl: selectedUser.avatar_url,
          },
        },
        {
          onSuccess: () => onSuccess?.(),
        }
      )
    }
  }, [
    isFormValid,
    rate,
    isEditMode,
    hasChanges,
    props,
    responsibleId,
    comment,
    sectionId,
    selectedUser,
    updateMutation,
    createMutation,
    onClose,
    onSuccess,
  ])

  const handleDelete = useCallback(() => {
    if (!isEditMode) return

    const loading = (props as EditModeProps).loading

    onClose()

    deleteMutation.mutate(
      { loadingId: loading.id, sectionId },
      {
        onSuccess: () => onSuccess?.(),
      }
    )
  }, [isEditMode, props, sectionId, deleteMutation, onClose, onSuccess])

  const isPending =
    updateMutation.isPending ||
    deleteMutation.isPending ||
    createMutation.isPending

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
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/50">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-medium text-slate-300">
                {isEditMode ? 'Редактировать загрузку' : 'Новая загрузка'}
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
          <div className="px-4 py-3 space-y-4">
            {/* Employee Selection - Fixed height container */}
            <div>
              <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1.5">
                Ответственный
              </label>

              {/* Fixed height container for employee selection */}
              <div className="h-[180px] flex flex-col">
                {/* Search Input - always visible */}
                <div className="relative mb-2 shrink-0">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    value={selectedUser ? selectedUser.full_name : searchQuery}
                    onChange={(e) => {
                      if (selectedUser) {
                        setResponsibleId('')
                        setSearchQuery(e.target.value)
                      } else {
                        setSearchQuery(e.target.value)
                      }
                    }}
                    onFocus={() => {
                      if (selectedUser) {
                        setResponsibleId('')
                        setSearchQuery('')
                      }
                    }}
                    placeholder="Поиск сотрудника..."
                    className={cn(
                      'w-full pl-8 pr-8 py-1.5 text-xs',
                      'bg-slate-800/50 border border-slate-700',
                      'rounded text-slate-200',
                      'placeholder:text-slate-600',
                      'focus:outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600/50',
                      'transition-colors',
                      selectedUser && 'border-amber-500/30 bg-amber-500/5'
                    )}
                    disabled={isPending}
                  />
                  {selectedUser && (
                    <button
                      onClick={() => {
                        setResponsibleId('')
                        setSearchQuery('')
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-500 hover:text-slate-300 rounded transition-colors"
                      disabled={isPending}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Users List - fills remaining space */}
                <div className="flex-1 overflow-y-auto border border-slate-700/50 rounded bg-slate-800/30">
                  {usersLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-[11px] text-slate-500">
                      {searchQuery ? 'Ничего не найдено' : 'Нет сотрудников'}
                    </div>
                  ) : (
                    <div className="space-y-0.5 p-0.5">
                      {filteredUsers.map((user) => {
                        const isSelected = user.user_id === responsibleId
                        return (
                          <button
                            key={user.user_id}
                            onClick={() => handleSelectUser(user.user_id)}
                            className={cn(
                              'w-full flex items-center gap-2 px-2 py-1.5 text-left rounded',
                              'transition-colors',
                              isSelected
                                ? 'bg-amber-500/10 border border-amber-500/30'
                                : 'hover:bg-slate-700/50 border border-transparent'
                            )}
                            disabled={isPending}
                          >
                            <Avatar className="w-6 h-6">
                              {user.avatar_url && (
                                <AvatarImage src={user.avatar_url} />
                              )}
                              <AvatarFallback className="text-[8px] bg-slate-700 text-slate-400">
                                {getInitials(user)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className={cn(
                                'text-[11px] font-medium truncate',
                                isSelected ? 'text-amber-400' : 'text-slate-300'
                              )}>
                                {user.full_name}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Rate Selection */}
            <div>
              <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1.5">
                Ставка
              </label>

              <div className="space-y-2">
                {/* Presets */}
                <div className="flex gap-1.5">
                  {RATE_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => handleRatePreset(preset.value)}
                      disabled={isPending}
                      className={cn(
                        'flex-1 px-2 py-1 text-[11px] font-medium rounded',
                        'border transition-all duration-150',
                        rate === preset.value
                          ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                          : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-300',
                        isPending && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Custom Input */}
                <div className="relative">
                  <input
                    type="text"
                    value={rateInput}
                    onChange={handleRateInputChange}
                    onBlur={handleRateInputBlur}
                    placeholder="Или введите своё значение"
                    className={cn(
                      'w-full px-2.5 py-1.5 pr-8 text-xs text-center',
                      'bg-slate-800/50 border border-slate-700',
                      'rounded text-slate-200 font-mono',
                      'placeholder:text-slate-600',
                      'focus:outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600/50',
                      'transition-colors'
                    )}
                    disabled={isPending}
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">
                    %
                  </span>
                </div>
              </div>
            </div>

            {/* Comment */}
            <div>
              <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1.5">
                Комментарий
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Необязательно..."
                rows={2}
                className={cn(
                  'w-full px-2.5 py-1.5 text-xs',
                  'bg-slate-800/50 border border-slate-700',
                  'rounded text-slate-200 resize-none',
                  'placeholder:text-slate-600',
                  'focus:outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600/50',
                  'transition-colors'
                )}
                disabled={isPending}
              />
            </div>

            {/* Delete Confirmation */}
            {isEditMode && showDeleteConfirm && (
              <div className="p-3 border border-red-500/30 bg-red-500/10 rounded-lg">
                <div className="flex items-center gap-2 text-xs text-red-400 mb-2">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span className="font-medium">Удалить загрузку?</span>
                </div>
                <p className="text-[11px] text-slate-400 mb-3">
                  Это действие нельзя отменить.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className={cn(
                      'flex-1 px-2 py-1 text-[11px] font-medium rounded',
                      'text-slate-400 hover:text-slate-300',
                      'border border-slate-700 hover:border-slate-600',
                      'bg-slate-800/50 hover:bg-slate-800',
                      'transition-colors'
                    )}
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleDelete}
                    className={cn(
                      'flex-1 px-2 py-1 text-[11px] font-medium rounded',
                      'text-white bg-red-600 hover:bg-red-500',
                      'transition-colors'
                    )}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-700/50">
            {/* Delete Button (edit mode only) */}
            {isEditMode && !showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isPending}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded',
                  'text-red-400 hover:text-red-300',
                  'border border-red-500/30 hover:border-red-500/50',
                  'bg-transparent hover:bg-red-500/10',
                  'transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <Trash2 className="w-3 h-3" />
                Удалить
              </button>
            ) : (
              <div />
            )}

            <div className="flex gap-2">
              <button
                onClick={onClose}
                disabled={isPending}
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
                onClick={handleSave}
                disabled={!isFormValid || isPending || (isEditMode && !hasChanges)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded',
                  'text-slate-900 bg-amber-500 hover:bg-amber-400',
                  'transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500'
                )}
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {isEditMode ? 'Сохранение...' : 'Создание...'}
                  </>
                ) : (
                  <>
                    <Users className="w-3 h-3" />
                    {isEditMode ? 'Сохранить' : 'Создать'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
