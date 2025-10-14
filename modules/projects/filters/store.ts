import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase-client'

export type FilterType = 'manager' | 'project' | 'stage' | 'object' | 'department' | 'team' | 'employee'

export interface FilterOption {
  id: string
  name: string
  departmentId?: string
  managerId?: string
}

export interface FilterConfigs {
  [key: string]: { id: string; label: string }
}

export interface FilterStore {
  isLoading: boolean
  isLoadingProjects: boolean
  isLoadingStages: boolean
  isLoadingObjects: boolean

  managers: FilterOption[]
  projects: FilterOption[]
  stages: FilterOption[]
  objects: FilterOption[]
  departments: FilterOption[]
  teams: FilterOption[]
  employees: FilterOption[]

  lockedFilters?: FilterType[]

  selectedManagerId: string | null
  selectedProjectId: string | null
  selectedStageId: string | null
  selectedObjectId: string | null
  selectedDepartmentId: string | null
  selectedTeamId: string | null
  selectedEmployeeId: string | null

  config: FilterConfigs

  initialize: (config: FilterConfigs) => void
  setFilter: (type: FilterType, value: string | null) => void
  resetFilters: () => void

  isFilterLocked: (type: FilterType) => boolean

  getFilteredProjects: () => FilterOption[]
  getFilteredStages: () => FilterOption[]
  getFilteredObjects: () => FilterOption[]
  getFilteredEmployees: () => FilterOption[]
  getFilteredTeams: () => FilterOption[]

  loadManagers: () => Promise<void>
  loadProjects: (managerId?: string | null) => Promise<void>
  loadStages: (projectId: string) => Promise<void>
  loadObjects: (stageId: string) => Promise<void>
  loadDepartments: () => Promise<void>
  loadTeams: () => Promise<void>
  loadEmployees: () => Promise<void>
}

export const useProjectFilterStore = create<FilterStore>()(
  devtools(
    persist(
      (set, get) => ({
        isLoading: false,
        isLoadingProjects: false,
        isLoadingStages: false,
        isLoadingObjects: false,

        managers: [],
        projects: [],
        stages: [],
        objects: [],
        departments: [],
        teams: [],
        employees: [],

        lockedFilters: [],

        selectedManagerId: null,
        selectedProjectId: null,
        selectedStageId: null,
        selectedObjectId: null,
        selectedDepartmentId: null,
        selectedTeamId: null,
        selectedEmployeeId: null,

        config: {},

        initialize: (config: FilterConfigs) => {
          set({ config })
          get().loadManagers()
          get().loadDepartments()
          get().loadEmployees()

          const state = get()
          if (state.selectedManagerId) get().loadProjects(state.selectedManagerId)
          if (state.selectedProjectId) get().loadStages(state.selectedProjectId)
          if (state.selectedStageId) get().loadObjects(state.selectedStageId)
        },

        isFilterLocked: (type: FilterType) => {
          const state = get()
          return Boolean(state.lockedFilters && state.lockedFilters.includes(type))
        },

        setFilter: (type: FilterType, value: string | null) => {
          const state = get()
          if (state.lockedFilters && state.lockedFilters.includes(type)) return
          const updates: any = {}
          updates[`selected${type.charAt(0).toUpperCase() + type.slice(1)}Id`] = value

          if (type === 'manager') {
            updates.selectedProjectId = null
            updates.selectedStageId = null
            updates.selectedObjectId = null
            if (value) state.loadProjects(value)
          }
          if (type === 'project') {
            updates.selectedStageId = null
            updates.selectedObjectId = null
            if (value) state.loadStages(value)
          }
          if (type === 'stage') {
            updates.selectedObjectId = null
            if (value) state.loadObjects(value)
          }
          if (type === 'department') {
            updates.selectedTeamId = null
            updates.selectedEmployeeId = null
          }
          if (type === 'team') {
            updates.selectedEmployeeId = null
          }
          set(updates)
        },

        resetFilters: () => {
          const state = get()
          const isLocked = (t: FilterType) => Boolean(state.lockedFilters && state.lockedFilters.includes(t))
          set({
            selectedManagerId: isLocked('manager') ? state.selectedManagerId : null,
            selectedProjectId: null,
            selectedStageId: null,
            selectedObjectId: null,
            selectedDepartmentId: isLocked('department') ? state.selectedDepartmentId : null,
            selectedTeamId: isLocked('team') ? state.selectedTeamId : null,
            selectedEmployeeId: null,
            projects: [],
            stages: [],
            objects: [],
          })
        },

        getFilteredProjects: () => {
          const state = get()
          if (!state.selectedManagerId) return state.projects
          return state.projects.filter(p => p.managerId === state.selectedManagerId)
        },
        getFilteredStages: () => {
          const state = get()
          if (!state.selectedProjectId) return []
          return state.stages
        },
        getFilteredObjects: () => {
          const state = get()
          if (!state.selectedStageId) return []
          return state.objects
        },
        getFilteredEmployees: () => {
          const state = get()
          let filtered = state.employees
          if (state.selectedDepartmentId) filtered = filtered.filter(e => (e as any).departmentId === state.selectedDepartmentId)
          if (state.selectedTeamId) filtered = filtered.filter(e => (e as any).teamId === state.selectedTeamId)
          return filtered
        },
        getFilteredTeams: () => {
          const state = get()
          if (!state.selectedDepartmentId) return state.teams
          return state.teams.filter(t => t.departmentId === state.selectedDepartmentId)
        },

        loadManagers: async () => {
          try {
            const { data, error } = await supabase
              .from('view_manager_projects')
              .select('manager_id, manager_name')
              .order('manager_name')
            if (error) throw error
            const map = new Map()
            data?.forEach(row => {
              if (!map.has(row.manager_id)) {
                map.set(row.manager_id, { id: row.manager_id, name: row.manager_name })
              }
            })
            set({ managers: Array.from(map.values()) })
          } catch (e) {
            console.warn('Ошибка загрузки менеджеров:', (e as any)?.message || e)
          }
        },

        loadProjects: async (managerId?: string | null) => {
          set({ isLoadingProjects: true })
          try {
            let query = supabase
              .from('projects')
              .select('project_id, project_name, project_manager')
              .order('project_name')
            if (managerId) query = query.eq('project_manager', managerId)
            const { data, error } = await query
            if (error) throw error
            const projects = data?.map(p => ({ id: p.project_id, name: p.project_name, managerId: p.project_manager })) || []
            set({ projects, isLoadingProjects: false })
          } catch (e) {
            console.warn('Ошибка загрузки проектов:', (e as any)?.message || e)
            set({ isLoadingProjects: false })
          }
        },

        loadStages: async (projectId: string) => {
          set({ isLoadingStages: true })
          try {
            const { data, error } = await supabase
              .from('stages')
              .select('stage_id, stage_name, stage_project_id')
              .eq('stage_project_id', projectId)
              .order('stage_name')
            if (error) throw error
            const stages = data?.map(s => ({ id: s.stage_id, name: s.stage_name })) || []
            set({ stages, isLoadingStages: false })
          } catch (e) {
            console.warn('Ошибка загрузки этапов:', (e as any)?.message || e)
            set({ isLoadingStages: false })
          }
        },

        loadObjects: async (stageId: string) => {
          set({ isLoadingObjects: true })
          try {
            const { data, error } = await supabase
              .from('objects')
              .select('object_id, object_name, object_stage_id')
              .eq('object_stage_id', stageId)
              .order('object_name')
            if (error) throw error
            const objects = data?.map(o => ({ id: o.object_id, name: o.object_name })) || []
            set({ objects, isLoadingObjects: false })
          } catch (e) {
            console.warn('Ошибка загрузки объектов:', (e as any)?.message || e)
            set({ isLoadingObjects: false })
          }
        },

        loadDepartments: async () => {
          try {
            const { data, error } = await supabase
              .from('view_organizational_structure')
              .select('*')
              .order('department_name')
            if (error) throw error
            const departmentsMap = new Map()
            const teamsMap = new Map()
            data?.forEach(row => {
              if (!departmentsMap.has(row.department_id)) {
                departmentsMap.set(row.department_id, { id: row.department_id, name: row.department_name })
              }
              if (row.team_id && !teamsMap.has(row.team_id)) {
                teamsMap.set(row.team_id, { id: row.team_id, name: row.team_name, departmentId: row.department_id })
              }
            })
            set({ departments: Array.from(departmentsMap.values()), teams: Array.from(teamsMap.values()) })
          } catch (e) {
            console.warn('Ошибка загрузки отделов:', (e as any)?.message || e)
          }
        },

        loadTeams: async () => {
          // Команды подгружаются в loadDepartments
        },

        loadEmployees: async () => {
          try {
            const { data, error } = await supabase
              .from('view_employee_workloads')
              .select('user_id, full_name, final_team_id, final_department_id')
              .order('full_name')
            if (error) throw error
            const map = new Map()
            data?.forEach(row => {
              if (!map.has(row.user_id)) {
                map.set(row.user_id, { id: row.user_id, name: row.full_name, teamId: row.final_team_id, departmentId: row.final_department_id })
              }
            })
            set({ employees: Array.from(map.values()) })
          } catch (e) {
            console.warn('Ошибка загрузки сотрудников:', (e as any)?.message || e)
          }
        },
      }),
      {
        name: 'projects-filter-store',
        partialize: (state) => ({
          selectedManagerId: state.selectedManagerId,
          selectedProjectId: state.selectedProjectId,
          selectedStageId: state.selectedStageId,
          selectedObjectId: state.selectedObjectId,
          selectedDepartmentId: state.selectedDepartmentId,
          selectedTeamId: state.selectedTeamId,
          selectedEmployeeId: state.selectedEmployeeId,
        })
      }
    )
  )
)


