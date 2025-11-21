import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase-client'
import { useUserStore } from '@/stores/useUserStore'
import type { FilterStore, FilterOption, FilterConfigs, FilterType } from './types'
import type { Department, Team, Employee } from '../types'

export const useFilterStore = create<FilterStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Состояние загрузки
        isLoading: false,
        isLoadingProjects: false,
        isLoadingStages: false,
        isLoadingObjects: false,
        
        // Данные фильтров
        subdivisions: [],
        managers: [],
        projects: [],
        stages: [],
        objects: [],
        departments: [],
        teams: [],
        employees: [],

        // Заблокированные фильтры по ролям
        lockedFilters: [],

        // Выбранные значения
        selectedSubdivisionId: null,
        selectedManagerId: null,
        selectedProjectId: null,
        selectedStageId: null,
        selectedObjectId: null,
        selectedDepartmentId: null,
        selectedTeamId: null,
        selectedEmployeeId: null,
        
        // Конфигурация
        config: {},
        
        // Инициализация с конфигурацией
        initialize: (config: FilterConfigs) => {
          set({ config })
          // Загружаем базовые данные
          get().loadSubdivisions()
          get().loadManagers()
          get().loadDepartments()
          get().loadEmployees()

          // Восстанавливаем зависимые данные для сохраненных фильтров
          const state = get()

          // Если есть выбранный менеджер, загружаем его проекты
          if (state.selectedManagerId) {
            get().loadProjects(state.selectedManagerId)
          }

          // Если есть выбранный проект, загружаем его стадии
          if (state.selectedProjectId) {
            get().loadStages(state.selectedProjectId)
          }

          // Если есть выбранная стадия, загружаем её объекты
          if (state.selectedStageId) {
            get().loadObjects(state.selectedStageId)
          }
        },
        
        // Применение ограничений и дефолтов по правам — не используется напрямую (см. integration/applyPlanningLocks)
        applyPermissionDefaults: () => {},

        // Проверка блокировки фильтра
        isFilterLocked: (type: FilterType) => {
          const state = get()
          return Boolean(state.lockedFilters && state.lockedFilters.includes(type))
        },

        // Универсальный метод установки фильтра
        setFilter: (type: FilterType, value: string | null) => {
          console.log(`🔄 setFilter: ${type} = ${value}`)
          const state = get()
          // Уважение блокировок
          if (state.lockedFilters && state.lockedFilters.includes(type)) {
            console.warn(`🔒 Фильтр ${type} заблокирован по правам, изменение отклонено`)
            return
          }
          const updates: any = {}
          
          // Устанавливаем значение
          updates[`selected${type.charAt(0).toUpperCase() + type.slice(1)}Id`] = value
          
          // Обрабатываем зависимости
          if (type === 'manager' && value) {
            updates.selectedProjectId = null
            updates.selectedStageId = null
            updates.selectedObjectId = null
            state.loadProjects(value)
          }

          if (type === 'project' && value) {
            updates.selectedStageId = null
            updates.selectedObjectId = null
            state.loadStages(value)
          }

          if (type === 'stage' && value) {
            updates.selectedObjectId = null
            state.loadObjects(value)
          }

          // Subdivision → Department → Team → Employee
          if (type === 'subdivision') {
            // Сбрасываем все зависимые фильтры при изменении подразделения
            console.log(`🔄 Сбрасываю отдел, команду и сотрудника при изменении подразделения`)
            updates.selectedDepartmentId = null
            updates.selectedTeamId = null
            updates.selectedEmployeeId = null
          }

          if (type === 'department') {
            // Сбрасываем команду и сотрудника при любом изменении отдела (выбор или очистка)
            console.log(`🔄 Сбрасываю команду и сотрудника при изменении отдела`)
            updates.selectedTeamId = null
            updates.selectedEmployeeId = null
            if (value) {
              state.loadTeams()
            }
          }

          if (type === 'team') {
            // Сбрасываем сотрудника при любом изменении команды (выбор или очистка)
            console.log(`🔄 Сбрасываю сотрудника при изменении команды`)
            updates.selectedEmployeeId = null
          }
          
          console.log(`🔄 Применяю обновления:`, updates)
          set(updates)
        },
        
        // Сброс фильтров
        resetFilters: () => {

          const state = get()
          const isLocked = (t: FilterType) => Boolean(state.lockedFilters && state.lockedFilters.includes(t))

          set({
            selectedSubdivisionId: isLocked('subdivision') ? state.selectedSubdivisionId : null,
            selectedManagerId: isLocked('manager') ? state.selectedManagerId : null,
            selectedProjectId: null,
            selectedStageId: null,
            selectedObjectId: null,
            selectedDepartmentId: isLocked('department') ? state.selectedDepartmentId : null,
            selectedTeamId: isLocked('team') ? state.selectedTeamId : null,
            selectedEmployeeId: null,
            projects: [],
            stages: [],
            objects: []
          })
        },
        

        
        // Фильтрованные данные
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

        getFilteredDepartments: () => {
          const state = get()
          if (!state.selectedSubdivisionId) return state.departments
          return state.departments.filter(d => (d as any).subdivisionId === state.selectedSubdivisionId)
        },

        getFilteredEmployees: () => {
          const state = get()
          let filtered = state.employees

          // Priority: team > department > subdivision
          if (state.selectedTeamId) {
            filtered = filtered.filter(e => (e as any).teamId === state.selectedTeamId)
          } else if (state.selectedDepartmentId) {
            filtered = filtered.filter(e => (e as any).departmentId === state.selectedDepartmentId)
          } else if (state.selectedSubdivisionId) {
            // Get all departments in this subdivision
            const deptIds = new Set(
              state.departments
                .filter(d => (d as any).subdivisionId === state.selectedSubdivisionId)
                .map(d => d.id)
            )
            // Filter employees by those departments
            filtered = filtered.filter(e => deptIds.has((e as any).departmentId))
          }

          return filtered
        },

        getFilteredTeams: () => {
          const state = get()
          // Priority: department > subdivision
          if (state.selectedDepartmentId) {
            return state.teams.filter(t => t.departmentId === state.selectedDepartmentId)
          }

          // If only subdivision is selected, filter teams by departments in this subdivision
          if (state.selectedSubdivisionId) {
            const deptIds = state.departments
              .filter(d => (d as any).subdivisionId === state.selectedSubdivisionId)
              .map(d => d.id)
            return state.teams.filter(t => deptIds.includes(t.departmentId!))
          }

          return state.teams
        },
        
        // Методы загрузки данных
        loadManagers: async () => {
          try {
            const { data, error } = await supabase
              .from('view_manager_projects')
              .select('manager_id, manager_name')
              .order('manager_name')
            
            if (error) throw error
            
            const managerMap = new Map()
            data?.forEach(row => {
              if (!managerMap.has(row.manager_id)) {
                managerMap.set(row.manager_id, {
                  id: row.manager_id,
                  name: row.manager_name
                })
              }
            })
            
            set({ managers: Array.from(managerMap.values()) })
          } catch (error) {
            console.error('Ошибка загрузки менеджеров:', error)
          }
        },
        
        loadProjects: async (managerId?: string | null) => {
          set({ isLoadingProjects: true })
          try {
            let query = supabase
              .from('projects')
              .select('project_id, project_name, project_manager')
              .eq('project_status', 'active')
              .order('project_name')
            
            if (managerId) {
              query = query.eq('project_manager', managerId)
            }
            
            const { data, error } = await query
            if (error) throw error
            
            const projects = data?.map(p => ({
              id: p.project_id,
              name: p.project_name,
              managerId: p.project_manager
            })) || []
            
            set({ projects, isLoadingProjects: false })
          } catch (error) {
            console.error('Ошибка загрузки проектов:', error)
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
            
            const stages = data?.map(s => ({
              id: s.stage_id,
              name: s.stage_name
            })) || []
            
            set({ stages, isLoadingStages: false })
          } catch (error) {
            console.error('Ошибка загрузки этапов:', error)
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
            
            const objects = data?.map(o => ({
              id: o.object_id,
              name: o.object_name
            })) || []
            
            set({ objects, isLoadingObjects: false })
          } catch (error) {
            console.error('Ошибка загрузки объектов:', error)
            set({ isLoadingObjects: false })
          }
        },

        loadSubdivisions: async () => {
          try {
            const { data, error } = await supabase
              .from('view_subdivisions_with_heads')
              .select('subdivision_id, subdivision_name')
              .order('subdivision_name')

            if (error) throw error

            const subdivisions = data?.map(s => ({
              id: s.subdivision_id,
              name: s.subdivision_name
            })) || []

            set({ subdivisions })
          } catch (error) {
            console.error('Ошибка загрузки подразделений:', error)
          }
        },

        loadDepartments: async () => {
          try {
            // Загружаем departments напрямую из таблицы чтобы получить subdivision_id
            const [deptsResult, teamsResult] = await Promise.all([
              supabase
                .from('departments')
                .select('department_id, department_name, subdivision_id')
                .order('department_name'),
              supabase
                .from('view_organizational_structure')
                .select('team_id, team_name, department_id')
                .order('team_name')
            ])

            if (deptsResult.error) throw deptsResult.error
            if (teamsResult.error) throw teamsResult.error

            // Departments с subdivision_id
            const departmentsMap = new Map()
            deptsResult.data?.forEach(row => {
              if (!departmentsMap.has(row.department_id)) {
                departmentsMap.set(row.department_id, {
                  id: row.department_id,
                  name: row.department_name,
                  subdivisionId: row.subdivision_id
                })
              }
            })

            // Teams
            const teamsMap = new Map()
            teamsResult.data?.forEach(row => {
              if (row.team_id && !teamsMap.has(row.team_id)) {
                teamsMap.set(row.team_id, {
                  id: row.team_id,
                  name: row.team_name,
                  departmentId: row.department_id
                })
              }
            })

            set({
              departments: Array.from(departmentsMap.values()),
              teams: Array.from(teamsMap.values())
            })
          } catch (error) {
            console.error('Ошибка загрузки отделов:', error)
          }
        },
        
        loadTeams: async () => {
          // Команды уже загружены в loadDepartments
        },
        
        loadEmployees: async () => {
          try {
            const { data, error } = await supabase
              .from('view_employee_workloads')
              .select(`
                user_id,
                full_name,
                final_team_id,
                final_department_id
              `)
              .order('full_name')
            
            if (error) throw error
            
            // Используем Map для дедупликации по user_id
            const employeesMap = new Map()
            data?.forEach(row => {
              if (!employeesMap.has(row.user_id)) {
                employeesMap.set(row.user_id, {
                  id: row.user_id,
                  name: row.full_name,
                  teamId: row.final_team_id,
                  departmentId: row.final_department_id
                })
              }
            })
            
            set({ employees: Array.from(employeesMap.values()) })
          } catch (error) {
            console.error('Ошибка загрузки сотрудников:', error)
          }
        }
      }),
      {
        name: 'filter-store',
        partialize: (state) => ({
          selectedSubdivisionId: state.selectedSubdivisionId,
          selectedManagerId: state.selectedManagerId,
          selectedProjectId: state.selectedProjectId,
          selectedStageId: state.selectedStageId,
          selectedObjectId: state.selectedObjectId,
          selectedDepartmentId: state.selectedDepartmentId,
          selectedTeamId: state.selectedTeamId,
          selectedEmployeeId: state.selectedEmployeeId
        })
      }
    )
  )
) 