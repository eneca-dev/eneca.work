'use client'

/**
 * DeleteSectionModal - Модалка удаления раздела с каскадным удалением
 *
 * Показывает статистику связанных данных и требует двухэтапное подтверждение.
 * Использует оптимистичное обновление для мгновенного отображения.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Loader2, AlertTriangle, Trash2, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'
import { useUiStore } from '@/stores/useUiStore'
import { queryKeys, type CachedPaginatedData } from '@/modules/cache'
import { cn } from '@/lib/utils'
import type { Project } from '@/modules/resource-graph/types'

// Глобальный счётчик операций для защиты от race conditions
let deleteSectionOperationCounter = 0

// ============================================================================
// Types
// ============================================================================

type CachedResourceGraphData = CachedPaginatedData<Project>

export interface DeleteSectionModalProps {
  isOpen: boolean
  onClose: () => void
  sectionId: string
  sectionName: string
  onSuccess?: () => void
}

interface DeleteStats {
  loadings_count: number
  assignments_count: number
  decomposition_items_count: number
  plan_loadings_count: number
  section_comments_count: number
  decomposition_stages_count: number
  tasks_count: number
  budgets_count: number
  checkpoints_count: number
}

// ============================================================================
// Component
// ============================================================================

export function DeleteSectionModal({
  isOpen,
  onClose,
  sectionId,
  sectionName,
  onSuccess,
}: DeleteSectionModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteStats, setDeleteStats] = useState<DeleteStats | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const supabase = useMemo(() => createClient(), [])
  const queryClient = useQueryClient()
  const { setNotification } = useUiStore()
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // Ref для отслеживания актуальности операции (защита от race conditions)
  const currentOperationRef = useRef<number>(0)

  // Escape key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      // Auto-focus close button on open
      closeButtonRef.current?.focus()
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, isDeleting, onClose])

  // Загрузка статистики при открытии
  const loadDeleteStats = useCallback(async () => {
    setIsLoading(true)
    try {
      const [
        loadingsResult,
        assignmentsFromResult,
        assignmentsToResult,
        decompositionItemsResult,
        planLoadingsResult,
        sectionCommentsResult,
        decompositionStagesResult,
        tasksResult,
        budgetsResult,
        checkpointsResult,
      ] = await Promise.all([
        supabase.from('loadings').select('loading_id', { count: 'exact' }).eq('loading_section', sectionId),
        supabase.from('assignments').select('assignment_id', { count: 'exact' }).eq('from_section_id', sectionId),
        supabase.from('assignments').select('assignment_id', { count: 'exact' }).eq('to_section_id', sectionId),
        supabase.from('decomposition_items').select('decomposition_item_id', { count: 'exact' }).eq('decomposition_item_section_id', sectionId),
        supabase.from('plan_loadings').select('plan_loading_id', { count: 'exact' }).eq('plan_loading_section', sectionId),
        supabase.from('section_comments').select('comment_id', { count: 'exact' }).eq('section_id', sectionId),
        supabase.from('decomposition_stages').select('decomposition_stage_id', { count: 'exact' }).eq('decomposition_stage_section_id', sectionId),
        supabase.from('tasks').select('task_id', { count: 'exact' }).eq('task_parent_section', sectionId),
        supabase.from('budgets').select('budget_id', { count: 'exact' }).eq('entity_type', 'section').eq('entity_id', sectionId),
        supabase.from('section_readiness_checkpoints').select('checkpoint_id', { count: 'exact' }).eq('section_id', sectionId),
      ])

      setDeleteStats({
        loadings_count: loadingsResult.count || 0,
        assignments_count: (assignmentsFromResult.count || 0) + (assignmentsToResult.count || 0),
        decomposition_items_count: decompositionItemsResult.count || 0,
        plan_loadings_count: planLoadingsResult.count || 0,
        section_comments_count: sectionCommentsResult.count || 0,
        decomposition_stages_count: decompositionStagesResult.count || 0,
        tasks_count: tasksResult.count || 0,
        budgets_count: budgetsResult.count || 0,
        checkpoints_count: checkpointsResult.count || 0,
      })
    } catch (error) {
      console.error('Ошибка загрузки статистики удаления:', error)
      setNotification('Ошибка загрузки статистики удаления')
    } finally {
      setIsLoading(false)
    }
  }, [sectionId, supabase, setNotification])

  useEffect(() => {
    if (isOpen) {
      loadDeleteStats()
      setShowConfirmation(false)
    }
  }, [isOpen, loadDeleteStats])

  // Удаление раздела
  const handleDelete = async () => {
    if (!deleteStats) return

    setIsDeleting(true)

    // Увеличиваем счётчик операций и сохраняем текущий номер
    const operationId = ++deleteSectionOperationCounter
    currentOperationRef.current = operationId

    // Сохраняем предыдущие данные для отката
    const previousData = queryClient.getQueriesData<CachedResourceGraphData>({
      queryKey: queryKeys.resourceGraph.all,
    })

    // Оптимистично удаляем раздел из кэша
    queryClient.setQueriesData<CachedResourceGraphData>(
      { queryKey: queryKeys.resourceGraph.all },
      (oldData) => {
        if (!oldData?.data) return oldData
        return {
          ...oldData,
          data: oldData.data.map((project) => ({
            ...project,
            objects: project.objects.map((obj) => ({
              ...obj,
              sections: obj.sections.filter((section) => section.id !== sectionId),
            })),
          })),
        }
      }
    )

    // Формируем детальное уведомление
    const deletedItems = []
    if (deleteStats.tasks_count > 0) deletedItems.push(`задач: ${deleteStats.tasks_count}`)
    if (deleteStats.loadings_count > 0) deletedItems.push(`загрузок: ${deleteStats.loadings_count}`)
    if (deleteStats.decomposition_stages_count > 0) deletedItems.push(`этапов: ${deleteStats.decomposition_stages_count}`)
    if (deleteStats.decomposition_items_count > 0) deletedItems.push(`элементов: ${deleteStats.decomposition_items_count}`)

    const detailMessage = deletedItems.length > 0
      ? `Удаляем: ${deletedItems.join(', ')}`
      : ''

    // Сразу закрываем модалку
    setNotification(`Раздел "${sectionName}" удаляется... ${detailMessage}`)
    onClose()

    try {
      // CASCADE автоматически удалит все связанные данные
      const { error: sectionError } = await supabase
        .from('sections')
        .delete()
        .eq('section_id', sectionId)

      if (sectionError) throw sectionError

      // Проверяем результат удаления
      const { data: verification } = await supabase
        .from('sections')
        .select('section_id')
        .eq('section_id', sectionId)
        .single()

      if (verification) {
        throw new Error('Раздел не был удален')
      }

      // Проверяем, что эта операция всё ещё актуальна (защита от race conditions)
      if (currentOperationRef.current !== operationId) {
        console.log(`[SectionDelete] Операция ${operationId} устарела, пропускаем финализацию`)
        return
      }

      // Инвалидируем другие связанные кэши (resourceGraph уже обновлён оптимистично)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.sections.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all }),
      ])

      const successMessage = deletedItems.length > 0
        ? `Также удалено: ${deletedItems.join(', ')}`
        : 'Связанных данных не было'

      setNotification(`Раздел "${sectionName}" успешно удален. ${successMessage}`)
      onSuccess?.()
    } catch (error) {
      console.error('Ошибка удаления раздела:', error)

      // Откатываем только если эта операция всё ещё актуальна
      if (currentOperationRef.current === operationId) {
        for (const [queryKey, data] of previousData) {
          queryClient.setQueryData(queryKey, data)
        }
        setNotification(error instanceof Error ? error.message : 'Ошибка удаления раздела')
      } else {
        console.log(`[SectionDelete] Операция ${operationId} устарела, пропускаем откат`)
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const totalRelatedItems = deleteStats
    ? deleteStats.loadings_count +
      deleteStats.assignments_count +
      deleteStats.decomposition_items_count +
      deleteStats.plan_loadings_count +
      deleteStats.section_comments_count +
      deleteStats.decomposition_stages_count +
      deleteStats.tasks_count +
      deleteStats.budgets_count +
      deleteStats.checkpoints_count
    : 0

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
        aria-labelledby="delete-section-title"
        className={cn(
          'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
          'w-full max-w-md',
          'bg-card/95 backdrop-blur-md',
          'border border-border/50',
          'rounded-lg shadow-2xl shadow-black/50',
          'transform transition-all duration-200'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span id="delete-section-title" className="text-xs font-medium text-foreground">
              Удаление раздела
            </span>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
              {sectionName}
            </span>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            disabled={isDeleting}
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors focus:outline-none focus:ring-1 focus:ring-border/50"
            aria-label="Закрыть"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-6 gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Загрузка информации...</span>
            </div>
          ) : deleteStats ? (
            <div className="space-y-3">
              {/* Warning */}
              <div className="flex items-start gap-2.5 p-3 bg-red-500/10 rounded border border-red-500/20">
                <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-red-300">
                    <strong>Внимание!</strong> Это действие необратимо. Будет удалён раздел и все связанные с ним данные.
                  </p>
                </div>
              </div>

              {/* Stats */}
              {totalRelatedItems > 0 && (
                <div className="bg-muted/50 rounded border border-border/50 p-3">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Также будет удалено
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    {deleteStats.loadings_count > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Загрузки</span>
                        <span className="text-foreground font-mono">{deleteStats.loadings_count}</span>
                      </div>
                    )}
                    {deleteStats.assignments_count > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Задания</span>
                        <span className="text-foreground font-mono">{deleteStats.assignments_count}</span>
                      </div>
                    )}
                    {deleteStats.decomposition_stages_count > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Этапы</span>
                        <span className="text-foreground font-mono">{deleteStats.decomposition_stages_count}</span>
                      </div>
                    )}
                    {deleteStats.decomposition_items_count > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Декомпозиция</span>
                        <span className="text-foreground font-mono">{deleteStats.decomposition_items_count}</span>
                      </div>
                    )}
                    {deleteStats.tasks_count > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Задачи</span>
                        <span className="text-foreground font-mono">{deleteStats.tasks_count}</span>
                      </div>
                    )}
                    {deleteStats.budgets_count > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Бюджеты</span>
                        <span className="text-foreground font-mono">{deleteStats.budgets_count}</span>
                      </div>
                    )}
                    {deleteStats.section_comments_count > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Комментарии</span>
                        <span className="text-foreground font-mono">{deleteStats.section_comments_count}</span>
                      </div>
                    )}
                    {deleteStats.checkpoints_count > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Контр. точки</span>
                        <span className="text-foreground font-mono">{deleteStats.checkpoints_count}</span>
                      </div>
                    )}
                    {deleteStats.plan_loadings_count > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">План загрузки</span>
                        <span className="text-foreground font-mono">{deleteStats.plan_loadings_count}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Confirmation step */}
              {showConfirmation && (
                <div className="p-3 bg-red-500/10 rounded border border-red-500/20">
                  <p className="text-xs text-red-300">
                    Подтвердите удаление раздела <strong>"{sectionName}"</strong>
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-xs text-muted-foreground py-6">
              Ошибка загрузки данных
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-border/50">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className={cn(
              'px-3 py-1.5 text-[11px] font-medium rounded',
              'text-muted-foreground hover:text-foreground',
              'border border-border hover:border-border',
              'bg-muted/50 hover:bg-muted',
              'transition-colors',
              'focus:outline-none focus:ring-1 focus:ring-border/50',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            Отмена
          </button>

          {!showConfirmation ? (
            <button
              onClick={() => setShowConfirmation(true)}
              disabled={isLoading || !deleteStats}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded',
                'text-red-400 border border-red-500/30',
                'bg-red-500/10 hover:bg-red-500/20',
                'transition-colors',
                'focus:outline-none focus:ring-1 focus:ring-red-500/50',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <Trash2 className="w-3 h-3" />
              Подтвердить удаление
            </button>
          ) : (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded',
                'text-white bg-red-600 hover:bg-red-500',
                'transition-colors',
                'focus:outline-none focus:ring-1 focus:ring-red-500/50',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isDeleting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Trash2 className="w-3 h-3" />
              )}
              {isDeleting ? 'Удаление...' : 'Удалить раздел'}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
