import type { AssignmentDirection, AssignmentStatus } from '../types'

export interface FilterOption {
  id: string
  name: string
  departmentId?: string // для команд - связь с отделом
  teamId?: string       // для специалистов - связь с командой
  projectId?: string    // для стадий - связь с проектом
  stageId?: string      // для объектов - связь со стадией
}

export interface FilterState {
  direction: AssignmentDirection
  selectedProjectId: string | null
  selectedDepartmentId: string | null
  selectedTeamId: string | null
  selectedSpecialistId: string | null
  selectedStageId: string | null
  selectedObjectId: string | null
  selectedStatus: AssignmentStatus | null
}

export interface FilterOptions {
  projects: FilterOption[]
  departments: FilterOption[]
  teams: FilterOption[]
  specialists: FilterOption[]
  stages: FilterOption[]
  objects: FilterOption[]
}

export interface FilterConfigs {
  [key: string]: {
    apiEndpoint?: string
    dependencies?: string[]
    transform?: (data: any) => FilterOption[]
  }
}

export interface FilterStore extends FilterState, FilterOptions {
  // Состояние загрузки
  isLoading: boolean
  isLoadingStages: boolean
  isLoadingObjects: boolean
  
  // Конфигурация
  config: FilterConfigs
  
  // Методы
  initialize: (config: FilterConfigs) => void
  setFilter: (type: string, value: string | null) => void
  resetFilters: () => void
  
  // Фильтрованные данные
  getFilteredStages: () => FilterOption[]
  getFilteredObjects: () => FilterOption[]
  getFilteredTeams: () => FilterOption[]
  getFilteredSpecialists: () => FilterOption[]
  
  // Методы загрузки
  loadStages: (projectId: string) => void
  loadObjects: (stageId: string) => void
}

export interface FilterSelectProps {
  id: string
  label: string
  value: string | null
  onChange: (value: string | null) => void
  disabled?: boolean
  options: FilterOption[]
  placeholder: string
  theme?: 'light' | 'dark'
  loading?: boolean
} 