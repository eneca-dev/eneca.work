/**
 * Aggregate Bars — утилиты для агрегации загрузок X/Y
 *
 * X = сумма активных ставок на день
 * Y = плановая ёмкость (задаётся пользователем на уровне ObjectSection)
 *
 * Агрегация пробрасывается вверх: ObjectSection → Project → Department
 */

import { formatMinskDate } from '@/lib/timezone-utils'
import type {
  DeptHierarchyDepartment,
  DeptHierarchyProject,
  DeptHierarchyObjectSection,
  DeptEmployeeLeaf,
} from '../types/hierarchy'
import type { DayCell } from '../types'

// ============================================================================
// Types
// ============================================================================

/** Per-day aggregated data: rateSum / capacity */
export interface DailyAggregation {
  /** Sum of active employee rates on this day */
  rateSum: number
  /** Total capacity (user-defined sum from ObjectSections) */
  capacity: number
}

// ============================================================================
// Compute daily aggregation from employees
// ============================================================================

/** Check if a date string falls within a range */
function isDateInRange(dateStr: string, startDate: string, endDate: string): boolean {
  return dateStr >= startDate && dateStr <= endDate
}

/**
 * Compute per-day aggregation for a list of employees + capacity.
 * Supports per-date capacity overrides: each day can have its own capacity.
 * Returns array aligned with dayCells.
 */
export function computeDailyAggregation(
  employees: DeptEmployeeLeaf[],
  defaultCapacity: number,
  dateCapacityOverrides: Record<string, number>,
  dayCells: DayCell[]
): DailyAggregation[] {
  return dayCells.map((cell) => {
    const dateStr = formatMinskDate(cell.date)
    const capacity = dateCapacityOverrides[dateStr] ?? defaultCapacity

    let rateSum = 0
    for (const emp of employees) {
      if (isDateInRange(dateStr, emp.startDate, emp.endDate)) {
        rateSum += emp.rate
      }
    }

    return { rateSum, capacity }
  })
}

// ============================================================================
// Collect employees + capacity from hierarchy levels
// ============================================================================

export interface EmployeesWithCapacity {
  employees: DeptEmployeeLeaf[]
  capacity: number
}

export function collectFromObjectSection(os: DeptHierarchyObjectSection): EmployeesWithCapacity {
  return { employees: os.employees, capacity: os.capacity }
}

export function collectFromProject(proj: DeptHierarchyProject): EmployeesWithCapacity {
  let capacity = 0
  const employees: DeptEmployeeLeaf[] = []
  for (const os of proj.objectSections) {
    employees.push(...os.employees)
    capacity += os.capacity
  }
  return { employees, capacity }
}

export function collectFromDepartment(dept: DeptHierarchyDepartment): EmployeesWithCapacity {
  let capacity = 0
  const employees: DeptEmployeeLeaf[] = []
  for (const proj of dept.projects) {
    const collected = collectFromProject(proj)
    employees.push(...collected.employees)
    capacity += collected.capacity
  }
  return { employees, capacity }
}
