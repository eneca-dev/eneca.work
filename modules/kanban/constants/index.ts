import type { KanbanColumn, StageStatus, SectionStatus } from '../types'

// Колонки доски (статусы этапов)
// Тепловая карта: от холодных к горячим (активным) и остывают к финишу
export const KANBAN_COLUMNS: KanbanColumn[] = [
  {
    id: 'backlog',
    title: 'Бэклог',
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-900/50',
    borderColor: 'border-slate-200 dark:border-slate-700',
  },
  {
    id: 'planned',
    title: 'План',
    color: 'text-teal-600 dark:text-teal-400',
    bgColor: 'bg-teal-50 dark:bg-teal-900/30',
    borderColor: 'border-teal-200 dark:border-teal-800',
  },
  {
    id: 'in_progress',
    title: 'В работе',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-900/30',
    borderColor: 'border-orange-200 dark:border-orange-800',
  },
  {
    id: 'paused',
    title: 'Пауза',
    color: 'text-stone-600 dark:text-stone-400',
    bgColor: 'bg-stone-100 dark:bg-stone-900/50',
    borderColor: 'border-stone-200 dark:border-stone-700',
  },
  {
    id: 'review',
    title: 'Проверка',
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-50 dark:bg-indigo-900/30',
    borderColor: 'border-indigo-200 dark:border-indigo-800',
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
    color: 'text-teal-600 dark:text-teal-400',
    bgColor: 'bg-teal-100 dark:bg-teal-900/50',
  },
  in_progress: {
    label: 'В работе',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/50',
  },
  paused: {
    label: 'Пауза',
    color: 'text-stone-600 dark:text-stone-400',
    bgColor: 'bg-stone-100 dark:bg-stone-900/50',
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
