/**
 * Departments Timeline Module - Utils
 *
 * Re-export утилит из resource-graph для совместимости
 * Плюс дополнительные утилиты для отрисовки загрузок
 */

import { addDays } from 'date-fns'
import { cn } from '@/lib/utils'
import { formatMinskDate, parseMinskDate } from '@/lib/timezone-utils'
import type { DayCell } from '../types'

// Re-export date utils from resource-graph
export { buildCalendarMap, getDayInfo } from '@/modules/resource-graph/utils'

// Re-export loading bars utils from shared components
export {
  loadingsToPeriods,
  calculateBarRenders,
  calculateBarTop,
  formatBarLabel,
  formatBarTooltip,
  getBarLabelParts,
  getSectionColor,
  splitPeriodByNonWorkingDays,
  BASE_BAR_HEIGHT,
  BAR_GAP,
  COMMENT_HEIGHT,
  COMMENT_GAP,
  type BarPeriod,
  type BarRender,
  type BarLabelParts,
} from '@/components/shared/timeline/loading-bars-utils'

// ============================================================================
// Cell Helpers - DRY utilities for timeline cells
// ============================================================================

/**
 * Определяет тип дня (выходной, праздник и т.д.)
 */
export function getCellDayType(cell: DayCell) {
  return {
    isWeekend: cell.isWeekend && !cell.isWorkday,
    isSpecialDayOff: cell.isHoliday || cell.isTransferredDayOff,
  }
}

/**
 * Генерирует CSS классы для ячейки дня на таймлайне
 */
export function getCellClassNames(cell: DayCell, additionalClasses?: string) {
  const { isWeekend, isSpecialDayOff } = getCellDayType(cell)

  return cn(
    'border-r border-border/50 relative',
    cell.isToday && 'bg-primary/10',
    !cell.isToday && isSpecialDayOff && 'bg-amber-50 dark:bg-amber-950/30',
    !cell.isToday && isWeekend && 'bg-muted/50',
    additionalClasses
  )
}

/**
 * Вычисляет процент загрузки для дня
 */
export function calculateLoadPercentage(
  dailyWorkloads: Record<string, number> | undefined,
  cell: DayCell,
  totalCapacity: number
): number {
  const { isWeekend, isSpecialDayOff } = getCellDayType(cell)
  const dateKey = formatMinskDate(cell.date)
  const workload = dailyWorkloads?.[dateKey] || 0

  return !isWeekend && !isSpecialDayOff && totalCapacity > 0
    ? Math.round((workload / totalCapacity) * 100)
    : 0
}

// ============================================================================
// Project Grouping Utils - для режима группировки по проектам
// ============================================================================

import type { Department, Employee, Loading, ProjectGroup } from '../types'

/** ID для группы "Без проекта" */
export const NO_PROJECT_ID = '__no_project__'
/** Название для группы "Без проекта" */
export const NO_PROJECT_NAME = 'Без проекта'

/**
 * Проверяет, активна ли загрузка на указанную дату
 *
 * @param loading - загрузка сотрудника
 * @param today - дата в формате 'YYYY-MM-DD'
 * @returns true если загрузка активна на эту дату
 */
export function isLoadingActiveOnDate(loading: Loading, today: string): boolean {
  return loading.startDate <= today && loading.endDate >= today
}

/**
 * Вычисляет dailyWorkloads для списка загрузок
 */
function calculateDailyWorkloadsFromLoadings(loadings: Loading[]): Record<string, number> {
  const workloads: Record<string, number> = {}

  for (const loading of loadings) {
    const startDate = parseMinskDate(loading.startDate)
    const endDate = parseMinskDate(loading.endDate)
    let currentDate = startDate

    while (currentDate <= endDate) {
      const dateKey = formatMinskDate(currentDate)
      workloads[dateKey] = (workloads[dateKey] || 0) + (loading.rate || 1)
      currentDate = addDays(currentDate, 1)
    }
  }

  return workloads
}

/**
 * Группирует сотрудников отдела по проектам на основе активных загрузок
 *
 * Для режима группировки "По проектам":
 * - Собирает всех сотрудников из всех команд отдела
 * - Фильтрует загрузки по дате (активные на сегодня)
 * - Группирует по projectId
 * - Один сотрудник может появиться в нескольких проектах
 *
 * @param department - отдел с командами и сотрудниками
 * @param today - дата в формате 'YYYY-MM-DD' для фильтрации активных загрузок
 * @returns массив ProjectGroup отсортированный по названию проекта
 *
 * @example
 * const projects = groupEmployeesByProjects(department, '2024-01-15')
 * // Возвращает:
 * // [
 * //   { projectId: '...', projectName: 'ЖК Солнечный', employees: [...] },
 * //   { projectId: '...', projectName: 'БЦ Центральный', employees: [...] },
 * // ]
 */
export function groupEmployeesByProjects(
  department: Department,
  today: string
): ProjectGroup[] {
  // Map для сбора данных по проектам: projectId -> { info, employeesMap }
  const projectsMap = new Map<string, {
    projectName: string
    projectStatus?: string
    employeesMap: Map<string, {
      employee: Employee
      loadings: Loading[]
    }>
  }>()

  // Проходим по всем командам и сотрудникам
  for (const team of department.teams) {
    for (const employee of team.employees) {
      if (!employee.loadings || employee.loadings.length === 0) {
        continue
      }

      // Фильтруем загрузки, активные на сегодня
      const activeLoadings = employee.loadings.filter(
        (loading) => isLoadingActiveOnDate(loading, today)
      )

      if (activeLoadings.length === 0) {
        continue
      }

      // Группируем загрузки по проектам
      for (const loading of activeLoadings) {
        const projectId = loading.projectId || NO_PROJECT_ID
        const projectName = loading.projectName || NO_PROJECT_NAME
        const projectStatus = loading.projectStatus

        // Получаем или создаём запись для проекта
        if (!projectsMap.has(projectId)) {
          projectsMap.set(projectId, {
            projectName,
            projectStatus,
            employeesMap: new Map(),
          })
        }

        const projectData = projectsMap.get(projectId)!

        // Получаем или создаём запись для сотрудника в этом проекте
        if (!projectData.employeesMap.has(employee.id)) {
          projectData.employeesMap.set(employee.id, {
            employee: { ...employee, loadings: [] },
            loadings: [],
          })
        }

        // Добавляем загрузку сотруднику в этом проекте
        projectData.employeesMap.get(employee.id)!.loadings.push(loading)
      }
    }
  }

  // Преобразуем Map в массив ProjectGroup
  const projectGroups: ProjectGroup[] = []

  for (const [projectId, projectData] of projectsMap) {
    const employees: Employee[] = []
    let allProjectLoadings: Loading[] = []

    for (const [, employeeData] of projectData.employeesMap) {
      // Создаём копию сотрудника с загрузками только для этого проекта
      const employeeWithProjectLoadings: Employee = {
        ...employeeData.employee,
        loadings: employeeData.loadings,
        // Пересчитываем dailyWorkloads только для загрузок этого проекта
        dailyWorkloads: calculateDailyWorkloadsFromLoadings(employeeData.loadings),
      }
      employees.push(employeeWithProjectLoadings)
      allProjectLoadings = allProjectLoadings.concat(employeeData.loadings)
    }

    // Сортируем сотрудников по имени
    employees.sort((a, b) =>
      (a.fullName || a.name).localeCompare(b.fullName || b.name)
    )

    projectGroups.push({
      projectId,
      projectName: projectData.projectName,
      projectStatus: projectData.projectStatus,
      employees,
      dailyWorkloads: calculateDailyWorkloadsFromLoadings(allProjectLoadings),
    })
  }

  // Сортируем проекты: "Без проекта" в конец, остальные по алфавиту
  projectGroups.sort((a, b) => {
    if (a.projectId === NO_PROJECT_ID) return 1
    if (b.projectId === NO_PROJECT_ID) return -1
    return a.projectName.localeCompare(b.projectName)
  })

  return projectGroups
}
