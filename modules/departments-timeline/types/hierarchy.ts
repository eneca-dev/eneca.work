/**
 * Departments Hierarchy Types
 *
 * Типы для иерархии: Отдел → Проект → Объект/Раздел → Сотрудники
 *
 * Безличные загрузки полностью убраны.
 */

// ============================================================================
// Leaf Types
// ============================================================================

/**
 * Именной сотрудник (leaf) — bar прямо на строке
 */
export interface DeptEmployeeLeaf {
  id: string
  employeeName: string
  avatarUrl?: string
  position?: string
  startDate: string
  endDate: string
  rate: number
  /** Название этапа декомпозиции (отображается на баре) */
  stageName?: string
}

// ============================================================================
// Hierarchy Types
// ============================================================================

/**
 * Объект/Раздел (Object + Section merged) — содержит сотрудников
 */
export interface DeptHierarchyObjectSection {
  id: string
  /** Название объекта */
  objectName: string
  /** Название раздела */
  sectionName: string
  /** Плановая ёмкость (кол-во ставок) — задаётся пользователем, используется как Y в X/Y */
  capacity: number
  /** Сотрудники */
  employees: DeptEmployeeLeaf[]
}

/**
 * Проект (Project) — collapsible, агрегация при сворачивании
 */
export interface DeptHierarchyProject {
  id: string
  name: string
  employeeCount: number
  objectSections: DeptHierarchyObjectSection[]
}

/**
 * Отдел (Department) — верхний уровень, collapsible
 */
export interface DeptHierarchyDepartment {
  id: string
  name: string
  employeeCount: number
  projects: DeptHierarchyProject[]
}
