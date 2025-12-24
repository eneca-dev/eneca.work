/**
 * Resource Graph Module - Server Actions
 *
 * Server Actions для модуля графика ресурсов
 * Все actions используют RLS и типобезопасны
 */

'use server'

import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/modules/cache'
import type {
  Project,
  ResourceGraphRow,
  ProjectTag,
  CompanyCalendarEvent,
  WorkLog,
  Loading,
  ReadinessPoint,
  StageResponsible,
} from '../types'
import { transformRowsToHierarchy } from '../utils'
import type { FilterQueryParams } from '@/modules/inline-filter'

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
 * @returns Список проектов с полной структурой
 */
export async function getResourceGraphData(
  filters?: FilterQueryParams
): Promise<ActionResult<Project[]>> {
  try {
    const supabase = await createClient()

    // Build query
    let query = supabase
      .from('v_resource_graph')
      .select('*')

    // Apply tag filter first (requires subquery to get project IDs)
    // Метки передаются как названия, нужно сначала найти их ID
    const tagValues = filters?.tag_id
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
    if (filters?.subdivision_id && typeof filters.subdivision_id === 'string') {
      // Проверяем: это UUID или название?
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filters.subdivision_id)
      if (isUuid) {
        query = query.eq('section_subdivision_id', filters.subdivision_id)
      } else {
        // Фильтрация по названию (case-insensitive)
        query = query.ilike('section_subdivision_name', filters.subdivision_id)
      }
    }

    // Apply department filter (фильтр по отделу - по названию)
    if (filters?.department_id && typeof filters.department_id === 'string') {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filters.department_id)
      if (isUuid) {
        query = query.eq('section_department_id', filters.department_id)
      } else {
        query = query.ilike('section_department_name', filters.department_id)
      }
    }

    // Apply project filter (по названию или ID)
    if (filters?.project_id && typeof filters.project_id === 'string') {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filters.project_id)
      if (isUuid) {
        query = query.eq('project_id', filters.project_id)
      } else {
        query = query.ilike('project_name', filters.project_id)
      }
    }

    // Order for consistent hierarchy
    query = query
      .order('project_name')
      .order('stage_name')
      .order('object_name')
      .order('section_name')
      .order('decomposition_stage_order')
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

    // Получаем work_logs через join с decomposition_items, profiles и budgets
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
        decomposition_items!inner (
          decomposition_item_section_id
        ),
        profiles:work_log_created_by (
          user_id,
          first_name,
          last_name
        ),
        budgets (
          budget_id,
          name,
          budget_types (
            name,
            color
          )
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
      const budget = row.budgets as { budget_id: string; name: string; budget_types: { name: string; color: string } | null } | null

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
          id: budget?.budget_id || '',
          name: budget?.name || 'Без бюджета',
          typeName: budget?.budget_types?.name || null,
          typeColor: budget?.budget_types?.color || null,
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
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

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

