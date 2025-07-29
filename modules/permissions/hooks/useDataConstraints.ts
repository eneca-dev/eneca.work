import { useEffect } from 'react'
import { useUserStore } from '@/stores/useUserStore'
import { useDataScopeStore } from '../store/useDataScopeStore'
import { usePermissionsStore } from '../store/usePermissionsStore'
import type { UseDataConstraintsReturn } from '../types'

/**
 * Хук для работы с ограничениями данных
 */
export const useDataConstraints = (): UseDataConstraintsReturn => {
  const userId = useUserStore(state => state.id)
  const userProfile = useUserStore(state => state.profile)
  
  const constraints = usePermissionsStore(state => state.constraints)
  
  const {
    dataScope,
    isLoading,
    error,
    loadAvailableProjects,
    loadAvailableDepartments,
    loadAvailableTeams,
    loadAvailableUsers,
    isDataTypeLocked,
    updateFromPermissions
  } = useDataScopeStore()

  // Обновляем область данных при изменении разрешений
  useEffect(() => {
    if (constraints.length > 0) {
      updateFromPermissions()
    }
  }, [constraints, updateFromPermissions])

  return {
    constraints,
    dataScope,
    getAvailableProjects: loadAvailableProjects,
    getAvailableDepartments: loadAvailableDepartments,
    getAvailableTeams: loadAvailableTeams,
    isDataLocked: isDataTypeLocked
  }
}

/**
 * Хук для работы с фильтрами на основе ограничений
 */
export const useFilterConstraints = () => {
  const userProfile = useUserStore(state => state.profile)
  const { dataScope, getFilterConstraint } = useDataScopeStore()

  const getAvailableProjects = async () => {
    // TODO: Реализовать загрузку проектов с учетом ограничений
    switch (dataScope.projects) {
      case 'all':
        return [] // Все проекты
      case 'managed':
        return [] // Только управляемые проекты
      case 'participated':
        return [] // Только проекты с участием
      default:
        return []
    }
  }

  const getAvailableDepartments = async () => {
    // TODO: Реализовать загрузку отделов с учетом ограничений
    switch (dataScope.departments) {
      case 'all':
        return [] // Все отделы
      case 'own':
        return userProfile?.departmentId ? [{ id: userProfile.departmentId }] : []
      case 'managed':
        return [] // Управляемые отделы
      default:
        return []
    }
  }

  const getAvailableTeams = async () => {
    // TODO: Реализовать загрузку команд с учетом ограничений
    switch (dataScope.teams) {
      case 'all':
        return [] // Все команды
      case 'department':
        return [] // Команды отдела
      case 'own':
        return userProfile?.teamId ? [{ id: userProfile.teamId }] : []
      default:
        return []
    }
  }

  const getAvailableUsers = async () => {
    // TODO: Реализовать загрузку пользователей с учетом ограничений
    switch (dataScope.users) {
      case 'all':
        return [] // Все пользователи
      case 'department':
        return [] // Пользователи отдела
      case 'team':
        return [] // Пользователи команды
             case 'self':
         return userProfile ? [{ id: userId }] : []
      default:
        return []
    }
  }

  const isFilterLocked = (filterType: string): boolean => {
    const constraint = getFilterConstraint(filterType)
    return constraint.isLocked
  }

  const getDefaultFilterValue = (filterType: string): string | undefined => {
    const constraint = getFilterConstraint(filterType)
    return constraint.defaultValue
  }

  const getFilterOptions = (filterType: string): any[] => {
    const constraint = getFilterConstraint(filterType)
    return constraint.availableOptions
  }

  return {
    getAvailableProjects,
    getAvailableDepartments,
    getAvailableTeams,
    getAvailableUsers,
    isFilterLocked,
    getDefaultFilterValue,
    getFilterOptions,
    dataScope
  }
}

/**
 * Хук для проверки блокировки конкретного типа данных
 */
export const useIsDataLocked = (dataType: 'projects' | 'departments' | 'teams' | 'users'): boolean => {
  const { isDataLocked } = useDataConstraints()
  return isDataLocked(dataType)
}

/**
 * Хук для получения доступных опций для фильтра
 */
export const useFilterOptions = (filterType: string) => {
  const { getFilterOptions, isFilterLocked, getDefaultFilterValue } = useFilterConstraints()
  
  return {
    options: getFilterOptions(filterType),
    isLocked: isFilterLocked(filterType),
    defaultValue: getDefaultFilterValue(filterType)
  }
} 