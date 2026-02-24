// Types from module.meta.json schema

export type TaskCategory =
  | 'feature'
  | 'bug'
  | 'refactor'
  | 'performance'
  | 'security'
  | 'docs'
  | 'tech-debt'
  | 'migration'
  | 'audit'
  | 'research'

export type TaskStatus =
  | 'backlog'
  | 'todo'
  | 'in-progress'
  | 'review'
  | 'done'
  | 'blocked'
  | 'cancelled'

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low'

export type ModuleStatus = 'stable' | 'beta' | 'alpha' | 'deprecated' | 'experimental'

export type ModuleTag =
  | 'core'
  | 'data-layer'
  | 'ui'
  | 'feature'
  | 'utility'
  | 'integration'
  | 'auth'
  | 'admin'

export interface ModuleTask {
  id: string
  title: string
  description?: string
  details?: string
  acceptanceCriteria?: string[]
  technicalNotes?: string
  category: TaskCategory
  priority: TaskPriority
  status: TaskStatus
  assignee?: string | null
  createdAt: string
  updatedAt: string
  completedAt?: string | null
  blockedBy?: string[]
  blocks?: string[]
  affectedFiles?: string[]
  estimatedHours?: number
}

export interface ModuleMeta {
  name: string
  displayName: string
  description: string
  version?: string
  status: ModuleStatus
  route?: string | null
  tags?: ModuleTag[]
}

export interface ModuleMetaFile {
  $schema?: string
  meta: ModuleMeta
  architecture: {
    structure: Record<string, string>
    entryPoint?: string
    publicApi: string[]
  }
  hooks?: Array<{
    name: string
    description: string
    file?: string
    params?: string
    returns?: string
    example?: string
  }>
  actions?: Array<{
    name: string
    description: string
    file?: string
    input?: string
    output?: string
    mutates?: boolean
  }>
  stores?: Array<{
    name: string
    description: string
    file?: string
    persistence?: string | null
    state?: string[]
    actions?: string[]
  }>
  components?: Array<{
    name: string
    description: string
    file?: string
    props?: string[]
    example?: string
  }>
  patterns?: Array<{
    name: string
    description: string
    example?: string
  }>
  antipatterns?: Array<{
    name: string
    description: string
    instead: string
  }>
  technologies?: string[]
  dependencies?: {
    modules?: string[]
    database?: {
      tables?: string[]
      views?: string[]
      enums?: string[]
      functions?: string[]
    }
  }
  dependents?: string[]
  cache?: {
    queryKeys?: string[]
    realtimeChannels?: string[]
    invalidationRules?: Array<{
      trigger: string
      invalidates: string[]
    }>
  }
  permissions?: string[]
  tasks: ModuleTask[]
  changelog?: Array<{
    version: string
    date: string
    changes: string[]
  }>
}

// Aggregated task with module info
export interface AggregatedTask extends ModuleTask {
  moduleName: string
  moduleDisplayName: string
  moduleRoute?: string | null
}

// Statistics
export interface TaskStats {
  total: number
  byStatus: Record<TaskStatus, number>
  byCategory: Record<TaskCategory, number>
  byPriority: Record<TaskPriority, number>
  byModule: Record<string, number>
}

// Filter state
export interface TaskFilters {
  modules: string[]
  categories: TaskCategory[]
  statuses: TaskStatus[]
  priorities: TaskPriority[]
  search: string
}

export type GroupBy = 'module' | 'status' | 'category' | 'priority'
