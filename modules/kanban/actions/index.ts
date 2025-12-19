'use server'

/**
 * Kanban Module - Server Actions
 *
 * Server Actions для работы с данными канбан-доски.
 * Используют v_resource_graph view для получения данных.
 */

import { createClient } from '@/utils/supabase/server'
import type { ActionResult, PaginatedActionResult } from '@/modules/cache'
import type { FilterQueryParams } from '@/modules/inline-filter'
import type { KanbanSection, KanbanStage, StageStatus } from '../types'
import { transformRowsToKanbanSections } from '../utils/transform-rows-to-kanban'

// ============================================================================
// Types
// ============================================================================

export type KanbanFilters = FilterQueryParams

/** Параметры для пагинированного запроса */
export interface KanbanPaginatedParams {
  filters?: KanbanFilters
  page: number
  pageSize?: number
}

/** Размер страницы по умолчанию */
const DEFAULT_PAGE_SIZE = 15

// ============================================================================
// Queries
// ============================================================================

/**
 * Получить разделы для канбан-доски
 *
 * Загружает данные из v_resource_graph и трансформирует в KanbanSection[]
 * Применяет фильтры по подразделению, отделу, проекту и тегам
 */
export async function getKanbanSections(
  filters?: KanbanFilters
): Promise<ActionResult<KanbanSection[]>> {
  try {
    const supabase = await createClient()

    // Build query
    let query = supabase.from('v_resource_graph').select('*')

    // Apply tag filter first (requires subquery to get project IDs)
    const tagValues = filters?.['tag_id']
    if (tagValues) {
      const tagArray = Array.isArray(tagValues) ? tagValues : [tagValues]
      if (tagArray.length > 0) {
        // Check if UUID or name
        const isUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            tagArray[0]
          )

        let tagUuids: string[]
        if (isUuid) {
          tagUuids = tagArray
        } else {
          // Look up tags by name
          const { data: tags, error: tagsError } = await supabase
            .from('project_tags')
            .select('tag_id, name')
            .in('name', tagArray)

          if (tagsError) {
            console.error('[getKanbanSections] Tag lookup error:', tagsError)
            return { success: false, error: tagsError.message }
          }

          tagUuids = tags?.map((t) => t.tag_id) || []
          if (tagUuids.length === 0) {
            return { success: true, data: [] }
          }
        }

        const { data: tagLinks, error: tagError } = await supabase
          .from('project_tag_links')
          .select('project_id')
          .in('tag_id', tagUuids)

        if (tagError) {
          console.error('[getKanbanSections] Tag filter error:', tagError)
          return { success: false, error: tagError.message }
        }

        // Get unique project IDs
        const projectIdsFromTags = [
          ...new Set(tagLinks?.map((l) => l.project_id) || []),
        ]

        // If no projects match tags, return empty result
        if (projectIdsFromTags.length === 0) {
          return { success: true, data: [] }
        }

        query = query.in('project_id', projectIdsFromTags)
      }
    }

    // Apply subdivision filter (by name or UUID)
    const subdivisionId = filters?.['subdivision_id']
    if (subdivisionId && typeof subdivisionId === 'string') {
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          subdivisionId
        )
      if (isUuid) {
        query = query.eq('section_subdivision_id', subdivisionId)
      } else {
        query = query.ilike('section_subdivision_name', subdivisionId)
      }
    }

    // Apply department filter (by name or UUID)
    const departmentId = filters?.['department_id']
    if (departmentId && typeof departmentId === 'string') {
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          departmentId
        )
      if (isUuid) {
        query = query.eq('section_department_id', departmentId)
      } else {
        query = query.ilike('section_department_name', departmentId)
      }
    }

    // Apply team filter (requires subquery to get team members)
    const teamId = filters?.['team_id']
    if (teamId && typeof teamId === 'string') {
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          teamId
        )

      // Get team members from v_org_structure
      let teamQuery = supabase.from('v_org_structure').select('employee_id')
      if (isUuid) {
        teamQuery = teamQuery.eq('team_id', teamId)
      } else {
        teamQuery = teamQuery.ilike('team_name', teamId)
      }

      const { data: teamMembers, error: teamError } = await teamQuery

      if (teamError) {
        console.error('[getKanbanSections] Team filter error:', teamError)
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

    // Apply responsible filter (by name or UUID)
    const responsibleId = filters?.['responsible_id']
    if (responsibleId && typeof responsibleId === 'string') {
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          responsibleId
        )
      if (isUuid) {
        query = query.eq('section_responsible_id', responsibleId)
      } else {
        query = query.ilike('section_responsible_name', responsibleId)
      }
    }

    // Apply project filter (by name or UUID)
    const projectId = filters?.['project_id']
    if (projectId && typeof projectId === 'string') {
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          projectId
        )
      if (isUuid) {
        query = query.eq('project_id', projectId)
      } else {
        query = query.ilike('project_name', projectId)
      }
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
      console.error('[getKanbanSections] Supabase error:', error)
      return { success: false, error: error.message }
    }

    // Transform flat rows to kanban sections
    const sections = transformRowsToKanbanSections(data || [])

    return { success: true, data: sections }
  } catch (error) {
    console.error('[getKanbanSections] Error:', error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Ошибка загрузки разделов',
    }
  }
}

/**
 * Получить разделы для канбан-доски с пагинацией
 *
 * Загружает данные из v_resource_graph, трансформирует в KanbanSection[]
 * и возвращает указанную страницу с мета-информацией о пагинации.
 *
 * @param params - Параметры запроса (filters, page, pageSize)
 * @returns PaginatedActionResult с секциями и информацией о пагинации
 */
export async function getKanbanSectionsPaginated(
  params: KanbanPaginatedParams
): Promise<PaginatedActionResult<KanbanSection>> {
  try {
    const { filters, page, pageSize = DEFAULT_PAGE_SIZE } = params

    const supabase = await createClient()

    // Build query
    let query = supabase.from('v_resource_graph').select('*')

    // Apply tag filter first (requires subquery to get project IDs)
    const tagValues = filters?.['tag_id']
    if (tagValues) {
      const tagArray = Array.isArray(tagValues) ? tagValues : [tagValues]
      if (tagArray.length > 0) {
        // Check if UUID or name
        const isUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            tagArray[0]
          )

        let tagUuids: string[]
        if (isUuid) {
          tagUuids = tagArray
        } else {
          // Look up tags by name
          const { data: tags, error: tagsError } = await supabase
            .from('project_tags')
            .select('tag_id, name')
            .in('name', tagArray)

          if (tagsError) {
            console.error('[getKanbanSectionsPaginated] Tag lookup error:', tagsError)
            return { success: false, error: tagsError.message }
          }

          tagUuids = tags?.map((t) => t.tag_id) || []
          if (tagUuids.length === 0) {
            return {
              success: true,
              data: [],
              pagination: { page, pageSize, total: 0, totalPages: 0 },
            }
          }
        }

        const { data: tagLinks, error: tagError } = await supabase
          .from('project_tag_links')
          .select('project_id')
          .in('tag_id', tagUuids)

        if (tagError) {
          console.error('[getKanbanSectionsPaginated] Tag filter error:', tagError)
          return { success: false, error: tagError.message }
        }

        // Get unique project IDs
        const projectIdsFromTags = [
          ...new Set(tagLinks?.map((l) => l.project_id) || []),
        ]

        // If no projects match tags, return empty result
        if (projectIdsFromTags.length === 0) {
          return {
            success: true,
            data: [],
            pagination: { page, pageSize, total: 0, totalPages: 0 },
          }
        }

        query = query.in('project_id', projectIdsFromTags)
      }
    }

    // Apply subdivision filter (by name or UUID)
    const subdivisionId = filters?.['subdivision_id']
    if (subdivisionId && typeof subdivisionId === 'string') {
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          subdivisionId
        )
      if (isUuid) {
        query = query.eq('section_subdivision_id', subdivisionId)
      } else {
        query = query.ilike('section_subdivision_name', subdivisionId)
      }
    }

    // Apply department filter (by name or UUID)
    const departmentId = filters?.['department_id']
    if (departmentId && typeof departmentId === 'string') {
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          departmentId
        )
      if (isUuid) {
        query = query.eq('section_department_id', departmentId)
      } else {
        query = query.ilike('section_department_name', departmentId)
      }
    }

    // Apply team filter (requires subquery to get team members)
    const teamId = filters?.['team_id']
    if (teamId && typeof teamId === 'string') {
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          teamId
        )

      // Get team members from v_org_structure
      let teamQuery = supabase.from('v_org_structure').select('employee_id')
      if (isUuid) {
        teamQuery = teamQuery.eq('team_id', teamId)
      } else {
        teamQuery = teamQuery.ilike('team_name', teamId)
      }

      const { data: teamMembers, error: teamError } = await teamQuery

      if (teamError) {
        console.error('[getKanbanSectionsPaginated] Team filter error:', teamError)
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
        return {
          success: true,
          data: [],
          pagination: { page, pageSize, total: 0, totalPages: 0 },
        }
      }

      query = query.in('section_responsible_id', employeeIds)
    }

    // Apply responsible filter (by name or UUID)
    const responsibleId = filters?.['responsible_id']
    if (responsibleId && typeof responsibleId === 'string') {
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          responsibleId
        )
      if (isUuid) {
        query = query.eq('section_responsible_id', responsibleId)
      } else {
        query = query.ilike('section_responsible_name', responsibleId)
      }
    }

    // Apply project filter (by name or UUID)
    const projectId = filters?.['project_id']
    if (projectId && typeof projectId === 'string') {
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          projectId
        )
      if (isUuid) {
        query = query.eq('project_id', projectId)
      } else {
        query = query.ilike('project_name', projectId)
      }
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
      console.error('[getKanbanSectionsPaginated] Supabase error:', error)
      return { success: false, error: error.message }
    }

    // Transform flat rows to kanban sections
    const allSections = transformRowsToKanbanSections(data || [])

    // Calculate pagination
    const total = allSections.length
    const totalPages = Math.ceil(total / pageSize)
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize

    // Get page slice
    const paginatedSections = allSections.slice(startIndex, endIndex)

    return {
      success: true,
      data: paginatedSections,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    }
  } catch (error) {
    console.error('[getKanbanSectionsPaginated] Error:', error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Ошибка загрузки разделов',
    }
  }
}

/**
 * Получить детали раздела по ID
 */
export async function getKanbanSectionById(
  sectionId: string
): Promise<ActionResult<KanbanSection | null>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('v_resource_graph')
      .select('*')
      .eq('section_id', sectionId)
      .order('decomposition_stage_name')
      .order('decomposition_item_order')

    if (error) {
      console.error('[getKanbanSectionById] Supabase error:', error)
      return { success: false, error: error.message }
    }

    if (!data || data.length === 0) {
      return { success: true, data: null }
    }

    // Transform and get the first (only) section
    const sections = transformRowsToKanbanSections(data)
    return { success: true, data: sections[0] || null }
  } catch (error) {
    console.error('[getKanbanSectionById] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки раздела',
    }
  }
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Обновить статус этапа (при перетаскивании карточки)
 */
export async function updateStageStatus(input: {
  stageId: string
  sectionId: string
  newStatus: StageStatus
}): Promise<ActionResult<KanbanStage>> {
  try {
    const supabase = await createClient()

    // Map kanban status back to DB status name
    const statusMap: Record<StageStatus, string> = {
      backlog: 'Бэклог',
      planned: 'План',
      in_progress: 'В работе',
      paused: 'Пауза',
      review: 'Проверка',
      done: 'Готово',
    }

    const dbStatusName = statusMap[input.newStatus]

    // First, get the status ID from stage_statuses table
    const { data: statusData, error: statusError } = await supabase
      .from('stage_statuses')
      .select('id')
      .eq('name', dbStatusName)
      .single()

    if (statusError || !statusData) {
      console.error('[updateStageStatus] Status lookup error:', statusError)
      return {
        success: false,
        error: `Не найден статус: ${dbStatusName}`,
      }
    }

    // Update the decomposition stage status
    const { error: updateError } = await supabase
      .from('decomposition_stages')
      .update({ stage_status_id: statusData.id })
      .eq('decomposition_stage_id', input.stageId)

    if (updateError) {
      console.error('[updateStageStatus] Update error:', updateError)
      return { success: false, error: updateError.message }
    }

    // Return updated stage data (simplified)
    return {
      success: true,
      data: {
        id: input.stageId,
        name: '',
        status: input.newStatus,
        sectionId: input.sectionId,
        order: 0,
        tasks: [],
        plannedHours: 0,
        actualHours: 0,
        progress: 0,
      },
    }
  } catch (error) {
    console.error('[updateStageStatus] Error:', error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Ошибка обновления статуса',
    }
  }
}

/**
 * Обновить прогресс задачи
 */
export async function updateTaskProgress(input: {
  taskId: string
  stageId: string
  sectionId: string
  progress: number
}): Promise<ActionResult<{ success: boolean }>> {
  try {
    const supabase = await createClient()

    // Validate progress
    const progress = Math.max(0, Math.min(100, Math.round(input.progress)))

    const { error } = await supabase
      .from('decomposition_items')
      .update({ decomposition_item_progress: progress })
      .eq('decomposition_item_id', input.taskId)

    if (error) {
      console.error('[updateTaskProgress] Supabase error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: { success: true } }
  } catch (error) {
    console.error('[updateTaskProgress] Error:', error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Ошибка обновления прогресса',
    }
  }
}

/**
 * Обновить плановые часы задачи
 */
export async function updateTaskPlannedHours(input: {
  taskId: string
  stageId: string
  sectionId: string
  plannedHours: number
}): Promise<ActionResult<{ success: boolean }>> {
  try {
    const supabase = await createClient()

    // Validate hours
    const hours = Math.max(0, input.plannedHours)

    const { error } = await supabase
      .from('decomposition_items')
      .update({ decomposition_item_planned_hours: hours })
      .eq('decomposition_item_id', input.taskId)

    if (error) {
      console.error('[updateTaskPlannedHours] Supabase error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: { success: true } }
  } catch (error) {
    console.error('[updateTaskPlannedHours] Error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Ошибка обновления плановых часов',
    }
  }
}
