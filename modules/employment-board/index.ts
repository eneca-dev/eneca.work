/**
 * Employment Board - Public API
 *
 * Доска занятости отдела: вкладка «Занятость» на странице /tasks.
 */

export { EmploymentBoardInternal } from './components/EmploymentBoardInternal'
export {
  EMPLOYMENT_BOARD_VIEW,
  EMPLOYMENT_BOARD_EDIT,
  type EmploymentBoardPermission,
} from './constants'
export { EMPLOYMENT_BOARD_FILTER_CONFIG } from './filter-config'
export type {
  BoardEmployee,
  BoardProject,
  BoardProjectEmployee,
  EmploymentBoard,
  PinProjectInput,
  PlacementInput,
  PlacementSource,
} from './types'
