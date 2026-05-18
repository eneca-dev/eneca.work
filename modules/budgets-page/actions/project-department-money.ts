/**
 * Project × Department Money Server Action
 *
 * Загружает расчётный бюджет на пересечении проект × отдел
 * из v_cache_project_department_budget.
 * Источник: суммы по всем loadings проекта, сгруппированные по отделу.
 *
 * @module budgets-page/actions/project-department-money
 * См. supabase/migrations/2026-05-15_v_cache_project_department_budget.sql
 */

'use server'

import { createClient } from '@/utils/supabase/server'
import type { ActionResult, ViewRow } from '@/modules/cache'

// ============================================================================
// Types
// ============================================================================

/** Строка из v_cache_project_department_budget. */
export type ProjectDepartmentBudget = ViewRow<'v_cache_project_department_budget'>

// ============================================================================
// Actions
// ============================================================================

/**
 * Получить расчётные бюджеты на пересечении проект × отдел.
 *
 * Загружаем весь view целиком (≤ N_проектов × N_отделов ≈ 1000–3000 строк).
 * Фильтрация по конкретному проекту происходит на клиенте через Map.
 *
 * Аналог getSectionCalcBudgets — единый паттерн для агрегатов от loadings.
 */
export async function getProjectDepartmentBudgets(): Promise<ActionResult<ProjectDepartmentBudget[]>> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Не авторизован' }
  }

  const { data, error } = await supabase
    .from('v_cache_project_department_budget')
    .select('project_id, department_id, calc_budget, total_hours, loading_count, valid_loading_count, errors_count')

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: data ?? [] }
}
