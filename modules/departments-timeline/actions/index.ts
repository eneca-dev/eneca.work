/**
 * Departments Timeline Module - Server Actions
 *
 * Server Actions для модуля таймлайна отделов
 * Все actions используют RLS и типобезопасны
 */

'use server'

import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/modules/cache'
import type { Department, Team, Employee, Loading, TeamFreshness } from '../types'
import { formatMinskDate } from '@/lib/timezone-utils'
import type { FilterQueryParams } from '@/modules/inline-filter'
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
      if (isUuid(secureFilters.subdivision_id)) {
        // Получаем отделы подразделения
        const { data: depts } = await supabase
          .from('departments')
          .select('department_id')
          .eq('subdivision_id', secureFilters.subdivision_id)

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
          .ilike('subdivision_name', secureFilters.subdivision_id)

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
      if (isUuid(secureFilters.department_id)) {
        orgQuery = orgQuery.eq('department_id', secureFilters.department_id)
      } else {
        orgQuery = orgQuery.ilike('department_name', secureFilters.department_id)
      }
    }

    // Применяем фильтр по команде
    if (secureFilters?.team_id) {
      if (isUuid(secureFilters.team_id)) {
        orgQuery = orgQuery.eq('team_id', secureFilters.team_id)
      } else {
        orgQuery = orgQuery.ilike('team_name', secureFilters.team_id)
      }
    }

    const { data: orgData, error: orgError } = await orgQuery

    if (orgError) {
      console.error('[getDepartmentsData] Org structure error:', orgError)
      return { success: false, error: orgError.message }
    }

    if (!orgData || orgData.length === 0) {
      return { success: true, data: [] }
    }

    // 2. Загружаем данные о сотрудниках с их загрузками
    let employeeQuery = supabase
      .from('view_employee_workloads')
      .select('*')
      .or('loading_status.eq.active,loading_status.is.null')

    // Применяем те же фильтры для сотрудников
    if (secureFilters?.department_id) {
      if (isUuid(secureFilters.department_id)) {
        employeeQuery = employeeQuery.eq('final_department_id', secureFilters.department_id)
      }
    }

    if (secureFilters?.team_id) {
      if (isUuid(secureFilters.team_id)) {
        employeeQuery = employeeQuery.eq('final_team_id', secureFilters.team_id)
      }
    }

    // Применяем фильтр по ответственному (сотруднику)
    if (secureFilters?.responsible_id) {
      if (isUuid(secureFilters.responsible_id)) {
        employeeQuery = employeeQuery.eq('user_id', secureFilters.responsible_id)
      } else {
        employeeQuery = employeeQuery.ilike('full_name', `%${secureFilters.responsible_id}%`)
      }
    }

    const { data: employeeData, error: employeeError } = await employeeQuery

    if (employeeError) {
      console.error('[getDepartmentsData] Employee data error:', employeeError)
      return { success: false, error: employeeError.message }
    }

    // 3. Группируем данные по отделам и командам
    const departmentsMap = new Map<string, Department>()
    const teamsMap = new Map<string, Team>()
    const employeesMap = new Map<string, Employee>()

    // Сначала обрабатываем сотрудников и их загрузки
    employeeData?.forEach((item) => {
      if (!employeesMap.has(item.user_id)) {
        employeesMap.set(item.user_id, {
          id: item.user_id,
          name: item.full_name || '',
          fullName: item.full_name,
          firstName: item.first_name,
          lastName: item.last_name,
          email: item.email,
          position: item.position_name,
          avatarUrl: item.avatar_url,
          teamId: item.final_team_id,
          teamName: item.final_team_name,
          teamCode: '',
          departmentId: item.final_department_id,
          departmentName: item.final_department_name,
          loadings: [],
          dailyWorkloads: {},
          hasLoadings: item.has_loadings,
          loadingsCount: item.loadings_count,
          employmentRate: item.employment_rate || 1,
          workload: 0,
        })
      }

      const employee = employeesMap.get(item.user_id)!

      // Добавляем загрузку, если она есть
      if (item.loading_id) {
        employee.loadings!.push({
          id: item.loading_id,
          employeeId: item.user_id,
          responsibleId: item.loading_responsible || item.user_id,
          responsibleName: item.full_name,
          responsibleAvatarUrl: item.avatar_url,
          responsibleTeamName: item.final_team_name,
          projectId: item.project_id || undefined,
          projectName: item.project_name,
          projectStatus: item.project_status,
          objectId: item.object_id || undefined,
          objectName: item.object_name || undefined,
          sectionId: item.loading_section,
          sectionName: item.section_name,
          stageId: item.stage_id || '',
          stageName: item.stage_name || undefined,
          startDate: item.loading_start,
          endDate: item.loading_finish,
          rate: item.loading_rate || 1,
          comment: item.loading_comment || undefined,
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
      // Создаем или обновляем отдел
      if (!departmentsMap.has(item.department_id)) {
        departmentsMap.set(item.department_id, {
          id: item.department_id,
          name: item.department_name,
          subdivisionId: item.subdivision_id,
          subdivisionName: item.subdivision_name,
          totalEmployees: item.department_employee_count || 0,
          teams: [],
          dailyWorkloads: {},
          departmentHeadId: item.department_head_id,
          departmentHeadName: item.department_head_full_name,
          departmentHeadEmail: item.department_head_email,
          departmentHeadAvatarUrl: item.department_head_avatar_url,
          managerName: item.department_head_full_name,
        })
      }

      // Создаем или обновляем команду, если она есть
      if (item.team_id) {
        const teamKey = `${item.department_id}-${item.team_id}`
        if (!teamsMap.has(teamKey)) {
          teamsMap.set(teamKey, {
            id: item.team_id,
            name: item.team_name,
            code: '',
            departmentId: item.department_id,
            departmentName: item.department_name,
            totalEmployees: item.team_employee_count || 0,
            employees: [],
            dailyWorkloads: {},
            teamLeadId: item.team_lead_id,
            teamLeadName: item.team_lead_full_name,
            teamLeadEmail: item.team_lead_email,
            teamLeadAvatarUrl: item.team_lead_avatar_url,
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
    return { success: false, error: String(error) }
  }
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
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('view_planning_team_freshness')
      .select('*')

    if (error) {
      console.error('[getTeamsFreshness] Error:', error)
      return { success: false, error: error.message }
    }

    const freshnessMap: Record<string, TeamFreshness> = {}

    data?.forEach((item) => {
      freshnessMap[item.team_id] = {
        teamId: item.team_id,
        teamName: item.team_name,
        departmentId: item.department_id,
        departmentName: item.department_name,
        lastUpdate: item.last_update,
        daysSinceUpdate: item.days_since_update,
      }
    })

    return { success: true, data: freshnessMap }
  } catch (error) {
    console.error('[getTeamsFreshness] Unexpected error:', error)
    return { success: false, error: String(error) }
  }
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
      return { success: false, error: error.message }
    }

    return { success: true, data: { teamId } }
  } catch (error) {
    console.error('[confirmTeamActivity] Unexpected error:', error)
    return { success: false, error: String(error) }
  }
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
      return { success: false, error: error.message }
    }

    return { success: true, data: { teamIds } }
  } catch (error) {
    console.error('[confirmMultipleTeamsActivity] Unexpected error:', error)
    return { success: false, error: String(error) }
  }
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
  try {
    console.log('🔵 [updateLoadingDates] Called with:', { loadingId, startDate, finishDate })

    // Валидация входных данных
    if (!loadingId) {
      console.error('❌ [updateLoadingDates] Missing loadingId')
      return { success: false, error: 'ID загрузки обязателен' }
    }

    if (!startDate || !finishDate) {
      console.error('❌ [updateLoadingDates] Missing dates')
      return { success: false, error: 'Даты начала и окончания обязательны' }
    }

    // Проверяем что startDate <= finishDate
    if (startDate > finishDate) {
      console.error('❌ [updateLoadingDates] Start date > finish date')
      return { success: false, error: 'Дата начала не может быть позже даты окончания' }
    }

    const supabase = await createClient()

    // Проверка авторизации
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('❌ [updateLoadingDates] Auth error:', authError)
      return { success: false, error: 'Необходима авторизация' }
    }

    console.log('🔵 [updateLoadingDates] Updating loading in DB:', { loadingId, startDate, finishDate })

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
      return { success: false, error: error.message }
    }

    console.log('✅ [updateLoadingDates] Successfully updated loading dates in DB')

    return {
      success: true,
      data: { loadingId, startDate, finishDate },
    }
  } catch (error) {
    console.error('[updateLoadingDates] Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка обновления дат загрузки',
    }
  }
}
