export interface FilterOption {
  id: string
  name: string
  departmentId?: string // для команд - связь с отделом
  managerId?: string    // для проектов - связь с менеджером
}

export interface FilterState {
  selectedProjectId: string | null
  selectedDepartmentId: string | null
  selectedTeamId: string | null
  selectedManagerId: string | null
  selectedEmployeeId: string | null
  selectedStageId: string | null
  selectedObjectId: string | null
}

export interface FilterOptions {
  projects: FilterOption[]
  departments: FilterOption[]
  teams: FilterOption[]
  managers: FilterOption[]
  employees: FilterOption[]
  stages: FilterOption[]
  objects: FilterOption[]
}

export interface LoadingState {
  isLoading: boolean
  isLoadingProjects: boolean
  isLoadingStages: boolean
  isLoadingObjects: boolean
}

export type FilterType = 'manager' | 'project' | 'stage' | 'object' | 'department' | 'team' | 'employee'

export interface FilterConfig {
  id: string
  label: string
  dependencies?: string[] // какие фильтры должны быть выбраны перед этим
  fetchFunction?: string  // название функции для загрузки данных
}

export interface ModuleConfig {
  filters: FilterConfig[]
}

export interface FilterConfigs {
  [key: string]: FilterConfig
}

export interface FilterStore {
  // Состояние загрузки
  isLoading: boolean
  isLoadingProjects: boolean
  isLoadingStages: boolean
  isLoadingObjects: boolean
  
  // Данные фильтров
  managers: FilterOption[]
  projects: FilterOption[]
  stages: FilterOption[]
  objects: FilterOption[]
  departments: FilterOption[]
  teams: FilterOption[]
  employees: FilterOption[]
  
  // Заблокированные фильтры по правам (храним как массив строк для совместимости с persist)
  lockedFilters?: FilterType[]
  
  // Выбранные значения
  selectedManagerId: string | null
  selectedProjectId: string | null
  selectedStageId: string | null
  selectedObjectId: string | null
  selectedDepartmentId: string | null
  selectedTeamId: string | null
  selectedEmployeeId: string | null
  
  // Конфигурация
  config: FilterConfigs
  
  // Методы
  initialize: (config: FilterConfigs) => void
  setFilter: (type: string, value: string | null) => void
  resetFilters: () => void

  applyPermissionDefaults: (ctx: { permissions: string[]; departmentId?: string | null; teamId?: string | null }) => void
  isFilterLocked: (type: FilterType) => boolean
  getFilteredProjects: () => FilterOption[]
  getFilteredStages: () => FilterOption[]
  getFilteredObjects: () => FilterOption[]
  getFilteredEmployees: () => FilterOption[]
  getFilteredTeams: () => FilterOption[]
  
  // Приватные методы загрузки
  loadManagers: () => Promise<void>
  loadProjects: (managerId?: string | null) => Promise<void>
  loadStages: (projectId: string) => Promise<void>
  loadObjects: (stageId: string) => Promise<void>
  loadDepartments: () => Promise<void>
  loadTeams: () => Promise<void>
  loadEmployees: () => Promise<void>
}

export interface PermissionBadgeProps {
  theme: 'light' | 'dark'
}

export interface FilterSelectProps {
  id: string
  label: string
  value: string | null
  onChange: (value: string | null) => void
  disabled?: boolean
  locked?: boolean
  options: FilterOption[]
  placeholder: string
  theme?: 'light' | 'dark'
  loading?: boolean
} 