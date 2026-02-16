/**
 * Sections Page Module - Server Actions
 *
 * Server Actions для работы с иерархией разделов и загрузками
 */

'use server'

import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/modules/cache'
import type { FilterQueryParams } from '@/modules/inline-filter'
import { getFilterContext, applyMandatoryFilters } from '@/modules/permissions'
import type {
  Department,
  Project,
  ObjectSection,
  SectionLoading,
  CreateLoadingInput,
  UpdateLoadingInput,
  CapacityInput,
  SectionCapacity,
} from '../types'

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Проверяет, является ли строка UUID
 */
function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

// ============================================================================
// Get Hierarchy Data
// ============================================================================

/**
 * Получить иерархию отделов → проекты → разделы → загрузки
 */
export async function getSectionsHierarchy(
  filters?: FilterQueryParams
): Promise<ActionResult<Department[]>> {
  try {
    const supabase = await createClient()

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Получаем filter context для permissions
    const filterContextResult = await getFilterContext()
    const filterContext = filterContextResult.success ? filterContextResult.data : null
    const secureFilters = applyMandatoryFilters(filters || {}, filterContext)

    // Запрос к view
    let query = supabase.from('view_departments_sections_loadings').select('*')

    // Применяем фильтры из inline-filter (поддерживаем UUID и названия)

    // Фильтр по команде (через employee_id, т.к. view не содержит team_id)
    if (secureFilters?.team_id) {
      const teamId = Array.isArray(secureFilters.team_id)
        ? secureFilters.team_id[0]
        : secureFilters.team_id

      if (isUuid(teamId)) {
        // Получаем сотрудников команды из view_employee_workloads
        const { data: teamEmployees } = await supabase
          .from('view_employee_workloads')
          .select('user_id')
          .eq('final_team_id', teamId)

        const employeeIds = teamEmployees?.map(e => e.user_id) || []
        if (employeeIds.length > 0) {
          // Убираем дубликаты (т.к. view может вернуть одного employee несколько раз из-за loadings)
          const uniqueEmployeeIds = Array.from(new Set(employeeIds))
          query = query.in('employee_id', uniqueEmployeeIds)
        } else {
          // Команда пустая - возвращаем пустой результат
          return { success: true, data: [] }
        }
      }
    }

    // Фильтр по отделу
    if (secureFilters?.department_id) {
      const departmentId = Array.isArray(secureFilters.department_id)
        ? secureFilters.department_id[0]
        : secureFilters.department_id

      if (isUuid(departmentId)) {
        query = query.eq('department_id', departmentId)
      } else {
        query = query.ilike('department_name', departmentId)
      }
    }

    // Фильтр по подразделению
    if (secureFilters?.subdivision_id) {
      const subdivisionId = Array.isArray(secureFilters.subdivision_id)
        ? secureFilters.subdivision_id[0]
        : secureFilters.subdivision_id

      if (isUuid(subdivisionId)) {
        // Для подразделения нужно получить все отделы подразделения
        const { data: depts } = await supabase
          .from('departments')
          .select('department_id')
          .eq('subdivision_id', subdivisionId)

        const deptIds = depts?.map(d => d.department_id) || []
        if (deptIds.length > 0) {
          query = query.in('department_id', deptIds)
        } else {
          return { success: true, data: [] }
        }
      } else {
        // Фильтрация по названию подразделения
        const { data: subdivisions } = await supabase
          .from('subdivisions')
          .select('subdivision_id')
          .ilike('subdivision_name', subdivisionId)

        if (subdivisions && subdivisions.length > 0) {
          const { data: depts } = await supabase
            .from('departments')
            .select('department_id')
            .in('subdivision_id', subdivisions.map(s => s.subdivision_id))

          const deptIds = depts?.map(d => d.department_id) || []
          if (deptIds.length > 0) {
            query = query.in('department_id', deptIds)
          } else {
            return { success: true, data: [] }
          }
        }
      }
    }

    // Фильтр по проекту
    if (secureFilters?.project_id) {
      const projectId = Array.isArray(secureFilters.project_id)
        ? secureFilters.project_id[0]
        : secureFilters.project_id

      if (isUuid(projectId)) {
        query = query.eq('project_id', projectId)
      } else {
        query = query.ilike('project_name', projectId)
      }
    }

    const { data: rows, error } = await query

    if (error) {
      console.error('Error fetching sections hierarchy:', error)
      return {
        success: false,
        error: `Ошибка загрузки данных: ${error.message}`,
      }
    }

    if (!rows || rows.length === 0) {
      return { success: true, data: [] }
    }

    // Трансформация плоских строк в иерархию
    const departmentsMap = new Map<string, Department>()

    for (const row of rows) {
      const deptId = row.department_id
      const projectId = row.project_id
      const sectionId = row.section_id
      const loadingId = row.loading_id

      // Получаем или создаём отдел
      let department = departmentsMap.get(deptId)
      if (!department) {
        department = {
          id: deptId,
          name: row.department_name,
          subdivisionId: row.subdivision_id,
          subdivisionName: row.subdivision_name,
          departmentHeadId: row.department_head_id,
          departmentHeadName: row.department_head_name,
          departmentHeadEmail: row.department_head_email,
          departmentHeadAvatarUrl: row.department_head_avatar_url,
          totalProjects: 0,
          totalSections: 0,
          totalLoadings: 0,
          dailyWorkloads: {},
          projects: [],
        }
        departmentsMap.set(deptId, department)
      }

      // Получаем или создаём проект
      let project = department.projects.find((p) => p.id === projectId)
      if (!project) {
        project = {
          id: projectId,
          name: row.project_name,
          status: row.project_status,
          managerId: null, // View doesn't have project manager
          managerName: null,
          leadEngineerId: null,
          leadEngineerName: null,
          departmentId: deptId,
          departmentName: row.department_name,
          stageType: null, // View doesn't have stage type
          totalSections: 0,
          totalLoadings: 0,
          dailyWorkloads: {},
          objectSections: [],
        }
        department.projects.push(project)
        department.totalProjects++
      }

      // Получаем или создаём объект/раздел
      let objectSection = project.objectSections.find((os) => os.id === sectionId)
      if (!objectSection) {
        // Собираем имя responsible из first_name и last_name
        const responsibleName = row.responsible_first_name && row.responsible_last_name
          ? `${row.responsible_first_name} ${row.responsible_last_name}`
          : row.responsible_first_name || row.responsible_last_name || null

        objectSection = {
          id: sectionId,
          name: `${row.object_name} / ${row.section_name}`,
          objectId: row.object_id,
          objectName: row.object_name,
          sectionId: sectionId,
          sectionName: row.section_name,
          sectionType: row.section_type,
          sectionResponsibleId: row.responsible_id,
          sectionResponsibleName: responsibleName,
          projectId: projectId,
          projectName: row.project_name,
          departmentId: deptId,
          departmentName: row.department_name,
          startDate: row.section_start_date,
          endDate: row.section_end_date,
          defaultCapacity: row.default_capacity != null ? parseFloat(String(row.default_capacity)) : null,
          capacityOverrides: {},
          dailyWorkloads: {},
          loadings: [],
          totalLoadings: 0,
        }
        project.objectSections.push(objectSection)
        project.totalSections++
        department.totalSections++
      }

      // Добавляем capacity override если есть
      if (row.capacity_date && row.capacity_value !== null) {
        objectSection.capacityOverrides![row.capacity_date] = row.capacity_value
      }

      // Добавляем загрузку если есть
      if (loadingId) {
        // Собираем имя сотрудника из first_name и last_name
        const employeeName = row.employee_first_name && row.employee_last_name
          ? `${row.employee_first_name} ${row.employee_last_name}`
          : row.employee_first_name || row.employee_last_name || 'Без имени'

        const loading: SectionLoading = {
          id: loadingId,
          sectionId: sectionId,
          sectionName: row.section_name,
          projectId: projectId,
          projectName: row.project_name,
          objectId: row.object_id,
          objectName: row.object_name,
          stageId: row.loading_stage,
          stageName: row.stage_name,
          employeeId: row.employee_id,
          employeeName: employeeName,
          employeeFirstName: row.employee_first_name,
          employeeLastName: row.employee_last_name,
          employeeEmail: null, // View doesn't have email
          employeeAvatarUrl: row.employee_avatar_url,
          employeeCategory: row.employee_category,
          employeePosition: row.employee_position,
          employeeDepartmentId: deptId, // Use parent department
          employeeDepartmentName: row.department_name,
          startDate: row.loading_start,
          endDate: row.loading_finish,
          rate: row.loading_rate,
          status: 'active', // View doesn't have status
          comment: row.loading_comment,
          createdAt: null,
          updatedAt: null,
        }
        objectSection.loadings.push(loading)
        objectSection.totalLoadings = objectSection.loadings.length
        project.totalLoadings++
        department.totalLoadings++
      }
    }

    // Преобразуем Map в массив
    const departments = Array.from(departmentsMap.values())

    return { success: true, data: departments }
  } catch (error) {
    console.error('Unexpected error in getSectionsHierarchy:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

// ============================================================================
// Capacity CRUD
// ============================================================================

/**
 * Установить/обновить ёмкость раздела
 */
export async function upsertSectionCapacity(
  input: CapacityInput
): Promise<ActionResult<SectionCapacity>> {
  try {
    const supabase = await createClient()

    // Валидация
    if (input.capacityValue <= 0 || input.capacityValue > 99) {
      return {
        success: false,
        error: 'Ёмкость должна быть от 0.1 до 99',
      }
    }

    // Получаем текущего пользователя
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Upsert capacity
    const { data, error } = await supabase
      .from('section_capacity')
      .upsert(
        {
          section_id: input.sectionId,
          capacity_date: input.capacityDate,
          capacity_value: input.capacityValue,
          created_by: user.id,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'section_id,capacity_date',
        }
      )
      .select()
      .single()

    if (error) {
      console.error('Error upserting section capacity:', error)
      return {
        success: false,
        error: `Ошибка сохранения ёмкости: ${error.message}`,
      }
    }

    return {
      success: true,
      data: {
        capacityId: data.capacity_id,
        sectionId: data.section_id,
        capacityDate: data.capacity_date,
        capacityValue: data.capacity_value,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        createdBy: data.created_by,
      },
    }
  } catch (error) {
    console.error('Unexpected error in upsertSectionCapacity:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

/**
 * Удалить capacity override для конкретной даты (вернёт к default)
 */
export async function deleteSectionCapacityOverride(
  sectionId: string,
  date: string
): Promise<ActionResult<void>> {
  try {
    const supabase = await createClient()

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const { error } = await supabase
      .from('section_capacity')
      .delete()
      .eq('section_id', sectionId)
      .eq('capacity_date', date)

    if (error) {
      console.error('Error deleting capacity override:', error)
      return {
        success: false,
        error: `Ошибка удаления: ${error.message}`,
      }
    }

    return { success: true, data: undefined }
  } catch (error) {
    console.error('Unexpected error in deleteSectionCapacityOverride:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

// ============================================================================
// Loading CRUD
// ============================================================================

/**
 * Создать загрузку с валидацией stage → section
 */
export async function createSectionLoading(
  input: CreateLoadingInput
): Promise<ActionResult<{ loading_id: string }>> {
  try {
    const supabase = await createClient()

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Валидация: если stageId указан, проверяем что он принадлежит sectionId
    if (input.stageId) {
      const { data: stage, error: stageError } = await supabase
        .from('decomposition_stages')
        .select('decomposition_stage_section_id')
        .eq('decomposition_stage_id', input.stageId)
        .single()

      if (stageError || !stage) {
        return {
          success: false,
          error: 'Этап декомпозиции не найден',
        }
      }

      if (stage.decomposition_stage_section_id !== input.sectionId) {
        return {
          success: false,
          error: 'Выбранный этап не принадлежит указанному разделу',
        }
      }
    }

    // Валидация дат
    if (new Date(input.startDate) > new Date(input.endDate)) {
      return {
        success: false,
        error: 'Дата начала не может быть позже даты окончания',
      }
    }

    // Валидация ставки
    if (input.rate <= 0 || input.rate > 1) {
      return {
        success: false,
        error: 'Ставка должна быть от 0 до 1',
      }
    }

    // Создание загрузки
    const { data, error } = await supabase
      .from('loadings')
      .insert({
        loading_section: input.sectionId,
        loading_stage: input.stageId,
        loading_responsible: input.employeeId,
        loading_start: input.startDate,
        loading_finish: input.endDate,
        loading_rate: input.rate,
        loading_comment: input.comment,
        loading_status: 'active',
        is_shortage: false,
      })
      .select('loading_id')
      .single()

    if (error) {
      console.error('Error creating loading:', error)
      return {
        success: false,
        error: `Ошибка создания загрузки: ${error.message}`,
      }
    }

    return { success: true, data: { loading_id: data.loading_id } }
  } catch (error) {
    console.error('Unexpected error in createSectionLoading:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

/**
 * Обновить загрузку
 */
export async function updateSectionLoading(
  input: UpdateLoadingInput
): Promise<ActionResult<void>> {
  try {
    const supabase = await createClient()

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Валидация: если stageId указан, проверяем что он принадлежит section
    if (input.stageId !== undefined && input.stageId !== null) {
      // Сначала получаем section_id текущей загрузки
      const { data: loading, error: loadingError } = await supabase
        .from('loadings')
        .select('loading_section')
        .eq('loading_id', input.loadingId)
        .single()

      if (loadingError || !loading) {
        return {
          success: false,
          error: 'Загрузка не найдена',
        }
      }

      // Проверяем что stage принадлежит section
      const { data: stage, error: stageError } = await supabase
        .from('decomposition_stages')
        .select('decomposition_stage_section_id')
        .eq('decomposition_stage_id', input.stageId)
        .single()

      if (stageError || !stage) {
        return {
          success: false,
          error: 'Этап декомпозиции не найден',
        }
      }

      if (stage.decomposition_stage_section_id !== loading.loading_section) {
        return {
          success: false,
          error: 'Выбранный этап не принадлежит разделу загрузки',
        }
      }
    }

    // Валидация дат если обе указаны
    if (input.startDate && input.endDate) {
      if (new Date(input.startDate) > new Date(input.endDate)) {
        return {
          success: false,
          error: 'Дата начала не может быть позже даты окончания',
        }
      }
    }

    // Валидация ставки
    if (input.rate !== undefined && (input.rate <= 0 || input.rate > 1)) {
      return {
        success: false,
        error: 'Ставка должна быть от 0 до 1',
      }
    }

    // Формируем объект обновления
    const updateData: Record<string, unknown> = {}

    if (input.employeeId !== undefined) updateData.loading_responsible = input.employeeId
    if (input.startDate !== undefined) updateData.loading_start = input.startDate
    if (input.endDate !== undefined) updateData.loading_finish = input.endDate
    if (input.rate !== undefined) updateData.loading_rate = input.rate
    if (input.comment !== undefined) updateData.loading_comment = input.comment
    if (input.stageId !== undefined) updateData.loading_stage = input.stageId

    // Проверяем что есть что обновлять
    if (Object.keys(updateData).length === 0) {
      return { success: true, data: undefined }
    }

    const { error } = await supabase
      .from('loadings')
      .update(updateData)
      .eq('loading_id', input.loadingId)

    if (error) {
      console.error('Error updating loading:', error)
      return {
        success: false,
        error: `Ошибка обновления загрузки: ${error.message}`,
      }
    }

    return { success: true, data: undefined }
  } catch (error) {
    console.error('Unexpected error in updateSectionLoading:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

/**
 * Удалить загрузку (архивировать)
 */
export async function deleteSectionLoading(
  loadingId: string
): Promise<ActionResult<void>> {
  try {
    const supabase = await createClient()

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Архивируем вместо удаления
    const { error } = await supabase
      .from('loadings')
      .update({
        loading_status: 'archived',
        loading_updated: new Date().toISOString(),
      })
      .eq('loading_id', loadingId)

    if (error) {
      console.error('Error deleting loading:', error)
      return {
        success: false,
        error: `Ошибка удаления загрузки: ${error.message}`,
      }
    }

    return { success: true, data: undefined }
  } catch (error) {
    console.error('Unexpected error in deleteSectionLoading:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}
