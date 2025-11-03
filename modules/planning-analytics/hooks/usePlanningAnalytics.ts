"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  fetchPlanningAnalyticsSummary,
  fetchDepartmentProjects,
  fetchDepartmentStats,
  getDepartmentOptions,
  aggregateProjectsByDepartments,
  aggregateDepartmentStats,
  type PlanningAnalyticsSummary,
  type DepartmentProjectData,
  type DepartmentStats,
  type DepartmentOption,
  type ProjectLoading,
} from "../services/planningAnalyticsService"

interface UsePlanningAnalyticsResult {
  summary: PlanningAnalyticsSummary | null
  departmentOptions: DepartmentOption[]
  departmentStats: DepartmentStats[]
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
  getAggregatedProjects: (selectedDepartmentIds: string[]) => ProjectLoading[]
  getAggregatedStats: (selectedDepartmentIds: string[]) => {
    users_with_loading_count: number
    total_users_count: number
    percentage_users_with_loading: number
    sections_in_work_today: number
    projects_in_work_today: number
    avg_department_loading: number
  }
}

export function usePlanningAnalytics(): UsePlanningAnalyticsResult {
  const [summary, setSummary] = useState<PlanningAnalyticsSummary | null>(null)
  const [departmentProjects, setDepartmentProjects] = useState<DepartmentProjectData[]>([])
  const [departmentStats, setDepartmentStats] = useState<DepartmentStats[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Загружаем все источники данных параллельно
      const [summaryData, departmentData, statsData] = await Promise.all([
        fetchPlanningAnalyticsSummary(),
        fetchDepartmentProjects(),
        fetchDepartmentStats()
      ])

      setSummary(summaryData)
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

  // Получение опций для селектора
  const departmentOptions = useMemo(() => {
    return getDepartmentOptions(departmentProjects)
  }, [departmentProjects])

  // Функция для получения агрегированных проектов
  const getAggregatedProjects = useCallback((selectedDepartmentIds: string[]): ProjectLoading[] => {
    // Если выбрано "Общее" (и только оно), возвращаем данные из summary
    if (selectedDepartmentIds.includes("all") && selectedDepartmentIds.length === 1) {
      return summary?.top_projects_by_loading || []
    }

    // Фильтруем только реальные отделы (исключаем "all")
    const departmentIds = selectedDepartmentIds.filter(id => id !== "all")

    // Если нет выбранных отделов, возвращаем общие данные
    if (departmentIds.length === 0) {
      return summary?.top_projects_by_loading || []
    }

    // Агрегируем данные по выбранным отделам
    return aggregateProjectsByDepartments(departmentProjects, departmentIds)
  }, [summary, departmentProjects])

  // Функция для получения агрегированной статистики
  const getAggregatedStats = useCallback((selectedDepartmentIds: string[]) => {
    // Если выбрано "Общее" (и только оно), возвращаем данные из summary
    if (selectedDepartmentIds.includes("all") && selectedDepartmentIds.length === 1) {
      return {
        users_with_loading_count: summary?.users_with_loading_count || 0,
        total_users_count: summary?.total_users_count || 0,
        percentage_users_with_loading: summary?.percentage_users_with_loading || 0,
        sections_in_work_today: summary?.sections_in_work_today || 0,
        projects_in_work_today: summary?.projects_in_work_today || 0,
        avg_department_loading: summary?.avg_department_loading || 0
      }
    }

    // Фильтруем только реальные отделы (исключаем "all")
    const departmentIds = selectedDepartmentIds.filter(id => id !== "all")

    // Если нет выбранных отделов, возвращаем общие данные
    if (departmentIds.length === 0) {
      return {
        users_with_loading_count: summary?.users_with_loading_count || 0,
        total_users_count: summary?.total_users_count || 0,
        percentage_users_with_loading: summary?.percentage_users_with_loading || 0,
        sections_in_work_today: summary?.sections_in_work_today || 0,
        projects_in_work_today: summary?.projects_in_work_today || 0,
        avg_department_loading: summary?.avg_department_loading || 0
      }
    }

    // Агрегируем статистику по выбранным отделам
    return aggregateDepartmentStats(departmentStats, departmentIds)
  }, [summary, departmentStats])

  return {
    summary,
    departmentOptions,
    departmentStats,
    isLoading,
    error,
    refresh: loadData,
    getAggregatedProjects,
    getAggregatedStats,
  }
}
