import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { createClient } from '@/utils/supabase/client'
import { useUserStore } from '@/stores/useUserStore'
import { usePermissionsStore } from '@/modules/permissions'
import type { FilterStore, FilterOption, FilterConfigs } from './types'

const supabase = createClient()

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
          console.log('🚀 Инициализация фильтров проектов...')
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
          // Применяем дефолты по правам (мягко)
          get().applyPermissionDefaults()
        },
        
        // Универсальный метод установки фильтра
        setFilter: (type: string, value: string | null) => {
          console.log(`🔄 setFilter: ${type} = ${value}`)
          const state = get()
          
          // Проверяем, не заблокирован ли фильтр
          if (state.isFilterLocked(type)) {
            console.warn(`🔒 Фильтр ${type} заблокирован и не может быть изменён`)
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
          // После сброса мягко восстановим дефолты по правам
          get().applyPermissionDefaults()
        },
        
        // Проверка блокировки фильтра на основе hierarchy permissions + наличие дефолтного значения
        isFilterLocked: (type: string) => {
          const permissionsState = usePermissionsStore.getState()
          const { permissions } = permissionsState
          const userState = useUserStore.getState()
          const userId = userState.id
          const profile: any = userState.profile
          
          if (!permissions || permissions.length === 0) return false
          
          // Проверяем hierarchy permissions для автоблокировки фильтров
          const isAdmin = permissions.includes('hierarchy.is_admin')
          if (isAdmin) return false

          const state = get()
          const hasDept = !!(profile?.departmentId)
          const hasTeam = !!(profile?.teamId)
          const hasManager = !!userId && (userId.length > 0)
          const hasEmployee = !!userId && state.employees.some(e => e.id === userId)

          if (permissions.includes('hierarchy.is_project_manager')) {
            // Блокируем менеджера и все проектные фильтры, если есть дефолт
            if (type === 'manager') return hasManager
            // Проектные фильтры блокируются только если уже выбран проект менеджера
            if (type === 'project' || type === 'stage' || type === 'object') {
              return !!state.selectedManagerId && state.selectedManagerId === userId
            }
          }

          if (permissions.includes('hierarchy.is_department_head')) {
            // Блокируем только отдел, команды и сотрудников можно выбирать внутри отдела
            if (type === 'department') return hasDept
            // Команду и сотрудников НЕ блокируем - пусть выбирает внутри своего отдела
          }

          if (permissions.includes('hierarchy.is_team_lead')) {
            // Блокируем отдел/команду, сотрудников можно выбирать внутри команды
            if (type === 'department') return hasDept
            if (type === 'team') return hasTeam
            // Сотрудников НЕ блокируем - пусть выбирает внутри своей команды
          }

          // Обычный пользователь: блокируем отдел/команду/сотрудника при наличии дефолтов
          if (permissions.includes('hierarchy.is_user')) {
            if (type === 'department') return hasDept
            if (type === 'team') return hasTeam
            if (type === 'employee') return hasEmployee
          }

          // Админ не имеет ограничений
          return false
        },

        // Применение дефолтов согласно правам пользователя (мягко: не перетираем явный выбор)
        applyPermissionDefaults: () => {
          const permissionsState = usePermissionsStore.getState()
          const { permissions } = permissionsState
          const userState = useUserStore.getState()
          const userId = userState.id
          const profile: any = userState.profile
          const state = get()

          if (!permissions || permissions.length === 0) return

          const updates: any = {}

          // Department Head → по умолчанию отдел
          if (permissions.includes('hierarchy.is_department_head')) {
            const deptId = profile?.departmentId
            if (deptId && !state.selectedDepartmentId) updates.selectedDepartmentId = deptId
          }

          // Team Lead → по умолчанию отдел и команда
          if (permissions.includes('hierarchy.is_team_lead')) {
            const deptId = profile?.departmentId
            const teamId = profile?.teamId
            if (deptId && !state.selectedDepartmentId) updates.selectedDepartmentId = deptId
            if (teamId && !state.selectedTeamId) updates.selectedTeamId = teamId
          }

          // Project Manager → по умолчанию руководитель проекта = текущий пользователь
          if (permissions.includes('hierarchy.is_project_manager')) {
            if (userId && !state.selectedManagerId) {
              updates.selectedManagerId = userId
              // подгружаем проекты этого менеджера
              state.loadProjects(userId)
            }
          }

          // User → по умолчанию сотрудник = сам
          if (permissions.includes('hierarchy.is_user')) {
            if (userId && !state.selectedEmployeeId) updates.selectedEmployeeId = userId
            const deptId = profile?.departmentId || state.employees.find(e => e.id === userId)?.departmentId
            const teamId = profile?.teamId || state.employees.find(e => e.id === userId)?.teamId
            if (deptId && !state.selectedDepartmentId) updates.selectedDepartmentId = deptId
            if (teamId && !state.selectedTeamId) updates.selectedTeamId = teamId
          }

          if (Object.keys(updates).length > 0) set(updates)
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
            filtered = filtered.filter(e => (e as any).departmentId === state.selectedDepartmentId)
          }
          
          if (state.selectedTeamId) {
            filtered = filtered.filter(e => (e as any).teamId === state.selectedTeamId)
          }
          
          return filtered
        },
        
        // Методы загрузки данных
        loadManagers: async () => {
          console.log('🔄 Загружаю менеджеров...')
          try {
            const { data, error } = await supabase
              .from('view_manager_projects')
              .select('manager_id, manager_name')
              .order('manager_name')
            
            if (error) throw error
            
            console.log('📊 Данные менеджеров:', data)
            
            const managerMap = new Map()
            data?.forEach((row: any) => {
              if (!managerMap.has(row.manager_id)) {
                managerMap.set(row.manager_id, {
                  id: row.manager_id,
                  name: row.manager_name
                })
              }
            })
            
            const managers = Array.from(managerMap.values())
            console.log('✅ Менеджеры загружены:', managers)
            set({ managers })
            // Применяем дефолты по ролям (если требуется)
            get().applyPermissionDefaults()
          } catch (error) {
            console.error('❌ Ошибка загрузки менеджеров:', error)
          }
        },
        
        loadProjects: async (managerId?: string | null) => {
          console.log('🔄 Загружаю проекты для менеджера:', managerId)
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
            
            console.log('📊 Данные проектов:', data)
            
            const projects = data?.map((p: any) => ({
              id: p.project_id,
              name: p.project_name,
              managerId: p.project_manager
            })) || []
            
            console.log('✅ Проекты загружены:', projects)
            set({ projects, isLoadingProjects: false })
          } catch (error) {
            console.error('❌ Ошибка загрузки проектов:', error)
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
            
            const stages = data?.map((s: any) => ({
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
            
            const objects = data?.map((o: any) => ({
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
            
            data?.forEach((row: any) => {
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
            // Применяем дефолты по ролям (если требуется)
            get().applyPermissionDefaults()
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
            data?.forEach((row: any) => {
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
            // Применяем дефолты по ролям (если требуется)
            get().applyPermissionDefaults()
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