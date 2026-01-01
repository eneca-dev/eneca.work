'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { X, MessageSquareText, Loader2, Trash2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BaseModalProps } from '../../types'
import { useProjectMetrics } from '@/modules/project-reports'

// ============================================================================
// Types
// ============================================================================

export interface ProjectReportModalProps extends BaseModalProps {
  /** ID проекта */
  projectId: string
  /** Название проекта для отображения */
  projectName: string
  /** Режим работы модалки */
  mode: 'create' | 'edit'
  /** Данные для редактирования (только для mode='edit') */
  editData?: {
    reportId: string
    comment: string
    createdAt: string
    authorName: string
    actualReadiness?: number | null
    plannedReadiness?: number | null
    budgetSpent?: number | null
  }
  /** Callback сохранения отчета */
  onSave: (data: {
    reportId?: string
    comment: string
  }) => Promise<void>
  /** Callback удаления отчета (только для mode='edit') */
  onDelete?: () => Promise<void>
}

// ============================================================================
// Component
// ============================================================================

export function ProjectReportModal({
  isOpen,
  onClose,
  onSuccess,
  projectId,
  projectName,
  mode,
  editData,
  onSave,
  onDelete,
}: ProjectReportModalProps) {
  // Form state
  const [comment, setComment] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Load current metrics (for create mode)
  const { data: currentMetrics, isLoading: metricsLoading } = useProjectMetrics(projectId, {
    enabled: isOpen && mode === 'create',
  })

  // Determine which metrics to display
  const displayMetrics =
    mode === 'edit'
      ? {
          actualReadiness: editData?.actualReadiness ?? null,
          plannedReadiness: editData?.plannedReadiness ?? null,
          budgetSpent: editData?.budgetSpent ?? null,
        }
      : currentMetrics
      ? {
          actualReadiness: currentMetrics.actualReadiness,
          plannedReadiness: currentMetrics.plannedReadiness,
          budgetSpent: currentMetrics.budgetSpent,
        }
      : null

  // Reset form on open
  useEffect(() => {
    if (isOpen) {
      setShowDeleteConfirm(false)
      setSaveError(null)
      if (mode === 'edit' && editData) {
        setComment(editData.comment)
      } else {
        setComment('')
      }
    }
  }, [isOpen, mode, editData])

  // ESC key handler
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSaving && !isDeleting) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
    }

    return () => {
      document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, isSaving, isDeleting, onClose])

  // Validation
  const isFormValid = comment.trim().length > 0

  // Handlers
  const handleSubmit = useCallback(async () => {
    if (!isFormValid || isSaving) return

    setSaveError(null)
    setIsSaving(true)
    try {
      await onSave({
        reportId: mode === 'edit' ? editData?.reportId : undefined,
        comment: comment.trim(),
      })
      onSuccess?.()
    } catch (error) {
      console.error('[ProjectReportModal] Save error:', error)
      setSaveError('Не удалось сохранить отчет. Попробуйте еще раз.')
    } finally {
      setIsSaving(false)
    }
  }, [isFormValid, isSaving, onSave, mode, editData, comment, onSuccess])

  const handleDelete = useCallback(async () => {
    if (!onDelete || mode !== 'edit') return

    setIsDeleting(true)
    setSaveError(null)
    try {
      await onDelete()
      onClose()
      onSuccess?.()
    } catch (error) {
      console.error('[ProjectReportModal] Delete error:', error)
      setSaveError('Не удалось удалить отчет. Попробуйте еще раз.')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }, [onDelete, mode, onClose, onSuccess])

  const isPending = isSaving || isDeleting

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={isPending ? undefined : onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className={cn(
            'pointer-events-auto w-full max-w-xl',
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
              <MessageSquareText className="w-4 h-4 text-blue-500" />
              <span id="modal-title" className="text-xs font-medium text-slate-300">
                {mode === 'create' ? 'Создать отчет' : 'Редактировать отчет'}
              </span>
              <span className="text-[10px] text-slate-500">·</span>
              <span className="text-[10px] text-slate-400 truncate max-w-[300px]" title={projectName}>
                Проект: {projectName}
              </span>
            </div>
            <button
              onClick={onClose}
              aria-label="Закрыть"
              className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-4 py-3">
            <div className="grid grid-cols-[1fr,200px] gap-3">
              {/* Metadata row - только в edit mode */}
              {mode === 'edit' && editData && (
                <>
                  {/* Автор (left) */}
                  <div className="pb-2">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wide">
                      Автор
                    </div>
                    <div className="text-xs text-slate-300 font-medium mt-0.5">
                      {editData.authorName}
                    </div>
                  </div>

                  {/* Создан (right) */}
                  <div className="pb-2">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wide">
                      Создан
                    </div>
                    <div className="text-xs text-slate-300 font-medium mt-0.5">
                      {new Date(editData.createdAt).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* Left column - Textarea */}
              <div className="flex flex-col">
                <label htmlFor="report-comment" className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1.5">
                  Текст отчета
                </label>
                <textarea
                  id="report-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Введите текст отчета..."
                  className={cn(
                    'w-full h-full px-2.5 py-2 text-xs',
                    'bg-slate-800/50 border border-slate-700',
                    'rounded text-slate-200 resize-none',
                    'placeholder:text-slate-600',
                    'focus:outline-none focus:border-slate-500/50 focus:ring-1 focus:ring-slate-500/30',
                    'transition-colors'
                  )}
                  autoFocus
                  disabled={isPending}
                />
              </div>

              {/* Right column - Metrics */}
              <div className="flex flex-col">
                <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1.5">
                  {mode === 'create' ? 'Показатели проекта (текущие)' : 'Показатели проекта'}
                </label>

                {metricsLoading && mode === 'create' ? (
                  <div className="flex items-center justify-center flex-1">
                    <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Actual Readiness */}
                    <div className="flex flex-col gap-1 p-2 rounded bg-slate-800/30 border border-blue-500/20">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-[10px] text-slate-400">Фактическая готовность</span>
                      </div>
                      <div className="text-lg font-semibold text-blue-400 tabular-nums">
                        {displayMetrics?.actualReadiness !== null &&
                        displayMetrics?.actualReadiness !== undefined
                          ? `${displayMetrics.actualReadiness}%`
                          : '—'}
                      </div>
                    </div>

                    {/* Planned Readiness */}
                    <div className="flex flex-col gap-1 p-2 rounded bg-slate-800/30 border border-green-500/20">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-[10px] text-slate-400">Плановая готовность</span>
                      </div>
                      <div className="text-lg font-semibold text-green-400 tabular-nums">
                        {displayMetrics?.plannedReadiness !== null &&
                        displayMetrics?.plannedReadiness !== undefined
                          ? `${displayMetrics.plannedReadiness}%`
                          : '—'}
                      </div>
                    </div>

                    {/* Budget Spent */}
                    <div className="flex flex-col gap-1 p-2 rounded bg-slate-800/30 border border-amber-500/20">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        <span className="text-[10px] text-slate-400">Расход бюджета</span>
                      </div>
                      <div className="text-lg font-semibold text-amber-400 tabular-nums">
                        {displayMetrics?.budgetSpent !== null && displayMetrics?.budgetSpent !== undefined
                          ? `${displayMetrics.budgetSpent}%`
                          : '—'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Delete Confirmation */}
            {mode === 'edit' && showDeleteConfirm && (
              <div className="mt-4 p-3 border border-red-500/30 bg-red-500/10 rounded-lg">
                <div className="flex items-center gap-2 text-xs text-red-400 mb-2">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span className="font-medium">Удалить отчет?</span>
                </div>
                <p className="text-[11px] text-slate-400 mb-3">
                  Это действие нельзя отменить.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isPending}
                    className={cn(
                      'flex-1 px-2 py-1 text-[11px] font-medium rounded',
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
                    type="button"
                    onClick={handleDelete}
                    disabled={isPending}
                    className={cn(
                      'flex-1 px-2 py-1 text-[11px] font-medium rounded',
                      'text-white bg-red-600 hover:bg-red-500',
                      'transition-colors',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    {isDeleting ? (
                      <span className="flex items-center justify-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Удаление...
                      </span>
                    ) : (
                      'Удалить'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-700/50">
            {/* Error message */}
            {saveError && (
              <div role="alert" className="px-4 py-2 bg-red-900/20 border-b border-red-500/30">
                <p className="text-xs text-red-400">{saveError}</p>
              </div>
            )}

            <div className="flex items-center justify-between px-4 py-2.5">
              {/* Delete Button (edit mode only) */}
              {mode === 'edit' && !showDeleteConfirm ? (
                <button
                  type="button"
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
                  type="button"
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
                  type="button"
                  onClick={handleSubmit}
                  disabled={!isFormValid || isPending}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded',
                    'text-white bg-green-600 hover:bg-green-500',
                    'transition-colors',
                    'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500'
                  )}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Сохранение...
                    </>
                  ) : (
                    <>
                      <MessageSquareText className="w-3 h-3" />
                      {mode === 'create' ? 'Создать' : 'Сохранить'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
