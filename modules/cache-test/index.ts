/**
 * Cache Test Module
 *
 * Тестовый модуль для проверки работы системы кеширования.
 * Используется для отладки и демонстрации паттернов работы с кешем.
 */

// Components
export { ProjectsList } from './components/projects-list'
export { ProjectStructureView } from './components/project-structure'

// Hooks
export {
  useProjects,
  useProject,
  useUpdateProject,
  useProjectsWithCounts,
  useProjectStructure,
} from './hooks/use-projects'

export type {
  ProjectListItem,
  Project,
  ProjectWithCounts,
  ProjectStructure,
  UpdateProjectInput,
} from './hooks/use-projects'
