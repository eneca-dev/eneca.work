import { useMemo } from 'react'
import { usePermissions } from '@/modules/permissions/hooks/usePermissions'
import { useUserStore } from '@/stores/useUserStore'

// Приоритет разрешений (от высшего к низшему) - должен совпадать с backend
const HIERARCHY_PRIORITY = [
  'hierarchy.is_admin',
  'hierarchy.is_project_manager',
  'hierarchy.is_subdivision_head',
  'hierarchy.is_department_head',
  'hierarchy.is_team_lead',
  'hierarchy.is_user'
] as const

type HierarchyPermission = typeof HIERARCHY_PRIORITY[number]

/**
 * Определяет наивысшее разрешение из списка
 */
function getHighestHierarchy(permissions: string[]): HierarchyPermission | null {
  for (const hierarchyPermission of HIERARCHY_PRIORITY) {
    if (permissions.includes(hierarchyPermission)) {
      return hierarchyPermission
    }
  }
  return null
}

/**
 * Хук для проверки прав на актуализацию данных команды
 */
export function useTeamActivityPermissions() {
  const { permissions } = usePermissions()
  const userId = useUserStore(state => state.id)
  const userProfile = useUserStore(state => state.profile)

  const highestHierarchy = useMemo(() => {
    return getHighestHierarchy(permissions)
  }, [permissions])

  /**
   * Проверка возможности актуализации конкретной команды
   * @param teamId - ID команды для проверки
   */
  const canActualizeTeam = useMemo(() => {
    return (teamId: string) => {
      if (!highestHierarchy || !userId) return false

      switch (highestHierarchy) {
        case 'hierarchy.is_admin':
        case 'hierarchy.is_project_manager':
        case 'hierarchy.is_subdivision_head':
        case 'hierarchy.is_department_head':
          // Полный доступ (данные уже отфильтрованы при загрузке)
          return true

        case 'hierarchy.is_team_lead':
          // Team lead может актуализировать только команду, в которой он состоит
          // Тимлидов может быть несколько в одной команде
          if (!userProfile) return false
          return teamId === userProfile.teamId || teamId === userProfile.team_id

        default:
          // is_user или неизвестная роль - отказ
          return false
      }
    }
  }, [highestHierarchy, userId, userProfile])

  /**
   * Проверка возможности актуализации отдела (всех его команд)
   * Если пользователь видит отдел в интерфейсе - данные уже отфильтрованы на уровне загрузки
   */
  const canActualizeDepartment = useMemo(() => {
    return () => {
      if (!highestHierarchy || !userId) return false

      switch (highestHierarchy) {
        case 'hierarchy.is_admin':
        case 'hierarchy.is_project_manager':
        case 'hierarchy.is_subdivision_head':
        case 'hierarchy.is_department_head':
          // Полный доступ (данные уже отфильтрованы при загрузке)
          return true

        case 'hierarchy.is_team_lead':
          // Team lead не может актуализировать весь отдел
          return false

        default:
          // is_user или неизвестная роль - отказ
          return false
      }
    }
  }, [highestHierarchy, userId])

  return {
    highestHierarchy,
    canActualizeTeam,
    canActualizeDepartment,
    hasAnyActualizationRights: highestHierarchy !== 'hierarchy.is_user' && highestHierarchy !== null
  }
}
