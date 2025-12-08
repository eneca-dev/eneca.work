'use server'

import { createClient } from "@/utils/supabase/server"
import { getUserPermissions } from "@/modules/permissions/supabase/supabasePermissions"

// Приоритет разрешений (от высшего к низшему)
const HIERARCHY_PRIORITY = [
  'hierarchy.is_admin',
  'hierarchy.is_project_manager',
  'hierarchy.is_subdivision_head',
  'hierarchy.is_department_head',
  'hierarchy.is_team_lead',
  'hierarchy.is_user'
] as const

/**
 * Определяет наивысшее разрешение из списка
 */
function getHighestHierarchy(permissions: string[]): typeof HIERARCHY_PRIORITY[number] | null {
  for (const hierarchyPermission of HIERARCHY_PRIORITY) {
    if (permissions.includes(hierarchyPermission)) {
      return hierarchyPermission
    }
  }
  return null
}

/**
 * Server Action: Подтверждение актуальности данных команды
 * Записывает событие в таблицу teams_activity
 */
export async function confirmTeamActivityAction(teamId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    // Валидация teamId: должен быть непустой строкой
    if (!teamId || typeof teamId !== 'string' || teamId.trim() === '') {
      return {
        success: false,
        error: "teamId должен быть непустой строкой"
      }
    }

    // Получаем supabase клиент (серверный)
    const supabase = await createClient()

    // Проверка авторизации
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        success: false,
        error: "Не авторизован"
      }
    }

    // Получаем разрешения пользователя
    const { permissions } = await getUserPermissions(user.id)
    const highestHierarchy = getHighestHierarchy(permissions)

    if (!highestHierarchy) {
      return {
        success: false,
        error: "Нет прав для актуализации данных"
      }
    }

    // Проверяем доступ в зависимости от уровня разрешений
    switch (highestHierarchy) {
      case 'hierarchy.is_admin':
      case 'hierarchy.is_project_manager':
        // Полный доступ - не нужны дополнительные проверки
        break

      case 'hierarchy.is_subdivision_head': {
        // Проверяем, что команда в его подразделении
        const { data: team } = await supabase
          .from('teams')
          .select('department_id')
          .eq('team_id', teamId)
          .single()

        if (!team?.department_id) {
          console.log(`❌ Команда не найдена или не привязана к отделу`)
          return {
            success: false,
            error: "Команда не найдена"
          }
        }

        const { data: department } = await supabase
          .from('departments')
          .select('subdivision_id')
          .eq('department_id', team.department_id)
          .single()

        const { data: userProfile } = await supabase
          .from('profiles')
          .select('subdivision_id')
          .eq('user_id', user.id)
          .single()

        if (!department?.subdivision_id || !userProfile?.subdivision_id) {
          return {
            success: false,
            error: "Ошибка при проверке прав доступа"
          }
        }

        if (department?.subdivision_id !== userProfile?.subdivision_id) {
          return {
            success: false,
            error: "Нет прав для актуализации команды из другого подразделения"
          }
        }
        break
      }

      case 'hierarchy.is_department_head': {
        // Проверяем, что команда в его отделе
        const { data: team } = await supabase
          .from('teams')
          .select('department_id')
          .eq('team_id', teamId)
          .single()

        const { data: userProfile } = await supabase
          .from('profiles')
          .select('department_id')
          .eq('user_id', user.id)
          .single()

        if (!team?.department_id || !userProfile?.department_id) {
          return {
            success: false,
            error: team ? "Ошибка при проверке прав доступа" : "Команда не найдена"
          }
        }

        if (team?.department_id !== userProfile?.department_id) {
          return {
            success: false,
            error: "Нет прав для актуализации команды из другого отдела"
          }
        }
        break
      }

      case 'hierarchy.is_team_lead': {
        // Проверяем, что пользователь состоит в этой команде
        // Тимлидов может быть несколько в одной команде
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('team_id')
          .eq('user_id', user.id)
          .single()

        if (userProfile?.team_id !== teamId) {
          return {
            success: false,
            error: "Нет прав для актуализации команды, в которой вы не состоите"
          }
        }
        break
      }

      default:
        // is_user или неизвестная роль - отказ
        return {
          success: false,
          error: "Недостаточно прав для актуализации данных"
        }
    }

    // INSERT в teams_activity
    const { error: insertError } = await supabase
      .from("teams_activity")
      .insert({
        team_id: teamId,
        confirmed_by: user.id,
        activity_type: 'data_confirmed',
        confirmed_at: new Date().toISOString()
      })

    if (insertError) {
      console.error("❌ Ошибка при записи в teams_activity:", insertError)

      return {
        success: false,
        error: "Ошибка при записи в БД"
      }
    }

    return { success: true }

  } catch (error) {
    console.error("❌ Внутренняя ошибка в confirmTeamActivityAction:", error)

    return {
      success: false,
      error: "Внутренняя ошибка сервера"
    }
  }
}
