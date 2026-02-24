'use client'

/**
 * Kanban Filters - Filter Options Hook
 *
 * Реэкспорт из tasks module для единообразного кеширования.
 * Использует общие query keys из modules/cache.
 */

export { useTasksFilterOptions as useKanbanFilterOptions } from '@/modules/tasks/hooks/useTasksFilterOptions'
