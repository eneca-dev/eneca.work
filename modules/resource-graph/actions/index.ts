/**
 * Resource Graph Module - Server Actions
 *
 * Server Actions для модуля графика ресурсов
 * Все actions используют RLS и типобезопасны
 */

'use server'

import { createClient } from '@/utils/supabase/server'
import type {
  ResourceGraphFilters,
  Project,
  ResourceGraphRow,
  ProjectTag,
  CompanyCalendarEvent,
} from '../types'
import { transformRowsToHierarchy } from '../utils'

// ============================================================================
// Result Types
// ============================================================================

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

// ============================================================================
// Query Actions
// ============================================================================

/**
 * Получить данные для графика ресурсов
 *
 * Загружает полную иерархию: Проект → Стадия → Объект → Раздел → Этап декомпозиции → Элемент декомпозиции
 *
 * @param filters - Фильтры для запроса
 * @returns Список проектов с полной структурой
 */
export async function getResourceGraphData(
  filters?: ResourceGraphFilters
): Promise<ActionResult<Project[]>> {
  try {
    const supabase = await createClient()

    // Build query
    let query = supabase
      .from('v_resource_graph')
      .select('*')

    // Apply tag filter first (requires subquery to get project IDs)
    let projectIdsFromTags: string[] | null = null
    if (filters?.tagIds && filters.tagIds.length > 0) {
      const { data: tagLinks, error: tagError } = await supabase
        .from('project_tag_links')
        .select('project_id')
        .in('tag_id', filters.tagIds)

      if (tagError) {
        console.error('[getResourceGraphData] Tag filter error:', tagError)
        return { success: false, error: tagError.message }
      }

      // Get unique project IDs
      projectIdsFromTags = [...new Set(tagLinks?.map(l => l.project_id) || [])]

      // If no projects match tags, return empty result
      if (projectIdsFromTags.length === 0) {
        return { success: true, data: [] }
      }

      query = query.in('project_id', projectIdsFromTags)
    }

    // Apply filters
    if (filters?.managerId) {
      query = query.eq('manager_id', filters.managerId)
    }

    if (filters?.projectId) {
      query = query.eq('project_id', filters.projectId)
    }

    if (filters?.stageId) {
      query = query.eq('stage_id', filters.stageId)
    }

    if (filters?.objectId) {
      query = query.eq('object_id', filters.objectId)
    }

    if (filters?.sectionId) {
      query = query.eq('section_id', filters.sectionId)
    }

    if (filters?.employeeId) {
      // Filter by responsible (section or item)
      query = query.or(
        `section_responsible_id.eq.${filters.employeeId},item_responsible_id.eq.${filters.employeeId}`
      )
    }

    if (filters?.search) {
      // Search in project, stage, object, section names
      query = query.or(
        `project_name.ilike.%${filters.search}%,` +
        `stage_name.ilike.%${filters.search}%,` +
        `object_name.ilike.%${filters.search}%,` +
        `section_name.ilike.%${filters.search}%`
      )
    }

    // Order for consistent hierarchy
    query = query
      .order('project_name')
      .order('stage_name')
      .order('object_name')
      .order('section_name')
      .order('decomposition_stage_name')
      .order('decomposition_item_order')

    const { data, error } = await query

    if (error) {
      console.error('[getResourceGraphData] Supabase error:', error)
      return { success: false, error: error.message }
    }

    // Transform flat rows to hierarchy
    const projects = transformRowsToHierarchy(data as ResourceGraphRow[])

    return { success: true, data: projects }
  } catch (error) {
    console.error('[getResourceGraphData] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки данных',
    }
  }
}

/**
 * Получить данные загрузки для конкретного пользователя
 *
 * @param userId - ID пользователя
 * @param dateRange - Диапазон дат (опционально)
 * @returns Данные проектов где пользователь является ответственным
 */
export async function getUserWorkload(
  userId: string,
  dateRange?: { start: string; end: string }
): Promise<ActionResult<Project[]>> {
  try {
    const supabase = await createClient()

    // Build query - filter by responsible
    let query = supabase
      .from('v_resource_graph')
      .select('*')
      .or(`section_responsible_id.eq.${userId},item_responsible_id.eq.${userId}`)

    // Apply date range filter if provided
    if (dateRange) {
      // Filter by decomposition stage dates
      query = query
        .or(
          `decomposition_stage_start.gte.${dateRange.start},` +
          `decomposition_stage_finish.lte.${dateRange.end},` +
          `decomposition_item_planned_due_date.gte.${dateRange.start},` +
          `decomposition_item_planned_due_date.lte.${dateRange.end}`
        )
    }

    // Order for consistent hierarchy
    query = query
      .order('project_name')
      .order('stage_name')
      .order('object_name')
      .order('section_name')
      .order('decomposition_stage_name')
      .order('decomposition_item_order')

    const { data, error } = await query

    if (error) {
      console.error('[getUserWorkload] Supabase error:', error)
      return { success: false, error: error.message }
    }

    // Transform flat rows to hierarchy
    const projects = transformRowsToHierarchy(data as ResourceGraphRow[])

    return { success: true, data: projects }
  } catch (error) {
    console.error('[getUserWorkload] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки данных',
    }
  }
}

// ============================================================================
// Tag Actions
// ============================================================================

/**
 * Получить все теги проектов
 *
 * @returns Список тегов с id, name, color
 */
export async function getProjectTags(): Promise<ActionResult<ProjectTag[]>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('project_tags')
      .select('tag_id, name, color')
      .order('name')

    if (error) {
      console.error('[getProjectTags] Supabase error:', error)
      return { success: false, error: error.message }
    }

    const tags: ProjectTag[] = (data || []).map(row => ({
      id: row.tag_id,
      name: row.name,
      color: row.color,
    }))

    return { success: true, data: tags }
  } catch (error) {
    console.error('[getProjectTags] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки тегов',
    }
  }
}

// ============================================================================
// Filter Structure Actions (загрузка всей структуры за один запрос)
// ============================================================================

/**
 * Загрузить полную организационную структуру для фильтров
 * Загружается один раз и кешируется на клиенте
 */
export async function getOrgStructure(): Promise<ActionResult<{
  subdivisions: Array<{ id: string; name: string }>
  departments: Array<{ id: string; name: string; subdivisionId: string | null }>
  teams: Array<{ id: string; name: string; departmentId: string | null }>
  employees: Array<{ id: string; name: string; teamId: string | null }>
}>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('v_org_structure')
      .select('*')

    if (error) {
      console.error('[getOrgStructure] Supabase error:', error)
      return { success: false, error: error.message }
    }

    // Преобразуем плоские данные в уникальные списки
    const subdivisionsMap = new Map<string, { id: string; name: string }>()
    const departmentsMap = new Map<string, { id: string; name: string; subdivisionId: string | null }>()
    const teamsMap = new Map<string, { id: string; name: string; departmentId: string | null }>()
    const employeesMap = new Map<string, { id: string; name: string; teamId: string | null }>()

    for (const row of data || []) {
      if (row.subdivision_id) {
        subdivisionsMap.set(row.subdivision_id, {
          id: row.subdivision_id,
          name: row.subdivision_name || 'Без названия',
        })
      }

      if (row.department_id) {
        departmentsMap.set(row.department_id, {
          id: row.department_id,
          name: row.department_name || 'Без названия',
          subdivisionId: row.department_subdivision_id,
        })
      }

      if (row.team_id) {
        teamsMap.set(row.team_id, {
          id: row.team_id,
          name: row.team_name || 'Без названия',
          departmentId: row.team_department_id,
        })
      }

      if (row.employee_id) {
        employeesMap.set(row.employee_id, {
          id: row.employee_id,
          name: row.employee_name?.trim() || 'Без имени',
          teamId: row.employee_team_id,
        })
      }
    }

    return {
      success: true,
      data: {
        subdivisions: Array.from(subdivisionsMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
        departments: Array.from(departmentsMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
        teams: Array.from(teamsMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
        employees: Array.from(employeesMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
      },
    }
  } catch (error) {
    console.error('[getOrgStructure] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки организационной структуры',
    }
  }
}

/**
 * Загрузить полную проектную структуру для фильтров
 * Загружается один раз и кешируется на клиенте
 */
export async function getProjectStructure(): Promise<ActionResult<{
  managers: Array<{ id: string; name: string }>
  projects: Array<{ id: string; name: string; managerId: string | null }>
  stages: Array<{ id: string; name: string; projectId: string | null }>
  objects: Array<{ id: string; name: string; stageId: string | null }>
  sections: Array<{ id: string; name: string; objectId: string | null }>
}>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('v_project_structure')
      .select('*')

    if (error) {
      console.error('[getProjectStructure] Supabase error:', error)
      return { success: false, error: error.message }
    }

    // Преобразуем плоские данные в уникальные списки
    const managersMap = new Map<string, { id: string; name: string }>()
    const projectsMap = new Map<string, { id: string; name: string; managerId: string | null }>()
    const stagesMap = new Map<string, { id: string; name: string; projectId: string | null }>()
    const objectsMap = new Map<string, { id: string; name: string; stageId: string | null }>()
    const sectionsMap = new Map<string, { id: string; name: string; objectId: string | null }>()

    for (const row of data || []) {
      if (row.manager_id) {
        managersMap.set(row.manager_id, {
          id: row.manager_id,
          name: row.manager_name?.trim() || 'Без имени',
        })
      }

      if (row.project_id) {
        projectsMap.set(row.project_id, {
          id: row.project_id,
          name: row.project_name || 'Без названия',
          managerId: row.project_manager,
        })
      }

      if (row.stage_id) {
        stagesMap.set(row.stage_id, {
          id: row.stage_id,
          name: row.stage_name || 'Без названия',
          projectId: row.stage_project_id,
        })
      }

      if (row.object_id) {
        objectsMap.set(row.object_id, {
          id: row.object_id,
          name: row.object_name || 'Без названия',
          stageId: row.object_stage_id,
        })
      }

      if (row.section_id) {
        sectionsMap.set(row.section_id, {
          id: row.section_id,
          name: row.section_name || 'Без названия',
          objectId: row.section_object_id,
        })
      }
    }

    return {
      success: true,
      data: {
        managers: Array.from(managersMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
        projects: Array.from(projectsMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
        stages: Array.from(stagesMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
        objects: Array.from(objectsMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
        sections: Array.from(sectionsMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
      },
    }
  } catch (error) {
    console.error('[getProjectStructure] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки проектной структуры',
    }
  }
}

// ============================================================================
// Calendar Actions - Праздники и переносы
// ============================================================================

/**
 * Получить глобальные события календаря (праздники и переносы)
 *
 * Возвращает только глобальные события компании (is_global = true)
 * с типом "Праздник" или "Перенос"
 *
 * @returns Список праздников и переносов рабочих дней
 */
export async function getCompanyCalendarEvents(): Promise<ActionResult<CompanyCalendarEvent[]>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('calendar_events')
      .select(`
        calendar_event_id,
        calendar_event_type,
        calendar_event_date_start,
        calendar_event_date_end,
        calendar_event_comment,
        calendar_event_is_weekday
      `)
      .eq('calendar_event_is_global', true)
      .in('calendar_event_type', ['Праздник', 'Перенос'])
      .order('calendar_event_date_start')

    if (error) {
      console.error('[getCompanyCalendarEvents] Supabase error:', error)
      return { success: false, error: error.message }
    }

    const events: CompanyCalendarEvent[] = (data || []).map(row => ({
      id: row.calendar_event_id,
      type: row.calendar_event_type as 'Праздник' | 'Перенос',
      dateStart: row.calendar_event_date_start,
      dateEnd: row.calendar_event_date_end,
      name: row.calendar_event_comment,
      isWorkday: row.calendar_event_is_weekday,
    }))

    return { success: true, data: events }
  } catch (error) {
    console.error('[getCompanyCalendarEvents] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки календарных событий',
    }
  }
}

