'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { X, Save, Loader2, Check, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useDepartmentsList,
  useCreateTemplate,
  type TemplateStage,
} from '@/modules/dec-templates'
import type { BaseModalProps } from '../../types'

// ============================================================================
// Types
// ============================================================================

export interface TemplateSaveModalProps extends BaseModalProps {
  /** Этапы для сохранения в шаблон */
  stages: TemplateStage[]
  /** ID отдела пользователя для предвыбора */
  defaultDepartmentId?: string
}

// ============================================================================
// Component
// ============================================================================

export function TemplateSaveModal({
  isOpen,
  onClose,
  onSuccess,
  stages,
  defaultDepartmentId,
}: TemplateSaveModalProps) {
  // State
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('')
  const [templateName, setTemplateName] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  // Queries & Mutations
  const { data: departments = [], isLoading: isDepsLoading } = useDepartmentsList({
    enabled: isOpen,
  })
  const { mutateAsync: createTemplateFn, isPending: isSaving } = useCreateTemplate()

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setTemplateName('')
      setValidationError(null)
      // Pre-select user's department
      if (defaultDepartmentId && departments.length > 0) {
        const exists = departments.some((d) => d.id === defaultDepartmentId)
        setSelectedDepartmentId(exists ? defaultDepartmentId : '')
      } else {
        setSelectedDepartmentId('')
      }
    }
  }, [isOpen, defaultDepartmentId, departments])

  // Pre-select department when departments load
  useEffect(() => {
    if (isOpen && !selectedDepartmentId && defaultDepartmentId && departments.length > 0) {
      const exists = departments.some((d) => d.id === defaultDepartmentId)
      if (exists) {
        setSelectedDepartmentId(defaultDepartmentId)
      }
    }
  }, [isOpen, defaultDepartmentId, departments, selectedDepartmentId])

  // Validation
  const isFormValid = useMemo(() => {
    return selectedDepartmentId.trim() !== '' && templateName.trim() !== ''
  }, [selectedDepartmentId, templateName])

  // Stats
  const stagesCount = stages.length
  const itemsCount = stages.reduce((sum, s) => sum + s.items.length, 0)

  // Handlers
  const handleSave = useCallback(async () => {
    if (!isFormValid || isSaving) return

    if (stages.length === 0) {
      setValidationError('Нет этапов для сохранения')
      return
    }

    setValidationError(null)

    try {
      await createTemplateFn({
        name: templateName.trim(),
        departmentId: selectedDepartmentId,
        stages,
      })
      onSuccess?.()
      onClose()
    } catch (err) {
      console.error('[TemplateSaveModal] Save error:', err)
      setValidationError(err instanceof Error ? err.message : 'Ошибка сохранения')
    }
  }, [
    isFormValid,
    isSaving,
    stages,
    templateName,
    selectedDepartmentId,
    createTemplateFn,
    onSuccess,
    onClose,
  ])

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
            'pointer-events-auto w-full max-w-sm',
            'bg-card/95 backdrop-blur-md',
            'border border-border/50',
            'rounded-lg shadow-2xl shadow-black/50',
            'transform transition-all duration-200',
            isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
            <div className="flex items-center gap-2">
              <Save className="w-4 h-4 text-teal-500" />
              <span className="text-xs font-medium text-foreground">Сохранить как шаблон</span>
              <span className="text-[10px] text-muted-foreground">·</span>
              <span className="text-[10px] text-muted-foreground">
                {stagesCount} эт. · {itemsCount} зад.
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-4 py-3 space-y-4">
            {isDepsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Template Name */}
                <div>
                  <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                    Название шаблона
                  </label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Например: Стандартная задача"
                    className={cn(
                      'w-full px-2.5 py-2 text-xs',
                      'bg-muted border border-border',
                      'rounded text-foreground',
                      'placeholder:text-muted-foreground',
                      'focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/30',
                      'transition-colors'
                    )}
                    disabled={isSaving}
                    autoFocus
                  />
                </div>

                {/* Department chips */}
                <div>
                  <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                    Отдел
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto">
                    {departments.map((dept) => {
                      const isSelected = selectedDepartmentId === dept.id
                      return (
                        <button
                          key={dept.id}
                          type="button"
                          onClick={() => setSelectedDepartmentId(dept.id)}
                          disabled={isSaving}
                          className={cn(
                            'flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium',
                            'border transition-all duration-150',
                            isSelected
                              ? 'border-teal-500/50 bg-teal-500/10 text-teal-400'
                              : 'border-border bg-muted text-muted-foreground hover:border-border',
                            'disabled:opacity-50 disabled:cursor-not-allowed'
                          )}
                        >
                          {dept.name}
                          {isSelected && <Check className="w-2.5 h-2.5 text-teal-500" />}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Validation error */}
                {validationError && (
                  <div className="flex items-center gap-1.5 text-[10px] text-red-400">
                    <AlertCircle className="w-3 h-3" />
                    <span>{validationError}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-border/50">
            <button
              onClick={onClose}
              disabled={isSaving}
              className={cn(
                'px-3 py-1.5 text-[11px] font-medium rounded',
                'text-muted-foreground hover:text-foreground',
                'border border-border hover:border-border',
                'bg-muted hover:bg-muted',
                'transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              disabled={!isFormValid || isSaving}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded',
                'text-slate-900 bg-teal-500 hover:bg-teal-400',
                'transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground'
              )}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  <Save className="w-3 h-3" />
                  Сохранить
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
