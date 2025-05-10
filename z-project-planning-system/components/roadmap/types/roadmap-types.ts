import type { Project, Loading } from "@/types/project-types"

// Интерфейс для хранения агрегированных значений по категориям
export interface CategoryAggregates {
  total: number
}

// Интерфейс для группировки дней по месяцам
export interface MonthGroup {
  month: string
  startIndex: number
  days: number
}

export interface RoadmapContextType {
  project: Project
  workingDays: Date[]
  allDays: Date[]
  monthGroups: MonthGroup[]
  sectionAggregates: Record<string, Record<string, CategoryAggregates>>
  maxAggregates: Record<string, number>
  expandedSections: Record<string, boolean>
  onToggleSection: (sectionId: string) => void
  onAddLoading: (stageId: string) => void
  onEditLoading: (loading: Loading, stageId: string) => void
  CELL_WIDTH: number
  sidebarWidth?: number
  showPlanCharts: boolean
  showFactCharts: boolean
  togglePlanCharts: () => void
  toggleFactCharts: () => void
  responsibleColumnWidth?: number
  isResponsibleColumnCollapsed: boolean
  toggleResponsibleColumn: () => void
  isDarkTheme: boolean
  collapseAllSections?: () => void
}

