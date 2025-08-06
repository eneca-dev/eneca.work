import { useEffect, useState } from "react"
import { useUserStore } from "@/stores/useUserStore"
import { useUserPermissions } from "./useUserPermissions"

interface UsersFilters {
  departments: string[] // Названия отделов  
  teams: string[]       // Названия команд
  categories: string[]  // Названия категорий
  positions: string[]   // Названия должностей
  workLocations: string[]
  roles: string[]
}

interface SmartFiltersConfig {
  // Заблокированные фильтры (пользователь не может их изменить)
  lockedFilters: {
    departments?: boolean
    teams?: boolean
    categories?: boolean
    positions?: boolean
    workLocations?: boolean
    roles?: boolean
  }
  // Преднастроенные значения фильтров
  presetFilters: UsersFilters
  // Можно ли сбросить фильтры
  canResetFilters: boolean
}

export function useUsersSmartFilters() {
  const userProfile = useUserStore(state => state.profile)
  const { 
    isAdmin, 
    isDepartmentHead, 
    isProjectManager, 
    isTeamLead, 
    isUser 
  } = useUserPermissions()
  
  const [config, setConfig] = useState<SmartFiltersConfig>({
    lockedFilters: {},
    presetFilters: {
      departments: [],
      teams: [],
      categories: [],
      positions: [],
      workLocations: [],
      roles: []
    },
    canResetFilters: true
  })

  useEffect(() => {
    if (!userProfile) return

    const newConfig: SmartFiltersConfig = {
      lockedFilters: {},
      presetFilters: {
        departments: [],
        teams: [],
        categories: [],
        positions: [],
        workLocations: [],
        roles: []
      },
      canResetFilters: true
    }

    // 🔴 Администратор - видит всех, никаких ограничений
    if (isAdmin) {
      setConfig(newConfig)
      return
    }

    // 🟠 Руководитель отдела - видит только свой отдел
    if (isDepartmentHead && userProfile.departmentId) {
      newConfig.lockedFilters.departments = true
      // TODO: Преобразовать departmentId в название отдела
      // newConfig.presetFilters.departments = [getDepartmentNameById(userProfile.departmentId)]
      newConfig.canResetFilters = false // Не может сбросить фильтр отдела
    }

    // 🟢 Руководитель команды - видит только свой отдел и команду  
    if (isTeamLead && userProfile.departmentId && userProfile.teamId) {
      newConfig.lockedFilters.departments = true
      newConfig.lockedFilters.teams = true
      // TODO: Преобразовать ID в названия
      // newConfig.presetFilters.departments = [getDepartmentNameById(userProfile.departmentId)]
      // newConfig.presetFilters.teams = [getTeamNameById(userProfile.teamId)]
      newConfig.canResetFilters = false // Не может сбросить фильтры
    }

    // 🔵 Руководитель проекта - пока видит всех (в будущем ограничим участниками проектов)
    if (isProjectManager) {
      // TODO: Добавить ограничения по участникам проектов
      // newConfig.presetFilters.projects = getUserManagedProjects()
    }

    // 🔷 Обычный пользователь - видит всех (или в будущем только своих коллег)
    if (isUser) {
      // TODO: Возможно ограничить видимостью только своего отдела для обычных пользователей
    }

    setConfig(newConfig)
  }, [userProfile, isAdmin, isDepartmentHead, isProjectManager, isTeamLead, isUser])

  // Функция проверки заблокирован ли фильтр
  const isFilterLocked = (filterType: keyof UsersFilters): boolean => {
    return config.lockedFilters[filterType] ?? false
  }

  // Функция получения преднастроенных значений для фильтра
  const getPresetValue = (filterType: keyof UsersFilters): string[] => {
    return config.presetFilters[filterType] ?? []
  }

  // Функция проверки можно ли сбросить фильтры
  const canResetFilters = (): boolean => {
    return config.canResetFilters
  }

  // Функция получения подсказки почему фильтр заблокирован
  const getFilterLockReason = (filterType: keyof UsersFilters): string | null => {
    if (!isFilterLocked(filterType)) return null

    if (isDepartmentHead && filterType === 'departments') {
      return 'Руководитель отдела видит только пользователей своего отдела'
    }

    if (isTeamLead && (filterType === 'departments' || filterType === 'teams')) {
      return 'Руководитель команды видит только пользователей своей команды'
    }

    return 'Фильтр заблокирован согласно вашим правам доступа'
  }

  return {
    config,
    isFilterLocked,
    getPresetValue,
    canResetFilters,
    getFilterLockReason
  }
} 