/**
 * Sections Page Module - Server Actions
 *
 * Server Actions для работы с иерархией разделов и загрузками
 */

'use server'

import { createClient } from '@/utils/supabase/server'
import * as Sentry from '@sentry/nextjs'
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
  return Sentry.startSpan(
    { name: 'getSectionsHierarchy', op: 'db.query' },
    async () => {
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

    // Для project_manager (scope.level === 'projects') убираем обязательный project_id фильтр,
    // чтобы менеджер видел все разделы — как на вкладке "Отделы" (там project_id не обрабатывается).
    // Ручной фильтр пользователя (если выбрал проект в UI) при этом сохраняется.
    const isProjectManagerScope = filterContext?.scope?.level === 'projects'
    const effectiveFilters = isProjectManagerScope
      ? { ...secureFilters, project_id: filters?.project_id }
      : secureFilters

    // Запрос к view
    let query = supabase.from('view_departments_sections_loadings').select('*')

    // Применяем фильтры из inline-filter (поддерживаем UUID и названия)
    // Переменная для хранения разрешённого UUID отдела (для трансформации иерархии ниже)
    let resolvedDeptUuid: string | undefined

    // Фильтр по команде (через employee_id, т.к. view не содержит team_id)
    if (effectiveFilters?.team_id) {
      let teamUuid: string | undefined

      const teamId = Array.isArray(effectiveFilters.team_id)
        ? effectiveFilters.team_id[0]
        : effectiveFilters.team_id

      if (isUuid(teamId)) {
        teamUuid = teamId
      } else {
        // Резолвим название команды в UUID
        const { data: teams } = await supabase
          .from('teams')
          .select('team_id')
          .ilike('team_name', teamId)

        if (teams && teams.length > 0) {
          teamUuid = teams[0].team_id
        } else {
          return { success: true, data: [] }
        }
      }

      // Получаем сотрудников команды из view_employee_workloads
      const { data: teamEmployees } = await supabase
        .from('view_employee_workloads')
        .select('user_id')
        .eq('final_team_id', teamUuid)

      const employeeIds = teamEmployees?.map(e => e.user_id) || []
      if (employeeIds.length > 0) {
        const uniqueEmployeeIds = Array.from(new Set(employeeIds))
        query = query.in('employee_id', uniqueEmployeeIds)
      } else {
        return { success: true, data: [] }
      }
    }

    // Фильтр по подразделению
    // Показывает раздел если ответственный или сотрудник с загрузкой из этого подразделения
    if (effectiveFilters?.subdivision_id) {
      const subdivisionId = Array.isArray(effectiveFilters.subdivision_id)
        ? effectiveFilters.subdivision_id[0]
        : effectiveFilters.subdivision_id

      if (isUuid(subdivisionId)) {
        query = query.or(`subdivision_id.eq.${subdivisionId},employee_subdivision_id.eq.${subdivisionId}`)
      } else {
        // Резолвим название в UUID (как в departments-timeline)
        const { data: subdivisions } = await supabase
          .from('subdivisions')
          .select('subdivision_id')
          .ilike('subdivision_name', subdivisionId)

        if (subdivisions && subdivisions.length > 0) {
          const subId = subdivisions[0].subdivision_id
          query = query.or(`subdivision_id.eq.${subId},employee_subdivision_id.eq.${subId}`)
        } else {
          return { success: true, data: [] }
        }
      }
    }

    // Фильтр по отделу
    // Показывает раздел если:
    // 1) Ответственный раздела из этого отдела ИЛИ
    // 2) Есть загрузка сотрудника из этого отдела
    if (effectiveFilters?.department_id) {
      const departmentId = Array.isArray(effectiveFilters.department_id)
        ? effectiveFilters.department_id[0]
        : effectiveFilters.department_id

      if (isUuid(departmentId)) {
        resolvedDeptUuid = departmentId
        query = query.or(`department_id.eq.${departmentId},employee_department_id.eq.${departmentId}`)
      } else {
        // Резолвим название в UUID (как в departments-timeline)
        const { data: departments } = await supabase
          .from('departments')
          .select('department_id')
          .ilike('department_name', departmentId)

        if (departments && departments.length > 0) {
          const deptId = departments[0].department_id
          resolvedDeptUuid = deptId
          query = query.or(`department_id.eq.${deptId},employee_department_id.eq.${deptId}`)
        } else {
          return { success: true, data: [] }
        }
      }
    }

    // Фильтр по проекту
    if (effectiveFilters?.project_id) {
      const projectId = Array.isArray(effectiveFilters.project_id)
        ? effectiveFilters.project_id[0]
        : effectiveFilters.project_id

      if (isUuid(projectId)) {
        query = query.eq('project_id', projectId)
      } else {
        query = query.ilike('project_name', projectId)
      }
    }

    const { data: rows, error } = await query

    if (error) {
      console.error('Error fetching sections hierarchy:', error)
      Sentry.captureException(new Error(error.message), {
        tags: { module: 'sections-page', action: 'getSectionsHierarchy', error_type: 'db_error', user_facing: 'true' },
        extra: { appliedFilters: Object.keys(secureFilters || {}) },
      })
      return {
        success: false,
        error: `Ошибка загрузки данных: ${error.message}`,
      }
    }

    if (!rows || rows.length === 0) {
      return { success: true, data: [] }
    }

    // Трансформация плоских строк в иерархию
    // Логика размещения раздела по отделам зависит от scope пользователя:
    // - team scope (user/team_lead): только отдел сотрудника с загрузкой
    // - dept scope (нач. отдела): только свой отдел (через ответственного или сотрудника)
    // - admin/subdivision scope: полное дублирование (отдел ответственного + отдел сотрудника)
    const departmentsMap = new Map<string, Department>()

    // Определяем scope по наличию mandatory-фильтров (устанавливаются applyMandatoryFilters)
    const isTeamScoped = !!secureFilters?.team_id
    // Используем разрешённый UUID отдела (resolvedDeptUuid), а не сырое значение из фильтров,
    // т.к. inline-filter передаёт НАЗВАНИЕ ("Отдел развития"), а не UUID.
    // Если mandatory-фильтр установил department_id как UUID — resolvedDeptUuid уже содержит его.
    // Если пользователь ввёл название — resolvedDeptUuid содержит UUID из DB lookup выше.
    const scopedDeptId = resolvedDeptUuid

    for (const row of rows) {
      const responsibleDeptId = row.department_id
      const projectId = row.project_id
      const sectionId = row.section_id
      const loadingId = row.loading_id
      const employeeDeptId = row.employee_department_id

      // Определяем в каких отделах должен появиться раздел
      const departmentIds: Array<{ id: string; name: string; subdivisionId: string; subdivisionName: string }> = []

      if (isTeamScoped) {
        // Team scope (user/team_lead): только отдел сотрудника с загрузкой.
        // Отдел ответственного может быть чужим — не дублируем туда,
        // чтобы не было фантомных отделов с 0 загрузок.
        if (loadingId && employeeDeptId) {
          departmentIds.push({
            id: employeeDeptId,
            name: row.employee_department_name || 'Без отдела',
            subdivisionId: row.employee_subdivision_id || '00000000-0000-0000-0000-000000000000',
            subdivisionName: row.employee_subdivision_name || 'Без подразделения',
          })
        }
      } else if (scopedDeptId) {
        // Dept scope (нач. отдела): раздел всегда попадает только в свой отдел.
        // OR-фильтр в запросе возвращает строки через два пути:
        // 1) department_id = МОЙ → ответственный из моего отдела
        // 2) employee_department_id = МОЙ → мой сотрудник грузится на чужом разделе
        // В обоих случаях дублировать в чужой отдел не нужно.
        if (responsibleDeptId === scopedDeptId) {
          departmentIds.push({
            id: responsibleDeptId,
            name: row.department_name,
            subdivisionId: row.subdivision_id,
            subdivisionName: row.subdivision_name,
          })
        } else if (loadingId && employeeDeptId === scopedDeptId) {
          departmentIds.push({
            id: employeeDeptId,
            name: row.employee_department_name || 'Без отдела',
            subdivisionId: row.employee_subdivision_id || '00000000-0000-0000-0000-000000000000',
            subdivisionName: row.employee_subdivision_name || 'Без подразделения',
          })
        }
      } else {
        // Admin / subdivision scope: полное дублирование —
        // 1) Всегда добавляем отдел ответственного
        departmentIds.push({
          id: responsibleDeptId,
          name: row.department_name,
          subdivisionId: row.subdivision_id,
          subdivisionName: row.subdivision_name,
        })

        // 2) Если есть загрузка сотрудника из другого отдела - добавляем и его
        if (loadingId && employeeDeptId && employeeDeptId !== responsibleDeptId) {
          departmentIds.push({
            id: employeeDeptId,
            name: row.employee_department_name || 'Без отдела',
            subdivisionId: row.employee_subdivision_id || '00000000-0000-0000-0000-000000000000',
            subdivisionName: row.employee_subdivision_name || 'Без подразделения',
          })
        }
      }

      // Обрабатываем раздел для КАЖДОГО отдела
      for (const deptInfo of departmentIds) {
        const deptId = deptInfo.id

        // Получаем или создаём отдел
        let department = departmentsMap.get(deptId)
        if (!department) {
          department = {
            id: deptId,
            name: deptInfo.name,
            subdivisionId: deptInfo.subdivisionId,
            subdivisionName: deptInfo.subdivisionName,
            // Данные о руководителе берём только для отдела ответственного
            departmentHeadId: deptId === responsibleDeptId ? row.department_head_id : null,
            departmentHeadName: deptId === responsibleDeptId ? row.department_head_name : null,
            departmentHeadEmail: deptId === responsibleDeptId ? row.department_head_email : null,
            departmentHeadAvatarUrl: deptId === responsibleDeptId ? row.department_head_avatar_url : null,
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
            managerId: null,
            managerName: null,
            leadEngineerId: null,
            leadEngineerName: null,
            departmentId: deptId,
            departmentName: deptInfo.name,
            stageType: null,
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
            departmentName: deptInfo.name,
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

        // Добавляем capacity override только один раз (в отделе ответственного)
        if (deptId === responsibleDeptId && row.capacity_date && row.capacity_value !== null) {
          objectSection.capacityOverrides![row.capacity_date] = row.capacity_value
        }

        // Добавляем загрузку только в отдел сотрудника
        if (loadingId && employeeDeptId === deptId) {
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
            employeeEmail: null,
            employeeAvatarUrl: row.employee_avatar_url,
            employeeCategory: row.employee_category,
            employeePosition: row.employee_position,
            employeeEmploymentRate: row.employee_employment_rate ?? null,
            employeeDepartmentId: employeeDeptId || deptId,
            employeeDepartmentName: row.employee_department_name || row.department_name,
            startDate: row.loading_start,
            endDate: row.loading_finish,
            rate: row.loading_rate,
            status: 'active',
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
    }

    // Преобразуем Map в массив
    const departments = Array.from(departmentsMap.values())

    return { success: true, data: departments }
  } catch (error) {
    console.error('Unexpected error in getSectionsHierarchy:', error)
    Sentry.captureException(error, {
      tags: { module: 'sections-page', action: 'getSectionsHierarchy', error_type: 'unexpected_error', user_facing: 'true' },
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
  }) // end Sentry.startSpan
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
  return Sentry.startSpan(
    { name: 'upsertSectionCapacity', op: 'db.mutation', attributes: { 'section.id': input.sectionId } },
    async () => {
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
      Sentry.captureException(new Error(error.message), {
        tags: { module: 'sections-page', action: 'upsertSectionCapacity', error_type: 'db_error', user_facing: 'true' },
        extra: { sectionId: input.sectionId, capacityDate: input.capacityDate },
      })
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
    Sentry.captureException(error, {
      tags: { module: 'sections-page', action: 'upsertSectionCapacity', error_type: 'unexpected_error', user_facing: 'true' },
      extra: { sectionId: input.sectionId },
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
  }) // end Sentry.startSpan
}

/**
 * Удалить capacity override для конкретной даты (вернёт к default)
 */
export async function deleteSectionCapacityOverride(
  sectionId: string,
  date: string
): Promise<ActionResult<void>> {
  return Sentry.startSpan(
    { name: 'deleteSectionCapacityOverride', op: 'db.mutation', attributes: { 'section.id': sectionId } },
    async () => {
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
      Sentry.captureException(new Error(error.message), {
        tags: { module: 'sections-page', action: 'deleteSectionCapacityOverride', error_type: 'db_error', user_facing: 'true' },
        extra: { sectionId, date },
      })
      return {
        success: false,
        error: `Ошибка удаления: ${error.message}`,
      }
    }

    return { success: true, data: undefined }
  } catch (error) {
    console.error('Unexpected error in deleteSectionCapacityOverride:', error)
    Sentry.captureException(error, {
      tags: { module: 'sections-page', action: 'deleteSectionCapacityOverride', error_type: 'unexpected_error', user_facing: 'true' },
      extra: { sectionId },
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
  }) // end Sentry.startSpan
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
  return Sentry.startSpan(
    { name: 'createSectionLoading', op: 'db.mutation', attributes: { 'section.id': input.sectionId, 'employee.id': input.employeeId } },
    async () => {
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
      Sentry.captureException(new Error(error.message), {
        tags: { module: 'sections-page', action: 'createSectionLoading', error_type: 'db_error', user_facing: 'true' },
        extra: { sectionId: input.sectionId, employeeId: input.employeeId },
      })
      return {
        success: false,
        error: `Ошибка создания загрузки: ${error.message}`,
      }
    }

    return { success: true, data: { loading_id: data.loading_id } }
  } catch (error) {
    console.error('Unexpected error in createSectionLoading:', error)
    Sentry.captureException(error, {
      tags: { module: 'sections-page', action: 'createSectionLoading', error_type: 'unexpected_error', user_facing: 'true' },
      extra: { sectionId: input.sectionId, employeeId: input.employeeId },
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
  }) // end Sentry.startSpan
}

/**
 * Обновить загрузку
 */
export async function updateSectionLoading(
  input: UpdateLoadingInput
): Promise<ActionResult<void>> {
  return Sentry.startSpan(
    { name: 'updateSectionLoading', op: 'db.mutation', attributes: { 'loading.id': input.loadingId } },
    async () => {
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
      Sentry.captureException(new Error(error.message), {
        tags: { module: 'sections-page', action: 'updateSectionLoading', error_type: 'db_error', user_facing: 'true' },
        extra: { loadingId: input.loadingId },
      })
      return {
        success: false,
        error: `Ошибка обновления загрузки: ${error.message}`,
      }
    }

    return { success: true, data: undefined }
  } catch (error) {
    console.error('Unexpected error in updateSectionLoading:', error)
    Sentry.captureException(error, {
      tags: { module: 'sections-page', action: 'updateSectionLoading', error_type: 'unexpected_error', user_facing: 'true' },
      extra: { loadingId: input.loadingId },
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
  }) // end Sentry.startSpan
}

/**
 * Удалить загрузку (архивировать)
 */
export async function deleteSectionLoading(
  loadingId: string
): Promise<ActionResult<void>> {
  return Sentry.startSpan(
    { name: 'deleteSectionLoading', op: 'db.mutation', attributes: { 'loading.id': loadingId } },
    async () => {
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
      Sentry.captureException(new Error(error.message), {
        tags: { module: 'sections-page', action: 'deleteSectionLoading', error_type: 'db_error', user_facing: 'true' },
        extra: { loadingId },
      })
      return {
        success: false,
        error: `Ошибка удаления загрузки: ${error.message}`,
      }
    }

    return { success: true, data: undefined }
  } catch (error) {
    console.error('Unexpected error in deleteSectionLoading:', error)
    Sentry.captureException(error, {
      tags: { module: 'sections-page', action: 'deleteSectionLoading', error_type: 'unexpected_error', user_facing: 'true' },
      extra: { loadingId },
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
  }) // end Sentry.startSpan
}
