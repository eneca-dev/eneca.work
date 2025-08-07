// Типы для модуля управления отпусками

export interface VacationEvent {
  calendar_event_id: string
  calendar_event_date_start: string
  calendar_event_date_end: string | null
  calendar_event_type: 'Отпуск запрошен' | 'Отпуск одобрен' | 'Отпуск отклонен'
  calendar_event_comment?: string
  calendar_event_created_by: string
  calendar_event_created_at: string
  user_id: string
  user_name: string
  user_email: string
}

export interface Department {
  department_id: string
  department_name: string
}

export interface Employee {
  user_id: string
  first_name: string
  last_name: string
  email: string
  department_id: string
  department_name: string
  position_name?: string
  avatar_url?: string
}

export interface VacationManagementState {
  selectedDepartmentId: string | null
  employees: Employee[]
  vacations: VacationEvent[]
  departments: Department[]
  isLoading: boolean
  error: string | null
}

export interface GanttDateRange {
  startDate: Date
  endDate: Date
}

export interface VacationFormData {
  startDate: string
  endDate: string
  comment?: string
  type: 'Отпуск запрошен' | 'Отпуск одобрен' | 'Отпуск отклонен'
}

export type VacationAction = 'create' | 'edit' | 'approve' | 'reject' | 'delete' 