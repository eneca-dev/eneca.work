// Типы для модуля "Моя работа"

export interface UserLoading {
  loading_id: string
  loading_responsible: string
  section_id: string
  loading_start: string
  loading_finish: string
  loading_rate: number
  loading_status: 'active' | 'archived'
  
  // Данные из join с разделами и проектами
  section_name: string
  project_name: string
  project_id: string
  object_name: string
  stage_name: string
  
  // Данные ответственного (если понадобятся в будущем)
  responsible_first_name: string
  responsible_last_name: string
}

export interface DecompositionItem {
  work_type: string
  work_content: string
  labor_costs: number
  actual_hours?: number // Фактические часы из work_logs
  due_date?: string // Срок выполнения
}

export interface UserTask {
  task_id: string
  task_name: string
  task_description?: string
  task_responsible: string
  task_parent_section: string // раздел, КУДА отправлено задание
  task_section_id?: string // раздел, ОТКУДА отправлено задание
  task_start_date?: string
  task_end_date?: string
  task_status: string
  task_created: string
  task_updated: string
  
  // Обогащенные данные
  section_name: string // название раздела-отправителя
  project_name: string // название проекта раздела-отправителя
  responsible_name?: string // имя ответственного за задание
}

export interface UserAnalytics {
  comments_count: number
  mentions_count: number
  active_loadings_count: number
  archived_loadings_count: number
  today_hours: number
  week_hours: number
}

export interface ResponsibilityInfo {
  type: 'project_manager' | 'lead_engineer' | 'object_responsible' | 'section_responsible'
  entity_id: string
  entity_name: string
  entity_description?: string
}

export interface MyWorkData {
  loadings: UserLoading[]
  tasks: UserTask[]
  analytics: UserAnalytics
  responsibilities: ResponsibilityInfo[]
  workLogs: WorkLogEntry[]
}

// Типы для work_logs данных
export interface WorkLogEntry {
  work_log_id: string
  work_log_date: string
  work_log_hours: number
  work_log_description?: string
  section_name: string
  work_category_name?: string
}

// Локальные типы для компонентов определяются внутри компонентов

export interface DeadlinesBlockProps {
  loadings: UserLoading[]
}
