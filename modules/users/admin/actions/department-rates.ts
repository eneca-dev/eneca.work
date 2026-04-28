/**
 * Department Budget Settings — Server Actions
 *
 * Управление ставками отделов (department_budget_settings).
 * Используется при расчёте денежной стоимости loadings.
 *
 * @module users/admin/actions/department-rates
 * См. docs/production/budgets-calc-from-loadings.md
 */

'use server'

import { createClient } from '@/utils/supabase/server'
import type { ActionResult, TableRow } from '@/modules/cache'

// ============================================================================
// Types
// ============================================================================

export type DepartmentBudgetSetting = TableRow<'department_budget_settings'>

export interface UpdateDepartmentRateInput {
  departmentId: string
  hourlyRate: number
  workHoursPerDay: number
}

// ============================================================================
// Helpers
// ============================================================================

async function checkSettingsEditPermission(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('user_has_permission', {
    p_user_id: userId,
    p_permission_name: 'budgets.settings.edit',
  })
  return !error && data === true
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Получить настройки ставок всех отделов
 */
export async function getDepartmentBudgetSettings(): Promise<
  ActionResult<DepartmentBudgetSetting[]>
> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Не авторизован' }
  }

  const { data, error } = await supabase
    .from('department_budget_settings')
    .select('department_id, hourly_rate, work_hours_per_day, updated_at, updated_by')

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: data ?? [] }
}

/**
 * Обновить настройки ставки отдела (создаёт запись если не существует)
 *
 * Требует permission: budgets.settings.edit
 */
export async function updateDepartmentBudgetSetting(
  input: UpdateDepartmentRateInput,
): Promise<ActionResult<DepartmentBudgetSetting>> {
  const supabase = await createClient()

  // 1. Auth
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Не авторизован' }
  }

  // 2. Permission
  const hasPermission = await checkSettingsEditPermission(supabase, user.id)
  if (!hasPermission) {
    return { success: false, error: 'Нет прав на редактирование ставок отделов' }
  }

  // 3. Input validation
  if (!input.departmentId) {
    return { success: false, error: 'departmentId обязателен' }
  }
  if (input.hourlyRate < 0) {
    return { success: false, error: 'Ставка не может быть отрицательной' }
  }
  if (input.workHoursPerDay <= 0 || input.workHoursPerDay > 24) {
    return { success: false, error: 'Часов в дне должно быть в диапазоне (0, 24]' }
  }

  const { data, error } = await supabase
    .from('department_budget_settings')
    .upsert(
      {
        department_id: input.departmentId,
        hourly_rate: input.hourlyRate,
        work_hours_per_day: input.workHoursPerDay,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'department_id' },
    )
    .select('department_id, hourly_rate, work_hours_per_day, updated_at, updated_by')
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data }
}
