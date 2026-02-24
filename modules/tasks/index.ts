/**
 * Tasks Module
 *
 * Объединённый модуль для страницы Задачи
 * Интегрирует Kanban и Timeline (Resource Graph) представления
 */

// Components
export { TasksView, TasksTabs, TabModal } from './components'

// Stores
export {
  useTasksTabsStore,
  TASKS_FILTER_CONFIG,
  VIEW_MODE_ICONS,
  getTabIcon,
  type TaskTab,
  type TasksViewMode,
  type TabIconName,
  type CreateTabInput,
  type UpdateTabInput,
} from './stores'

// Hooks
export { useTasksFilterOptions } from './hooks'
