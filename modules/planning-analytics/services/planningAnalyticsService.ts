import * as Sentry from "@sentry/nextjs"
import { supabase } from "@/lib/supabase-client"

export interface ProjectLoading {
  project_id: string
  project_name: string
  total_loadings_count: number
  total_loading_rate: number
  rank: number
}

export interface DepartmentProjectData {
  analytics_date: string
  department_id: string
  department_name: string
  subdivision_id: string | null
  subdivision_name: string | null
  project_id: string
  project_name: string
  users_count: number
  total_loading_rate: number
  rank: number
}

export interface DepartmentOption {
  id: string
  name: string
  type: "all" | "subdivision" | "department"
}

export interface DepartmentStats {
  analytics_date: string
  department_id: string
  department_name: string
  subdivision_id: string | null
  subdivision_name: string | null
  total_users: number
  users_with_loading: number
  percentage_users_with_loading: number
  sections_in_work_today: number
  projects_in_work_today: number
  total_loading_rate: number
  avg_department_loading: number
  section_ids_array: string[]
  project_ids_array: string[]
  users_without_loading?: Array<{
    first_name: string
    last_name: string
  }>
  total_loadings_count: number
  absence_count: number
}

/**
 * Получение данных по проектам всех отделов
 */
export async function fetchDepartmentProjects(): Promise<DepartmentProjectData[]> {
  return Sentry.startSpan(
    {
      op: "db.query",
      name: "Загрузка данных по проектам отделов",
    },
    async (span) => {
      try {
        span.setAttribute("table", "view_planning_analytics_departments_projects")

        const { data, error } = await supabase
          .from("view_planning_analytics_departments_projects_2")
          .select("*")
          .order("department_id")
          .order("rank")

        if (error) {
          span.setAttribute("db.success", false)
          span.setAttribute("db.error", error.message)

          Sentry.captureException(error, {
            tags: {
              module: 'planning-analytics',
              action: 'fetch_department_projects',
              table: 'view_planning_analytics_departments_projects'
            },
            extra: {
              error_code: error.code,
              error_details: error.details,
              error_hint: error.hint,
              timestamp: new Date().toISOString()
            }
          })
          return []
        }

        span.setAttribute("db.success", true)
        span.setAttribute("rows_count", data?.length || 0)

        return (data || []) as DepartmentProjectData[]
      } catch (error) {
        // This catch now only handles unexpected errors (non-Supabase errors)
        span.setAttribute("db.success", false)

        Sentry.captureException(error, {
          tags: {
            module: 'planning-analytics',
            action: 'fetch_department_projects',
            error_type: 'unexpected_error'
          },
          extra: {
            timestamp: new Date().toISOString()
          }
        })
        return []
      }
    }
  )
}

/**
 * Получение списка подразделений и отделов для селектора
 * Всегда возвращает полный список подразделений и отделов
 */
export function getDepartmentOptions(
  departmentProjects: DepartmentProjectData[]
): DepartmentOption[] {
  const uniqueSubdivisions = new Map<string, string>()
  const uniqueDepartments = new Map<string, string>()

  departmentProjects.forEach(item => {
    // Добавляем подразделение, если оно есть
    if (item.subdivision_id && item.subdivision_name && !uniqueSubdivisions.has(item.subdivision_id)) {
      uniqueSubdivisions.set(item.subdivision_id, item.subdivision_name)
    }

    // Добавляем отдел
    if (!uniqueDepartments.has(item.department_id)) {
      uniqueDepartments.set(item.department_id, item.department_name)
    }
  })

  const options: DepartmentOption[] = []

  // Добавляем подразделения
  uniqueSubdivisions.forEach((name, id) => {
    options.push({ id, name, type: "subdivision" })
  })

  // Добавляем отделы
  uniqueDepartments.forEach((name, id) => {
    options.push({ id, name, type: "department" })
  })

  return options
}

/**
 * Получение статистики по всем отделам
 */
export async function fetchDepartmentStats(): Promise<DepartmentStats[]> {
  return Sentry.startSpan(
    {
      op: "db.query",
      name: "Загрузка статистики по отделам",
    },
    async (span) => {
      try {
        span.setAttribute("table", "view_planning_analytics_departments")

        const { data, error } = await supabase
          .from("view_planning_analytics_departments_2")
          .select("*")
          .order("avg_department_loading", { ascending: false })

        if (error) {
          span.setAttribute("db.success", false)
          span.setAttribute("db.error", error.message)

          Sentry.captureException(error, {
            tags: {
              module: 'planning-analytics',
              action: 'fetch_department_stats',
              table: 'view_planning_analytics_departments'
            },
            extra: {
              error_code: error.code,
              error_details: error.details,
              error_hint: error.hint,
              timestamp: new Date().toISOString()
            }
          })
          return []
        }

        span.setAttribute("db.success", true)
        span.setAttribute("rows_count", data?.length || 0)

        return (data as DepartmentStats[]) || []
      } catch (error) {
        // This catch now only handles unexpected errors (non-Supabase errors)
        span.setAttribute("db.success", false)

        Sentry.captureException(error, {
          tags: {
            module: 'planning-analytics',
            action: 'fetch_department_stats',
            error_type: 'unexpected_error'
          },
          extra: {
            timestamp: new Date().toISOString()
          }
        })
        return []
      }
    }
  )
}

/**
 * Агрегация статистики по выбранным отделам
 */
export function aggregateDepartmentStats(
  departmentStats: DepartmentStats[],
  selectedDepartmentIds: string[]
): {
  users_with_loading_count: number
  total_users_count: number
  percentage_users_with_loading: number
  sections_in_work_today: number
  projects_in_work_today: number
  avg_department_loading: number
  total_loading_rate: number
  total_loadings_count: number
} {
  // Фильтруем статистику по выбранным отделам
  const filteredStats = departmentStats.filter(stat =>
    selectedDepartmentIds.includes(stat.department_id)
  )

  if (filteredStats.length === 0) {
    return {
      users_with_loading_count: 0,
      total_users_count: 0,
      percentage_users_with_loading: 0,
      sections_in_work_today: 0,
      projects_in_work_today: 0,
      avg_department_loading: 0,
      total_loading_rate: 0,
      total_loadings_count: 0
    }
  }

  // Суммируем показатели
  const totalUsers = filteredStats.reduce((sum, stat) => sum + stat.total_users, 0)
  const usersWithLoading = filteredStats.reduce((sum, stat) => sum + stat.users_with_loading, 0)
  const totalLoadingRate = filteredStats.reduce((sum, stat) => sum + Number(stat.total_loading_rate), 0)
  const totalLoadingsCount = filteredStats.reduce((sum, stat) => sum + stat.total_loadings_count, 0)

  // Собираем уникальные ID разделов и проектов через Set
  const uniqueSectionIds = new Set<string>()
  const uniqueProjectIds = new Set<string>()

  filteredStats.forEach(stat => {
    // Добавляем все ID разделов из массива
    if (stat.section_ids_array && Array.isArray(stat.section_ids_array)) {
      stat.section_ids_array.forEach(id => {
        if (id) uniqueSectionIds.add(id)
      })
    }

    // Добавляем все ID проектов из массива
    if (stat.project_ids_array && Array.isArray(stat.project_ids_array)) {
      stat.project_ids_array.forEach(id => {
        if (id) uniqueProjectIds.add(id)
      })
    }
  })

  const absenceCount = filteredStats.reduce((sum, stat) => sum + (stat.absence_count || 0), 0)

  return {
    users_with_loading_count: usersWithLoading,
    total_users_count: totalUsers,
    percentage_users_with_loading: totalUsers > 0
      ? Number(((usersWithLoading / totalUsers) * 100).toFixed(2))
      : 0,
    sections_in_work_today: uniqueSectionIds.size,
    projects_in_work_today: uniqueProjectIds.size,
    avg_department_loading: totalUsers > 0
      ? Number((totalLoadingRate / totalUsers).toFixed(2))
      : 0,
    total_loading_rate: totalLoadingRate,
    total_loadings_count: totalLoadingsCount,
    absence_count: absenceCount
  }
}

/**
 * Агрегация проектов по выбранным отделам
 */
export function aggregateProjectsByDepartments(
  departmentProjects: DepartmentProjectData[],
  selectedDepartmentIds: string[]
): ProjectLoading[] {
  // Фильтруем проекты по выбранным отделам
  const filteredProjects = departmentProjects.filter(item =>
    selectedDepartmentIds.includes(item.department_id)
  )

  // Группируем по проектам и суммируем загрузки
  const projectMap = new Map<string, {
    project_id: string
    project_name: string
    total_loadings_count: number
    total_loading_rate: number
  }>()

  filteredProjects.forEach(item => {
    const existing = projectMap.get(item.project_id)
    if (existing) {
      existing.total_loadings_count += item.users_count
      existing.total_loading_rate += Number(item.total_loading_rate)
    } else {
      projectMap.set(item.project_id, {
        project_id: item.project_id,
        project_name: item.project_name,
        total_loadings_count: item.users_count,
        total_loading_rate: Number(item.total_loading_rate)
      })
    }
  })

  // Сортируем по коэффициенту загрузки (total_loading_rate) как в SQL view и берём топ-10
  const projects = Array.from(projectMap.values())
    .sort((a, b) => b.total_loading_rate - a.total_loading_rate)
    .slice(0, 10)
    .map((project, index) => ({
      ...project,
      rank: index + 1
    }))

  return projects
}

