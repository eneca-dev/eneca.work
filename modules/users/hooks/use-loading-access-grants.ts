'use client'

/**
 * React Query хуки для cross-department loading access grants.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys, staleTimePresets } from '@/modules/cache'
import {
  listLoadingAccessGrantsForEmployee,
  listAllLoadingAccessGrants,
  createLoadingAccessGrant,
  revokeLoadingAccessGrant,
} from '../actions/loading-access-grants'
import type {
  LoadingAccessGrantRow,
  CreateLoadingAccessGrantInput,
} from '../actions/loading-access-grants.types'

/**
 * Индекс всех грантов: employee_id → массив department_ids, которым выдан грант.
 * Используется в EmployeeSelector / MultiEmployeeSelector для:
 *  1. фильтрации "гостевых" сотрудников видимых для НО/ТЛ другого отдела;
 *  2. отображения бейджа "из <отдел>" в селекторе.
 *
 * Таблица грантов мала — один запрос дешевле N+1.
 */
export function useAllLoadingAccessGrantsIndex() {
  return useQuery({
    queryKey: [...queryKeys.loadingAccessGrants.all, 'index'] as const,
    queryFn: async (): Promise<Record<string, string[]>> => {
      const result = await listAllLoadingAccessGrants()
      if (!result.success) throw new Error(result.error)
      const index: Record<string, string[]> = {}
      for (const row of result.data) {
        ;(index[row.employee_id] ??= []).push(row.granted_to_department_id)
      }
      return index
    },
    staleTime: staleTimePresets.medium,
  })
}

/**
 * Список грантов для сотрудника.
 * Используется в UI карточки сотрудника и для проверки прав на клиенте.
 */
export function useLoadingAccessGrants(employeeId: string | null) {
  return useQuery({
    queryKey: employeeId
      ? queryKeys.loadingAccessGrants.byEmployee(employeeId)
      : ['loadingAccessGrants', 'byEmployee', 'disabled'],
    queryFn: async (): Promise<LoadingAccessGrantRow[]> => {
      if (!employeeId) return []
      const result = await listLoadingAccessGrantsForEmployee(employeeId)
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    enabled: !!employeeId,
    staleTime: staleTimePresets.medium,
  })
}

/**
 * Compact-хук: возвращает только массив department_ids которым выдан грант
 * на указанного сотрудника. Используется в проверках прав на клиенте.
 */
export function useEmployeeGrantedDepartmentIds(employeeId: string | null) {
  return useQuery({
    queryKey: employeeId
      ? [...queryKeys.loadingAccessGrants.byEmployee(employeeId), 'department-ids']
      : ['loadingAccessGrants', 'byEmployee', 'disabled', 'department-ids'],
    queryFn: async (): Promise<string[]> => {
      if (!employeeId) return []
      const result = await listLoadingAccessGrantsForEmployee(employeeId)
      if (!result.success) throw new Error(result.error)
      return result.data.map((g) => g.granted_to_department_id)
    },
    enabled: !!employeeId,
    staleTime: staleTimePresets.medium,
  })
}

/**
 * Создание гранта (выдача доступа отделу).
 * Оптимистично обновляет список грантов сотрудника.
 */
export function useCreateLoadingAccessGrant() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateLoadingAccessGrantInput) => {
      const result = await createLoadingAccessGrant(input)
      if (!result.success) throw new Error(result.error)
      return { grant_id: result.data.grant_id, input }
    },
    onSuccess: ({ input }) => {
      qc.invalidateQueries({
        queryKey: queryKeys.loadingAccessGrants.byEmployee(input.employee_id),
      })
      qc.invalidateQueries({
        queryKey: queryKeys.loadingAccessGrants.byDepartment(
          input.granted_to_department_id
        ),
      })
      // Сотрудник теперь будет виден в селекторах другого отдела
      qc.invalidateQueries({ queryKey: queryKeys.users.all })
    },
  })
}

/**
 * Отзыв гранта.
 */
export function useRevokeLoadingAccessGrant() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: { grant_id: string }) => {
      const result = await revokeLoadingAccessGrant(input)
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    onSuccess: ({ employee_id }) => {
      qc.invalidateQueries({
        queryKey: queryKeys.loadingAccessGrants.byEmployee(employee_id),
      })
      qc.invalidateQueries({ queryKey: queryKeys.loadingAccessGrants.all })
      qc.invalidateQueries({ queryKey: queryKeys.users.all })
    },
  })
}
