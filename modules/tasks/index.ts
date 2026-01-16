/**
 * Tasks Module
 *
 * Объединённый модуль для страницы Задачи
 * Интегрирует Kanban и Timeline (Resource Graph) представления
 */

// Components
export { TasksView } from './components'

// Stores
export {
  useTasksFiltersStore,
  useTasksViewStore,
  TASKS_FILTER_CONFIG,
  type TasksViewMode,
} from './stores'

// Hooks
export { useTasksFilterOptions } from './hooks'
