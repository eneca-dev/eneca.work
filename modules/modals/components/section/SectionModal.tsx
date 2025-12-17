'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, FileText, Calendar, User, Edit3, Check, Loader2, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { CommentsPanel } from '@/modules/comments/components/CommentsPanel'
import type { Section } from '@/modules/resource-graph/types'
import type { BaseModalProps } from '../../types'
import { SectionMetrics } from './SectionMetrics'
import { updateSection } from '../../actions/updateSection'

// ============================================================================
// Types
// ============================================================================

export interface SectionModalProps extends BaseModalProps {
  /** Данные раздела из кеша (моментальная загрузка) */
  section: Section
  /** ID раздела для комментариев и мутаций */
  sectionId: string
  /** Список статусов для выбора */
  statuses?: Array<{ id: string; name: string; color: string }>
  /** Список пользователей для выбора ответственного */
  users?: Array<{ id: string; name: string; avatarUrl?: string | null }>
}

type TabType = 'general' | 'stages'

// ============================================================================
// Helpers
// ============================================================================

function getInitials(firstName?: string | null, lastName?: string | null): string {
  const f = firstName?.[0] || ''
  const l = lastName?.[0] || ''
  return (f + l).toUpperCase() || '?'
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return 'Не указаны'
  if (start && !end) return `${formatDate(start)} — …`
  if (!start && end) return `… — ${formatDate(end)}`
  return `${formatDate(start)} — ${formatDate(end)}`
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
  statuses = [],
  users = [],
}: SectionModalProps) {
  // State
  const [activeTab, setActiveTab] = useState<TabType>('general')
  const [editingField, setEditingField] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Edit values
  const [editName, setEditName] = useState(section.name)
  const [editDescription, setEditDescription] = useState('')
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [showResponsibleDropdown, setShowResponsibleDropdown] = useState(false)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab('general')
      setEditingField(null)
      setEditName(section.name)
      setEditDescription('')
      setShowStatusDropdown(false)
      setShowResponsibleDropdown(false)
      setSaveError(null)
    }
  }, [isOpen, section.name])

  // Close on ESC
  useEffect(() => {
    if (!isOpen) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  // Handlers
  const handleSave = useCallback(async (field: string, value: unknown) => {
    setIsSaving(true)
    setSaveError(null)
    try {
      const result = await updateSection(sectionId, { [field]: value })
      if (result.success) {
        onSuccess?.()
        setEditingField(null)
      } else {
        setSaveError(result.error)
      }
    } catch (err) {
      setSaveError('Ошибка сохранения')
    } finally {
      setIsSaving(false)
    }
  }, [sectionId, onSuccess])

  const handleStatusChange = useCallback(async (statusId: string | null) => {
    setShowStatusDropdown(false)
    await handleSave('statusId', statusId)
  }, [handleSave])

  const handleResponsibleChange = useCallback(async (responsibleId: string | null) => {
    setShowResponsibleDropdown(false)
    await handleSave('responsibleId', responsibleId)
  }, [handleSave])

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Slide-in Panel */}
      <div
        className={cn(
          'fixed inset-y-0 right-0 z-50 w-[420px]',
          'bg-slate-900/95 backdrop-blur-md',
          'border-l border-slate-700/50',
          'shadow-2xl shadow-black/50',
          'flex flex-col',
          'transform transition-transform duration-300',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-4 py-3 border-b border-slate-700/50">
          {/* Avatar */}
          <Avatar className="h-10 w-10 shrink-0">
            {section.responsible.avatarUrl && (
              <AvatarImage src={section.responsible.avatarUrl} />
            )}
            <AvatarFallback className="bg-slate-700 text-slate-300 text-xs">
              {getInitials(section.responsible.firstName, section.responsible.lastName)}
            </AvatarFallback>
          </Avatar>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {/* Name - editable */}
            {editingField === 'name' ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={cn(
                    'flex-1 px-2 py-0.5 text-sm font-medium',
                    'bg-slate-800/50 border border-slate-600',
                    'rounded text-slate-200',
                    'focus:outline-none focus:border-amber-500/50'
                  )}
                  autoFocus
                  disabled={isSaving}
                />
                <button
                  onClick={() => handleSave('name', editName)}
                  disabled={isSaving}
                  className="p-1 text-green-400 hover:bg-slate-800 rounded"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => { setEditingField(null); setEditName(section.name) }}
                  className="p-1 text-slate-500 hover:bg-slate-800 rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div
                className="group flex items-center gap-1 cursor-pointer"
                onClick={() => setEditingField('name')}
              >
                <h2 className="text-sm font-medium text-slate-200 truncate">
                  {section.name}
                </h2>
                <Edit3 className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}

            {/* Responsible - clickable dropdown */}
            <div className="relative mt-1">
              <button
                onClick={() => setShowResponsibleDropdown(!showResponsibleDropdown)}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-300"
              >
                <User className="w-3 h-3" />
                <span>{section.responsible.name || 'Не назначен'}</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {showResponsibleDropdown && (
                <div className="absolute top-full left-0 mt-1 z-10 w-48 bg-slate-800 border border-slate-700 rounded-md shadow-lg max-h-48 overflow-y-auto">
                  <button
                    onClick={() => handleResponsibleChange(null)}
                    className="w-full px-3 py-1.5 text-left text-[11px] text-slate-400 hover:bg-slate-700"
                  >
                    Не назначен
                  </button>
                  {users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleResponsibleChange(user.id)}
                      className="w-full px-3 py-1.5 text-left text-[11px] text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                    >
                      <Avatar className="h-4 w-4">
                        {user.avatarUrl && <AvatarImage src={user.avatarUrl} />}
                        <AvatarFallback className="text-[8px] bg-slate-600">
                          {user.name?.[0] || '?'}
                        </AvatarFallback>
                      </Avatar>
                      {user.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Status - clickable dropdown */}
            <div className="relative mt-1">
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="flex items-center gap-1.5 text-[11px]"
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: section.status.color || '#6b7280' }}
                />
                <span className="text-slate-300">{section.status.name || 'Без статуса'}</span>
                <ChevronDown className="w-3 h-3 text-slate-500" />
              </button>

              {showStatusDropdown && (
                <div className="absolute top-full left-0 mt-1 z-10 w-40 bg-slate-800 border border-slate-700 rounded-md shadow-lg">
                  <button
                    onClick={() => handleStatusChange(null)}
                    className="w-full px-3 py-1.5 text-left text-[11px] text-slate-400 hover:bg-slate-700"
                  >
                    Без статуса
                  </button>
                  {statuses.map((status) => (
                    <button
                      key={status.id}
                      onClick={() => handleStatusChange(status.id)}
                      className="w-full px-3 py-1.5 text-left text-[11px] text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                    >
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: status.color }}
                      />
                      {status.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 py-2 border-b border-slate-700/50">
          <button
            onClick={() => setActiveTab('general')}
            className={cn(
              'px-3 py-1 text-[11px] font-medium rounded transition-colors',
              activeTab === 'general'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800'
            )}
          >
            Общая
          </button>
          <button
            onClick={() => setActiveTab('stages')}
            className={cn(
              'px-3 py-1 text-[11px] font-medium rounded transition-colors',
              activeTab === 'stages'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800'
            )}
          >
            Этапы
          </button>
        </div>

        {/* Error message */}
        {saveError && (
          <div className="mx-4 mt-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">
            {saveError}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'general' && (
            <div className="px-4 py-3 space-y-3">
              {/* Dates + Metrics row */}
              <div className="flex items-center justify-between gap-4">
                {/* Dates */}
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>{formatDateRange(section.startDate, section.endDate)}</span>
                </div>

                {/* Compact Metrics */}
                <SectionMetrics section={section} compact />
              </div>

              {/* Divider */}
              <div className="border-t border-slate-700/50" />

              {/* Description */}
              <div>
                <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1.5">
                  Описание
                </label>
                {editingField === 'description' ? (
                  <div className="space-y-2">
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={3}
                      className={cn(
                        'w-full px-2.5 py-1.5 text-xs',
                        'bg-slate-800/50 border border-slate-700',
                        'rounded text-slate-200 resize-none',
                        'placeholder:text-slate-600',
                        'focus:outline-none focus:border-slate-600'
                      )}
                      placeholder="Описание раздела..."
                      disabled={isSaving}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSave('description', editDescription)}
                        disabled={isSaving}
                        className={cn(
                          'flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded',
                          'bg-amber-500 text-slate-900 hover:bg-amber-400',
                          'disabled:opacity-50'
                        )}
                      >
                        {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        Сохранить
                      </button>
                      <button
                        onClick={() => setEditingField(null)}
                        className="px-2 py-1 text-[10px] text-slate-400 hover:text-slate-300"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="group cursor-pointer p-2 rounded bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
                    onClick={() => {
                      setEditDescription(section.description || '')
                      setEditingField('description')
                    }}
                  >
                    {section.description ? (
                      <p className="text-xs text-slate-300 whitespace-pre-wrap">
                        {section.description}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 min-h-[2rem]">
                        Нажмите чтобы добавить описание...
                      </p>
                    )}
                    <Edit3 className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-slate-700/50" />

              {/* Comments */}
              <div>
                <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-2">
                  Комментарии
                </label>
                <div className="bg-slate-800/30 rounded-lg overflow-hidden">
                  <CommentsPanel
                    sectionId={sectionId}
                    autoScrollOnMount={false}
                    autoScrollOnNewComment={true}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'stages' && (
            <div className="px-4 py-8 text-center">
              <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500">
                Вкладка "Этапы" в разработке
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
