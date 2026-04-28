/**
 * useDepartmentBudgetSettings — настройки ставок отделов.
 *
 * См. docs/production/budgets-calc-from-loadings.md
 */

'use client'

import {
  createCacheQuery,
  createUpdateMutation,
  queryKeys,
  staleTimePresets,
} from '@/modules/cache'
import {
  getDepartmentBudgetSettings,
  updateDepartmentBudgetSetting,
} from '../actions/department-rates'

export const useDepartmentBudgetSettings = createCacheQuery({
  queryKey: () => queryKeys.budgets.departmentSettings(),
  queryFn: getDepartmentBudgetSettings,
  staleTime: staleTimePresets.medium,
})

/**
 * Mutation для обновления ставки отдела.
 * Optimistic update + инвалидация расчётного бюджета (т.к. меняется hourly_rate).
 */
export const useUpdateDepartmentBudgetSetting = createUpdateMutation({
  mutationFn: updateDepartmentBudgetSetting,
  listQueryKey: queryKeys.budgets.departmentSettings(),
  getId: (input) => input.departmentId,
  getItemId: (item) => item.department_id,
  merge: (item, input) => ({
    ...item,
    hourly_rate: input.hourlyRate,
    work_hours_per_day: input.workHoursPerDay,
    updated_at: new Date().toISOString(),
  }),
  invalidateKeys: [
    queryKeys.budgets.departmentSettings(),
    queryKeys.budgets.calc(), // пересчёт calc по разделам после смены ставки
  ],
})
