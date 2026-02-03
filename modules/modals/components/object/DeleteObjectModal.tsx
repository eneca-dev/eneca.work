'use client'

/**
 * DeleteObjectModal - Модалка удаления объекта с каскадным удалением
 *
 * Показывает статистику связанных данных и требует двухэтапное подтверждение.
 * Использует оптимистичное обновление для мгновенного отображения.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Loader2, AlertTriangle, Trash2, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'
import { useUiStore } from '@/stores/useUiStore'
import { queryKeys } from '@/modules/cache'
import { cn } from '@/lib/utils'
import type { Project } from '@/modules/resource-graph/types'

// Глобальный счётчик операций для защиты от race conditions
let deleteOperationCounter = 0

// ============================================================================
// Types
// ============================================================================

/**
 * Тип кешированных данных Resource Graph (с пагинацией)
 */
type CachedResourceGraphData = {
  success: true
  data: Project[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export interface DeleteObjectModalProps {
  isOpen: boolean
  onClose: () => void
  objectId: string
  objectName: string
  onSuccess?: () => void
}

interface DeleteStats {
  sections_count: number
  loadings_count: number
  assignments_count: number
  tasks_count: number
  budgets_count: number
  decomposition_stages_count: number
  decomposition_items_count: number
  work_logs_count: number
}

// ============================================================================
// Component
// ============================================================================

export function DeleteObjectModal({
  isOpen,
  onClose,
  objectId,
  objectName,
  onSuccess,
}: DeleteObjectModalProps) {
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
      closeButtonRef.current?.focus()
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, isDeleting, onClose])

  // Загрузка статистики при открытии
  const loadDeleteStats = useCallback(async () => {
    setIsLoading(true)
    try {
      // Получаем разделы объекта
      const { data: sections, count: sectionsCount } = await supabase
        .from('sections')
        .select('section_id', { count: 'exact' })
        .eq('section_object_id', objectId)

      const sectionIds = sections?.map(s => s.section_id) || []

      let loadingsCount = 0
      let assignmentsCount = 0
      let tasksCount = 0
      let decompositionStagesCount = 0
      let decompositionItemsCount = 0
      let workLogsCount = 0
      let budgetsCount = 0

      if (sectionIds.length > 0) {
        const [
          loadingsResult,
          assignmentsResult,
          tasksResult,
          stagesResult,
          itemsResult,
          sectionBudgetsResult,
        ] = await Promise.all([
          supabase.from('loadings').select('loading_id', { count: 'exact' }).in('loading_section', sectionIds),
          supabase.from('assignments').select('assignment_id', { count: 'exact' }).in('from_section_id', sectionIds),
          supabase.from('tasks').select('task_id', { count: 'exact' }).in('task_parent_section', sectionIds),
          supabase.from('decomposition_stages').select('decomposition_stage_id', { count: 'exact' }).in('decomposition_stage_section_id', sectionIds),
          supabase.from('decomposition_items').select('decomposition_item_id', { count: 'exact' }).in('decomposition_item_section_id', sectionIds),
          supabase.from('budgets').select('budget_id', { count: 'exact' }).eq('entity_type', 'section').in('entity_id', sectionIds),
        ])

        loadingsCount = loadingsResult.count || 0
        assignmentsCount = assignmentsResult.count || 0
        tasksCount = tasksResult.count || 0
        decompositionStagesCount = stagesResult.count || 0
        decompositionItemsCount = itemsResult.count || 0
        budgetsCount += sectionBudgetsResult.count || 0

        // Считаем бюджеты этапов декомпозиции
        if (stagesResult.data && stagesResult.data.length > 0) {
          const stageIds = stagesResult.data.map(s => s.decomposition_stage_id)
          const { count: stageBudgetsCount } = await supabase
            .from('budgets')
            .select('budget_id', { count: 'exact' })
            .eq('entity_type', 'decomposition_stage')
            .in('entity_id', stageIds)
          budgetsCount += stageBudgetsCount || 0
        }

        // Считаем бюджеты задач декомпозиции
        if (itemsResult.data && itemsResult.data.length > 0) {
          const itemIds = itemsResult.data.map(i => i.decomposition_item_id)
          const { count: itemBudgetsCount } = await supabase
            .from('budgets')
            .select('budget_id', { count: 'exact' })
            .eq('entity_type', 'decomposition_item')
            .in('entity_id', itemIds)
          budgetsCount += itemBudgetsCount || 0
        }

        // Получаем work_logs через decomposition_items
        if (itemsResult.data && itemsResult.data.length > 0) {
          const itemIds = itemsResult.data.map(i => i.decomposition_item_id)
          const { count } = await supabase
            .from('work_logs')
            .select('work_log_id', { count: 'exact' })
            .in('decomposition_item_id', itemIds)
          workLogsCount = count || 0
        }
      }

      // Бюджеты объекта
      const { count: objectBudgetsCount } = await supabase
        .from('budgets')
        .select('budget_id', { count: 'exact' })
        .eq('entity_type', 'object')
        .eq('entity_id', objectId)
      budgetsCount += objectBudgetsCount || 0

      setDeleteStats({
        sections_count: sectionsCount || 0,
        loadings_count: loadingsCount,
        assignments_count: assignmentsCount,
        tasks_count: tasksCount,
        budgets_count: budgetsCount,
        decomposition_stages_count: decompositionStagesCount,
        decomposition_items_count: decompositionItemsCount,
        work_logs_count: workLogsCount,
      })
    } catch (error) {
      console.error('Ошибка загрузки статистики удаления:', error)
      setNotification('Ошибка загрузки статистики удаления')
    } finally {
      setIsLoading(false)
    }
  }, [objectId, supabase, setNotification])

  useEffect(() => {
    if (isOpen) {
      loadDeleteStats()
      setShowConfirmation(false)
    }
  }, [isOpen, loadDeleteStats])

  // Удаление объекта
  const handleDelete = async () => {
    if (!deleteStats) return

    setIsDeleting(true)

    // Увеличиваем счётчик операций и сохраняем текущий номер
    const operationId = ++deleteOperationCounter
    currentOperationRef.current = operationId

    // Сохраняем предыдущие данные для отката
    const previousData = queryClient.getQueriesData<CachedResourceGraphData>({
      queryKey: queryKeys.resourceGraph.all,
    })

    // Оптимистично удаляем объект из кэша
    queryClient.setQueriesData<CachedResourceGraphData>(
      { queryKey: queryKeys.resourceGraph.all },
      (oldData) => {
        if (!oldData?.data) return oldData
        return {
          ...oldData,
          data: oldData.data.map((project) => ({
            ...project,
            objects: project.objects.filter((obj) => obj.id !== objectId),
          })),
        }
      }
    )

    // Формируем уведомление
    const deletedItems = []
    if (deleteStats.sections_count > 0) deletedItems.push(`разделов: ${deleteStats.sections_count}`)
    if (deleteStats.decomposition_stages_count > 0) deletedItems.push(`этапов: ${deleteStats.decomposition_stages_count}`)
    if (deleteStats.decomposition_items_count > 0) deletedItems.push(`задач: ${deleteStats.decomposition_items_count}`)
    if (deleteStats.budgets_count > 0) deletedItems.push(`бюджетов: ${deleteStats.budgets_count}`)

    const detailMessage = deletedItems.length > 0
      ? `Удаляем: ${deletedItems.join(', ')}`
      : ''

    // Сразу закрываем модалку
    setNotification(`Объект "${objectName}" удаляется... ${detailMessage}`)
    onClose()

    try {
      // Получаем все разделы объекта
      const { data: sections } = await supabase
        .from('sections')
        .select('section_id')
        .eq('section_object_id', objectId)

      const sectionIds = sections?.map(s => s.section_id) || []

      if (sectionIds.length > 0) {
        // Получаем все decomposition_items для разделов
        const { data: items } = await supabase
          .from('decomposition_items')
          .select('decomposition_item_id')
          .in('decomposition_item_section_id', sectionIds)

        const itemIds = items?.map(i => i.decomposition_item_id) || []

        // Удаляем work_logs для decomposition_items
        if (itemIds.length > 0) {
          await supabase.from('work_logs').delete().in('decomposition_item_id', itemIds)

          // Получаем бюджеты задач декомпозиции для удаления budget_parts
          const { data: itemBudgets } = await supabase
            .from('budgets')
            .select('budget_id')
            .eq('entity_type', 'decomposition_item')
            .in('entity_id', itemIds)

          const itemBudgetIds = itemBudgets?.map(b => b.budget_id) || []

          // Удаляем budget_parts для бюджетов задач
          if (itemBudgetIds.length > 0) {
            await supabase.from('budget_parts').delete().in('budget_id', itemBudgetIds)
          }

          // Удаляем бюджеты задач декомпозиции
          await supabase.from('budgets').delete().eq('entity_type', 'decomposition_item').in('entity_id', itemIds)
        }

        // Получаем бюджеты разделов для удаления budget_parts
        const { data: sectionBudgets } = await supabase
          .from('budgets')
          .select('budget_id')
          .eq('entity_type', 'section')
          .in('entity_id', sectionIds)

        const sectionBudgetIds = sectionBudgets?.map(b => b.budget_id) || []

        // Удаляем budget_parts для бюджетов разделов
        if (sectionBudgetIds.length > 0) {
          await supabase.from('budget_parts').delete().in('budget_id', sectionBudgetIds)
        }

        // Удаляем бюджеты разделов
        await supabase.from('budgets').delete().eq('entity_type', 'section').in('entity_id', sectionIds)

        // Удаляем decomposition_items
        await supabase.from('decomposition_items').delete().in('decomposition_item_section_id', sectionIds)

        // Получаем decomposition_stages для удаления их бюджетов
        const { data: stages } = await supabase
          .from('decomposition_stages')
          .select('decomposition_stage_id')
          .in('decomposition_stage_section_id', sectionIds)

        if (stages && stages.length > 0) {
          const stageIds = stages.map(s => s.decomposition_stage_id)

          // Получаем бюджеты этапов для удаления budget_parts
          const { data: stageBudgets } = await supabase
            .from('budgets')
            .select('budget_id')
            .eq('entity_type', 'decomposition_stage')
            .in('entity_id', stageIds)

          const stageBudgetIds = stageBudgets?.map(b => b.budget_id) || []

          // Удаляем budget_parts для бюджетов этапов
          if (stageBudgetIds.length > 0) {
            await supabase.from('budget_parts').delete().in('budget_id', stageBudgetIds)
          }

          // Удаляем бюджеты этапов
          await supabase.from('budgets').delete().eq('entity_type', 'decomposition_stage').in('entity_id', stageIds)
        }

        // Удаляем decomposition_stages
        await supabase.from('decomposition_stages').delete().in('decomposition_stage_section_id', sectionIds)

        // Удаляем plan_loadings
        const { data: loadings } = await supabase
          .from('loadings')
          .select('loading_id')
          .in('loading_section', sectionIds)

        if (loadings && loadings.length > 0) {
          const loadingIds = loadings.map(l => l.loading_id)
          await supabase.from('plan_loadings').delete().in('plan_loading_id', loadingIds)
        }

        // Удаляем assignments
        await supabase.from('assignments').delete().in('from_section_id', sectionIds)

        // Удаляем tasks
        await supabase.from('tasks').delete().in('task_parent_section', sectionIds)

        // Удаляем loadings
        await supabase.from('loadings').delete().in('loading_section', sectionIds)

        // Удаляем sections
        await supabase.from('sections').delete().in('section_id', sectionIds)
      }

      // Получаем бюджеты объекта для удаления budget_parts
      const { data: objectBudgets } = await supabase
        .from('budgets')
        .select('budget_id')
        .eq('entity_type', 'object')
        .eq('entity_id', objectId)

      const objectBudgetIds = objectBudgets?.map(b => b.budget_id) || []

      // Удаляем budget_parts для бюджетов объекта
      if (objectBudgetIds.length > 0) {
        await supabase.from('budget_parts').delete().in('budget_id', objectBudgetIds)
      }

      // Удаляем бюджеты объекта
      await supabase.from('budgets').delete().eq('entity_type', 'object').eq('entity_id', objectId)

      // Удаляем сам объект
      const { error: deleteError } = await supabase
        .from('objects')
        .delete()
        .eq('object_id', objectId)

      if (deleteError) throw deleteError

      // Проверяем что объект удален
      const { data: verification } = await supabase
        .from('objects')
        .select('object_id')
        .eq('object_id', objectId)
        .single()

      if (verification) {
        throw new Error('Объект не был удален')
      }

      // Проверяем, что эта операция всё ещё актуальна (защита от race conditions)
      if (currentOperationRef.current !== operationId) {
        console.log(`[ObjectDelete] Операция ${operationId} устарела, пропускаем финализацию`)
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

      setNotification(`Объект "${objectName}" успешно удален. ${successMessage}`)
      onSuccess?.()
    } catch (error) {
      console.error('Ошибка удаления объекта:', error)

      // Откатываем только если эта операция всё ещё актуальна
      if (currentOperationRef.current === operationId) {
        for (const [queryKey, data] of previousData) {
          queryClient.setQueryData(queryKey, data)
        }
        setNotification(error instanceof Error ? error.message : 'Ошибка удаления объекта')
      } else {
        console.log(`[ObjectDelete] Операция ${operationId} устарела, пропускаем откат`)
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const totalRelatedItems = deleteStats
    ? deleteStats.sections_count +
      deleteStats.loadings_count +
      deleteStats.assignments_count +
      deleteStats.decomposition_items_count +
      deleteStats.decomposition_stages_count +
      deleteStats.tasks_count +
      deleteStats.budgets_count +
      deleteStats.work_logs_count
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
        aria-labelledby="delete-object-title"
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
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span id="delete-object-title" className="text-xs font-medium text-slate-300">
              Удаление объекта
            </span>
            <span className="text-[10px] text-slate-500">·</span>
            <span className="text-[10px] text-slate-400 truncate max-w-[200px]">
              {objectName}
            </span>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            disabled={isDeleting}
            className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-slate-600/50"
            aria-label="Закрыть"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-6 gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              <span className="text-xs text-slate-400">Загрузка информации...</span>
            </div>
          ) : deleteStats ? (
            <div className="space-y-3">
              {/* Warning */}
              <div className="flex items-start gap-2.5 p-3 bg-red-500/10 rounded border border-red-500/20">
                <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-red-300">
                    <strong>Внимание!</strong> Это действие необратимо. Будет удалён объект и все связанные с ним данные.
                  </p>
                </div>
              </div>

              {/* Stats */}
              {totalRelatedItems > 0 && (
                <div className="bg-slate-800/50 rounded border border-slate-700/50 p-3">
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-2">
                    Также будет удалено
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    {deleteStats.sections_count > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Разделы</span>
                        <span className="text-slate-300 font-mono">{deleteStats.sections_count}</span>
                      </div>
                    )}
                    {deleteStats.decomposition_stages_count > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Этапы</span>
                        <span className="text-slate-300 font-mono">{deleteStats.decomposition_stages_count}</span>
                      </div>
                    )}
                    {deleteStats.decomposition_items_count > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Элементы</span>
                        <span className="text-slate-300 font-mono">{deleteStats.decomposition_items_count}</span>
                      </div>
                    )}
                    {deleteStats.tasks_count > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Задачи</span>
                        <span className="text-slate-300 font-mono">{deleteStats.tasks_count}</span>
                      </div>
                    )}
                    {deleteStats.loadings_count > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Загрузки</span>
                        <span className="text-slate-300 font-mono">{deleteStats.loadings_count}</span>
                      </div>
                    )}
                    {deleteStats.budgets_count > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Бюджеты</span>
                        <span className="text-slate-300 font-mono">{deleteStats.budgets_count}</span>
                      </div>
                    )}
                    {deleteStats.work_logs_count > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Логи работ</span>
                        <span className="text-slate-300 font-mono">{deleteStats.work_logs_count}</span>
                      </div>
                    )}
                    {deleteStats.assignments_count > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Назначения</span>
                        <span className="text-slate-300 font-mono">{deleteStats.assignments_count}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Confirmation step */}
              {showConfirmation && (
                <div className="p-3 bg-red-500/10 rounded border border-red-500/20">
                  <p className="text-xs text-red-300">
                    Подтвердите удаление объекта <strong>"{objectName}"</strong>
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-xs text-slate-500 py-6">
              Ошибка загрузки данных
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-slate-700/50">
          <button
            onClick={onClose}
            disabled={isDeleting}
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
              {isDeleting ? 'Удаление...' : 'Удалить объект'}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
