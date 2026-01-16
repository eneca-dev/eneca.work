import { supabase } from "@/lib/supabase-client"
import type { TeamFreshness } from "../types"
import { confirmTeamActivityAction } from "../actions/team-activity"

/**
 * Загрузка данных актуальности команд из view_planning_team_freshness
 * Возвращает информацию о последнем обновлении данных каждой команды
 */
export async function fetchTeamFreshness(): Promise<TeamFreshness[]> {
  try {
    const { data, error } = await supabase
      .from("view_planning_team_freshness")
      .select("team_id, team_name, department_id, department_name, last_update, days_since_update")

    if (error) {
      console.error("❌ Ошибка загрузки freshness:", error)
      throw error
    }

    // Преобразование snake_case к camelCase и типов Date
    const freshness = (data || []).map(item => ({
      teamId: item.team_id,
      teamName: item.team_name,
      departmentId: item.department_id,
      departmentName: item.department_name,
      lastUpdate: item.last_update ? new Date(item.last_update) : null,
      daysSinceUpdate: item.days_since_update
    }))

    return freshness
  } catch (error) {
    console.error("❌ Ошибка при загрузке freshness:", error)
    return []
  }
}

/**
 * Подтверждение актуальности данных команды
 * Вызывает Server Action для безопасной записи в teams_activity
 */
export async function confirmTeamActivity(teamId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    // Вызов Server Action напрямую (без fetch)
    const result = await confirmTeamActivityAction(teamId)
    return result
  } catch (error) {
    console.error("❌ Ошибка при подтверждении активности:", error)

    return {
      success: false,
      error: 'Ошибка при подтверждении. Попробуйте снова'
    }
  }
}

/**
 * Подтверждение актуальности данных нескольких команд (например, всего отдела)
 * Актуализирует все команды параллельно
 */
export async function confirmMultipleTeamsActivity(teamIds: string[]): Promise<{
  success: boolean
  error?: string
}> {
  try {
    // Параллельная актуализация всех команд
    const results = await Promise.all(
      teamIds.map(teamId => confirmTeamActivity(teamId))
    )

    // Проверяем, все ли команды успешно актуализированы
    const failed = results.filter(r => !r.success)

    if (failed.length > 0) {
      return {
        success: false,
        error: `Не удалось актуализировать ${failed.length} команд`
      }
    }

    return { success: true }
  } catch (error) {
    console.error("❌ Ошибка при актуализации команд:", error)
    return {
      success: false,
      error: 'Ошибка при актуализации команд'
    }
  }
}
