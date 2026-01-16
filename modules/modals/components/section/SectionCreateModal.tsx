'use client'

/**
 * SectionCreateModal - Модалка создания нового раздела
 *
 * Позволяет создать раздел в объекте с указанием названия и описания.
 * Использует оптимистичное обновление для мгновенного отображения.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { X, FileText, Loader2, AlertCircle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'
import { useUiStore } from '@/stores/useUiStore'
import { queryKeys } from '@/modules/cache'
import { cn } from '@/lib/utils'
import type { Project, Section } from '@/modules/resource-graph/types'

// Глобальный счётчик операций для защиты от race conditions
let createSectionOperationCounter = 0

// ============================================================================
// Types
// ============================================================================

export interface SectionCreateModalProps {
  isOpen: boolean
  onClose: () => void
  /** ID объекта, в котором создаётся раздел */
  objectId: string
  /** Название объекта для отображения */
  objectName: string
  onSuccess?: () => void
}

// ============================================================================
// Component
// ============================================================================

export function SectionCreateModal({
  isOpen,
  onClose,
  objectId,
  objectName,
  onSuccess,
}: SectionCreateModalProps) {
  const [sectionName, setSectionName] = useState('')
  const [sectionDescription, setSectionDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = useMemo(() => createClient(), [])
  const queryClient = useQueryClient()
  const { setNotification } = useUiStore()
  const inputRef = useRef<HTMLInputElement>(null)

  // Ref для отслеживания актуальности операции (защита от race conditions)
  const currentOperationRef = useRef<number>(0)

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setSectionName('')
      setSectionDescription('')
      setError(null)
      // Delay focus to ensure modal is visible
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Escape key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isCreating) {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, isCreating, onClose])

  const isFormValid = sectionName.trim().length > 0

  const handleSubmit = useCallback(async () => {
    if (!isFormValid || isCreating) return

    setIsCreating(true)
    setError(null)

    // Увеличиваем счётчик операций и сохраняем текущий номер
    const operationId = ++createSectionOperationCounter
    currentOperationRef.current = operationId

    const trimmedName = sectionName.trim()

    // Создаём временный раздел для оптимистичного обновления
    const tempId = `temp-${operationId}`
    const optimisticSection: Section = {
      id: tempId,
      name: trimmedName,
      description: sectionDescription.trim() || null,
      startDate: null,
      endDate: null,
      responsible: {
        id: null,
        firstName: null,
        lastName: null,
        name: null,
        avatarUrl: null,
      },
      status: {
        id: null,
        name: null,
        color: null,
      },
      readinessCheckpoints: [],
      actualReadiness: [],
      budgetSpending: [],
      decompositionStages: [],
    }

    // Сохраняем предыдущие данные для отката
    const previousData = queryClient.getQueriesData<Project[]>({
      queryKey: queryKeys.resourceGraph.all,
    })

    // Оптимистично добавляем раздел в кэш
    queryClient.setQueriesData<Project[]>(
      { queryKey: queryKeys.resourceGraph.all },
      (oldData) => {
        if (!oldData) return oldData
        return oldData.map((project) => ({
          ...project,
          objects: project.objects.map((obj) =>
            obj.id === objectId
              ? { ...obj, sections: [...obj.sections, optimisticSection] }
              : obj
          ),
        }))
      }
    )

    // Сразу закрываем модалку и показываем уведомление
    setNotification(`Раздел "${trimmedName}" создаётся...`)
    onClose()

    try {
      // Получаем project_id из объекта
      const { data: objectData, error: objectError } = await supabase
        .from('objects')
        .select('object_project_id')
        .eq('object_id', objectId)
        .single()

      if (objectError || !objectData?.object_project_id) {
        throw new Error('Не удалось получить проект объекта')
      }

      const { data, error: insertError } = await supabase
        .from('sections')
        .insert({
          section_name: trimmedName,
          section_description: sectionDescription.trim() || null,
          section_object_id: objectId,
          section_project_id: objectData.object_project_id,
        })
        .select('section_id, section_name')
        .single()

      if (insertError) {
        throw new Error(insertError.message)
      }

      // Проверяем, что эта операция всё ещё актуальна (защита от race conditions)
      if (currentOperationRef.current !== operationId) {
        console.log(`[SectionCreate] Операция ${operationId} устарела, пропускаем обновление кэша`)
        return
      }

      // Обновляем кэш с реальным ID
      queryClient.setQueriesData<Project[]>(
        { queryKey: queryKeys.resourceGraph.all },
        (oldData) => {
          if (!oldData) return oldData
          return oldData.map((project) => ({
            ...project,
            objects: project.objects.map((obj) =>
              obj.id === objectId
                ? {
                    ...obj,
                    sections: obj.sections.map((section) =>
                      section.id === tempId ? { ...section, id: data.section_id } : section
                    ),
                  }
                : obj
            ),
          }))
        }
      )

      // Инвалидируем связанные кэши
      // budgets.all - для загрузки автоматически созданного бюджета (триггер)
      // resourceGraph.all - для полного обновления иерархии с бюджетами
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.sections.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.resourceGraph.all }),
      ])

      setNotification(`Раздел "${data.section_name}" успешно создан`)
      onSuccess?.()
    } catch (err) {
      console.error('Ошибка создания раздела:', err)

      // Откатываем только если эта операция всё ещё актуальна
      if (currentOperationRef.current === operationId) {
        for (const [queryKey, data] of previousData) {
          queryClient.setQueryData(queryKey, data)
        }
        setNotification(err instanceof Error ? err.message : 'Ошибка создания раздела')
      } else {
        console.log(`[SectionCreate] Операция ${operationId} устарела, пропускаем откат`)
      }
    } finally {
      setIsCreating(false)
    }
  }, [isFormValid, isCreating, supabase, sectionName, sectionDescription, objectId, queryClient, setNotification, onSuccess, onClose])

  // Handle Enter key
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && isFormValid && !isCreating) {
      e.preventDefault()
      handleSubmit()
    }
  }, [isFormValid, isCreating, handleSubmit])

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-section-title"
        className={cn(
          'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
          'w-full max-w-md',
          'bg-slate-900/95 backdrop-blur-md',
          'border border-slate-700/50',
          'rounded-lg shadow-2xl shadow-black/50',
          'transform transition-all duration-200'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-teal-500" />
            <span id="create-section-title" className="text-xs font-medium text-slate-300">
              Создать раздел
            </span>
            <span className="text-[10px] text-slate-500">·</span>
            <span className="text-[10px] text-slate-400 truncate max-w-[200px]" title={objectName}>
              Объект: {objectName}
            </span>
          </div>
          <button
            onClick={onClose}
            disabled={isCreating}
            className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-slate-600/50"
            aria-label="Закрыть"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3">
          <div className="space-y-3">
            {/* Section Name */}
            <div>
              <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1.5">
                Название раздела *
              </label>
              <input
                ref={inputRef}
                type="text"
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Введите название раздела"
                disabled={isCreating}
                className={cn(
                  'w-full px-2.5 py-1.5 text-xs',
                  'bg-slate-800/50 border border-slate-700',
                  'rounded text-slate-200',
                  'placeholder:text-slate-600',
                  'focus:outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600/50',
                  'transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              />
            </div>

            {/* Section Description */}
            <div>
              <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1.5">
                Описание
              </label>
              <textarea
                value={sectionDescription}
                onChange={(e) => setSectionDescription(e.target.value)}
                placeholder="Необязательное описание раздела"
                disabled={isCreating}
                rows={2}
                className={cn(
                  'w-full px-2.5 py-1.5 text-xs',
                  'bg-slate-800/50 border border-slate-700',
                  'rounded text-slate-200',
                  'placeholder:text-slate-600',
                  'focus:outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600/50',
                  'transition-colors resize-none',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              />
            </div>

            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-red-400 bg-red-500/10 border border-red-500/30 rounded">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-slate-700/50">
          <button
            onClick={onClose}
            disabled={isCreating}
            className={cn(
              'px-3 py-1.5 text-[11px] font-medium rounded',
              'text-slate-400 hover:text-slate-300',
              'border border-slate-700 hover:border-slate-600',
              'bg-slate-800/50 hover:bg-slate-800',
              'transition-colors',
              'focus:outline-none focus:ring-1 focus:ring-slate-600/50',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isFormValid || isCreating}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded',
              'text-slate-900 bg-teal-500 hover:bg-teal-400',
              'transition-colors',
              'focus:outline-none focus:ring-1 focus:ring-teal-500/50',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500'
            )}
          >
            {isCreating ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Создание...
              </>
            ) : (
              <>
                <FileText className="w-3 h-3" />
                Создать
              </>
            )}
          </button>
        </div>
      </div>
    </>
  )
}
