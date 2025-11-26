"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  fetchDepartmentProjects,
  fetchDepartmentStats,
  getDepartmentOptions,
  aggregateProjectsByDepartments,
  aggregateDepartmentStats,
  type DepartmentProjectData,
  type DepartmentStats,
  type DepartmentOption,
  type ProjectLoading,
} from "../services/planningAnalyticsService"

interface UsePlanningAnalyticsResult {
  departmentOptions: DepartmentOption[]
  departmentStats: DepartmentStats[]
  departmentProjects: DepartmentProjectData[]
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
  getAggregatedProjects: (selectedDepartmentIds: string[], selectedSubdivisionId?: string | null) => ProjectLoading[]
  getAggregatedStats: (selectedDepartmentIds: string[], selectedSubdivisionId?: string | null) => {
    users_with_loading_count: number
    total_users_count: number
    percentage_users_with_loading: number
    sections_in_work_today: number
    projects_in_work_today: number
    avg_department_loading: number
    total_loading_rate: number
    total_loadings_count: number
    absence_count: number
  }
}

export function usePlanningAnalytics(): UsePlanningAnalyticsResult {
  const [departmentProjects, setDepartmentProjects] = useState<DepartmentProjectData[]>([])
  const [departmentStats, setDepartmentStats] = useState<DepartmentStats[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Загружаем все источники данных параллельно
      const [departmentData, statsData] = await Promise.all([
        fetchDepartmentProjects(),
        fetchDepartmentStats()
      ])

      setDepartmentProjects(departmentData)
      setDepartmentStats(statsData)
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Неизвестная ошибка"))
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Загрузка данных при монтировании компонента
  useEffect(() => {
    loadData()
  }, [loadData])

  // Получение опций для селектора (всегда полный список)
  const departmentOptions = useMemo(() => {
    return getDepartmentOptions(departmentProjects)
  }, [departmentProjects])

  // Функция для получения агрегированных проектов
  const getAggregatedProjects = useCallback((selectedDepartmentIds: string[], selectedSubdivisionId?: string | null): ProjectLoading[] => {
    // Определяем, какие отделы нужно включить
    let departmentIdsToInclude: string[] = []

    // Если выбрано подразделение, но нет выбранных отделов → показываем все отделы подразделения
    if (selectedSubdivisionId && selectedDepartmentIds.length === 0) {
      departmentProjects.forEach(dp => {
        if (dp.subdivision_id === selectedSubdivisionId && !departmentIdsToInclude.includes(dp.department_id)) {
          departmentIdsToInclude.push(dp.department_id)
        }
      })
    }
    // Если есть выбранные отделы → показываем только их
    else if (selectedDepartmentIds.length > 0) {
      departmentIdsToInclude = selectedDepartmentIds
    }
    // Если ничего не выбрано → агрегируем все отделы
    else {
      const allDepartmentIds = Array.from(
        new Set(departmentProjects.map(dp => dp.department_id))
      )
      return aggregateProjectsByDepartments(departmentProjects, allDepartmentIds)
    }

    // Агрегируем данные по выбранным отделам
    return aggregateProjectsByDepartments(departmentProjects, departmentIdsToInclude)
  }, [departmentProjects])

  // Функция для получения агрегированной статистики
  const getAggregatedStats = useCallback((selectedDepartmentIds: string[], selectedSubdivisionId?: string | null) => {
    // Определяем, какие отделы нужно включить
    let departmentIdsToInclude: string[] = []

    // Если выбрано подразделение, но нет выбранных отделов → показываем все отделы подразделения
    if (selectedSubdivisionId && selectedDepartmentIds.length === 0) {
      departmentStats.forEach(ds => {
        if (ds.subdivision_id === selectedSubdivisionId && !departmentIdsToInclude.includes(ds.department_id)) {
          departmentIdsToInclude.push(ds.department_id)
        }
      })
    }
    // Если есть выбранные отделы → показываем только их
    else if (selectedDepartmentIds.length > 0) {
      departmentIdsToInclude = selectedDepartmentIds
    }
    // Если ничего не выбрано → агрегируем все отделы
    else {
      const allDepartmentIds = Array.from(
        new Set(departmentStats.map(ds => ds.department_id))
      )
      return aggregateDepartmentStats(departmentStats, allDepartmentIds)
    }

    // Агрегируем статистику по выбранным отделам
    return aggregateDepartmentStats(departmentStats, departmentIdsToInclude)
  }, [departmentStats])

  return {
    departmentOptions,
    departmentStats,
    departmentProjects,
    isLoading,
    error,
    refresh: loadData,
    getAggregatedProjects,
    getAggregatedStats,
  }
}
