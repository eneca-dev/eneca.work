import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase-client'
import { useUserStore } from '@/stores/useUserStore'
import type { FilterStore, FilterOption, FilterConfigs } from './types'
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
        managers: [],
        projects: [],
        stages: [],
        objects: [],
        departments: [],
        teams: [],
        employees: [],
        
        // Выбранные значения
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
        
        // Универсальный метод установки фильтра
        setFilter: (type: string, value: string | null) => {
          const state = get()
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
          
          if (type === 'department' && value) {
            updates.selectedTeamId = null
            updates.selectedEmployeeId = null
            state.loadTeams()
          }
          
          set(updates)
        },
        
        // Сброс фильтров
        resetFilters: () => {
          const state = get()
          const updates: any = {
            selectedManagerId: null,
            selectedProjectId: null,
            selectedStageId: null,
            selectedObjectId: null,
            selectedDepartmentId: null,
            selectedTeamId: null,
            selectedEmployeeId: null,
            projects: [],
            stages: [],
            objects: []
          }
          
          // Применяем только незаблокированные сбросы
          Object.keys(updates).forEach(key => {
            const filterType = key.replace('selected', '').replace('Id', '').toLowerCase()
            if (state.isFilterLocked(filterType)) {
              delete updates[key]
            }
          })
          
          set(updates)
        },
        
        // Проверка блокировки фильтра
        isFilterLocked: (type: string) => {
          const userStore = useUserStore.getState()
          const activePermission = userStore.getActivePermission()
          
          if (!activePermission) return false
          
          switch (activePermission) {
            case 'is_project_manager':
              return type === 'manager'
            case 'is_head_of_department':
              return type === 'department'
            case 'is_teamlead':
              return type === 'department' || type === 'team'
            default:
              return false
          }
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
        
        getFilteredEmployees: () => {
          const state = get()
          let filtered = state.employees
          
          if (state.selectedDepartmentId) {
            filtered = filtered.filter(e => e.departmentId === state.selectedDepartmentId)
          }
          
          if (state.selectedTeamId) {
            filtered = filtered.filter(e => e.departmentId === state.selectedTeamId)
          }
          
          return filtered
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
              // Отделы
              if (!departmentsMap.has(row.department_id)) {
                departmentsMap.set(row.department_id, {
                  id: row.department_id,
                  name: row.department_name
                })
              }
              
              // Команды
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
            
            const employees = data?.map(e => ({
              id: e.user_id,
              name: e.full_name,
              teamId: e.final_team_id,
              departmentId: e.final_department_id
            })) || []
            
            set({ employees })
          } catch (error) {
            console.error('Ошибка загрузки сотрудников:', error)
          }
        }
      }),
      {
        name: 'filter-store',
        partialize: (state) => ({
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