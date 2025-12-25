// Типы для модуля Kanban

// Статусы этапов (колонки доски)
export type StageStatus =
  | 'backlog'
  | 'planned'
  | 'in_progress'
  | 'paused'
  | 'review'
  | 'done'

// Статусы разделов (swimlane)
export type SectionStatus =
  | 'planned'
  | 'in_progress'
  | 'paused'
  | 'suspended'
  | 'done'

// Задача (Decomposition Item) - элемент внутри этапа
export interface KanbanTask {
  id: string
  description: string
  responsible?: {
    userId: string
    firstName: string
    lastName: string
  } | null
  plannedHours: number
  actualHours: number
  progress: number // 0-100
  cpi: number | null // Cost Performance Index (EV / Actual)
  dueDate?: string | null
  order: number
  workCategory?: string | null
}

// Этап (Stage / Карточка) - перетаскиваемая карточка
export interface KanbanStage {
  id: string
  name: string
  description?: string | null
  status: StageStatus
  sectionId: string
  startDate?: string | null
  endDate?: string | null
  order: number
  tasks: KanbanTask[]
  // Расчётные поля
  plannedHours: number
  actualHours: number
  progress: number
  cpi: number | null // Aggregated CPI for stage
}

// Раздел (Section / Swimlane) - горизонтальная дорожка
export interface KanbanSection {
  id: string
  name: string
  description?: string | null
  status: SectionStatus
  responsible?: {
    userId: string
    firstName: string
    lastName: string
  } | null
  // Контекст
  projectId: string
  projectName: string
  stageId: string
  stageName: string
  objectId: string
  objectName: string
  // Этапы в этом разделе
  stages: KanbanStage[]
  // Расчётные поля
  totalPlannedHours: number
  totalActualHours: number
  overallProgress: number
}

// Доска целиком
export interface KanbanBoard {
  projectId: string
  projectName: string
  sections: KanbanSection[]
}

// Колонка доски (для UI)
export interface KanbanColumn {
  id: StageStatus
  title: string
  color: string
  bgColor: string
  borderColor: string
}

// Событие перетаскивания
export interface DragResult {
  stageId: string
  sectionId: string
  fromStatus: StageStatus
  toStatus: StageStatus
}

// Настройки отображения
export interface KanbanViewSettings {
  showEmptySwimlanes: boolean
  collapsedSections: string[]
  filterByResponsible?: string
}
