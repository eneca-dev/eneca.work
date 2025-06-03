export interface Project {
  id: string
  name: string
  description?: string
  startDate?: Date
  endDate?: Date
  status?: "active" | "completed" | "archived"
  teamId?: string
  ownerId?: string
}

export interface Task {
  id: string
  title: string
  description?: string
  startDate: Date
  endDate: Date
  assignees: string[]
  progress: number
  status?: "todo" | "in-progress" | "review" | "done"
  priority?: "low" | "medium" | "high"
  dependencies?: string[]
}

export interface Phase {
  id: string
  name: string
  description?: string
  tasks: Task[]
  startDate?: Date
  endDate?: Date
}

// Добавим интерфейс для раздела
export interface Section {
  id: string
  name: string
  projectId?: string
  projectName?: string
  objectId?: string
  objectName?: string
  stageId?: string
  stageName?: string
  clientId?: string
  clientName?: string
  responsibleName?: string
  departmentName?: string
  teamName?: string
  startDate?: Date | null
  endDate?: Date | null
  status?: string
  isExpanded?: boolean // Добавляем флаг для отслеживания состояния раскрытия
  loadings?: Loading[] // Добавляем массив загрузок
  hasLoadings?: boolean // Флаг наличия загрузок
}

// Добавляем интерфейс для загрузки
export interface Loading {
  id: string
  responsibleId: string
  responsibleName?: string
  sectionId: string
  startDate: Date
  endDate: Date
  rate: number // Ставка
  createdAt?: Date
  updatedAt?: Date
}

export interface TimelineView {
  activeTab: "timeline" | "board" | "calendar"
  currentMonth: string
  nextMonth: string
  showWeekends?: boolean
  zoomLevel?: number
}
