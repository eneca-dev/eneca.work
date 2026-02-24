'use client'

/**
 * Loading Modal New - Hook для мутаций загрузок
 *
 * Предоставляет операции CRUD для загрузок сотрудников с optimistic updates:
 * - create: создание новой загрузки с немедленным отображением в UI
 * - update: обновление существующей загрузки с немедленным отражением изменений
 * - archive: архивация загрузки (soft delete) с немедленным удалением из UI
 * - delete: удаление загрузки (hard delete) с немедленным удалением из UI
 *
 * Все операции применяют изменения к UI сразу же (optimistic update), а при ошибке
 * автоматически откатывают изменения к предыдущему состоянию.
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

type QueriesSnapshot = [readonly unknown[], unknown][]

interface OptimisticContext {
  previousDepartmentsData?: QueriesSnapshot
  previousResourceGraphData?: QueriesSnapshot
  previousProjectsData?: QueriesSnapshot
  previousSectionsPageData?: QueriesSnapshot
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
        queryClient.cancelQueries({ queryKey: queryKeys.sectionsPage.all }),
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
      const previousSectionsPageData = queryClient.getQueriesData({
        queryKey: queryKeys.sectionsPage.all,
      })

      // Создаём временную загрузку с optimistic ID (используется во всех optimistic updates)
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

      // Оптимистично обновляем departments timeline
      queryClient.setQueriesData(
        { queryKey: queryKeys.departmentsTimeline.lists() },
        (old: any) => {
          if (!old) return old

          const isDirectArray = Array.isArray(old)
          const departments = isDirectArray ? old : old?.data

          if (!departments || !Array.isArray(departments) || departments.length === 0) {
            return old
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

          return isDirectArray ? updatedDepartments : { ...old, data: updatedDepartments }
        }
      )

      // Оптимистично обновляем resourceGraph.loadings для раздела/этапа
      const allResourceGraphLoadings = queryClient.getQueriesData({
        queryKey: queryKeys.resourceGraph.all,
      })

      allResourceGraphLoadings.forEach(([queryKey, data]) => {
        const isLoadingsCache = Array.isArray(queryKey) && queryKey.includes('loadings')
        const sectionId = queryKey[queryKey.length - 1]

        if (!isLoadingsCache || !data || sectionId !== input.stageId) return

        if (Array.isArray(data)) {
          const updatedLoadings = [...data, tempLoading]
          queryClient.setQueryData(queryKey, updatedLoadings)
        }
      })

      // Оптимистично обновляем sectionsPage (вкладка "Разделы")
      const usersCache = queryClient.getQueryData<any[]>(queryKeys.users.lists())
      const employee = usersCache?.find((u: any) => u.user_id === input.employeeId)

      queryClient.setQueriesData(
        { queryKey: queryKeys.sectionsPage.lists() },
        (old: any) => {
          if (!old || !Array.isArray(old)) return old

          // Структура: Department[] -> Project[] -> ObjectSection[] -> SectionLoading[]
          const updatedDepartments = old.map((dept: any) => ({
            ...dept,
            projects: dept.projects.map((project: any) => ({
              ...project,
              objectSections: project.objectSections.map((objectSection: any) => {
                if (objectSection.sectionId === input.stageId) {
                  return {
                    ...objectSection,
                    loadings: [
                      ...(objectSection.loadings || []),
                      {
                        ...tempLoading,
                        sectionId: objectSection.sectionId,
                        sectionName: objectSection.sectionName,
                        projectId: objectSection.projectId,
                        projectName: objectSection.projectName,
                        objectId: objectSection.objectId,
                        objectName: objectSection.objectName,
                        stageId: input.stageId,
                        stageName: null,
                        employeeId: input.employeeId,
                        employeeName: employee?.full_name || 'Загрузка...',
                        employeeFirstName: employee?.first_name,
                        employeeLastName: employee?.last_name,
                        employeeEmail: employee?.email,
                        employeeAvatarUrl: employee?.avatar_url,
                        employeeCategory: employee?.category,
                        employeeDepartmentId: employee?.department_id || dept.id,
                        employeeDepartmentName: employee?.department_name || dept.name,
                        startDate: input.startDate,
                        endDate: input.endDate,
                        rate: input.rate,
                        comment: input.comment,
                        status: 'active',
                      }
                    ],
                    totalLoadings: (objectSection.totalLoadings || 0) + 1,
                  }
                }
                return objectSection
              }),
            })),
          }))

          return updatedDepartments
        }
      )

      return {
        previousDepartmentsData,
        previousResourceGraphData,
        previousProjectsData,
        previousSectionsPageData,
      }
    },

    onSuccess: (data) => {
      // Инвалидация кешей для обновления с реальными данными
      queryClient.invalidateQueries({ queryKey: queryKeys.loadings.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.departmentsTimeline.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.resourceGraph.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.sectionsPage.all })

      options.onCreateSuccess?.(data)
    },

    onError: (error: Error, _variables, context: OptimisticContext | undefined) => {
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
      if (context?.previousSectionsPageData) {
        context.previousSectionsPageData.forEach(([queryKey, data]) => {
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
        queryClient.cancelQueries({ queryKey: queryKeys.sectionsPage.all }),
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
      const previousSectionsPageData = queryClient.getQueriesData({
        queryKey: queryKeys.sectionsPage.all,
      })

      // Оптимистично обновляем departments timeline
      queryClient.setQueriesData(
        { queryKey: queryKeys.departmentsTimeline.lists() },
        (old: any) => {
          if (!old) return old

          const isDirectArray = Array.isArray(old)
          const departments = isDirectArray ? old : old?.data

          if (!departments || !Array.isArray(departments) || departments.length === 0) {
            return old
          }

          // Обновляем загрузку в departments
          let loadingFound = false
          let originalLoading: any = null
          let originalEmployeeId: string | null = null

          // Если меняется employeeId, нужно переместить загрузку между сотрудниками
          const isMovingBetweenEmployees = input.employeeId !== undefined

          // ПЕРВЫЙ ПРОХОД: Находим загрузку и сохраняем её данные
          if (isMovingBetweenEmployees) {
            for (const dept of departments) {
              for (const team of dept.teams || []) {
                for (const emp of team.employees || []) {
                  const foundLoading = emp.loadings?.find((l: any) => l.id === input.loadingId)
                  if (foundLoading) {
                    originalLoading = foundLoading
                    originalEmployeeId = emp.id
                    loadingFound = true
                    break
                  }
                }
                if (loadingFound) break
              }
              if (loadingFound) break
            }
          }

          // ВТОРОЙ ПРОХОД: Обновляем departments с учетом найденной информации
          const updatedDepartments = departments.map((dept: any) => ({
            ...dept,
            teams: dept.teams.map((team: any) => ({
              ...team,
              employees: team.employees.map((emp: any) => {
                // Собираем обновленные загрузки
                let updatedLoadings: any[] = []

                // Обрабатываем каждую загрузку текущего сотрудника
                for (const loading of emp.loadings || []) {
                  if (loading.id === input.loadingId) {
                    // Нашли целевую загрузку
                    if (!loadingFound) {
                      loadingFound = true
                      originalLoading = loading
                      originalEmployeeId = emp.id
                    }

                    // Если меняется сотрудник и это НЕ целевой сотрудник - удаляем загрузку
                    if (isMovingBetweenEmployees && emp.id !== input.employeeId) {
                      continue // Не добавляем в updatedLoadings
                    }

                    // Если НЕ меняется сотрудник ИЛИ это целевой сотрудник - обновляем
                    updatedLoadings.push({
                      ...loading,
                      ...(input.employeeId !== undefined && { employeeId: input.employeeId, responsibleId: input.employeeId }),
                      ...(input.stageId !== undefined && { stageId: input.stageId, sectionId: input.stageId }),
                      ...(input.startDate !== undefined && { startDate: input.startDate }),
                      ...(input.endDate !== undefined && { endDate: input.endDate }),
                      ...(input.rate !== undefined && { rate: input.rate }),
                      ...(input.comment !== undefined && { comment: input.comment }),
                      updatedAt: new Date().toISOString(),
                      _optimistic: true,
                    })
                  } else {
                    // Обычная загрузка - оставляем как есть
                    updatedLoadings.push(loading)
                  }
                }

                // Если меняется сотрудник и это целевой сотрудник И это не тот же сотрудник
                // Добавляем загрузку к новому сотруднику
                if (originalLoading && isMovingBetweenEmployees && emp.id === input.employeeId && originalEmployeeId !== emp.id) {
                  updatedLoadings.push({
                    ...originalLoading,
                    id: originalLoading.id, // Важно сохранить ID!
                    employeeId: input.employeeId,
                    responsibleId: input.employeeId,
                    ...(input.stageId !== undefined && { stageId: input.stageId, sectionId: input.stageId }),
                    ...(input.startDate !== undefined && { startDate: input.startDate }),
                    ...(input.endDate !== undefined && { endDate: input.endDate }),
                    ...(input.rate !== undefined && { rate: input.rate }),
                    ...(input.comment !== undefined && { comment: input.comment }),
                    updatedAt: new Date().toISOString(),
                    _optimistic: true,
                  })
                } else if (isMovingBetweenEmployees && emp.id === input.employeeId && !originalLoading) {
                  console.error('❌ [UPDATE onMutate] НЕ МОГУ добавить загрузку - originalLoading отсутствует!', {
                    targetEmployeeId: emp.id,
                    targetEmployeeName: emp.name || emp.fullName,
                  })
                }

                return {
                  ...emp,
                  loadings: updatedLoadings,
                  hasLoadings: updatedLoadings.length > 0,
                  loadingsCount: updatedLoadings.length,
                }
              }),
            })),
          }))

          // Возвращаем в том же формате, в каком получили
          return isDirectArray ? updatedDepartments : { ...old, data: updatedDepartments }
        }
      )

      // Оптимистично обновляем resourceGraph.loadings для всех затронутых разделов
      const allResourceGraphLoadings = queryClient.getQueriesData({
        queryKey: queryKeys.resourceGraph.all,
      })

      allResourceGraphLoadings.forEach(([queryKey, data]) => {
        const isLoadingsCache = Array.isArray(queryKey) && queryKey.includes('loadings')
        if (!isLoadingsCache || !data) return

        if (Array.isArray(data)) {
          const updatedLoadings = data.map((loading: any) => {
            if (loading.id === input.loadingId) {
              return {
                ...loading,
                ...(input.employeeId !== undefined && { employeeId: input.employeeId, responsibleId: input.employeeId }),
                ...(input.stageId !== undefined && { stageId: input.stageId, sectionId: input.stageId }),
                ...(input.startDate !== undefined && { startDate: input.startDate }),
                ...(input.endDate !== undefined && { endDate: input.endDate }),
                ...(input.rate !== undefined && { rate: input.rate }),
                ...(input.comment !== undefined && { comment: input.comment }),
                updatedAt: new Date().toISOString(),
                _optimistic: true,
              }
            }
            return loading
          })

          queryClient.setQueryData(queryKey, updatedLoadings)
        }
      })

      // Оптимистично обновляем sectionsPage (вкладка "Разделы")
      // При смене раздела (stageId) — удаляем загрузку из старого места (появится в новом после refetch)
      // При обновлении других полей — обновляем на месте
      const isSectionChange = input.stageId !== undefined

      if (isSectionChange) {
        // Optimistic removal — загрузка мгновенно исчезает из старого раздела
        queryClient.setQueriesData(
          { queryKey: queryKeys.sectionsPage.lists() },
          (old: any) => {
            if (!old || !Array.isArray(old)) return old

            return old.map((dept: any) => ({
              ...dept,
              projects: dept.projects.map((project: any) => ({
                ...project,
                objectSections: project.objectSections.map((objectSection: any) => ({
                  ...objectSection,
                  loadings: (objectSection.loadings || []).filter(
                    (loading: any) => loading.id !== input.loadingId
                  ),
                })),
              })),
            }))
          }
        )
      } else {
        // Обновление на месте (даты, ставка, комментарий, сотрудник)
        const usersCache = queryClient.getQueryData<any[]>(queryKeys.users.lists())
        const newEmployee = input.employeeId
          ? usersCache?.find((u: any) => u.user_id === input.employeeId)
          : undefined

        queryClient.setQueriesData(
          { queryKey: queryKeys.sectionsPage.lists() },
          (old: any) => {
            if (!old || !Array.isArray(old)) return old

            return old.map((dept: any) => ({
              ...dept,
              projects: dept.projects.map((project: any) => ({
                ...project,
                objectSections: project.objectSections.map((objectSection: any) => ({
                  ...objectSection,
                  loadings: (objectSection.loadings || []).map((loading: any) => {
                    if (loading.id !== input.loadingId) return loading

                    return {
                      ...loading,
                      ...(input.employeeId !== undefined && newEmployee && {
                        employeeId: input.employeeId,
                        employeeName: newEmployee.full_name,
                        employeeFirstName: newEmployee.first_name,
                        employeeLastName: newEmployee.last_name,
                        employeeEmail: newEmployee.email,
                        employeeAvatarUrl: newEmployee.avatar_url,
                        employeeCategory: newEmployee.category,
                        employeeDepartmentId: newEmployee.department_id,
                        employeeDepartmentName: newEmployee.department_name,
                      }),
                      ...(input.startDate !== undefined && { startDate: input.startDate }),
                      ...(input.endDate !== undefined && { endDate: input.endDate }),
                      ...(input.rate !== undefined && { rate: input.rate }),
                      ...(input.comment !== undefined && { comment: input.comment }),
                      updatedAt: new Date().toISOString(),
                      _optimistic: true,
                    }
                  }),
                })),
              })),
            }))
          }
        )
      }

      return {
        previousDepartmentsData,
        previousResourceGraphData,
        previousProjectsData,
        previousSectionsPageData,
      }
    },

    onSuccess: (data) => {
      // Инвалидация кешей для обновления с реальными данными
      queryClient.invalidateQueries({ queryKey: queryKeys.loadings.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.departmentsTimeline.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.resourceGraph.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.sectionsPage.all })

      options.onUpdateSuccess?.(data)
    },

    onError: (error: Error, _variables, context: OptimisticContext | undefined) => {
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
      if (context?.previousSectionsPageData) {
        context.previousSectionsPageData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }

      options.onError?.(error)
    },
  })

  // ==========================================================================
  // ARCHIVE - Архивация загрузки с optimistic update
  // ==========================================================================
  const archive = useMutation({
    mutationFn: async (input: ArchiveLoadingInput) => {
      const result = await archiveLoading(input)

      if (!result.success) {
        throw new Error(result.error)
      }

      return result.data
    },

    // Optimistic update - удаляем загрузку из UI сразу
    onMutate: async (input: ArchiveLoadingInput): Promise<OptimisticContext> => {
      // Отменяем все текущие запросы к затронутым кешам
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.departmentsTimeline.all }),
        queryClient.cancelQueries({ queryKey: queryKeys.resourceGraph.all }),
        queryClient.cancelQueries({ queryKey: queryKeys.projects.all }),
        queryClient.cancelQueries({ queryKey: queryKeys.sectionsPage.all }),
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
      const previousSectionsPageData = queryClient.getQueriesData({
        queryKey: queryKeys.sectionsPage.all,
      })

      // Оптимистично удаляем загрузку из departments timeline
      queryClient.setQueriesData(
        { queryKey: queryKeys.departmentsTimeline.lists() },
        (old: any) => {
          if (!old) return old

          const isDirectArray = Array.isArray(old)
          const departments = isDirectArray ? old : old?.data

          if (!departments || !Array.isArray(departments) || departments.length === 0) {
            return old
          }

          // Удаляем загрузку из соответствующего сотрудника
          const updatedDepartments = departments.map((dept: any) => ({
            ...dept,
            teams: dept.teams.map((team: any) => ({
              ...team,
              employees: team.employees.map((emp: any) => {
                const updatedLoadings = (emp.loadings || []).filter(
                  (loading: any) => loading.id !== input.loadingId
                )
                return {
                  ...emp,
                  loadings: updatedLoadings,
                  hasLoadings: updatedLoadings.length > 0,
                  loadingsCount: updatedLoadings.length,
                }
              }),
            })),
          }))

          return isDirectArray ? updatedDepartments : { ...old, data: updatedDepartments }
        }
      )

      // Оптимистично удаляем из resourceGraph.loadings
      const allResourceGraphLoadings = queryClient.getQueriesData({
        queryKey: queryKeys.resourceGraph.all,
      })

      allResourceGraphLoadings.forEach(([queryKey, data]) => {
        const isLoadingsCache = Array.isArray(queryKey) && queryKey.includes('loadings')
        if (!isLoadingsCache || !data) return

        if (Array.isArray(data)) {
          const updatedLoadings = data.filter((loading: any) => loading.id !== input.loadingId)
          queryClient.setQueryData(queryKey, updatedLoadings)
        }
      })

      // Оптимистично удаляем из sectionsPage (вкладка "Разделы")
      queryClient.setQueriesData(
        { queryKey: queryKeys.sectionsPage.lists() },
        (old: any) => {
          if (!old || !Array.isArray(old)) return old

          // Структура: Department[] -> Project[] -> ObjectSection[] -> SectionLoading[]
          const updatedDepartments = old.map((dept: any) => ({
            ...dept,
            projects: dept.projects.map((project: any) => ({
              ...project,
              objectSections: project.objectSections.map((objectSection: any) => {
                const updatedLoadings = (objectSection.loadings || []).filter(
                  (loading: any) => loading.id !== input.loadingId
                )

                return {
                  ...objectSection,
                  loadings: updatedLoadings,
                  totalLoadings: updatedLoadings.length,
                }
              }),
            })),
          }))

          return updatedDepartments
        }
      )

      return {
        previousDepartmentsData,
        previousResourceGraphData,
        previousProjectsData,
        previousSectionsPageData,
      }
    },

    onSuccess: (data) => {
      // Инвалидация кешей для обновления с реальными данными
      queryClient.invalidateQueries({ queryKey: queryKeys.loadings.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.departmentsTimeline.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.resourceGraph.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.sectionsPage.all })

      options.onArchiveSuccess?.(data)
    },

    onError: (error: Error, _variables, context: OptimisticContext | undefined) => {
      console.error('❌ Ошибка архивации загрузки, откатываем optimistic update')

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
      if (context?.previousSectionsPageData) {
        context.previousSectionsPageData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }

      options.onError?.(error)
    },
  })

  // ==========================================================================
  // DELETE - Удаление загрузки с optimistic update
  // ==========================================================================
  const remove = useMutation({
    mutationFn: async (input: DeleteLoadingInput) => {
      const result = await deleteLoading(input)

      if (!result.success) {
        throw new Error(result.error)
      }

      return result.data
    },

    // Optimistic update - удаляем загрузку из UI сразу
    onMutate: async (input: DeleteLoadingInput): Promise<OptimisticContext> => {
      // Отменяем все текущие запросы к затронутым кешам
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.departmentsTimeline.all }),
        queryClient.cancelQueries({ queryKey: queryKeys.resourceGraph.all }),
        queryClient.cancelQueries({ queryKey: queryKeys.projects.all }),
        queryClient.cancelQueries({ queryKey: queryKeys.sectionsPage.all }),
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
      const previousSectionsPageData = queryClient.getQueriesData({
        queryKey: queryKeys.sectionsPage.all,
      })

      // Оптимистично удаляем загрузку из departments timeline
      queryClient.setQueriesData(
        { queryKey: queryKeys.departmentsTimeline.lists() },
        (old: any) => {
          if (!old) return old

          const isDirectArray = Array.isArray(old)
          const departments = isDirectArray ? old : old?.data

          if (!departments || !Array.isArray(departments) || departments.length === 0) {
            return old
          }

          // Удаляем загрузку из соответствующего сотрудника
          const updatedDepartments = departments.map((dept: any) => ({
            ...dept,
            teams: dept.teams.map((team: any) => ({
              ...team,
              employees: team.employees.map((emp: any) => {
                const updatedLoadings = (emp.loadings || []).filter(
                  (loading: any) => loading.id !== input.loadingId
                )
                return {
                  ...emp,
                  loadings: updatedLoadings,
                  hasLoadings: updatedLoadings.length > 0,
                  loadingsCount: updatedLoadings.length,
                }
              }),
            })),
          }))

          return isDirectArray ? updatedDepartments : { ...old, data: updatedDepartments }
        }
      )

      // Оптимистично удаляем из resourceGraph.loadings
      const allResourceGraphLoadings = queryClient.getQueriesData({
        queryKey: queryKeys.resourceGraph.all,
      })

      allResourceGraphLoadings.forEach(([queryKey, data]) => {
        const isLoadingsCache = Array.isArray(queryKey) && queryKey.includes('loadings')
        if (!isLoadingsCache || !data) return

        if (Array.isArray(data)) {
          const updatedLoadings = data.filter((loading: any) => loading.id !== input.loadingId)
          queryClient.setQueryData(queryKey, updatedLoadings)
        }
      })

      // Оптимистично удаляем из sectionsPage (вкладка "Разделы")
      queryClient.setQueriesData(
        { queryKey: queryKeys.sectionsPage.lists() },
        (old: any) => {
          if (!old || !Array.isArray(old)) return old

          // Структура: Department[] -> Project[] -> ObjectSection[] -> SectionLoading[]
          const updatedDepartments = old.map((dept: any) => ({
            ...dept,
            projects: dept.projects.map((project: any) => ({
              ...project,
              objectSections: project.objectSections.map((objectSection: any) => {
                const updatedLoadings = (objectSection.loadings || []).filter(
                  (loading: any) => loading.id !== input.loadingId
                )

                return {
                  ...objectSection,
                  loadings: updatedLoadings,
                  totalLoadings: updatedLoadings.length,
                }
              }),
            })),
          }))

          return updatedDepartments
        }
      )

      return {
        previousDepartmentsData,
        previousResourceGraphData,
        previousProjectsData,
        previousSectionsPageData,
      }
    },

    onSuccess: (data) => {
      // Инвалидация кешей для обновления с реальными данными
      queryClient.invalidateQueries({ queryKey: queryKeys.loadings.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.departmentsTimeline.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.resourceGraph.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.sectionsPage.all })

      options.onDeleteSuccess?.(data.id)
    },

    onError: (error: Error, _variables, context: OptimisticContext | undefined) => {
      console.error('❌ Ошибка удаления загрузки, откатываем optimistic update')

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
      if (context?.previousSectionsPageData) {
        context.previousSectionsPageData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }

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
