'use client'

import { useState, useEffect } from 'react'
import { X, MessageSquareText, Loader2, FileText, User2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { BaseModalProps } from '@/modules/modals/types'

// ============================================================================
// Types
// ============================================================================

export interface StageReportModalProps extends BaseModalProps {
  /** ID стадии */
  stageId: string
  /** Название стадии (для отображения в header) */
  stageName: string
  /** Режим: create или edit */
  mode: 'create' | 'edit'
  /** Данные для редактирования */
  editData?: {
    reportId: string
    comment: string
    createdAt: string
    authorName: string
  }
  /** Callback сохранения */
  onSave: (data: { reportId?: string; comment: string }) => Promise<void>
}

// ============================================================================
// Component
// ============================================================================

export function StageReportModal({
  isOpen,
  onClose,
  onSuccess,
  stageId,
  stageName,
  mode,
  editData,
  onSave,
}: StageReportModalProps) {
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  // Сброс при открытии
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && editData) {
        setComment(editData.comment)
      } else {
        setComment('')
      }
    }
  }, [isOpen, mode, editData])

  const canSave = comment.trim().length > 0

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      await onSave({
        reportId: editData?.reportId,
        comment: comment.trim(),
      })
      onSuccess?.()
      onClose()
    } catch (error) {
      console.error('Ошибка сохранения отчета:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canSave && !saving) {
      handleSave()
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className={cn(
            'pointer-events-auto w-full max-w-2xl',
            'bg-gradient-to-br from-white via-white to-slate-50/50',
            'dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/50',
            'border border-slate-200/60 dark:border-slate-700/60',
            'rounded-2xl shadow-2xl shadow-blue-500/5 dark:shadow-black/50',
            'transform transition-all duration-300',
            isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
            'overflow-hidden'
          )}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
        >
          {/* Decorative header gradient */}
          <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-br from-blue-500/10 via-transparent to-transparent pointer-events-none" />

          {/* Header */}
          <div className="relative flex items-center justify-between px-6 py-4 border-b border-slate-200/50 dark:border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-500/10 ring-1 ring-blue-500/20">
                <MessageSquareText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">
                  {mode === 'edit' ? 'Редактировать отчёт' : 'Создать отчёт'}
                </h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <FileText className="w-3 h-3 text-slate-400" />
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Стадия: {stageName}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="relative px-6 py-5">
            <div className="space-y-5">
              {/* Информация о создании (при редактировании) */}
              {mode === 'edit' && editData && (
                <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-50/80 to-slate-50/50 dark:from-blue-950/20 dark:to-slate-900/50 border border-blue-100 dark:border-blue-900/30">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700">
                      <User2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5 font-medium">
                        Автор отчёта
                      </div>
                      <div className="text-sm text-slate-900 dark:text-slate-100 font-medium">
                        {editData.authorName}
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5 font-medium">
                      Создан
                    </div>
                    <div className="text-sm text-slate-900 dark:text-slate-100 font-medium tabular-nums">
                      {format(parseISO(editData.createdAt), 'd MMM yyyy, HH:mm', { locale: ru })}
                    </div>
                  </div>
                </div>
              )}

              {/* Комментарий */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <MessageSquareText className="w-3.5 h-3.5 text-blue-500" />
                    Комментарий руководителя проекта
                  </label>
                  <span className="text-[10px] text-red-500 dark:text-red-400 font-medium">
                    * обязательно
                  </span>
                </div>
                <div className="relative">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={10}
                    placeholder="Опишите текущее состояние работ, достижения, риски, планы на следующий период..."
                    autoFocus
                    className={cn(
                      'w-full px-4 py-3 text-sm leading-relaxed',
                      'bg-white dark:bg-slate-900/50',
                      'border-2 border-slate-200 dark:border-slate-700',
                      'rounded-xl text-slate-900 dark:text-slate-100 resize-none',
                      'placeholder:text-slate-400 dark:placeholder:text-slate-500',
                      'focus:outline-none focus:border-blue-400 dark:focus:border-blue-500',
                      'focus:ring-4 focus:ring-blue-500/10',
                      'transition-all duration-200',
                      'shadow-sm'
                    )}
                  />
                  {/* Character count */}
                  <div className="absolute bottom-3 right-3 text-[10px] text-slate-400 dark:text-slate-500 bg-white/80 dark:bg-slate-900/80 px-2 py-1 rounded-md backdrop-blur-sm">
                    {comment.length} символов
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <div className="p-1 rounded bg-slate-100 dark:bg-slate-800">
                    <kbd className="font-mono">⌘/Ctrl + Enter</kbd>
                  </div>
                  <span>для быстрого сохранения</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="relative flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/50">
            <button
              onClick={onClose}
              disabled={saving}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg',
                'text-slate-600 dark:text-slate-400',
                'border border-slate-200 dark:border-slate-700',
                'bg-white dark:bg-slate-800',
                'hover:bg-slate-50 dark:hover:bg-slate-700',
                'hover:border-slate-300 dark:hover:border-slate-600',
                'transition-all duration-200',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave || saving}
              className={cn(
                'flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg',
                'text-white bg-gradient-to-r from-blue-600 to-blue-500',
                'hover:from-blue-500 hover:to-blue-400',
                'shadow-lg shadow-blue-500/25',
                'hover:shadow-xl hover:shadow-blue-500/30',
                'transition-all duration-200',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'disabled:from-slate-300 disabled:to-slate-300',
                'dark:disabled:from-slate-700 dark:disabled:to-slate-700',
                'disabled:shadow-none'
              )}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  <MessageSquareText className="w-4 h-4" />
                  {mode === 'edit' ? 'Сохранить изменения' : 'Создать отчёт'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
