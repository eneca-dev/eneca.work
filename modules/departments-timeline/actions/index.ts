/**
 * Departments Timeline Module - Server Actions
 *
 * Server Actions для модуля таймлайна отделов
 * Все actions используют RLS и типобезопасны
 */

'use server'

import { createClient } from '@/utils/supabase/server'
import * as Sentry from '@sentry/nextjs'
import type { ActionResult } from '@/modules/cache'
import type { Department, Team, Employee, Loading, TeamFreshness } from '../types'
import { formatMinskDate } from '@/lib/timezone-utils'
import { type FilterQueryParams, getNegatedParams } from '@/modules/inline-filter'
import { getFilterContext } from '@/modules/permissions/server/get-filter-context'
import { applyMandatoryFilters } from '@/modules/permissions/utils/mandatory-filters'

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Проверяет, является ли строка UUID
 */
function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

/**
 * Вычисляет dailyWorkloads для сотрудника на основе его загрузок
 */
function calculateDailyWorkloads(loadings: Loading[]): Record<string, number> {
  const workloads: Record<string, number> = {}

  for (const loading of loadings) {
    const startDate = new Date(loading.startDate)
    const endDate = new Date(loading.endDate)
    const currentDate = new Date(startDate)

    while (currentDate <= endDate) {
      const dateKey = formatMinskDate(currentDate)
      workloads[dateKey] = (workloads[dateKey] || 0) + (loading.rate || 1)
      currentDate.setDate(currentDate.getDate() + 1)
    }
  }

  return workloads
}

/**
 * Агрегирует dailyWorkloads из массива сотрудников
 */
function aggregateDailyWorkloads(employees: Employee[]): Record<string, number> {
  const aggregated: Record<string, number> = {}

  for (const employee of employees) {
    if (employee.dailyWorkloads) {
      for (const [date, value] of Object.entries(employee.dailyWorkloads)) {
        aggregated[date] = (aggregated[date] || 0) + value
      }
    }
  }

  return aggregated
}

// ============================================================================
// Query Actions
// ============================================================================

/**
 * Получить данные отделов с командами и сотрудниками
 *
 * Загружает полную иерархию: Отдел → Команда → Сотрудник → Загрузки
 * Применяет фильтры по подразделению, отделу, команде, сотруднику
 *
 * @param filters - Параметры фильтрации (из InlineFilter)
 * @returns Список отделов с полной структурой
 */
export async function getDepartmentsData(
  filters?: FilterQueryParams
): Promise<ActionResult<Department[]>> {
  return Sentry.startSpan(
    { name: 'getDepartmentsData', op: 'db.query' },
    async () => {
  try {
    const supabase = await createClient()

    // 🔒 Получаем контекст разрешений и применяем обязательные фильтры
    const filterContextResult = await getFilterContext()
    const filterContext = filterContextResult.success ? filterContextResult.data : null
    const secureFilters = applyMandatoryFilters(filters || {}, filterContext)

    // 1. Загружаем организационную структуру
    let orgQuery = supabase.from('view_organizational_structure').select('*')

    // Применяем фильтр по подразделению
    if (secureFilters?.subdivision_id) {
      const subdivisionId = Array.isArray(secureFilters.subdivision_id)
        ? secureFilters.subdivision_id[0]
        : secureFilters.subdivision_id

      if (isUuid(subdivisionId)) {
        // Получаем отделы подразделения
        const { data: depts } = await supabase
          .from('departments')
          .select('department_id')
          .eq('subdivision_id', subdivisionId)

        const deptIds = depts?.map(d => d.department_id) || []
        if (deptIds.length > 0) {
          orgQuery = orgQuery.in('department_id', deptIds)
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
            orgQuery = orgQuery.in('department_id', deptIds)
          } else {
            return { success: true, data: [] }
          }
        }
      }
    }

    // Применяем фильтр по отделу
    if (secureFilters?.department_id) {
      const departmentId = Array.isArray(secureFilters.department_id)
        ? secureFilters.department_id[0]
        : secureFilters.department_id

      if (isUuid(departmentId)) {
        orgQuery = orgQuery.eq('department_id', departmentId)
      } else {
        orgQuery = orgQuery.ilike('department_name', departmentId)
      }
    }

    // Применяем фильтр по команде
    if (secureFilters?.team_id) {
      const teamId = Array.isArray(secureFilters.team_id)
        ? secureFilters.team_id[0]
        : secureFilters.team_id

      if (isUuid(teamId)) {
        orgQuery = orgQuery.eq('team_id', teamId)
      } else {
        orgQuery = orgQuery.ilike('team_name', teamId)
      }
    }

    // Исключающие фильтры для орг. структуры
    const excludeDepts = getNegatedParams(secureFilters, 'department_id')
    for (const val of excludeDepts) {
      if (isUuid(val)) {
        orgQuery = orgQuery.neq('department_id', val)
      } else {
        orgQuery = orgQuery.not('department_name', 'ilike', val)
      }
    }

    const excludeTeams = getNegatedParams(secureFilters, 'team_id')
    for (const val of excludeTeams) {
      if (isUuid(val)) {
        orgQuery = orgQuery.neq('team_id', val)
      } else {
        orgQuery = orgQuery.not('team_name', 'ilike', val)
      }
    }

    const { data: orgData, error: orgError } = await orgQuery

    if (orgError) {
      console.error('[getDepartmentsData] Org structure error:', orgError)
      Sentry.captureException(new Error(orgError.message), {
        tags: { module: 'departments-timeline', action: 'getDepartmentsData', error_type: 'db_error', user_facing: 'true' },
        extra: { query: 'view_organizational_structure', appliedFilters: Object.keys(secureFilters || {}) },
      })
      return { success: false, error: orgError.message }
    }

    if (!orgData || orgData.length === 0) {
      return { success: true, data: [] }
    }

    // 2. Загружаем данные о сотрудниках с их загрузками
    // Скоупим выборку отделами из org-запроса, чтобы не тянуть все отделы
    const orgDepartmentIds = [...new Set(orgData.map(o => o.department_id).filter(Boolean))]

    let employeeQuery = supabase
      .from('view_employee_workloads')
      .select('*')
      .or('loading_status.eq.active,loading_status.is.null')
      .in('final_department_id', orgDepartmentIds)

    // Применяем те же фильтры для сотрудников
    if (secureFilters?.department_id) {
      const departmentId = Array.isArray(secureFilters.department_id)
        ? secureFilters.department_id[0]
        : secureFilters.department_id

      if (isUuid(departmentId)) {
        employeeQuery = employeeQuery.eq('final_department_id', departmentId)
      } else {
        employeeQuery = employeeQuery.ilike('final_department_name', departmentId)
      }
    }

    if (secureFilters?.team_id) {
      const teamId = Array.isArray(secureFilters.team_id)
        ? secureFilters.team_id[0]
        : secureFilters.team_id

      if (isUuid(teamId)) {
        employeeQuery = employeeQuery.eq('final_team_id', teamId)
      } else {
        employeeQuery = employeeQuery.ilike('final_team_name', teamId)
      }
    }

    // Применяем фильтр по проекту (поддержка нескольких значений)
    if (secureFilters?.project_id) {
      const values = Array.isArray(secureFilters.project_id)
        ? secureFilters.project_id
        : [secureFilters.project_id]

      const uuids = values.filter(isUuid)
      const names = values.filter(v => !isUuid(v))

      if (uuids.length > 0 && names.length === 0) {
        employeeQuery = employeeQuery.in('project_id', uuids)
      } else if (names.length > 0 && uuids.length === 0) {
        // Несколько имён — OR через ilike
        const orClause = names.map(n => `project_name.ilike.${n}`).join(',')
        employeeQuery = employeeQuery.or(orClause)
      } else if (uuids.length > 0 && names.length > 0) {
        // Смешанный: UUID через in + имена через ilike
        const parts: string[] = uuids.map(id => `project_id.eq.${id}`)
        names.forEach(n => parts.push(`project_name.ilike.${n}`))
        employeeQuery = employeeQuery.or(parts.join(','))
      }
    }

    // Исключающие фильтры для сотрудников (-проект, -отдел, -команда, -ответственный)
    for (const val of getNegatedParams(secureFilters, 'project_id')) {
      if (isUuid(val)) {
        employeeQuery = employeeQuery.neq('project_id', val)
      } else {
        employeeQuery = employeeQuery.not('project_name', 'ilike', val)
      }
    }

    for (const val of getNegatedParams(secureFilters, 'department_id')) {
      if (isUuid(val)) {
        employeeQuery = employeeQuery.neq('final_department_id', val)
      } else {
        employeeQuery = employeeQuery.not('final_department_name', 'ilike', val)
      }
    }

    for (const val of getNegatedParams(secureFilters, 'team_id')) {
      if (isUuid(val)) {
        employeeQuery = employeeQuery.neq('final_team_id', val)
      } else {
        employeeQuery = employeeQuery.not('final_team_name', 'ilike', val)
      }
    }

    for (const val of getNegatedParams(secureFilters, 'responsible_id')) {
      if (isUuid(val)) {
        employeeQuery = employeeQuery.neq('user_id', val)
      } else {
        employeeQuery = employeeQuery.not('full_name', 'ilike', `%${val}%`)
      }
    }

    // Применяем фильтр по ответственному (сотруднику)
    if (secureFilters?.responsible_id) {
      const responsibleId = Array.isArray(secureFilters.responsible_id)
        ? secureFilters.responsible_id[0]
        : secureFilters.responsible_id

      if (isUuid(responsibleId)) {
        employeeQuery = employeeQuery.eq('user_id', responsibleId)
      } else {
        employeeQuery = employeeQuery.ilike('full_name', `%${responsibleId}%`)
      }
    }

    const { data: employeeData, error: employeeError } = await employeeQuery

    if (employeeError) {
      console.error('[getDepartmentsData] Employee data error:', employeeError)
      Sentry.captureException(new Error(employeeError.message), {
        tags: { module: 'departments-timeline', action: 'getDepartmentsData', error_type: 'db_error', user_facing: 'true' },
        extra: { query: 'view_employee_workloads', appliedFilters: Object.keys(secureFilters || {}) },
      })
      return { success: false, error: employeeError.message }
    }

    // 3. Группируем данные по отделам и командам
    const departmentsMap = new Map<string, Department>()
    const teamsMap = new Map<string, Team>()
    const employeesMap = new Map<string, Employee>()

    // Сначала обрабатываем сотрудников и их загрузки
    employeeData?.forEach((item) => {
      // Пропускаем записи без user_id
      if (!item.user_id) return

      if (!employeesMap.has(item.user_id)) {
        employeesMap.set(item.user_id, {
          id: item.user_id,
          name: item.full_name || '',
          fullName: item.full_name ?? undefined,
          firstName: item.first_name ?? undefined,
          lastName: item.last_name ?? undefined,
          email: item.email ?? undefined,
          position: item.position_name ?? undefined,
          categoryName: item.category_name ?? undefined,
          avatarUrl: item.avatar_url ?? undefined,
          teamId: item.final_team_id ?? undefined,
          teamName: item.final_team_name ?? undefined,
          teamCode: '',
          departmentId: item.final_department_id ?? undefined,
          departmentName: item.final_department_name ?? undefined,
          loadings: [],
          dailyWorkloads: {},
          hasLoadings: item.has_loadings ?? undefined,
          loadingsCount: item.loadings_count ?? undefined,
          employmentRate: item.employment_rate || 1,
          workload: 0,
        })
      }

      const employee = employeesMap.get(item.user_id)!

      // Добавляем загрузку, если она есть и имеет все обязательные поля
      if (item.loading_id && item.loading_start && item.loading_finish) {
        employee.loadings!.push({
          id: item.loading_id,
          employeeId: item.user_id,
          responsibleId: (item as any).loading_responsible ?? item.user_id,
          responsibleName: item.full_name ?? undefined,
          responsibleAvatarUrl: item.avatar_url ?? undefined,
          responsibleTeamName: item.final_team_name ?? undefined,
          projectId: item.project_id ?? undefined,
          projectName: item.project_name ?? undefined,
          projectStatus: item.project_status ?? undefined,
          objectId: item.object_id ?? undefined,
          objectName: item.object_name ?? undefined,
          sectionId: item.loading_section || null,
          sectionName: item.section_name ?? undefined,
          stageId: item.stage_id ?? '',
          stageName: item.stage_name ?? undefined,
          startDate: item.loading_start,
          endDate: item.loading_finish,
          rate: item.loading_rate || 1,
          comment: item.loading_comment ?? undefined,
        })
      }
    })

    // Вычисляем dailyWorkloads для каждого сотрудника
    employeesMap.forEach((employee) => {
      if (employee.loadings && employee.loadings.length > 0) {
        employee.dailyWorkloads = calculateDailyWorkloads(employee.loadings)
      }
    })

    // Теперь обрабатываем организационную структуру
    orgData?.forEach((item) => {
      // Пропускаем записи без department_id
      if (!item.department_id) return

      // Создаем или обновляем отдел
      if (!departmentsMap.has(item.department_id)) {
        departmentsMap.set(item.department_id, {
          id: item.department_id,
          name: item.department_name || 'Без названия',
          subdivisionId: undefined, // view_organizational_structure не содержит subdivision данных
          subdivisionName: undefined,
          totalEmployees: item.department_employee_count || 0,
          teams: [],
          dailyWorkloads: {},
          departmentHeadId: item.department_head_id ?? undefined,
          departmentHeadName: item.department_head_full_name ?? undefined,
          departmentHeadEmail: item.department_head_email ?? undefined,
          departmentHeadAvatarUrl: item.department_head_avatar_url ?? undefined,
          managerName: item.department_head_full_name ?? undefined,
        })
      }

      // Создаем или обновляем команду, если она есть
      if (item.team_id) {
        const teamKey = `${item.department_id}-${item.team_id}`
        if (!teamsMap.has(teamKey)) {
          teamsMap.set(teamKey, {
            id: item.team_id,
            name: item.team_name || 'Без названия',
            code: '',
            departmentId: item.department_id,
            departmentName: item.department_name ?? undefined,
            totalEmployees: item.team_employee_count || 0,
            employees: [],
            dailyWorkloads: {},
            teamLeadId: item.team_lead_id ?? undefined,
            teamLeadName: item.team_lead_full_name ?? undefined,
            teamLeadEmail: item.team_lead_email ?? undefined,
            teamLeadAvatarUrl: item.team_lead_avatar_url ?? undefined,
          })
        }
      }
    })

    // Распределяем сотрудников по командам
    employeesMap.forEach((employee) => {
      if (employee.teamId && employee.departmentId) {
        const teamKey = `${employee.departmentId}-${employee.teamId}`
        const team = teamsMap.get(teamKey)
        if (team) {
          team.employees.push(employee)
        }
      }
    })

    // Вычисляем dailyWorkloads для команд
    teamsMap.forEach((team) => {
      team.dailyWorkloads = aggregateDailyWorkloads(team.employees)
    })

    // Распределяем команды по отделам
    teamsMap.forEach((team) => {
      const department = departmentsMap.get(team.departmentId)
      if (department) {
        department.teams.push(team)
      }
    })

    // Вычисляем dailyWorkloads для отделов
    departmentsMap.forEach((department) => {
      const allEmployees = department.teams.flatMap(t => t.employees)
      department.dailyWorkloads = aggregateDailyWorkloads(allEmployees)
    })

    // Если применён фильтр по проекту или ответственному — убираем пустые команды/отделы,
    // т.к. org structure возвращает ВСЮ иерархию, а employee query — только релевантных
    const hasEmployeeOnlyFilters = secureFilters?.project_id
      || secureFilters?.responsible_id
      || secureFilters?.['!project_id']
      || secureFilters?.['!responsible_id']
    if (hasEmployeeOnlyFilters) {
      departmentsMap.forEach((department, deptId) => {
        department.teams = department.teams.filter(t => t.employees.length > 0)
        if (department.teams.length === 0) {
          departmentsMap.delete(deptId)
        }
      })
    }

    // Преобразуем Map в массив и сортируем
    const departments = Array.from(departmentsMap.values())
      .sort((a, b) => a.name.localeCompare(b.name))

    // Сортируем команды и сотрудников внутри отделов
    departments.forEach((dept) => {
      dept.teams.sort((a, b) => a.name.localeCompare(b.name))
      dept.teams.forEach((team) => {
        // Тимлид первым, остальные по имени
        team.employees.sort((a, b) => {
          if (team.teamLeadId === a.id) return -1
          if (team.teamLeadId === b.id) return 1
          return (a.fullName || a.name).localeCompare(b.fullName || b.name)
        })
      })
    })

    return { success: true, data: departments }
  } catch (error) {
    console.error('[getDepartmentsData] Unexpected error:', error)
    Sentry.captureException(error, {
      tags: { module: 'departments-timeline', action: 'getDepartmentsData', error_type: 'unexpected_error', user_facing: 'true' },
    })
    return { success: false, error: String(error) }
  }
  }) // end Sentry.startSpan
}

// ============================================================================
// Freshness Actions
// ============================================================================

/**
 * Получить данные актуальности команд
 *
 * @returns Record<teamId, TeamFreshness>
 */
export async function getTeamsFreshness(): Promise<ActionResult<Record<string, TeamFreshness>>> {
  return Sentry.startSpan(
    { name: 'getTeamsFreshness', op: 'db.query' },
    async () => {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('view_planning_team_freshness')
      .select('*')

    if (error) {
      console.error('[getTeamsFreshness] Error:', error)
      Sentry.captureException(new Error(error.message), {
        tags: { module: 'departments-timeline', action: 'getTeamsFreshness', error_type: 'db_error', user_facing: 'false' },
      })
      return { success: false, error: error.message }
    }

    const freshnessMap: Record<string, TeamFreshness> = {}

    data?.forEach((item) => {
      // Пропускаем записи без team_id
      if (!item.team_id) return

      freshnessMap[item.team_id] = {
        teamId: item.team_id,
        teamName: item.team_name || 'Без названия',
        departmentId: item.department_id || '',
        departmentName: item.department_name || 'Без названия',
        lastUpdate: item.last_update,
        daysSinceUpdate: item.days_since_update ?? undefined,
      }
    })

    return { success: true, data: freshnessMap }
  } catch (error) {
    console.error('[getTeamsFreshness] Unexpected error:', error)
    Sentry.captureException(error, {
      tags: { module: 'departments-timeline', action: 'getTeamsFreshness', error_type: 'unexpected_error', user_facing: 'false' },
    })
    return { success: false, error: String(error) }
  }
  }) // end Sentry.startSpan
}

/**
 * Подтвердить актуальность данных команды
 *
 * @param teamId - ID команды
 * @returns Результат операции
 */
export async function confirmTeamActivity(
  teamId: string
): Promise<ActionResult<{ teamId: string }>> {
  return Sentry.startSpan(
    { name: 'confirmTeamActivity', op: 'db.mutation', attributes: { 'team.id': teamId } },
    async () => {
  try {
    const supabase = await createClient()

    // Получаем текущего пользователя
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'Не авторизован' }
    }

    // Добавляем запись об актуализации
    const { error } = await supabase
      .from('teams_activity')
      .insert({
        team_id: teamId,
        confirmed_by: user.id,
        confirmed_at: new Date().toISOString(),
      })

    if (error) {
      console.error('[confirmTeamActivity] Error:', error)
      Sentry.captureException(new Error(error.message), {
        tags: { module: 'departments-timeline', action: 'confirmTeamActivity', error_type: 'db_error', user_facing: 'true' },
        extra: { teamId },
      })
      return { success: false, error: error.message }
    }

    return { success: true, data: { teamId } }
  } catch (error) {
    console.error('[confirmTeamActivity] Unexpected error:', error)
    Sentry.captureException(error, {
      tags: { module: 'departments-timeline', action: 'confirmTeamActivity', error_type: 'unexpected_error', user_facing: 'true' },
      extra: { teamId },
    })
    return { success: false, error: String(error) }
  }
  }) // end Sentry.startSpan
}

/**
 * Подтвердить актуальность данных нескольких команд
 *
 * @param teamIds - Массив ID команд
 * @returns Результат операции
 */
export async function confirmMultipleTeamsActivity(
  teamIds: string[]
): Promise<ActionResult<{ teamIds: string[] }>> {
  return Sentry.startSpan(
    { name: 'confirmMultipleTeamsActivity', op: 'db.mutation', attributes: { 'teams.count': teamIds.length } },
    async () => {
  try {
    const supabase = await createClient()

    // Получаем текущего пользователя
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'Не авторизован' }
    }

    // Добавляем записи об актуализации для всех команд
    const records = teamIds.map(teamId => ({
      team_id: teamId,
      confirmed_by: user.id,
      confirmed_at: new Date().toISOString(),
    }))

    const { error } = await supabase
      .from('teams_activity')
      .insert(records)

    if (error) {
      console.error('[confirmMultipleTeamsActivity] Error:', error)
      Sentry.captureException(new Error(error.message), {
        tags: { module: 'departments-timeline', action: 'confirmMultipleTeamsActivity', error_type: 'db_error', user_facing: 'true' },
        extra: { teamIds, count: teamIds.length },
      })
      return { success: false, error: error.message }
    }

    return { success: true, data: { teamIds } }
  } catch (error) {
    console.error('[confirmMultipleTeamsActivity] Unexpected error:', error)
    Sentry.captureException(error, {
      tags: { module: 'departments-timeline', action: 'confirmMultipleTeamsActivity', error_type: 'unexpected_error', user_facing: 'true' },
      extra: { teamIds },
    })
    return { success: false, error: String(error) }
  }
  }) // end Sentry.startSpan
}

// ============================================================================
// Mutation Actions - Loadings
// ============================================================================

/**
 * Обновить даты загрузки сотрудника
 *
 * Используется для drag-to-resize функциональности в timeline
 *
 * @param loadingId - ID загрузки
 * @param startDate - Новая дата начала (YYYY-MM-DD)
 * @param finishDate - Новая дата окончания (YYYY-MM-DD)
 * @returns Результат операции с обновленными данными
 */
export async function updateLoadingDates(
  loadingId: string,
  startDate: string,
  finishDate: string
): Promise<ActionResult<{ loadingId: string; startDate: string; finishDate: string }>> {
  return Sentry.startSpan(
    { name: 'updateLoadingDates', op: 'db.mutation', attributes: { 'loading.id': loadingId } },
    async () => {
  try {
    // Валидация входных данных
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

    // Обновляем даты загрузки (RLS обеспечивает проверку прав доступа)
    const { error } = await supabase
      .from('loadings')
      .update({
        loading_start: startDate,
        loading_finish: finishDate,
      })
      .eq('loading_id', loadingId)

    if (error) {
      console.error('[updateLoadingDates] Supabase error:', error)
      Sentry.captureException(new Error(error.message), {
        tags: { module: 'departments-timeline', action: 'updateLoadingDates', error_type: 'db_error', user_facing: 'true' },
        extra: { loadingId, startDate, finishDate },
      })
      return { success: false, error: error.message }
    }

    return {
      success: true,
      data: { loadingId, startDate, finishDate },
    }
  } catch (error) {
    console.error('[updateLoadingDates] Unexpected error:', error)
    Sentry.captureException(error, {
      tags: { module: 'departments-timeline', action: 'updateLoadingDates', error_type: 'unexpected_error', user_facing: 'true' },
      extra: { loadingId, startDate, finishDate },
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка обновления дат загрузки',
    }
  }
  }) // end Sentry.startSpan
}
