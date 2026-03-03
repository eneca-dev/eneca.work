'use server'

/**
 * Альтернативная версия fetchProjectsList через RPC функцию
 * Используйте эту версию если обычный запрос через view медленный
 */

import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/modules/cache'
import type { ProjectListItem, FetchProjectsListInput } from './projects-tree'

/**
 * Загрузка списка проектов через RPC функцию (быстрее чем через view)
 */
export async function fetchProjectsListRPC(
  input: FetchProjectsListInput
): Promise<ActionResult<ProjectListItem[]>> {
  try {
    const supabase = await createClient()

    // Вызов RPC функции
    const { data, error } = await supabase.rpc('get_projects_list', {
      p_mode: input.mode,
      p_user_id: input.userId,
    })

    if (error) {
      console.error('[fetchProjectsListRPC] Supabase error:', error)
      return {
        success: false,
        error: `Не удалось загрузить список проектов: ${error.message}`,
      }
    }

    // Маппинг данных из RPC в ProjectListItem
    const projects: ProjectListItem[] = (data || []).map((row) => ({
      id: row.project_id,
      name: row.node_name || 'Неизвестный проект',
      status: row.project_status || 'unknown',
      managerId: row.manager_id,
      managerName: row.manager_name,
      managerAvatar: row.manager_avatar,
      isFavorite: row.is_favorite || false,
      stage_type: row.stage_type,
    }))

    return { success: true, data: projects }
  } catch (error) {
    console.error('[fetchProjectsListRPC] Error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Произошла неизвестная ошибка при загрузке списка проектов',
    }
  }
}
