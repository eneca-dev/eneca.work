/**
 * Resource Graph Module - Server Actions
 *
 * Server Actions для модуля графика ресурсов
 * Все actions используют RLS и типобезопасны
 */

'use server'

import { createClient } from '@/utils/supabase/server'
import * as Sentry from '@sentry/nextjs'
import type { ActionResult, PaginatedActionResult } from '@/modules/cache'
import type {
  Project,
  ResourceGraphRow,
  ProjectTag,
  CompanyCalendarEvent,
  WorkLog,
  Loading,
  ReadinessPoint,
  StageResponsible,
  SectionsBatchData,
  SectionsBatchOptions,
  BatchCheckpoint,
  BatchBudget,
} from '../types'
import { transformRowsToHierarchy } from '../utils'
import { formatMinskDate, getTodayMinsk } from '@/lib/timezone-utils'
import type { FilterQueryParams } from '@/modules/inline-filter'
import { getFilterContext } from '@/modules/permissions/server/get-filter-context'
import { applyMandatoryFilters } from '@/modules/permissions/utils/mandatory-filters'

// ============================================================================
// Query Actions
// ============================================================================

/**
 * Получить данные для графика ресурсов
 *
 * Загружает полную иерархию: Проект → Стадия → Объект → Раздел → Этап декомпозиции → Элемент декомпозиции
 * Фильтрация по разделу: если раздел проходит фильтр, вся структура выше и ниже тоже проходит
 *
 * @param filters - Параметры фильтрации (из InlineFilter)
 * @param pagination - Параметры пагинации { page: number, pageSize: number }
 * @returns Список проектов с полной структурой + pagination info
 */
export async function getResourceGraphData(
  filters?: FilterQueryParams,
  pagination?: { page: number; pageSize: number }
): Promise<PaginatedActionResult<Project>> {
  try {
    const supabase = await createClient()

    // 🔒 Получаем контекст разрешений и применяем обязательные фильтры
    const filterContextResult = await getFilterContext()
    const filterContext = filterContextResult.success ? filterContextResult.data : null
    const secureFilters = applyMandatoryFilters(filters || {}, filterContext)

    // Build query
    let query = supabase
      .from('v_resource_graph')
      .select('*')

    // Apply tag filter first (requires subquery to get project IDs)
    // Метки передаются как названия, нужно сначала найти их ID
    const tagValues = secureFilters?.tag_id
    if (tagValues) {
      const tagArray = Array.isArray(tagValues) ? tagValues : [tagValues]
      if (tagArray.length > 0) {
        // Проверяем: это UUID или названия?
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tagArray[0])

        let tagUuids: string[]
        if (isUuid) {
          tagUuids = tagArray
        } else {
          // Ищем теги по названиям (case-insensitive)
          const { data: tags, error: tagsError } = await supabase
            .from('project_tags')
            .select('tag_id, name')
            .in('name', tagArray)

          if (tagsError) {
            console.error('[getResourceGraphData] Tag lookup error:', tagsError)
            return { success: false, error: tagsError.message }
          }

          tagUuids = tags?.map(t => t.tag_id) || []
          if (tagUuids.length === 0) {
            return { success: true, data: [] }
          }
        }

        const { data: tagLinks, error: tagError } = await supabase
          .from('project_tag_links')
          .select('project_id')
          .in('tag_id', tagUuids)

        if (tagError) {
          console.error('[getResourceGraphData] Tag filter error:', tagError)
          return { success: false, error: tagError.message }
        }

        // Get unique project IDs
        const projectIdsFromTags = [...new Set(tagLinks?.map(l => l.project_id) || [])]

        // If no projects match tags, return empty result
        if (projectIdsFromTags.length === 0) {
          return { success: true, data: [] }
        }

        query = query.in('project_id', projectIdsFromTags)
      }
    }

    // Apply subdivision filter (фильтр по подразделению - по названию)
    if (secureFilters?.subdivision_id && typeof secureFilters.subdivision_id === 'string') {
      // Проверяем: это UUID или название?
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(secureFilters.subdivision_id)
      if (isUuid) {
        query = query.eq('section_subdivision_id', secureFilters.subdivision_id)
      } else {
        // Фильтрация по названию (case-insensitive)
        query = query.ilike('section_subdivision_name', secureFilters.subdivision_id)
      }
    }

    // Apply department filter (фильтр по отделу - по названию)
    if (secureFilters?.department_id && typeof secureFilters.department_id === 'string') {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(secureFilters.department_id)
      if (isUuid) {
        query = query.eq('section_department_id', secureFilters.department_id)
      } else {
        query = query.ilike('section_department_name', secureFilters.department_id)
      }
    }

    // Apply project filter (по названию или ID)
    if (secureFilters?.project_id && typeof secureFilters.project_id === 'string') {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(secureFilters.project_id)
      if (isUuid) {
        query = query.eq('project_id', secureFilters.project_id)
      } else {
        query = query.ilike('project_name', secureFilters.project_id)
      }
    }

    // Apply project status filter (точное совпадение с enum значением)
    if (secureFilters?.project_status && typeof secureFilters.project_status === 'string') {
      query = query.eq('project_status', secureFilters.project_status)
    }

    // Apply team filter (requires subquery to get team members)
    const teamId = secureFilters?.team_id
    if (teamId && typeof teamId === 'string') {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamId)

      // Get team members from v_org_structure
      let teamQuery = supabase.from('v_org_structure').select('employee_id')
      if (isUuid) {
        teamQuery = teamQuery.eq('team_id', teamId)
      } else {
        teamQuery = teamQuery.ilike('team_name', teamId)
      }

      const { data: teamMembers, error: teamError } = await teamQuery

      if (teamError) {
        console.error('[getResourceGraphData] Team filter error:', teamError)
        return { success: false, error: teamError.message }
      }

      // Get unique employee IDs from team
      const employeeIds = [
        ...new Set(
          (teamMembers || [])
            .map((m) => m.employee_id)
            .filter((id): id is string => id !== null)
        ),
      ]

      if (employeeIds.length === 0) {
        return { success: true, data: [] }
      }

      query = query.in('section_responsible_id', employeeIds)
    }

    // Apply responsible filter (по имени или UUID)
    const responsibleId = secureFilters?.responsible_id
    if (responsibleId && typeof responsibleId === 'string') {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(responsibleId)
      if (isUuid) {
        query = query.eq('section_responsible_id', responsibleId)
      } else {
        query = query.ilike('section_responsible_name', responsibleId)
      }
    }

    // Order for consistent hierarchy (Project → Object → Section → DecompositionStage → Item)
    query = query
      .order('project_name')
      .order('object_name')
      .order('section_name')
      .order('decomposition_stage_order')
      .order('decomposition_item_order')

    const { data, error } = await Sentry.startSpan(
      { name: 'getResourceGraphData.query', op: 'db.query' },
      () => query
    )

    if (error) {
      console.error('[getResourceGraphData] Supabase error:', error)
      return { success: false, error: error.message }
    }

    // Если пагинация включена - применяем на server side
    if (pagination) {
      const { page, pageSize } = pagination

      // Извлекаем уникальные project_id из результата
      const uniqueProjectIds = [...new Set((data || []).map((row) => row.project_id))]
      const totalCount = uniqueProjectIds.length
      const totalPages = Math.ceil(totalCount / pageSize)

      // Проверяем валидность страницы
      if (page < 1 || (totalCount > 0 && page > totalPages)) {
        return {
          success: false,
          error: `Невалидная страница: ${page}. Доступно страниц: ${totalPages}`,
        }
      }

      // Применяем пагинацию к списку project_id
      const startIndex = (page - 1) * pageSize
      const endIndex = startIndex + pageSize
      const paginatedProjectIds = uniqueProjectIds.slice(startIndex, endIndex)

      // Фильтруем данные для проектов на текущей странице
      const filteredData = (data || []).filter((row) =>
        paginatedProjectIds.includes(row.project_id)
      )

      // Transform flat rows to hierarchy
      const projects = Sentry.startSpan(
        { name: 'getResourceGraphData.transform', op: 'serialize' },
        () => transformRowsToHierarchy(filteredData as ResourceGraphRow[])
      )

      return {
        success: true,
        data: projects,
        pagination: {
          page,
          pageSize,
          total: totalCount,
          totalPages,
        },
      }
    }

    // Без пагинации - возвращаем все данные
    // Transform flat rows to hierarchy
    const projects = Sentry.startSpan(
      { name: 'getResourceGraphData.transform', op: 'serialize' },
      () => transformRowsToHierarchy(data as ResourceGraphRow[])
    )

    return {
      success: true,
      data: projects,
      pagination: {
        page: 1,
        pageSize: projects.length,
        total: projects.length,
        totalPages: 1,
      },
    }
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

    // Order for consistent hierarchy (Project → Object → Section → DecompositionStage → Item)
    query = query
      .order('project_name')
      .order('object_name')
      .order('section_name')
      .order('decomposition_stage_order')
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

/**
 * Получить теги для всех проектов (пакетная загрузка)
 *
 * Возвращает Map<projectId, ProjectTag[]> для эффективного доступа к тегам
 * каждого проекта в UI.
 *
 * @returns Record<projectId, tags[]>
 */
export async function getProjectTagsMap(): Promise<ActionResult<Record<string, ProjectTag[]>>> {
  try {
    const supabase = await createClient()

    // Загружаем все связи проект-тег с данными тегов
    const { data, error } = await supabase
      .from('project_tag_links')
      .select(`
        project_id,
        project_tags (
          tag_id,
          name,
          color
        )
      `)

    if (error) {
      console.error('[getProjectTagsMap] Supabase error:', error)
      return { success: false, error: error.message }
    }

    // Группируем теги по project_id
    const result: Record<string, ProjectTag[]> = {}

    for (const row of data || []) {
      const projectId = row.project_id
      const tag = row.project_tags as { tag_id: string; name: string; color: string | null } | null

      if (!projectId || !tag) continue

      if (!result[projectId]) {
        result[projectId] = []
      }

      result[projectId].push({
        id: tag.tag_id,
        name: tag.name,
        color: tag.color,
      })
    }

    return { success: true, data: result }
  } catch (error) {
    console.error('[getProjectTagsMap] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки тегов проектов',
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

// ============================================================================
// Work Logs Actions - Отчёты о работе
// ============================================================================

/**
 * Получить отчёты о работе для раздела
 *
 * Загружает все work_logs для всех decomposition_items в данном разделе.
 * Используется при развороте раздела на графике ресурсов.
 *
 * @param sectionId - ID раздела
 * @returns Список отчётов с информацией о создателе и бюджете
 */
export async function getWorkLogsForSection(
  sectionId: string
): Promise<ActionResult<WorkLog[]>> {
  try {
    const supabase = await createClient()

    // Получаем work_logs через join с decomposition_items и profiles
    const { data, error } = await supabase
      .from('work_logs')
      .select(`
        work_log_id,
        decomposition_item_id,
        work_log_date,
        work_log_hours,
        work_log_amount,
        work_log_description,
        work_log_created_by,
        budget_id,
        decomposition_items!inner (
          decomposition_item_section_id
        ),
        profiles:work_log_created_by (
          user_id,
          first_name,
          last_name
        )
      `)
      .eq('decomposition_items.decomposition_item_section_id', sectionId)
      .order('work_log_date', { ascending: false })

    if (error) {
      console.error('[getWorkLogsForSection] Supabase error:', error)
      return { success: false, error: error.message }
    }

    // Трансформируем данные в WorkLog[]
    const workLogs: WorkLog[] = (data || []).map(row => {
      const profile = row.profiles as { user_id: string; first_name: string | null; last_name: string | null } | null

      return {
        id: row.work_log_id,
        itemId: row.decomposition_item_id,
        date: row.work_log_date,
        hours: Number(row.work_log_hours) || 0,
        amount: Number(row.work_log_amount) || 0,
        description: row.work_log_description || '',
        createdBy: {
          id: profile?.user_id || null,
          firstName: profile?.first_name || null,
          lastName: profile?.last_name || null,
          name: profile
            ? `${profile.last_name || ''} ${profile.first_name || ''}`.trim() || null
            : null,
        },
        budget: {
          id: row.budget_id || '',
          name: 'Бюджет',
          typeName: null,
          typeColor: null,
        },
      }
    })

    return { success: true, data: workLogs }
  } catch (error) {
    console.error('[getWorkLogsForSection] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки отчётов',
    }
  }
}

// ============================================================================
// Loadings Actions - Загрузки сотрудников
// ============================================================================

/**
 * Получить загрузки для раздела
 *
 * Загружает все loadings для всех decomposition_stages в данном разделе.
 * Используется при развороте раздела на графике ресурсов.
 *
 * @param sectionId - ID раздела
 * @returns Список загрузок с информацией о сотрудниках
 */
export async function getLoadingsForSection(
  sectionId: string
): Promise<ActionResult<Loading[]>> {
  try {
    const supabase = await createClient()

    // Получаем loadings через join с decomposition_stages и profiles
    const { data, error } = await supabase
      .from('loadings')
      .select(`
        loading_id,
        loading_stage,
        loading_start,
        loading_finish,
        loading_rate,
        loading_comment,
        loading_status,
        is_shortage,
        loading_responsible,
        decomposition_stages!inner (
          decomposition_stage_section_id
        ),
        profiles:loading_responsible (
          user_id,
          first_name,
          last_name,
          avatar_url
        )
      `)
      .eq('decomposition_stages.decomposition_stage_section_id', sectionId)
      .order('loading_start', { ascending: true })

    if (error) {
      console.error('[getLoadingsForSection] Supabase error:', error)
      return { success: false, error: error.message }
    }

    // Трансформируем данные в Loading[]
    const loadings: Loading[] = (data || []).map(row => {
      const profile = row.profiles as {
        user_id: string
        first_name: string | null
        last_name: string | null
        avatar_url: string | null
      } | null

      return {
        id: row.loading_id,
        stageId: row.loading_stage,
        startDate: row.loading_start,
        finishDate: row.loading_finish,
        rate: Number(row.loading_rate) || 1,
        comment: row.loading_comment,
        status: row.loading_status as Loading['status'],
        isShortage: row.is_shortage,
        employee: {
          id: profile?.user_id || null,
          firstName: profile?.first_name || null,
          lastName: profile?.last_name || null,
          name: profile
            ? `${profile.last_name || ''} ${profile.first_name || ''}`.trim() || null
            : null,
          avatarUrl: profile?.avatar_url || null,
        },
      }
    })

    return { success: true, data: loadings }
  } catch (error) {
    console.error('[getLoadingsForSection] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки назначений',
    }
  }
}

// ============================================================================
// Stage Readiness Actions - Готовность этапов декомпозиции
// ============================================================================

/**
 * Получить снэпшоты готовности для этапа декомпозиции
 *
 * Загружает все readiness snapshots для указанного этапа.
 * Используется для построения графика готовности на timeline.
 *
 * @param stageId - ID этапа декомпозиции
 * @returns Список точек готовности (дата + значение)
 */
export async function getStageReadinessSnapshots(
  stageId: string
): Promise<ActionResult<ReadinessPoint[]>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('stage_readiness_snapshots')
      .select('snapshot_date, readiness_value')
      .eq('stage_id', stageId)
      .order('snapshot_date', { ascending: true })

    if (error) {
      console.error('[getStageReadinessSnapshots] Supabase error:', error)
      return { success: false, error: error.message }
    }

    const points: ReadinessPoint[] = (data || []).map(row => ({
      date: row.snapshot_date,
      value: row.readiness_value,
    }))

    return { success: true, data: points }
  } catch (error) {
    console.error('[getStageReadinessSnapshots] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки готовности этапа',
    }
  }
}

/**
 * Получить снэпшоты готовности для всех этапов раздела
 *
 * Загружает readiness snapshots для всех decomposition_stages в разделе.
 * Также рассчитывает сегодняшнюю готовность на лету из decomposition_items.
 *
 * @param sectionId - ID раздела
 * @returns Map<stageId, ReadinessPoint[]>
 */
export async function getStageReadinessForSection(
  sectionId: string
): Promise<ActionResult<Record<string, ReadinessPoint[]>>> {
  try {
    const supabase = await createClient()

    // Получаем все этапы раздела с их items для расчёта сегодняшней готовности
    const { data: stages, error: stagesError } = await supabase
      .from('decomposition_stages')
      .select(`
        decomposition_stage_id,
        decomposition_items (
          decomposition_item_progress,
          decomposition_item_planned_hours
        )
      `)
      .eq('decomposition_stage_section_id', sectionId)

    if (stagesError) {
      console.error('[getStageReadinessForSection] Stages error:', stagesError)
      return { success: false, error: stagesError.message }
    }

    const stageIds = (stages || []).map(s => s.decomposition_stage_id)
    if (stageIds.length === 0) {
      return { success: true, data: {} }
    }

    // Получаем все снэпшоты для этих этапов (исторические данные до вчера)
    const { data, error } = await supabase
      .from('stage_readiness_snapshots')
      .select('stage_id, snapshot_date, readiness_value')
      .in('stage_id', stageIds)
      .order('snapshot_date', { ascending: true })

    if (error) {
      console.error('[getStageReadinessForSection] Supabase error:', error)
      return { success: false, error: error.message }
    }

    // Группируем исторические снэпшоты по stage_id
    const result: Record<string, ReadinessPoint[]> = {}
    for (const row of data || []) {
      if (!result[row.stage_id]) {
        result[row.stage_id] = []
      }
      result[row.stage_id].push({
        date: row.snapshot_date,
        value: row.readiness_value,
      })
    }

    // Добавляем сегодняшнюю готовность, рассчитанную на лету
    const today = formatMinskDate(getTodayMinsk())

    for (const stage of stages || []) {
      const stageId = stage.decomposition_stage_id
      const items = stage.decomposition_items as Array<{
        decomposition_item_progress: number | null
        decomposition_item_planned_hours: number | null
      }> || []

      // Рассчитываем взвешенное среднее: SUM(progress * hours) / SUM(hours)
      let totalWeightedProgress = 0
      let totalPlannedHours = 0

      for (const item of items) {
        const hours = item.decomposition_item_planned_hours || 0
        const progress = item.decomposition_item_progress || 0
        if (hours > 0) {
          totalWeightedProgress += progress * hours
          totalPlannedHours += hours
        }
      }

      const todayReadiness = totalPlannedHours > 0
        ? Math.round(totalWeightedProgress / totalPlannedHours)
        : 0

      // Добавляем сегодняшнюю точку только если есть данные для расчёта
      if (totalPlannedHours > 0) {
        if (!result[stageId]) {
          result[stageId] = []
        }

        // Проверяем, нет ли уже точки на сегодня (не перезаписываем)
        const hasToday = result[stageId].some(p => p.date === today)
        if (!hasToday) {
          result[stageId].push({
            date: today,
            value: todayReadiness,
          })
        }
      }
    }

    return { success: true, data: result }
  } catch (error) {
    console.error('[getStageReadinessForSection] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки готовности этапов',
    }
  }
}

// ============================================================================
// Mutation Actions - Обновление данных
// ============================================================================

/**
 * Обновить процент готовности задачи (decomposition_item)
 *
 * @param itemId - ID задачи
 * @param progress - Новый процент готовности (0-100)
 * @returns Успех или ошибка
 */
export async function updateItemProgress(
  itemId: string,
  progress: number
): Promise<ActionResult<{ itemId: string; progress: number }>> {
  try {
    // Валидация
    if (!itemId) {
      return { success: false, error: 'ID задачи обязателен' }
    }

    if (typeof progress !== 'number' || progress < 0 || progress > 100) {
      return { success: false, error: 'Готовность должна быть числом от 0 до 100' }
    }

    // Округляем до целого
    const roundedProgress = Math.round(progress)

    const supabase = await createClient()

    const { error } = await supabase
      .from('decomposition_items')
      .update({ decomposition_item_progress: roundedProgress })
      .eq('decomposition_item_id', itemId)

    if (error) {
      console.error('[updateItemProgress] Supabase error:', error)
      return { success: false, error: error.message }
    }

    return {
      success: true,
      data: { itemId, progress: roundedProgress },
    }
  } catch (error) {
    console.error('[updateItemProgress] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка обновления готовности',
    }
  }
}

// ============================================================================
// Timeline Resize Actions - Изменение сроков через drag
// ============================================================================

/**
 * Обновить даты загрузки сотрудника
 *
 * @param loadingId - ID загрузки
 * @param startDate - Новая дата начала (YYYY-MM-DD)
 * @param finishDate - Новая дата окончания (YYYY-MM-DD)
 * @returns Успех или ошибка
 */
export async function updateLoadingDates(
  loadingId: string,
  startDate: string,
  finishDate: string
): Promise<ActionResult<{ loadingId: string; startDate: string; finishDate: string }>> {
  try {
    // Валидация
    if (!loadingId) {
      return { success: false, error: 'ID загрузки обязателен' }
    }

    if (!startDate || !finishDate) {
      return { success: false, error: 'Даты начала и окончания обязательны' }
    }

    // Проверяем что startDate <= finishDate
    if (startDate > finishDate) {
      return { success: false, error: 'Дата начала не может быть позже даты окончания' }
    }

    const supabase = await createClient()

    // Проверка авторизации
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Необходима авторизация' }
    }

    const { error } = await supabase
      .from('loadings')
      .update({
        loading_start: startDate,
        loading_finish: finishDate,
      })
      .eq('loading_id', loadingId)

    if (error) {
      console.error('[updateLoadingDates] Supabase error:', error)
      return { success: false, error: error.message }
    }

    return {
      success: true,
      data: { loadingId, startDate, finishDate },
    }
  } catch (error) {
    console.error('[updateLoadingDates] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка обновления дат загрузки',
    }
  }
}

/**
 * Обновить даты этапа декомпозиции
 *
 * @param stageId - ID этапа декомпозиции
 * @param startDate - Новая дата начала (YYYY-MM-DD)
 * @param finishDate - Новая дата окончания (YYYY-MM-DD)
 * @returns Успех или ошибка
 */
export async function updateStageDates(
  stageId: string,
  startDate: string,
  finishDate: string
): Promise<ActionResult<{ stageId: string; startDate: string; finishDate: string }>> {
  try {
    // Валидация
    if (!stageId) {
      return { success: false, error: 'ID этапа обязателен' }
    }

    if (!startDate || !finishDate) {
      return { success: false, error: 'Даты начала и окончания обязательны' }
    }

    if (startDate > finishDate) {
      return { success: false, error: 'Дата начала не может быть позже даты окончания' }
    }

    const supabase = await createClient()

    // Проверка авторизации
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Необходима авторизация' }
    }

    const { error } = await supabase
      .from('decomposition_stages')
      .update({
        decomposition_stage_start: startDate,
        decomposition_stage_finish: finishDate,
      })
      .eq('decomposition_stage_id', stageId)

    if (error) {
      console.error('[updateStageDates] Supabase error:', error)
      return { success: false, error: error.message }
    }

    return {
      success: true,
      data: { stageId, startDate, finishDate },
    }
  } catch (error) {
    console.error('[updateStageDates] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка обновления дат этапа',
    }
  }
}

/**
 * Обновить даты раздела
 *
 * @param sectionId - ID раздела
 * @param startDate - Новая дата начала (YYYY-MM-DD)
 * @param endDate - Новая дата окончания (YYYY-MM-DD)
 * @returns Успех или ошибка
 */
export async function updateSectionDates(
  sectionId: string,
  startDate: string,
  endDate: string
): Promise<ActionResult<{ sectionId: string; startDate: string; endDate: string }>> {
  try {
    // Валидация
    if (!sectionId) {
      return { success: false, error: 'ID раздела обязателен' }
    }

    if (!startDate || !endDate) {
      return { success: false, error: 'Даты начала и окончания обязательны' }
    }

    if (startDate > endDate) {
      return { success: false, error: 'Дата начала не может быть позже даты окончания' }
    }

    const supabase = await createClient()

    // Проверка авторизации
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Необходима авторизация' }
    }

    const { error } = await supabase
      .from('sections')
      .update({
        section_start_date: startDate,
        section_end_date: endDate,
      })
      .eq('section_id', sectionId)

    if (error) {
      console.error('[updateSectionDates] Supabase error:', error)
      return { success: false, error: error.message }
    }

    return {
      success: true,
      data: { sectionId, startDate, endDate },
    }
  } catch (error) {
    console.error('[updateSectionDates] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка обновления дат раздела',
    }
  }
}

// ============================================================================
// Stage Responsibles Actions - Ответственные за этапы
// ============================================================================

/**
 * Получить ответственных за этапы раздела
 *
 * Загружает decomposition_stage_responsibles и джойнит с profiles
 * для получения имён и аватаров.
 *
 * @param sectionId - ID раздела
 * @returns Map<stageId, StageResponsible[]>
 */
export async function getStageResponsiblesForSection(
  sectionId: string
): Promise<ActionResult<Record<string, StageResponsible[]>>> {
  try {
    const supabase = await createClient()

    // Получаем этапы с их ответственными
    const { data: stages, error: stagesError } = await supabase
      .from('decomposition_stages')
      .select('decomposition_stage_id, decomposition_stage_responsibles')
      .eq('decomposition_stage_section_id', sectionId)

    if (stagesError) {
      console.error('[getStageResponsiblesForSection] Stages error:', stagesError)
      return { success: false, error: stagesError.message }
    }

    // Собираем все уникальные user_id
    const allUserIds = new Set<string>()
    for (const stage of stages || []) {
      const responsibles = stage.decomposition_stage_responsibles as string[] | null
      if (responsibles) {
        for (const id of responsibles) {
          allUserIds.add(id)
        }
      }
    }

    // Если нет ответственных, возвращаем пустой результат
    if (allUserIds.size === 0) {
      const result: Record<string, StageResponsible[]> = {}
      for (const stage of stages || []) {
        result[stage.decomposition_stage_id] = []
      }
      return { success: true, data: result }
    }

    // Загружаем профили для всех ответственных
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, first_name, last_name, avatar_url')
      .in('user_id', Array.from(allUserIds))

    if (profilesError) {
      console.error('[getStageResponsiblesForSection] Profiles error:', profilesError)
      return { success: false, error: profilesError.message }
    }

    // Создаём map для быстрого доступа
    const profilesMap = new Map<string, StageResponsible>()
    for (const p of profiles || []) {
      profilesMap.set(p.user_id, {
        id: p.user_id,
        firstName: p.first_name,
        lastName: p.last_name,
        avatarUrl: p.avatar_url,
      })
    }

    // Формируем результат
    const result: Record<string, StageResponsible[]> = {}
    for (const stage of stages || []) {
      const responsibles = stage.decomposition_stage_responsibles as string[] | null
      result[stage.decomposition_stage_id] = (responsibles || [])
        .map(id => profilesMap.get(id))
        .filter((p): p is StageResponsible => p !== undefined)
    }

    return { success: true, data: result }
  } catch (error) {
    console.error('[getStageResponsiblesForSection] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки ответственных за этапы',
    }
  }
}

// ============================================================================
// Loading CRUD Actions - Создание, обновление, удаление загрузок
// ============================================================================

/**
 * Создать новую загрузку
 *
 * @param input - Данные для создания загрузки
 * @returns ID созданной загрузки
 */
export async function createLoading(input: {
  sectionId: string
  stageId: string
  responsibleId: string
  startDate: string
  endDate: string
  rate: number
  comment?: string
}): Promise<ActionResult<{ loadingId: string }>> {
  try {
    // Валидация
    if (!input.sectionId || !input.stageId || !input.responsibleId) {
      return { success: false, error: 'Обязательные поля не заполнены' }
    }

    if (!input.startDate || !input.endDate) {
      return { success: false, error: 'Даты начала и окончания обязательны' }
    }

    if (input.startDate > input.endDate) {
      return { success: false, error: 'Дата начала не может быть позже даты окончания' }
    }

    const supabase = await createClient()

    // Проверка авторизации
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Необходима авторизация' }
    }

    // RLS проверяет авторизацию на уровне базы данных
    const { data, error } = await supabase
      .from('loadings')
      .insert({
        loading_section: input.sectionId,
        loading_stage: input.stageId,
        loading_responsible: input.responsibleId,
        loading_start: input.startDate,
        loading_finish: input.endDate,
        loading_rate: input.rate,
        loading_comment: input.comment || null,
        loading_status: 'active',
      })
      .select('loading_id')
      .single()

    if (error) {
      console.error('[createLoading] Supabase error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: { loadingId: data.loading_id } }
  } catch (error) {
    console.error('[createLoading] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка создания загрузки',
    }
  }
}

/**
 * Обновить загрузку (ответственного, ставку, комментарий и т.д.)
 *
 * @param loadingId - ID загрузки
 * @param updates - Поля для обновления
 * @returns Успех или ошибка
 */
export async function updateLoading(
  loadingId: string,
  updates: {
    responsibleId?: string
    rate?: number
    comment?: string
    stageId?: string
    startDate?: string
    endDate?: string
  }
): Promise<ActionResult<{ loadingId: string }>> {
  try {
    if (!loadingId) {
      return { success: false, error: 'ID загрузки обязателен' }
    }

    const supabase = await createClient()

    // Проверка авторизации
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Необходима авторизация' }
    }

    // RLS проверяет авторизацию на уровне базы данных
    // Формируем объект для обновления
    const updateData: Record<string, unknown> = {}

    if (updates.responsibleId !== undefined) {
      updateData.loading_responsible = updates.responsibleId
    }
    if (updates.rate !== undefined) {
      updateData.loading_rate = updates.rate
    }
    if (updates.comment !== undefined) {
      updateData.loading_comment = updates.comment
    }
    if (updates.stageId !== undefined) {
      updateData.loading_stage = updates.stageId
    }
    if (updates.startDate !== undefined) {
      updateData.loading_start = updates.startDate
    }
    if (updates.endDate !== undefined) {
      updateData.loading_finish = updates.endDate
    }

    const { error } = await supabase
      .from('loadings')
      .update(updateData)
      .eq('loading_id', loadingId)

    if (error) {
      console.error('[updateLoading] Supabase error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: { loadingId } }
  } catch (error) {
    console.error('[updateLoading] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка обновления загрузки',
    }
  }
}

/**
 * Удалить загрузку
 *
 * @param loadingId - ID загрузки
 * @returns Успех или ошибка
 */
export async function deleteLoading(
  loadingId: string
): Promise<ActionResult<{ loadingId: string }>> {
  try {
    if (!loadingId) {
      return { success: false, error: 'ID загрузки обязателен' }
    }

    const supabase = await createClient()

    // Проверка авторизации
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Необходима авторизация' }
    }

    // RLS проверяет авторизацию на уровне базы данных
    const { error } = await supabase
      .from('loadings')
      .delete()
      .eq('loading_id', loadingId)

    if (error) {
      console.error('[deleteLoading] Supabase error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: { loadingId } }
  } catch (error) {
    console.error('[deleteLoading] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка удаления загрузки',
    }
  }
}

// ============================================================================
// Decomposition Item CRUD Actions - Создание задач
// ============================================================================

/**
 * Создать новую задачу (decomposition_item)
 *
 * @param input - Данные для создания задачи
 * @returns ID созданной задачи
 */
export async function createDecompositionItem(input: {
  sectionId: string
  stageId: string
  description: string
  plannedHours: number
  workCategoryId: string
  responsibleId?: string
  dueDate?: string
}): Promise<ActionResult<{ itemId: string }>> {
  try {
    // Валидация
    if (!input.sectionId || !input.stageId) {
      return { success: false, error: 'ID раздела и этапа обязательны' }
    }

    if (!input.description?.trim()) {
      return { success: false, error: 'Название задачи обязательно' }
    }

    if (!input.workCategoryId) {
      return { success: false, error: 'Категория работ обязательна' }
    }

    if (input.plannedHours < 0) {
      return { success: false, error: 'Плановые часы не могут быть отрицательными' }
    }

    const supabase = await createClient()

    // Получаем текущего пользователя
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Необходима авторизация' }
    }

    // Получаем максимальный order для этого этапа
    const { data: existingItems } = await supabase
      .from('decomposition_items')
      .select('decomposition_item_order')
      .eq('decomposition_item_stage_id', input.stageId)
      .order('decomposition_item_order', { ascending: false })
      .limit(1)

    const maxOrder = existingItems?.[0]?.decomposition_item_order ?? 0
    const newOrder = maxOrder + 1

    // Создаём задачу
    const { data, error } = await supabase
      .from('decomposition_items')
      .insert({
        decomposition_item_section_id: input.sectionId,
        decomposition_item_stage_id: input.stageId,
        decomposition_item_description: input.description.trim(),
        decomposition_item_planned_hours: input.plannedHours,
        decomposition_item_work_category_id: input.workCategoryId,
        decomposition_item_responsible: input.responsibleId || null,
        decomposition_item_planned_due_date: input.dueDate || null,
        decomposition_item_order: newOrder,
        decomposition_item_progress: 0,
        decomposition_item_created_by: user.id,
      })
      .select('decomposition_item_id')
      .single()

    if (error) {
      console.error('[createDecompositionItem] Supabase error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: { itemId: data.decomposition_item_id } }
  } catch (error) {
    console.error('[createDecompositionItem] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка создания задачи',
    }
  }
}

/**
 * Удалить задачу (decomposition_item) с каскадным удалением отчётов
 *
 * @param itemId - ID задачи
 * @returns Успех или ошибка
 */
export async function deleteDecompositionItem(
  itemId: string
): Promise<ActionResult<{ itemId: string }>> {
  try {
    if (!itemId) {
      return { success: false, error: 'ID задачи обязателен' }
    }

    const supabase = await createClient()

    // Проверка авторизации
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Необходима авторизация' }
    }

    // 1. Удаляем все work_logs связанные с задачей
    const { error: workLogsError } = await supabase
      .from('work_logs')
      .delete()
      .eq('decomposition_item_id', itemId)

    if (workLogsError) {
      console.error('[deleteDecompositionItem] Work logs delete error:', workLogsError)
      return { success: false, error: `Ошибка удаления отчётов: ${workLogsError.message}` }
    }

    // 2. Удаляем саму задачу
    const { error: itemError } = await supabase
      .from('decomposition_items')
      .delete()
      .eq('decomposition_item_id', itemId)

    if (itemError) {
      console.error('[deleteDecompositionItem] Item delete error:', itemError)
      return { success: false, error: itemError.message }
    }

    return { success: true, data: { itemId } }
  } catch (error) {
    console.error('[deleteDecompositionItem] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка удаления задачи',
    }
  }
}

/**
 * Получить категории работ
 *
 * @returns Список категорий работ
 */
export async function getWorkCategories(): Promise<ActionResult<Array<{
  id: string
  name: string
  color: string | null
}>>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('work_categories')
      .select('work_category_id, work_category_name, work_category_color')
      .order('work_category_name')

    if (error) {
      console.error('[getWorkCategories] Supabase error:', error)
      return { success: false, error: error.message }
    }

    const categories = (data || []).map(row => ({
      id: row.work_category_id,
      name: row.work_category_name,
      color: row.work_category_color,
    }))

    return { success: true, data: categories }
  } catch (error) {
    console.error('[getWorkCategories] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки категорий работ',
    }
  }
}

// ============================================================================
// Batch Data Action - Все данные для секций объекта одним запросом
// ============================================================================

/**
 * Получить все данные для секций объекта одним запросом
 *
 * Заменяет 8 отдельных запросов на 1:
 * - workLogs
 * - loadings
 * - stageReadiness
 * - stageResponsibles
 * - checkpoints
 * - budgets (опционально, может быть скрыто по permissions)
 *
 * Вызывается при развороте объекта (Object).
 *
 * @param objectId - ID объекта (для загрузки бюджета объекта)
 * @param sectionIds - Массив ID секций объекта
 * @param options - Опции загрузки (includeBudgets для контроля доступа)
 * @returns Batch данные для всех секций + бюджет объекта
 */
export async function getSectionsBatchData(
  objectId: string,
  sectionIds: string[],
  options?: SectionsBatchOptions
): Promise<ActionResult<SectionsBatchData>> {
  try {
    if (!sectionIds || sectionIds.length === 0) {
      return {
        success: true,
        data: {
          workLogs: {},
          loadings: {},
          stageReadiness: {},
          stageResponsibles: {},
          checkpoints: {},
          budgets: {},
          objectBudget: null,
        },
      }
    }

    const includeBudgets = options?.includeBudgets !== false // По умолчанию включаем

    const supabase = await createClient()

    // Выполняем все запросы параллельно на сервере
    const [workLogsResult, loadingsResult, stagesResult, checkpointsResult, linkedCheckpointsResult, budgetsResult, objectBudgetResult] = await Sentry.startSpan(
      { name: 'getSectionsBatchData.firstBatch', op: 'db.query' },
      () => Promise.all([
      // 1. Work Logs для всех секций
      supabase
        .from('work_logs')
        .select(`
          work_log_id,
          decomposition_item_id,
          work_log_date,
          work_log_hours,
          work_log_amount,
          work_log_description,
          work_log_created_by,
          budget_id,
          decomposition_items!inner (
            decomposition_item_section_id
          ),
          profiles:work_log_created_by (
            user_id,
            first_name,
            last_name
          )
        `)
        .in('decomposition_items.decomposition_item_section_id', sectionIds)
        .order('work_log_date', { ascending: false }),

      // 2. Loadings для всех секций
      supabase
        .from('loadings')
        .select(`
          loading_id,
          loading_stage,
          loading_start,
          loading_finish,
          loading_rate,
          loading_comment,
          loading_status,
          is_shortage,
          loading_responsible,
          decomposition_stages!inner (
            decomposition_stage_id,
            decomposition_stage_section_id
          ),
          profiles:loading_responsible (
            user_id,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .in('decomposition_stages.decomposition_stage_section_id', sectionIds)
        .order('loading_start', { ascending: true }),

      // 3. Decomposition stages с их items и responsibles для всех секций
      supabase
        .from('decomposition_stages')
        .select(`
          decomposition_stage_id,
          decomposition_stage_section_id,
          decomposition_stage_responsibles,
          decomposition_items (
            decomposition_item_progress,
            decomposition_item_planned_hours
          )
        `)
        .in('decomposition_stage_section_id', sectionIds),

      // 4. Checkpoints для всех секций (из view_section_checkpoints) - основные
      supabase
        .from('view_section_checkpoints')
        .select(`
          checkpoint_id,
          section_id,
          type_id,
          type_code,
          type_name,
          is_custom,
          icon,
          color,
          title,
          description,
          checkpoint_date,
          completed_at,
          status,
          status_label,
          linked_sections,
          linked_sections_count
        `)
        .in('section_id', sectionIds)
        .order('checkpoint_date', { ascending: true }),

      // 4b. Linked checkpoints - находим checkpoint_id связанные с нашими секциями
      supabase
        .from('checkpoint_section_links')
        .select('checkpoint_id, section_id')
        .in('section_id', sectionIds),

      // 5. Budgets для всех секций (опционально по permissions)
      // V2: используем v_cache_budgets, budget_types больше нет
      includeBudgets
        ? supabase
            .from('v_cache_budgets')
            .select(`
              budget_id,
              entity_id,
              name,
              total_amount,
              total_spent,
              remaining_amount,
              spent_percentage,
              is_active
            `)
            .eq('entity_type', 'section')
            .in('entity_id', sectionIds)
            .eq('is_active', true)
        : Promise.resolve({ data: [], error: null }),

      // 6. Budget объекта (опционально по permissions)
      includeBudgets
        ? supabase
            .from('v_cache_budgets')
            .select(`
              budget_id,
              entity_id,
              name,
              total_amount,
              total_spent,
              remaining_amount,
              spent_percentage,
              is_active
            `)
            .eq('entity_type', 'object')
            .eq('entity_id', objectId)
            .eq('is_active', true)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]))

    // Проверяем ошибки
    if (workLogsResult.error) {
      console.error('[getSectionsBatchData] WorkLogs error:', workLogsResult.error)
      return { success: false, error: workLogsResult.error.message }
    }
    if (loadingsResult.error) {
      console.error('[getSectionsBatchData] Loadings error:', loadingsResult.error)
      return { success: false, error: loadingsResult.error.message }
    }
    if (stagesResult.error) {
      console.error('[getSectionsBatchData] Stages error:', stagesResult.error)
      return { success: false, error: stagesResult.error.message }
    }
    if (checkpointsResult.error) {
      console.error('[getSectionsBatchData] Checkpoints error:', checkpointsResult.error)
      return { success: false, error: checkpointsResult.error.message }
    }
    if (linkedCheckpointsResult.error) {
      console.error('[getSectionsBatchData] LinkedCheckpoints error:', linkedCheckpointsResult.error)
      return { success: false, error: linkedCheckpointsResult.error.message }
    }
    if (budgetsResult.error) {
      console.error('[getSectionsBatchData] Budgets error:', budgetsResult.error)
      return { success: false, error: budgetsResult.error.message }
    }
    if (objectBudgetResult.error) {
      console.error('[getSectionsBatchData] ObjectBudget error:', objectBudgetResult.error)
      return { success: false, error: objectBudgetResult.error.message }
    }

    // Собираем все stage_id для запроса readiness snapshots и бюджетов
    const stageIds = (stagesResult.data || []).map(s => s.decomposition_stage_id)

    // 4. Параллельно получаем snapshots, profiles для ответственных, и бюджеты для stages
    const allUserIds = new Set<string>()
    for (const stage of stagesResult.data || []) {
      const responsibles = stage.decomposition_stage_responsibles as string[] | null
      if (responsibles) {
        for (const id of responsibles) {
          allUserIds.add(id)
        }
      }
    }

    const [snapshotsResult, profilesResult, stageBudgetsResult] = await Sentry.startSpan(
      { name: 'getSectionsBatchData.secondBatch', op: 'db.query' },
      () => Promise.all([
      stageIds.length > 0
        ? supabase
            .from('stage_readiness_snapshots')
            .select('stage_id, snapshot_date, readiness_value')
            .in('stage_id', stageIds)
            .order('snapshot_date', { ascending: true })
        : Promise.resolve({ data: [], error: null }),

      allUserIds.size > 0
        ? supabase
            .from('profiles')
            .select('user_id, first_name, last_name, avatar_url')
            .in('user_id', Array.from(allUserIds))
        : Promise.resolve({ data: [], error: null }),

      // Загружаем бюджеты для decomposition_stages (если есть permission)
      includeBudgets && stageIds.length > 0
        ? supabase
            .from('v_cache_budgets')
            .select(`
              budget_id,
              entity_type,
              entity_id,
              name,
              total_amount,
              total_spent,
              remaining_amount,
              spent_percentage,
              is_active
            `)
            .eq('entity_type', 'decomposition_stage')
            .in('entity_id', stageIds)
            .eq('is_active', true)
        : Promise.resolve({ data: [], error: null }),
    ]))

    if (snapshotsResult.error) {
      console.error('[getSectionsBatchData] Snapshots error:', snapshotsResult.error)
      return { success: false, error: snapshotsResult.error.message }
    }
    if (profilesResult.error) {
      console.error('[getSectionsBatchData] Profiles error:', profilesResult.error)
      return { success: false, error: profilesResult.error.message }
    }
    if (stageBudgetsResult.error) {
      console.error('[getSectionsBatchData] StageBudgets error:', stageBudgetsResult.error)
      return { success: false, error: stageBudgetsResult.error.message }
    }

    // ============================
    // Трансформация данных
    // ============================

    // WorkLogs: группируем по sectionId
    const workLogs: Record<string, WorkLog[]> = {}
    for (const sectionId of sectionIds) {
      workLogs[sectionId] = []
    }

    for (const row of workLogsResult.data || []) {
      const sectionId = (row.decomposition_items as { decomposition_item_section_id: string })?.decomposition_item_section_id
      if (!sectionId) continue

      const profile = row.profiles as { user_id: string; first_name: string | null; last_name: string | null } | null

      if (!workLogs[sectionId]) {
        workLogs[sectionId] = []
      }

      workLogs[sectionId].push({
        id: row.work_log_id,
        itemId: row.decomposition_item_id,
        date: row.work_log_date,
        hours: Number(row.work_log_hours) || 0,
        amount: Number(row.work_log_amount) || 0,
        description: row.work_log_description || '',
        createdBy: {
          id: profile?.user_id || null,
          firstName: profile?.first_name || null,
          lastName: profile?.last_name || null,
          name: profile
            ? `${profile.last_name || ''} ${profile.first_name || ''}`.trim() || null
            : null,
        },
        budget: {
          id: row.budget_id || '',
          name: 'Бюджет',
          typeName: null,
          typeColor: null,
        },
      })
    }

    // Loadings: группируем по sectionId
    const loadings: Record<string, Loading[]> = {}
    for (const sectionId of sectionIds) {
      loadings[sectionId] = []
    }

    for (const row of loadingsResult.data || []) {
      const stage = row.decomposition_stages as {
        decomposition_stage_id: string
        decomposition_stage_section_id: string
      } | null
      const sectionId = stage?.decomposition_stage_section_id
      if (!sectionId) continue

      const profile = row.profiles as {
        user_id: string
        first_name: string | null
        last_name: string | null
        avatar_url: string | null
      } | null

      if (!loadings[sectionId]) {
        loadings[sectionId] = []
      }

      loadings[sectionId].push({
        id: row.loading_id,
        stageId: row.loading_stage,
        startDate: row.loading_start,
        finishDate: row.loading_finish,
        rate: Number(row.loading_rate) || 1,
        comment: row.loading_comment,
        status: row.loading_status as Loading['status'],
        isShortage: row.is_shortage,
        employee: {
          id: profile?.user_id || null,
          firstName: profile?.first_name || null,
          lastName: profile?.last_name || null,
          name: profile
            ? `${profile.last_name || ''} ${profile.first_name || ''}`.trim() || null
            : null,
          avatarUrl: profile?.avatar_url || null,
        },
      })
    }

    // Stage Readiness: группируем по sectionId -> stageId
    const stageReadiness: Record<string, Record<string, ReadinessPoint[]>> = {}
    for (const sectionId of sectionIds) {
      stageReadiness[sectionId] = {}
    }

    // Создаём map stage -> section
    const stageSectionMap = new Map<string, string>()
    for (const stage of stagesResult.data || []) {
      stageSectionMap.set(stage.decomposition_stage_id, stage.decomposition_stage_section_id)
    }

    // Группируем snapshots
    for (const row of snapshotsResult.data || []) {
      const sectionId = stageSectionMap.get(row.stage_id)
      if (!sectionId) continue

      if (!stageReadiness[sectionId]) {
        stageReadiness[sectionId] = {}
      }
      if (!stageReadiness[sectionId][row.stage_id]) {
        stageReadiness[sectionId][row.stage_id] = []
      }

      stageReadiness[sectionId][row.stage_id].push({
        date: row.snapshot_date,
        value: row.readiness_value,
      })
    }

    // Добавляем сегодняшнюю готовность на лету
    const today = formatMinskDate(getTodayMinsk())
    for (const stage of stagesResult.data || []) {
      const sectionId = stage.decomposition_stage_section_id
      const stageId = stage.decomposition_stage_id
      const items = stage.decomposition_items as Array<{
        decomposition_item_progress: number | null
        decomposition_item_planned_hours: number | null
      }> || []

      let totalWeightedProgress = 0
      let totalPlannedHours = 0

      for (const item of items) {
        const hours = item.decomposition_item_planned_hours || 0
        const progress = item.decomposition_item_progress || 0
        if (hours > 0) {
          totalWeightedProgress += progress * hours
          totalPlannedHours += hours
        }
      }

      if (totalPlannedHours > 0) {
        const todayReadiness = Math.round(totalWeightedProgress / totalPlannedHours)

        if (!stageReadiness[sectionId]) {
          stageReadiness[sectionId] = {}
        }
        if (!stageReadiness[sectionId][stageId]) {
          stageReadiness[sectionId][stageId] = []
        }

        // Проверяем нет ли уже точки на сегодня
        const hasToday = stageReadiness[sectionId][stageId].some(p => p.date === today)
        if (!hasToday) {
          stageReadiness[sectionId][stageId].push({
            date: today,
            value: todayReadiness,
          })
        }
      }
    }

    // Stage Responsibles: группируем по sectionId -> stageId
    const stageResponsibles: Record<string, Record<string, StageResponsible[]>> = {}
    for (const sectionId of sectionIds) {
      stageResponsibles[sectionId] = {}
    }

    // Создаём map профилей
    const profilesMap = new Map<string, StageResponsible>()
    for (const p of profilesResult.data || []) {
      profilesMap.set(p.user_id, {
        id: p.user_id,
        firstName: p.first_name,
        lastName: p.last_name,
        avatarUrl: p.avatar_url,
      })
    }

    for (const stage of stagesResult.data || []) {
      const sectionId = stage.decomposition_stage_section_id
      const stageId = stage.decomposition_stage_id
      const responsibles = stage.decomposition_stage_responsibles as string[] | null

      if (!stageResponsibles[sectionId]) {
        stageResponsibles[sectionId] = {}
      }

      stageResponsibles[sectionId][stageId] = (responsibles || [])
        .map(id => profilesMap.get(id))
        .filter((p): p is StageResponsible => p !== undefined)
    }

    // Checkpoints: группируем по sectionId
    const checkpoints: Record<string, BatchCheckpoint[]> = {}
    for (const sectionId of sectionIds) {
      checkpoints[sectionId] = []
    }

    for (const row of checkpointsResult.data || []) {
      const sectionId = row.section_id
      if (!sectionId) continue

      if (!checkpoints[sectionId]) {
        checkpoints[sectionId] = []
      }

      // linked_sections из view - JSONB массив
      const linkedSections = (row.linked_sections as Array<{
        section_id: string
        section_name: string
        object_id: string | null
      }> | null) ?? []

      checkpoints[sectionId].push({
        id: row.checkpoint_id,
        sectionId: row.section_id,
        typeId: row.type_id,
        typeCode: row.type_code,
        typeName: row.type_name,
        isCustom: row.is_custom ?? false,
        icon: row.icon,
        color: row.color,
        title: row.title,
        description: row.description,
        checkpointDate: row.checkpoint_date,
        completedAt: row.completed_at,
        status: row.status as 'pending' | 'completed' | 'completed_late' | 'overdue',
        statusLabel: row.status_label ?? '',
        linkedSections,
        linkedSectionsCount: row.linked_sections_count ?? 0,
      })
    }

    // Linked Checkpoints: добавляем чекпоинты в связанные секции
    // Собираем уникальные checkpoint_id которые нужно загрузить
    const loadedCheckpointIds = new Set(
      (checkpointsResult.data || []).map(row => row.checkpoint_id)
    )
    const linkedCheckpointMap = new Map<string, string[]>() // checkpoint_id -> [linked_section_ids]

    for (const link of linkedCheckpointsResult.data || []) {
      if (!link.checkpoint_id || !link.section_id) continue
      if (!linkedCheckpointMap.has(link.checkpoint_id)) {
        linkedCheckpointMap.set(link.checkpoint_id, [])
      }
      linkedCheckpointMap.get(link.checkpoint_id)!.push(link.section_id)
    }

    // Загружаем полные данные чекпоинтов которые ещё не загружены
    const checkpointIdsToLoad = Array.from(linkedCheckpointMap.keys()).filter(
      id => !loadedCheckpointIds.has(id)
    )

    if (checkpointIdsToLoad.length > 0) {
      const { data: additionalCheckpoints, error: additionalError } = await supabase
        .from('view_section_checkpoints')
        .select(`
          checkpoint_id,
          section_id,
          type_id,
          type_code,
          type_name,
          is_custom,
          icon,
          color,
          title,
          description,
          checkpoint_date,
          completed_at,
          status,
          status_label,
          linked_sections,
          linked_sections_count
        `)
        .in('checkpoint_id', checkpointIdsToLoad)

      if (!additionalError && additionalCheckpoints) {
        // Создаём map чекпоинтов по checkpoint_id
        const checkpointDataMap = new Map<string, typeof additionalCheckpoints[0]>()
        for (const row of additionalCheckpoints) {
          checkpointDataMap.set(row.checkpoint_id, row)
        }

        // Добавляем чекпоинты в связанные секции
        for (const [checkpointId, linkedSectionIds] of linkedCheckpointMap) {
          const row = checkpointDataMap.get(checkpointId)
          if (!row) continue

          const linkedSectionsData = (row.linked_sections as Array<{
            section_id: string
            section_name: string
            object_id: string | null
          }> | null) ?? []

          for (const linkedSectionId of linkedSectionIds) {
            if (!checkpoints[linkedSectionId]) {
              checkpoints[linkedSectionId] = []
            }

            // Проверяем что чекпоинт ещё не добавлен в эту секцию
            const alreadyExists = checkpoints[linkedSectionId].some(
              c => c.id === checkpointId
            )
            if (alreadyExists) continue

            checkpoints[linkedSectionId].push({
              id: row.checkpoint_id,
              sectionId: row.section_id, // Оригинальный section_id (владелец)
              typeId: row.type_id,
              typeCode: row.type_code,
              typeName: row.type_name,
              isCustom: row.is_custom ?? false,
              icon: row.icon,
              color: row.color,
              title: row.title,
              description: row.description,
              checkpointDate: row.checkpoint_date,
              completedAt: row.completed_at,
              status: row.status as 'pending' | 'completed' | 'completed_late' | 'overdue',
              statusLabel: row.status_label ?? '',
              linkedSections: linkedSectionsData,
              linkedSectionsCount: row.linked_sections_count ?? 0,
            })
          }
        }
      }
    }

    // Также добавляем уже загруженные чекпоинты в их связанные секции
    for (const [checkpointId, linkedSectionIds] of linkedCheckpointMap) {
      if (!loadedCheckpointIds.has(checkpointId)) continue

      // Находим данные чекпоинта среди уже загруженных
      const row = (checkpointsResult.data || []).find(r => r.checkpoint_id === checkpointId)
      if (!row) continue

      const linkedSectionsData = (row.linked_sections as Array<{
        section_id: string
        section_name: string
        object_id: string | null
      }> | null) ?? []

      for (const linkedSectionId of linkedSectionIds) {
        if (!checkpoints[linkedSectionId]) {
          checkpoints[linkedSectionId] = []
        }

        // Проверяем что чекпоинт ещё не добавлен в эту секцию
        const alreadyExists = checkpoints[linkedSectionId].some(
          c => c.id === checkpointId
        )
        if (alreadyExists) continue

        checkpoints[linkedSectionId].push({
          id: row.checkpoint_id,
          sectionId: row.section_id,
          typeId: row.type_id,
          typeCode: row.type_code,
          typeName: row.type_name,
          isCustom: row.is_custom ?? false,
          icon: row.icon,
          color: row.color,
          title: row.title,
          description: row.description,
          checkpointDate: row.checkpoint_date,
          completedAt: row.completed_at,
          status: row.status as 'pending' | 'completed' | 'completed_late' | 'overdue',
          statusLabel: row.status_label ?? '',
          linkedSections: linkedSectionsData,
          linkedSectionsCount: row.linked_sections_count ?? 0,
        })
      }
    }

    // Budgets: группируем по составному ключу entity_type:entity_id
    // V2: total_amount → planned_amount, total_spent → spent_amount
    // type_name и type_color больше не используются (V2 не имеет budget_types)
    const budgets: Record<string, BatchBudget[]> = {}

    // Инициализируем ключи для sections
    for (const sectionId of sectionIds) {
      budgets[`section:${sectionId}`] = []
    }

    // Инициализируем ключи для stages
    for (const stageId of stageIds) {
      budgets[`decomposition_stage:${stageId}`] = []
    }

    // Обрабатываем бюджеты sections
    for (const row of budgetsResult.data || []) {
      const entityId = row.entity_id
      if (!entityId) continue

      const key = `section:${entityId}`
      if (!budgets[key]) {
        budgets[key] = []
      }

      // V2 mapping: total_amount → planned_amount, total_spent → spent_amount
      const planned_amount = Number(row.total_amount) || 0
      const spent_amount = Number(row.total_spent) || 0
      const remaining_amount = Number(row.remaining_amount) || 0
      const spent_percentage = Number(row.spent_percentage) || 0

      budgets[key].push({
        budget_id: row.budget_id,
        name: row.name,
        planned_amount,
        spent_amount,
        remaining_amount,
        spent_percentage,
        type_name: null, // V2: budget_types не используются
        type_color: null, // V2: budget_types не используются
        is_active: row.is_active ?? true,
      })
    }

    // Обрабатываем бюджеты stages
    for (const row of stageBudgetsResult.data || []) {
      const entityId = row.entity_id
      if (!entityId) continue

      const key = `decomposition_stage:${entityId}`
      if (!budgets[key]) {
        budgets[key] = []
      }

      // V2 mapping: planned_amount as total_amount, spent_amount as total_spent
      const planned_amount = Number(row.total_amount) || 0
      const spent_amount = Number(row.total_spent) || 0
      const remaining_amount = Number(row.remaining_amount) || 0
      const spent_percentage = Number(row.spent_percentage) || 0

      budgets[key].push({
        budget_id: row.budget_id,
        name: row.name,
        planned_amount,
        spent_amount,
        remaining_amount,
        spent_percentage,
        type_name: null, // V2: budget_types не используются
        type_color: null, // V2: budget_types не используются
        is_active: row.is_active ?? true,
      })
    }

    // Обрабатываем бюджет объекта
    let objectBudget: BatchBudget | null = null
    if (objectBudgetResult.data) {
      const row = objectBudgetResult.data
      const planned_amount = Number(row.total_amount) || 0
      const spent_amount = Number(row.total_spent) || 0
      const remaining_amount = Number(row.remaining_amount) || 0
      const spent_percentage = Number(row.spent_percentage) || 0

      objectBudget = {
        budget_id: row.budget_id,
        name: row.name,
        planned_amount,
        spent_amount,
        remaining_amount,
        spent_percentage,
        type_name: null, // V2: budget_types не используются
        type_color: null, // V2: budget_types не используются
        is_active: row.is_active ?? true,
      }
    }

    return {
      success: true,
      data: {
        workLogs,
        loadings,
        stageReadiness,
        stageResponsibles,
        checkpoints,
        budgets,
        objectBudget,
      },
    }
  } catch (error) {
    console.error('[getSectionsBatchData] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки данных секций',
    }
  }
}

