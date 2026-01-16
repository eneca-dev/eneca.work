/**
 * Departments Timeline Module
 *
 * Модуль таймлайна отделов, команд и сотрудников с загрузками
 * Интегрируется в TasksView как отдельная вкладка
 *
 * @module departments-timeline
 */

// Components
export { DepartmentsTimelineInternal } from './components'
export { DepartmentRow, TeamRow, EmployeeRow } from './components'

// Hooks
export {
  useDepartmentsData,
  useTeamsFreshness,
  useConfirmTeamActivity,
  useConfirmMultipleTeamsActivity,
  departmentsTimelineKeys,
} from './hooks'

// Stores
export {
  useDepartmentsTimelineUIStore,
  useRowExpanded,
} from './stores'

// Types
export type {
  Department,
  Team,
  Employee,
  Loading,
  TeamFreshness,
  DepartmentFreshness,
  TreeNodeType,
  TreeNode,
  DayCell,
  CompanyCalendarEvent,
  TimelineRange,
} from './types'

// Constants
export {
  DAY_CELL_WIDTH,
  ROW_HEIGHT,
  SIDEBAR_WIDTH,
  DEPARTMENT_ROW_HEIGHT,
  TEAM_ROW_HEIGHT,
  EMPLOYEE_ROW_HEIGHT,
  LOADING_BAR_HEIGHT,
  LOADING_BAR_GAP,
  DAYS_BEFORE_TODAY,
  DAYS_AFTER_TODAY,
  TOTAL_DAYS,
  FRESHNESS_GREEN_THRESHOLD,
  FRESHNESS_YELLOW_THRESHOLD,
  FRESHNESS_NEVER_THRESHOLD,
} from './constants'
