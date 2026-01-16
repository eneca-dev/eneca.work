'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { X, FileText, Trash2, Loader2, Check, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  useTemplatesList,
  useDeleteTemplate,
  useApplyTemplate,
  type Stage,
} from '@/modules/dec-templates'
import type { BaseModalProps } from '../../types'

// ============================================================================
// Types
// ============================================================================

export interface TemplateSelectModalProps extends Omit<BaseModalProps, 'onSuccess'> {
  /** ID раздела для применения шаблона */
  sectionId: string
  /** Есть ли права на управление шаблонами */
  hasManagePermission?: boolean
  /** ID отдела пользователя для предвыбора фильтра */
  defaultDepartmentId?: string
  /** Callback после применения шаблона с созданными этапами */
  onApply?: (newStages: Stage[]) => void
}

// ============================================================================
// Component
// ============================================================================

export function TemplateSelectModal({
  isOpen,
  onClose,
  onApply,
  sectionId,
  hasManagePermission = false,
  defaultDepartmentId,
}: TemplateSelectModalProps) {
  // State
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [departmentFilter, setDepartmentFilter] = useState<string>('all')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Queries & Mutations
  const { data: templates = [], isLoading, error } = useTemplatesList({ enabled: isOpen })
  const { mutateAsync: deleteTemplateFn, isPending: isDeleting } = useDeleteTemplate()
  const { mutateAsync: applyTemplateFn, isPending: isApplying } = useApplyTemplate()

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setSelectedTemplateId(null)
      setDepartmentFilter(defaultDepartmentId || 'all')
      setDeleteConfirmId(null)
    }
  }, [isOpen, defaultDepartmentId])

  // Unique departments for filter
  const departments = useMemo(
    () =>
      Array.from(
        new Map(
          templates.map((t) => [t.departmentId, { id: t.departmentId, name: t.departmentName }])
        ).values()
      ),
    [templates]
  )

  // Filtered templates
  const filteredTemplates = useMemo(
    () =>
      templates.filter(
        (template) => departmentFilter === 'all' || template.departmentId === departmentFilter
      ),
    [templates, departmentFilter]
  )

  // Handlers
  const handleApply = useCallback(async () => {
    if (!selectedTemplateId || isApplying) return

    try {
      const newStages = await applyTemplateFn({
        templateId: selectedTemplateId,
        sectionId,
        statusId: null, // Server Action will find correct status
      })
      onApply?.(newStages)
      onClose()
    } catch (err) {
      console.error('[TemplateSelectModal] Apply error:', err)
    }
  }, [selectedTemplateId, sectionId, isApplying, applyTemplateFn, onApply, onClose])

  const handleDelete = useCallback(
    async (templateId: string) => {
      try {
        await deleteTemplateFn({ templateId })
        if (selectedTemplateId === templateId) {
          setSelectedTemplateId(null)
        }
        setDeleteConfirmId(null)
      } catch (err) {
        console.error('[TemplateSelectModal] Delete error:', err)
      }
    },
    [deleteTemplateFn, selectedTemplateId]
  )

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'd MMM', { locale: ru })
    } catch {
      return ''
    }
  }

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
              <FileText className="w-4 h-4 text-teal-500" />
              <span className="text-xs font-medium text-slate-300">Применить шаблон</span>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-4 py-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-5 w-5 text-red-500 mb-2" />
                <p className="text-xs text-red-400">Ошибка загрузки шаблонов</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Department filter chips */}
                {departments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDepartmentFilter('all')}
                      className={cn(
                        'px-2 py-1 rounded text-[10px] font-medium',
                        'border transition-all duration-150',
                        departmentFilter === 'all'
                          ? 'border-teal-500/50 bg-teal-500/10 text-teal-400'
                          : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                      )}
                    >
                      Все
                    </button>
                    {departments.map((dept) => (
                      <button
                        key={dept.id}
                        type="button"
                        onClick={() => setDepartmentFilter(dept.id)}
                        className={cn(
                          'px-2 py-1 rounded text-[10px] font-medium',
                          'border transition-all duration-150',
                          departmentFilter === dept.id
                            ? 'border-teal-500/50 bg-teal-500/10 text-teal-400'
                            : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                        )}
                      >
                        {dept.name}
                      </button>
                    ))}
                  </div>
                )}

                {/* Templates list */}
                <div className="max-h-[280px] overflow-y-auto -mx-1 px-1 space-y-1.5">
                  {filteredTemplates.length === 0 ? (
                    <div className="flex items-center justify-center py-8 text-xs text-slate-500">
                      Нет доступных шаблонов
                    </div>
                  ) : (
                    filteredTemplates.map((template) => {
                      const isSelected = selectedTemplateId === template.id
                      const isConfirmingDelete = deleteConfirmId === template.id

                      return (
                        <div
                          key={template.id}
                          className={cn(
                            'group relative p-2.5 rounded-md cursor-pointer',
                            'border transition-all duration-150',
                            isSelected
                              ? 'border-teal-500/50 bg-teal-500/10'
                              : 'border-slate-700/50 bg-slate-800/30 hover:border-slate-600 hover:bg-slate-800/50'
                          )}
                          onClick={() => setSelectedTemplateId(template.id)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                {isSelected && (
                                  <Check className="w-3 h-3 text-teal-500 flex-shrink-0" />
                                )}
                                <span
                                  className={cn(
                                    'text-xs font-medium truncate',
                                    isSelected ? 'text-teal-300' : 'text-slate-300'
                                  )}
                                >
                                  {template.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-500">
                                <span className="truncate">{template.departmentName}</span>
                                <span>·</span>
                                <span className="truncate">{template.creatorName}</span>
                                <span>·</span>
                                <span>{formatDate(template.createdAt)}</span>
                              </div>
                            </div>

                            {/* Delete button */}
                            {hasManagePermission && (
                              <div className="flex-shrink-0">
                                {isConfirmingDelete ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleDelete(template.id)
                                      }}
                                      disabled={isDeleting}
                                      className="px-1.5 py-0.5 text-[9px] font-medium bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                                    >
                                      {isDeleting ? '...' : 'Да'}
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setDeleteConfirmId(null)
                                      }}
                                      className="px-1.5 py-0.5 text-[9px] font-medium bg-slate-700 text-slate-400 rounded hover:bg-slate-600 transition-colors"
                                    >
                                      Нет
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setDeleteConfirmId(template.id)
                                    }}
                                    className="p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-slate-700/50">
            <button
              onClick={onClose}
              disabled={isApplying}
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
              onClick={handleApply}
              disabled={!selectedTemplateId || isApplying}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded',
                'text-slate-900 bg-teal-500 hover:bg-teal-400',
                'transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500'
              )}
            >
              {isApplying ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Применение...
                </>
              ) : (
                <>
                  <FileText className="w-3 h-3" />
                  Применить
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
