export interface Department {
  id: string
  name: string
}

export interface Team {
  id: string
  departmentId: string
  name: string
}

export interface Specialist {
  id: string
  teamId: string
  name: string
  position: string
  avatarUrl?: string
  responsibleForProjects?: string[] // ID проектов, за которые отвечает специалист
}

export interface Project {
  id: string
  name: string
}

export interface Section {
  id: string
  name: string
  projectIds: string[] // ID проектов, которые входят в этот раздел
}

export interface Stage {
  id: string
  projectId: string
  name: string
}

export interface Object {
  id: string
  stageId: string
  name: string
}

// Статусы заданий из таблицы assignments
export type AssignmentStatus = "Создано" | "Передано" | "Принято" | "Выполнено" | "Согласовано"

// Тип направления задания
export type AssignmentDirection = 'outgoing' | 'incoming' | 'all'

// Основной интерфейс для заданий из таблицы assignments
export interface Assignment {
  assignment_id: string
  project_id: string
  from_section_id: string
  to_section_id: string
  title: string
  description?: string
  status: AssignmentStatus
  created_at: string
  updated_at: string
  due_date?: string
  link?: string
  created_by?: string
  updated_by?: string
  planned_transmitted_date?: string
  planned_duration?: number
  actual_transmitted_date?: string
  actual_accepted_date?: string
  actual_worked_out_date?: string
  actual_agreed_date?: string
  // Дополнительные поля из JOIN запросов
  project_name?: string
  from_section_name?: string
  to_section_name?: string
  created_by_name?: string
  updated_by_name?: string
}

// Интерфейс для фильтров
export interface TaskFilters {
  direction?: AssignmentDirection
  projectId?: string | null
  stageId?: string | null
  objectId?: string | null
  departmentId?: string | null
  teamId?: string | null
  specialistId?: string | null
  status?: AssignmentStatus | null
  sectionId?: string | null
}

// Интерфейс для данных из view_section_hierarchy
export interface SectionHierarchy {
  section_id: string | null
  section_name: string | null
  object_id: string | null
  object_name: string | null
  stage_id: string | null
  stage_name: string | null
  project_id: string
  project_name: string
  client_id: string
  client_name: string
  project_lead_engineer_name: string | null
  project_manager_name: string | null
  section_responsible_name: string | null
  project_lead_engineer_avatar: string | null
  project_manager_avatar: string | null
  section_responsible_avatar: string | null
  responsible_department_id: string | null
  responsible_department_name: string | null
  responsible_team_name: string | null
  total_loading_rate: number | null
  tasks_count: number | null
  latest_plan_loading_status: string | null
  section_start_date?: string | null
  section_end_date?: string | null
}

// Интерфейс для организационной структуры
export interface OrganizationalStructure {
  department_id: string
  department_name: string
  team_id?: string
  team_name?: string
  department_head_id?: string
  department_head_full_name?: string
  department_head_avatar_url?: string
  team_lead_id?: string
  team_lead_full_name?: string
  team_lead_avatar_url?: string
  department_employee_count: number
  team_employee_count?: number
}

// Интерфейс для сотрудников
export interface Employee {
  id: string
  name: string
  teamId: string
  departmentId: string
  position?: string
  avatarUrl?: string
}

// Интерфейс для создания задания
export interface CreateAssignmentData {
  project_id: string
  from_section_id: string
  to_section_id: string
  title: string
  description?: string
  due_date?: string
  link?: string
  planned_transmitted_date?: string
  planned_duration?: number
}

// Интерфейс для обновления задания
export interface UpdateAssignmentData {
  title?: string
  description?: string
  due_date?: string
  link?: string
  planned_duration?: number
}

// Устаревшие типы для совместимости (будут удалены позже)
export type TaskStatus = "created" | "transferred" | "accepted" | "completed" | "approved"

export interface Task {
  id: string
  objectId: string
  title: string
  description: string
  assignedTo: string // specialistId
  createdBy: string // specialistId
  status: TaskStatus
  dueDate: string
  createdAt: string
  // Дополнительные поля для отображения (из joins)
  sectionName?: string
  objectName?: string
  stageName?: string
  projectName?: string
  assignedToName?: string
  assignedToAvatar?: string
  createdByName?: string
  createdByAvatar?: string
}

// Интерфейс для записи аудита изменений
export interface AssignmentAuditRecord {
  audit_id: string
  assignment_id: string
  changed_by: string | null
  changed_at: string
  operation_type: 'UPDATE'
  field_name: string
  old_value: string | null
  new_value: string | null
  created_at: string
  // Дополнительные поля из JOIN
  changed_by_name?: string
  changed_by_avatar?: string
}

// Маппинг полей для человекочитаемых названий
export const FIELD_LABELS: Record<string, string> = {
  title: 'Название',
  description: 'Описание', 
  due_date: 'Срок выполнения',
  planned_duration: 'Плановая продолжительность',
  link: 'Ссылка',
  status: 'Статус'
}
