import type { KanbanColumn, StageStatus, SectionStatus } from '../types'

// Колонки доски (статусы этапов)
export const KANBAN_COLUMNS: KanbanColumn[] = [
  {
    id: 'backlog',
    title: 'Бэклог',
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-900/50',
    borderColor: 'border-gray-200 dark:border-gray-700',
  },
  {
    id: 'planned',
    title: 'План',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
  {
    id: 'in_progress',
    title: 'В работе',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/30',
    borderColor: 'border-amber-200 dark:border-amber-800',
  },
  {
    id: 'paused',
    title: 'Пауза',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-900/30',
    borderColor: 'border-orange-200 dark:border-orange-800',
  },
  {
    id: 'review',
    title: 'Проверка',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-900/30',
    borderColor: 'border-purple-200 dark:border-purple-800',
  },
  {
    id: 'done',
    title: 'Готово',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/30',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
  },
]

// Статусы разделов (swimlane)
export const SECTION_STATUSES: Record<
  SectionStatus,
  { label: string; color: string; bgColor: string }
> = {
  planned: {
    label: 'План',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/50',
  },
  in_progress: {
    label: 'В работе',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/50',
  },
  paused: {
    label: 'Пауза',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/50',
  },
  suspended: {
    label: 'Приостановлено',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/50',
  },
  done: {
    label: 'Готово',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/50',
  },
}

// Утилита для получения колонки по статусу
export const getColumnById = (id: StageStatus): KanbanColumn | undefined => {
  return KANBAN_COLUMNS.find((col) => col.id === id)
}

// Утилита для получения индекса колонки
export const getColumnIndex = (id: StageStatus): number => {
  return KANBAN_COLUMNS.findIndex((col) => col.id === id)
}

// Ширина колонки
export const COLUMN_MIN_WIDTH = 280
export const COLUMN_MAX_WIDTH = 350

// Высота swimlane
export const SWIMLANE_MIN_HEIGHT = 120
export const SWIMLANE_HEADER_HEIGHT = 56
