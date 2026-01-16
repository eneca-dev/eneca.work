/**
 * Project Reports Module - Server Actions
 *
 * Server Actions для модуля отчетов руководителей проектов
 */

'use server'

import { createClient } from '@/utils/supabase/server'
import { formatMinskDate } from '@/lib/timezone-utils'
import type { ActionResult } from '@/modules/cache'
import type { ProjectReport } from '../types'
import { transformProfileToCreatedBy } from '../utils/profile-transform'

// ============================================================================
// Project Reports Actions
// ============================================================================

/**
 * Получить все отчеты для проекта
 * @param projectId - ID проекта
 * @returns Массив отчетов с информацией об авторах
 */
export async function getProjectReports(
  projectId: string
): Promise<ActionResult<ProjectReport[]>> {
  try {
    const supabase = await createClient()

    // Query с JOIN profiles для автора
    const { data, error } = await supabase
      .from('project_reports')
      .select(`
        report_id,
        project_id,
        comment,
        actual_readiness,
        planned_readiness,
        budget_spent,
        created_at,
        updated_at,
        profiles:created_by (
          user_id,
          first_name,
          last_name,
          avatar_url
        )
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[getProjectReports] Supabase error:', error)
      return { success: false, error: error.message }
    }

    // Transform в ProjectReport[]
    type ProfileRow = {
      user_id: string
      first_name: string | null
      last_name: string | null
      avatar_url: string | null
    }

    const reports: ProjectReport[] = (data || []).map(row => {
      const profile = row.profiles as ProfileRow | null

      return {
        id: row.report_id,
        projectId: row.project_id,
        comment: row.comment,
        actualReadiness: row.actual_readiness,
        plannedReadiness: row.planned_readiness,
        budgetSpent: row.budget_spent,
        createdBy: transformProfileToCreatedBy(profile),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    })

    return { success: true, data: reports }
  } catch (error) {
    console.error('[getProjectReports] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки отчетов',
    }
  }
}

/**
 * Рассчитать метрики проекта на текущий момент
 * @param projectId - ID проекта
 * @returns Метрики: actualReadiness, plannedReadiness, budgetSpent
 */
export async function calculateProjectMetrics(
  projectId: string
): Promise<ActionResult<{
  actualReadiness: number
  plannedReadiness: number
  budgetSpent: number
}>> {
  try {
    const supabase = await createClient()
    // Используем дату по Минскому времени
    const today = formatMinskDate(new Date())

    // Получаем данные из view v_resource_graph для всех секций проекта
    const { data: rows, error } = await supabase
      .from('v_resource_graph')
      .select(`
        section_id,
        section_readiness_checkpoints,
        section_budget_spending,
        decomposition_item_id,
        decomposition_item_progress,
        decomposition_item_planned_hours
      `)
      .eq('project_id', projectId)

    if (error) {
      console.error('[calculateProjectMetrics] Query error:', error)
      return { success: false, error: error.message }
    }

    if (!rows || rows.length === 0) {
      return {
        success: true,
        data: { actualReadiness: 0, plannedReadiness: 0, budgetSpent: 0 },
      }
    }

    // ============================================================================
    // 1. ACTUAL READINESS - Взвешенное среднее по всем decomposition_items
    // ============================================================================
    let totalWeightedProgress = 0
    let totalPlannedHours = 0

    for (const row of rows) {
      if (!row.decomposition_item_id) continue
      const hours = row.decomposition_item_planned_hours || 0
      const progress = row.decomposition_item_progress || 0
      if (hours > 0) {
        totalWeightedProgress += progress * hours
        totalPlannedHours += hours
      }
    }

    const actualReadiness =
      totalPlannedHours > 0
        ? Math.round(totalWeightedProgress / totalPlannedHours)
        : 0

    // ============================================================================
    // 2. PLANNED READINESS - Среднее по контрольным точкам всех секций
    // ============================================================================
    const uniqueSections = new Map<
      string,
      { checkpoints: Array<{ date: string; value: number }> }
    >()

    for (const row of rows) {
      if (!row.section_id || uniqueSections.has(row.section_id)) continue

      const checkpoints = Array.isArray(row.section_readiness_checkpoints)
        ? (row.section_readiness_checkpoints as Array<{ date: string; value: number }>)
        : []

      uniqueSections.set(row.section_id, { checkpoints })
    }

    let plannedReadinessSum = 0
    let plannedReadinessCount = 0

    for (const [, section] of uniqueSections) {
      // Находим ближайшую контрольную точку <= сегодня
      const relevantCheckpoints = section.checkpoints
        .filter(cp => cp.date <= today)
        .sort((a, b) => b.date.localeCompare(a.date)) // Сортируем по убыванию даты

      if (relevantCheckpoints.length > 0) {
        plannedReadinessSum += relevantCheckpoints[0].value
        plannedReadinessCount++
      }
    }

    const plannedReadiness =
      plannedReadinessCount > 0
        ? Math.round(plannedReadinessSum / plannedReadinessCount)
        : 0

    // ============================================================================
    // 3. BUDGET SPENT - Среднее процента расхода по всем секциям
    // ============================================================================
    const budgetSections = new Map<
      string,
      { spending: Array<{ date: string; percentage: number }> }
    >()

    for (const row of rows) {
      if (!row.section_id || budgetSections.has(row.section_id)) continue

      const spending = Array.isArray(row.section_budget_spending)
        ? (row.section_budget_spending as Array<{
            date: string
            spent: number
            percentage: number
          }>)
        : []

      budgetSections.set(row.section_id, { spending })
    }

    let budgetSpentSum = 0
    let budgetSpentCount = 0

    for (const [, section] of budgetSections) {
      // Берем последнее значение расхода бюджета <= сегодня
      const sortedSpending = section.spending
        .filter(sp => sp.date <= today)
        .sort((a, b) => b.date.localeCompare(a.date))

      if (sortedSpending.length > 0) {
        budgetSpentSum += sortedSpending[0].percentage
        budgetSpentCount++
      }
    }

    const budgetSpent =
      budgetSpentCount > 0 ? Math.round(budgetSpentSum / budgetSpentCount) : 0

    return {
      success: true,
      data: {
        actualReadiness,
        plannedReadiness,
        budgetSpent,
      },
    }
  } catch (error) {
    console.error('[calculateProjectMetrics] Error:', error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Ошибка расчета метрик проекта',
    }
  }
}

/**
 * Создать или обновить отчет к проекту
 * @param input - Данные отчета
 * @returns Созданный или обновленный отчет
 */
export async function upsertProjectReport(
  input: { reportId?: string; projectId: string; comment: string }
): Promise<ActionResult<ProjectReport>> {
  try {
    const supabase = await createClient()

    // Проверка авторизации
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Не авторизован' }
    }

    // RLS автоматически проверит разрешение project_reports.create/edit

    type ProfileRow = {
      user_id: string
      first_name: string | null
      last_name: string | null
      avatar_url: string | null
    }

    if (input.reportId) {
      // UPDATE - метрики НЕ пересчитываем (остаются замороженными)
      const { data, error } = await supabase
        .from('project_reports')
        .update({
          comment: input.comment,
          updated_at: new Date().toISOString(),
        })
        .eq('report_id', input.reportId)
        .select(`
          report_id,
          project_id,
          comment,
          actual_readiness,
          planned_readiness,
          budget_spent,
          created_at,
          updated_at,
          profiles:created_by (
            user_id,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .single()

      if (error) {
        console.error('[upsertProjectReport] Update error:', error)
        return { success: false, error: error.message }
      }

      const profile = data.profiles as ProfileRow | null

      return {
        success: true,
        data: {
          id: data.report_id,
          projectId: data.project_id,
          comment: data.comment,
          actualReadiness: data.actual_readiness,
          plannedReadiness: data.planned_readiness,
          budgetSpent: data.budget_spent,
          createdBy: transformProfileToCreatedBy(profile),
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        },
      }
    } else {
      // INSERT - Рассчитываем метрики при создании отчета
      const metricsResult = await calculateProjectMetrics(input.projectId)
      if (!metricsResult.success) {
        console.error('[upsertProjectReport] Metrics calculation failed:', metricsResult.error)
        // Продолжаем с нулевыми метриками, если расчет не удался
      }

      const metrics = metricsResult.success
        ? metricsResult.data
        : { actualReadiness: 0, plannedReadiness: 0, budgetSpent: 0 }

      const { data, error } = await supabase
        .from('project_reports')
        .insert({
          project_id: input.projectId,
          comment: input.comment,
          created_by: user.id,
          actual_readiness: metrics.actualReadiness,
          planned_readiness: metrics.plannedReadiness,
          budget_spent: metrics.budgetSpent,
        })
        .select(`
          report_id,
          project_id,
          comment,
          actual_readiness,
          planned_readiness,
          budget_spent,
          created_at,
          updated_at,
          profiles:created_by (
            user_id,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .single()

      if (error) {
        console.error('[upsertProjectReport] Insert error:', error)
        return { success: false, error: error.message }
      }

      const profile = data.profiles as ProfileRow | null

      return {
        success: true,
        data: {
          id: data.report_id,
          projectId: data.project_id,
          comment: data.comment,
          actualReadiness: data.actual_readiness,
          plannedReadiness: data.planned_readiness,
          budgetSpent: data.budget_spent,
          createdBy: transformProfileToCreatedBy(profile),
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        },
      }
    }
  } catch (error) {
    console.error('[upsertProjectReport] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка сохранения отчета',
    }
  }
}

/**
 * Удалить отчет к проекту
 * @param input - ID отчета и проекта (для инвалидации кеша)
 * @returns Результат удаления
 */
export async function deleteProjectReport(
  input: { reportId: string; projectId: string }
): Promise<ActionResult<void>> {
  try {
    const supabase = await createClient()

    // Проверка авторизации
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Не авторизован' }
    }

    // RLS автоматически проверит разрешение project_reports.edit

    const { error } = await supabase
      .from('project_reports')
      .delete()
      .eq('report_id', input.reportId)

    if (error) {
      console.error('[deleteProjectReport] Error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: undefined }
  } catch (error) {
    console.error('[deleteProjectReport] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка удаления отчета',
    }
  }
}
