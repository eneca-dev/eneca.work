export interface Loading {
  id: string
  startDate: string
  endDate: string
  rate: number // 0.25, 0.5, 0.75, 1
  employeeName: string // Имя Фамилия
}

export interface WorkLog {
  id: string
  date: string // дата отчёта
  hours: number // часы (например 8)
  employeeName: string
}

// Тип бюджета раздела
export type BudgetType = "main" | "premium"

// Бюджет раздела
export interface SectionBudget {
  amount: number // плановая сумма бюджета в рублях
  spent: number // потрачено из бюджета
  type: BudgetType // тип бюджета: основной или премиальный
}

export type StageStatus = "backlog" | "plan" | "in_progress" | "paused" | "review" | "done"

// Тип вехи
export type MilestoneType =
  | "expertise_submission"    // Выдача в экспертизу
  | "task_transfer_out"       // Передача задания в другой раздел
  | "task_transfer_in"        // Ожидаемый приём задания из другого раздела
  | "approval"                // Согласование
  | "deadline"                // Дедлайн

// Веха - ключевая точка в разделе
export interface Milestone {
  id: string
  type: MilestoneType
  date: string
  title: string
  description: string
  relatedSectionName?: string // Для передачи/приёма - название связанного раздела
  isCompleted: boolean
}

// Бюджет задачи
export interface TaskBudget {
  amount: number // плановая сумма
  spent: number // потрачено
}

// Недельная статистика для раздела
export interface WeeklyStats {
  weekNumber: number // номер недели (1, 2, 3...)
  weekStart: string // дата начала недели
  weekEnd: string // дата конца недели
  // Фактические показатели (накопительно)
  actualProgress: number // фактическая готовность в % (0-100)
  actualBudgetSpent: number // потрачено бюджета в % от общего (0-100)
  actualHoursSpent: number // потрачено часов в % от общего (0-100)
  // Плановый показатель (общий для всех метрик)
  plannedProgress: number // плановая готовность к этой неделе в % (0-100) - применяется ко всем барам
}

export interface DecompositionTask {
  id: string
  description: string
  plannedHours: number
  progress: number // 0-100
  responsibleName: string | null
  order: number
  budget?: TaskBudget // бюджет задачи
  startDate?: string // дата начала задачи
  endDate?: string // дата окончания задачи
  workLogs?: WorkLog[] // отчёты по задаче
}

export interface DecompositionStage {
  id: string
  name: string
  startDate: string | null // planned start
  finishDate: string | null // planned finish
  order: number
  status: StageStatus // статус этапа
  plannedHours: number // суммарные плановые часы по задачам этапа
  loadings: Loading[] // actual work periods
  workLogs: WorkLog[] // отчёты сотрудников
  tasks: DecompositionTask[] // задачи этапа
}

// Раздел проекта (например: КР, АР, ВК и т.д.)
export interface PlanningSection {
  id: string
  name: string
  startDate: string | null
  endDate: string | null
  stages: DecompositionStage[]
  milestones: Milestone[] // Вехи раздела
  budget?: SectionBudget // Плановый бюджет раздела
  weeklyStats?: WeeklyStats[] // Недельная статистика раздела
  totalPlannedHours?: number // Общее плановое количество часов
}

// Объект внутри стадии проекта (например: "Здание 1", "Корпус A")
export interface PlanningObject {
  id: string
  name: string
  sections: PlanningSection[]
}

// Стадия проекта (например: "Стадия П", "Стадия Р")
export interface ProjectStage {
  id: string
  name: string
  objects: PlanningObject[]
}

// Проект
export interface Project {
  id: string
  name: string
  status: string
  stages: ProjectStage[]
}

export interface TimelineRange {
  start: Date
  end: Date
  totalDays: number
}
