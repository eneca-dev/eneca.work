'use client'

import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { createCacheQuery, queryKeys, staleTimePresets } from '@/modules/cache'
import type { FilterQueryParams } from '@/modules/inline-filter'
import {
  getDepartmentEmploymentBoard,
  pinProject,
  placeEmployee,
  reportBoardPresence,
  removePlacement,
  searchBoardProjects,
  unpinProject,
} from '../actions'
import type { EmploymentBoard, PinProjectInput, PlacementInput } from '../types'

type BoardCacheSnapshot = readonly [QueryKey, EmploymentBoard | undefined]

/**
 * Доска может быть закэширована как с id отдела, так и без него: фактический
 * отдел иногда определяется только server action. Поэтому обновляем снимки по
 * данным доски, а не по составному ключу React Query.
 */
function updateDepartmentBoardCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  departmentId: string,
  updater: (board: EmploymentBoard) => EmploymentBoard,
): BoardCacheSnapshot[] {
  const snapshots = queryClient
    .getQueriesData<EmploymentBoard>({ queryKey: queryKeys.employmentBoard.all })
    .filter(([, board]) => board?.departmentId === departmentId)

  snapshots.forEach(([queryKey, board]) => {
    if (board) queryClient.setQueryData<EmploymentBoard>(queryKey, updater(board))
  })

  return snapshots
}

function restoreBoardCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  snapshots: BoardCacheSnapshot[] | undefined,
) {
  snapshots?.forEach(([queryKey, board]) => queryClient.setQueryData(queryKey, board))
}

interface BoardMutationOptions {
  /** Запускает fallback только после подтверждённой сервером записи. */
  onMutationSuccess?: () => void
}

export const useEmploymentBoard = createCacheQuery<EmploymentBoard, FilterQueryParams | undefined>({
  queryKey: (filters) => queryKeys.employmentBoard.list(filters?.department_id),
  queryFn: (filters) => getDepartmentEmploymentBoard(filters),
  staleTime: staleTimePresets.realtime,
})

/**
 * Поиск проектов для правой панели. Term должен быть уже задебаунсен вызывающим.
 * Запрос не стартует, пока введено меньше 2 символов.
 */
export const useBoardProjectSearch = createCacheQuery<Array<{ id: string; name: string }>, string>({
  queryKey: (term) => queryKeys.employmentBoard.search(term),
  queryFn: (term) => searchBoardProjects(term),
  staleTime: staleTimePresets.fast,
})

/**
 * Мутации доски.
 *
 * Локальные изменения показываются сразу, затем всегда подтверждаются свежим
 * серверным снимком. Автоматические размещения из loadings клиент не моделирует.
 */
export function usePinProject({ onMutationSuccess }: BoardMutationOptions = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: PinProjectInput) => {
      const result = await pinProject(input)
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.employmentBoard.all })
      const snapshots = updateDepartmentBoardCaches(queryClient, input.departmentId, (board) => ({
        ...board,
        projects: board.projects.some((project) => project.id === input.projectId)
          ? board.projects.map((project) =>
              project.id === input.projectId ? { ...project, isPinned: true, isPending: true } : project,
            )
          : [
              ...board.projects,
              {
                id: input.projectId,
                name: input.projectName ?? 'Проект',
                isPinned: true,
                isPending: true,
                employees: [],
              },
            ],
      }))
      return { snapshots }
    },
    onError: (_error, _input, context) => restoreBoardCaches(queryClient, context?.snapshots),
    onSuccess: (_data, input) => {
      updateDepartmentBoardCaches(queryClient, input.departmentId, (board) => ({
        ...board,
        projects: board.projects.map((project) =>
          project.id === input.projectId ? { ...project, isPending: false } : project,
        ),
      }))
      onMutationSuccess?.()
    },
  })
}

export function useUnpinProject({ onMutationSuccess }: BoardMutationOptions = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: PinProjectInput) => {
      const result = await unpinProject(input)
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.employmentBoard.all })
      const snapshots = updateDepartmentBoardCaches(queryClient, input.departmentId, (old) => {
        return {
          ...old,
          projects: old.projects
            .map((project) =>
              project.id === input.projectId ? { ...project, isPinned: false } : project,
            )
            // Карточка без автоматических сотрудников исчезает после открепления.
            .filter((project) => project.isPinned || project.employees.length > 0),
        }
      })
      return { snapshots }
    },
    onError: (_error, _input, context) => restoreBoardCaches(queryClient, context?.snapshots),
    onSuccess: () => onMutationSuccess?.(),
  })
}

/** Presence обновляется обычным коротким запросом, Redis хранит его 20 секунд. */
export function useBoardPresence(departmentId?: string) {
  return useQuery({
    queryKey: [...queryKeys.employmentBoard.all, 'presence', departmentId ?? null],
    queryFn: async () => {
      if (!departmentId) return []
      const result = await reportBoardPresence(departmentId)
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    enabled: Boolean(departmentId),
    refetchInterval: 10_000,
    staleTime: 5_000,
  })
}

/**
 * Ручное размещение можно безопасно показать оптимистично: оно не меняет
 * реальные loadings. При ошибке восстанавливается прежний снимок, а после
 * завершения запрос всегда сверяется с сервером.
 */
export function usePlaceEmployee({ onMutationSuccess }: BoardMutationOptions = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: PlacementInput) => {
      const result = await placeEmployee(input)
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.employmentBoard.all })
      const snapshots = updateDepartmentBoardCaches(queryClient, input.departmentId, (old) => {
        const employee = old.employees.find((item) => item.id === input.employeeId)
        if (!employee) return old

        return {
          ...old,
          projects: old.projects.map((project) =>
            project.id !== input.projectId || project.employees.some((item) => item.id === input.employeeId)
              ? project
              : {
                  ...project,
                  employees: [...project.employees, { ...employee, source: 'manual', rate: null, isPending: true }],
                },
          ),
          unassignedEmployeeIds: old.unassignedEmployeeIds.filter((id) => id !== input.employeeId),
        }
      })
      return { snapshots }
    },
    onError: (_error, _input, context) => restoreBoardCaches(queryClient, context?.snapshots),
    onSuccess: (_data, input) => {
      updateDepartmentBoardCaches(queryClient, input.departmentId, (board) => ({
        ...board,
        projects: board.projects.map((project) =>
          project.id === input.projectId
            ? {
                ...project,
                employees: project.employees.map((employee) =>
                  employee.id === input.employeeId && employee.source === 'manual'
                    ? { ...employee, isPending: false }
                    : employee,
                ),
              }
            : project,
        ),
      }))
      onMutationSuccess?.()
    },
  })
}

export function useRemovePlacement({ onMutationSuccess }: BoardMutationOptions = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: PlacementInput) => {
      const result = await removePlacement(input)
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.employmentBoard.all })
      const snapshots = updateDepartmentBoardCaches(queryClient, input.departmentId, (old) => {
        const projects = old.projects.map((project) =>
          project.id === input.projectId
            ? {
                ...project,
                employees: project.employees.filter(
                  (employee) => !(employee.id === input.employeeId && employee.source === 'manual'),
                ),
              }
            : project,
        )
        const isStillPlaced = projects.some((project) =>
          project.employees.some((employee) => employee.id === input.employeeId),
        )
        return {
          ...old,
          projects,
          unassignedEmployeeIds: isStillPlaced || old.unassignedEmployeeIds.includes(input.employeeId)
            ? old.unassignedEmployeeIds
            : [...old.unassignedEmployeeIds, input.employeeId],
        }
      })
      return { snapshots }
    },
    onError: (_error, _input, context) => restoreBoardCaches(queryClient, context?.snapshots),
    onSuccess: () => onMutationSuccess?.(),
  })
}
