// Минимальные типы для модуля аналитики раздела

export interface SectionAnalyticsProps {
  sectionId: string
}

export interface KPIData {
  daysToDeadline: number | null
  peopleOnLoadings: number
  currentTotalRate: number
}

// Отчёты за последние дни (из представления БД)
export interface ReportDayEntry {
  name: string
  hours: number
}

export interface ReportDay {
  date: string // YYYY-MM-DD
  entries: ReportDayEntry[]
}

// Суммы часов по отчётам за день (от БД)
export interface ReportDayTotal {
  date: string // YYYY-MM-DD
  total_hours: number
}

// Плановые события по заданиям на последние дни
export type AssignmentPlannedKind = 'planned_transfer' | 'planned_completion'

export interface AssignmentPlannedEventItem {
  title: string
  kind: AssignmentPlannedKind
  from_section_name?: string
  to_section_name?: string
}

export interface AssignmentPlanEvents {
  date: string // YYYY-MM-DD
  events: AssignmentPlannedEventItem[]
}


