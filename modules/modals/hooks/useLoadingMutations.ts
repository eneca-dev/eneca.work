'use client'

/**
 * Loading Modal 2 - Hook для мутаций загрузок
 *
 * Предоставляет операции CRUD для загрузок сотрудников с optimistic updates:
 * - create: создание новой загрузки
 * - update: обновление существующей загрузки
 * - archive: архивация загрузки (soft delete)
 * - delete: удаление загрузки (hard delete)
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/modules/cache'
import {
  createLoading,
  updateLoading,
  archiveLoading,
  deleteLoading,
} from '../actions/loadings'
import type {
  CreateLoadingInput,
  UpdateLoadingInput,
  ArchiveLoadingInput,
  DeleteLoadingInput,
  LoadingResult,
} from '../actions/loadings'

export interface UseLoadingMutationsOptions {
  /** Callback при успешном создании */
  onCreateSuccess?: (data: LoadingResult) => void
  /** Callback при успешном обновлении */
  onUpdateSuccess?: (data: LoadingResult) => void
  /** Callback при успешной архивации */
  onArchiveSuccess?: (data: LoadingResult) => void
  /** Callback при успешном удалении */
  onDeleteSuccess?: (id: string) => void
  /** Callback при ошибке */
  onError?: (error: Error) => void
}

// ============================================================================
// Helper Types
// ============================================================================

interface OptimisticContext {
  previousDepartmentsData?: unknown
  previousResourceGraphData?: unknown
  previousProjectsData?: unknown
}

// ============================================================================
// Main Hook
// ============================================================================

export function useLoadingMutations(options: UseLoadingMutationsOptions = {}) {
  const queryClient = useQueryClient()

  // ==========================================================================
  // CREATE - Создание загрузки с optimistic update
  // ==========================================================================
  const create = useMutation({
    mutationFn: async (input: CreateLoadingInput) => {
      const result = await createLoading(input)

      if (!result.success) {
        throw new Error(result.error)
      }

      return result.data
    },

    // Optimistic update - применяем изменения сразу
    onMutate: async (input: CreateLoadingInput): Promise<OptimisticContext> => {
      // Отменяем все текущие запросы к затронутым кешам
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.departmentsTimeline.all }),
        queryClient.cancelQueries({ queryKey: queryKeys.resourceGraph.all }),
        queryClient.cancelQueries({ queryKey: queryKeys.projects.all }),
      ])

      // Сохраняем снапшот текущих данных для отката при ошибке
      const previousDepartmentsData = queryClient.getQueriesData({
        queryKey: queryKeys.departmentsTimeline.all,
      })
      const previousResourceGraphData = queryClient.getQueriesData({
        queryKey: queryKeys.resourceGraph.all,
      })
      const previousProjectsData = queryClient.getQueriesData({
        queryKey: queryKeys.projects.all,
      })

      // Оптимистично обновляем departments timeline
      // Находим все активные запросы departments timeline и добавляем новую загрузку
      queryClient.setQueriesData(
        { queryKey: queryKeys.departmentsTimeline.lists() },
        (old: any) => {
          // Проверяем что данные вообще есть
          if (!old) {
            console.warn('⚠️ [CREATE onMutate] Нет данных в кеше')
            return old
          }

          // Кеш может быть в двух форматах:
          // 1. Прямой массив departments: [{ id, name, teams: [...] }, ...]
          // 2. Обёрнутый: { success: true, data: [...] }
          const isDirectArray = Array.isArray(old)
          const departments = isDirectArray ? old : old?.data

          if (!departments || !Array.isArray(departments) || departments.length === 0) {
            console.warn('⚠️ [CREATE onMutate] Нет departments в кеше')
            return old
          }

          // Создаём временную загрузку с optimistic ID
          const tempLoading = {
            id: `temp-${Date.now()}-${Math.random()}`,
            employeeId: input.employeeId,
            responsibleId: input.employeeId,
            stageId: input.stageId,
            sectionId: input.stageId, // stageId может быть как stage, так и section
            startDate: input.startDate,
            endDate: input.endDate,
            rate: input.rate,
            comment: input.comment || undefined,
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: null,
            _optimistic: true, // Метка для отладки
          }

          // Добавляем загрузку к соответствующему сотруднику
          const updatedDepartments = departments.map((dept: any) => ({
            ...dept,
            teams: dept.teams.map((team: any) => ({
              ...team,
              employees: team.employees.map((emp: any) => {
                if (emp.id === input.employeeId) {
                  return {
                    ...emp,
                    loadings: [...(emp.loadings || []), tempLoading],
                    hasLoadings: true,
                    loadingsCount: (emp.loadingsCount || 0) + 1,
                  }
                }
                return emp
              }),
            })),
          }))

          // Возвращаем в том же формате, в каком получили
          return isDirectArray ? updatedDepartments : { ...old, data: updatedDepartments }
        }
      )

      console.log('✨ Optimistic create: временная загрузка добавлена в UI')

      return {
        previousDepartmentsData,
        previousResourceGraphData,
        previousProjectsData,
      }
    },

    onSuccess: (data) => {
      console.log('✅ Загрузка успешно создана на сервере:', data.id)

      // Инвалидация кешей для обновления с реальными данными
      queryClient.invalidateQueries({ queryKey: queryKeys.loadings.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.departmentsTimeline.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.resourceGraph.all })

      options.onCreateSuccess?.(data)
    },

    onError: (error: Error, variables, context: OptimisticContext | undefined) => {
      console.error('❌ Ошибка создания загрузки, откатываем optimistic update')

      // Откатываем optimistic updates
      if (context?.previousDepartmentsData) {
        context.previousDepartmentsData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
      if (context?.previousResourceGraphData) {
        context.previousResourceGraphData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
      if (context?.previousProjectsData) {
        context.previousProjectsData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }

      options.onError?.(error)
    },
  })

  // ==========================================================================
  // UPDATE - Обновление загрузки с optimistic update
  // ==========================================================================
  const update = useMutation({
    mutationFn: async (input: UpdateLoadingInput) => {
      const result = await updateLoading(input)

      if (!result.success) {
        throw new Error(result.error)
      }

      return result.data
    },

    // Optimistic update - применяем изменения сразу
    onMutate: async (input: UpdateLoadingInput): Promise<OptimisticContext> => {
      // Отменяем все текущие запросы к затронутым кешам
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.departmentsTimeline.all }),
        queryClient.cancelQueries({ queryKey: queryKeys.resourceGraph.all }),
        queryClient.cancelQueries({ queryKey: queryKeys.projects.all }),
      ])

      // Сохраняем снапшот текущих данных для отката при ошибке
      const previousDepartmentsData = queryClient.getQueriesData({
        queryKey: queryKeys.departmentsTimeline.all,
      })
      const previousResourceGraphData = queryClient.getQueriesData({
        queryKey: queryKeys.resourceGraph.all,
      })
      const previousProjectsData = queryClient.getQueriesData({
        queryKey: queryKeys.projects.all,
      })

      // Оптимистично обновляем departments timeline
      queryClient.setQueriesData(
        { queryKey: queryKeys.departmentsTimeline.lists() },
        (old: any) => {
          // Проверяем что данные вообще есть
          if (!old) {
            console.warn('⚠️ [UPDATE onMutate] Нет данных в кеше')
            return old
          }

          // Кеш может быть в двух форматах:
          // 1. Прямой массив departments: [{ id, name, teams: [...] }, ...]
          // 2. Обёрнутый: { success: true, data: [...] }
          const isDirectArray = Array.isArray(old)
          const departments = isDirectArray ? old : old?.data

          if (!departments || !Array.isArray(departments) || departments.length === 0) {
            console.warn('⚠️ [UPDATE onMutate] Нет departments в кеше')
            return old
          }

          console.log('🔍 [UPDATE onMutate] Найдено departments в кеше:', {
            isDirectArray,
            departmentsCount: departments.length,
            loadingIdToFind: input.loadingId,
          })

          // Обновляем загрузку в departments
          let loadingFound = false
          const updatedDepartments = departments.map((dept: any) => ({
            ...dept,
            teams: dept.teams.map((team: any) => ({
              ...team,
              employees: team.employees.map((emp: any) => ({
                ...emp,
                loadings: (emp.loadings || []).map((loading: any) => {
                  if (loading.id === input.loadingId) {
                    loadingFound = true
                    console.log('✅ [UPDATE onMutate] Найдена загрузка для обновления:', {
                      loadingId: loading.id,
                      oldData: { startDate: loading.startDate, endDate: loading.endDate, rate: loading.rate },
                      newData: { startDate: input.startDate, endDate: input.endDate, rate: input.rate },
                    })
                    return {
                      ...loading,
                      // Обновляем только переданные поля
                      ...(input.employeeId !== undefined && { employeeId: input.employeeId }),
                      ...(input.startDate !== undefined && { startDate: input.startDate }),
                      ...(input.endDate !== undefined && { endDate: input.endDate }),
                      ...(input.rate !== undefined && { rate: input.rate }),
                      ...(input.comment !== undefined && { comment: input.comment }),
                      updatedAt: new Date().toISOString(),
                      _optimistic: true, // Метка для отладки
                    }
                  }
                  return loading
                }),
              })),
            })),
          }))

          if (!loadingFound) {
            console.warn('⚠️ [UPDATE onMutate] Загрузка не найдена в кеше:', input.loadingId)
          } else {
            console.log('✨ [UPDATE onMutate] Optimistic update применён успешно')
          }

          // Возвращаем в том же формате, в каком получили
          return isDirectArray ? updatedDepartments : { ...old, data: updatedDepartments }
        }
      )

      console.log('✨ Optimistic update: загрузка обновлена в UI:', input.loadingId)

      return {
        previousDepartmentsData,
        previousResourceGraphData,
        previousProjectsData,
      }
    },

    onSuccess: (data) => {
      console.log('✅ Загрузка успешно обновлена на сервере:', data.id)

      // Инвалидация кешей для обновления с реальными данными
      queryClient.invalidateQueries({ queryKey: queryKeys.loadings.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.departmentsTimeline.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.resourceGraph.all })

      options.onUpdateSuccess?.(data)
    },

    onError: (error: Error, variables, context: OptimisticContext | undefined) => {
      console.error('❌ Ошибка обновления загрузки, откатываем optimistic update')

      // Откатываем optimistic updates
      if (context?.previousDepartmentsData) {
        context.previousDepartmentsData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
      if (context?.previousResourceGraphData) {
        context.previousResourceGraphData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
      if (context?.previousProjectsData) {
        context.previousProjectsData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }

      options.onError?.(error)
    },
  })

  // ==========================================================================
  // ARCHIVE - Архивация загрузки (без optimistic update, т.к. редко используется)
  // ==========================================================================
  const archive = useMutation({
    mutationFn: async (input: ArchiveLoadingInput) => {
      const result = await archiveLoading(input)

      if (!result.success) {
        throw new Error(result.error)
      }

      return result.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.loadings.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.departmentsTimeline.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.resourceGraph.all })

      options.onArchiveSuccess?.(data)
    },
    onError: (error: Error) => {
      options.onError?.(error)
    },
  })

  // ==========================================================================
  // DELETE - Удаление загрузки (без optimistic update, т.к. редко используется)
  // ==========================================================================
  const remove = useMutation({
    mutationFn: async (input: DeleteLoadingInput) => {
      const result = await deleteLoading(input)

      if (!result.success) {
        throw new Error(result.error)
      }

      return result.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.loadings.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.departmentsTimeline.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.resourceGraph.all })

      options.onDeleteSuccess?.(data.id)
    },
    onError: (error: Error) => {
      options.onError?.(error)
    },
  })

  return {
    create,
    update,
    archive,
    remove,
  }
}

export type {
  CreateLoadingInput,
  UpdateLoadingInput,
  ArchiveLoadingInput,
  DeleteLoadingInput,
  LoadingResult,
}
