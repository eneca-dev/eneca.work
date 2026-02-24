import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { useTaskTransferStore } from '../store'
import type { FilterStore, FilterOption, FilterConfigs } from './types'

export const useTaskTransferFilterStore = create<FilterStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Состояние загрузки
        isLoading: false,
        isLoadingStages: false,
        isLoadingObjects: false,
        
        // Данные фильтров
        projects: [],
        stages: [],
        objects: [],
        departments: [],
        teams: [],
        specialists: [],
        
        // Выбранные значения
        direction: 'outgoing',
        selectedProjectId: null,
        selectedStageId: null,
        selectedObjectId: null,
        selectedDepartmentId: null,
        selectedTeamId: null,
        selectedSpecialistId: null,
        selectedStatus: null,
        
        // Конфигурация
        config: {},
        
        // Инициализация с конфигурацией
        initialize: (config: FilterConfigs) => {
          console.log('🚀 Инициализация фильтров задач...')
          set({ config })
          
          // Загружаем данные из основного стора модуля
          const taskStore = useTaskTransferStore.getState()
          
          // Преобразуем данные в формат фильтров
          const projects = taskStore.projects.map(p => ({ id: p.id, name: p.name }))
          
          // Получаем отделы и команды из sectionHierarchy для более полного списка
          const departmentsFromHierarchy = new Map<string, FilterOption>()
          const teamsFromHierarchy = new Map<string, FilterOption>()
          
          taskStore.sectionHierarchy.forEach(sh => {
            // Отделы из иерархии разделов
            if (sh.responsible_department_id && sh.responsible_department_name) {
              departmentsFromHierarchy.set(sh.responsible_department_id, {
                id: sh.responsible_department_id,
                name: sh.responsible_department_name
              })
            }
            
            // Команды из иерархии разделов (создаем уникальный ID на основе имени)
            if (sh.responsible_team_name) {
              // Ищем команду по имени в основном списке команд
              const team = taskStore.teams.find(t => t.name === sh.responsible_team_name)
              if (team) {
                teamsFromHierarchy.set(team.id, {
                  id: team.id,
                  name: team.name,
                  departmentId: team.departmentId
                })
              }
            }
          })
          
          // Дополняем данными из основного стора
          taskStore.departments.forEach(d => {
            departmentsFromHierarchy.set(d.id, { id: d.id, name: d.name })
          })
          
          taskStore.teams.forEach(t => {
            teamsFromHierarchy.set(t.id, { 
              id: t.id, 
              name: t.name, 
              departmentId: t.departmentId 
            })
          })
          
          const departments = Array.from(departmentsFromHierarchy.values())
          const teams = Array.from(teamsFromHierarchy.values())
          const specialists = taskStore.specialists.map(s => ({ 
            id: s.id, 
            name: s.name, 
            teamId: s.teamId 
          }))
          
          console.log('📊 Данные фильтров загружены:', {
            projects: projects.length,
            departments: departments.length,
            teams: teams.length,
            specialists: specialists.length
          })
          
          set({ projects, departments, teams, specialists })
        },
        
        // Универсальный метод установки фильтра
        setFilter: (type: string, value: string | null) => {
          console.log(`🔄 setFilter: ${type} = ${value}`)
          const state = get()
          const updates: any = {}
          
          // Устанавливаем значение
          if (type === 'direction') {
            updates.direction = value
          } else if (type === 'status') {
            updates.selectedStatus = value
          } else {
            updates[`selected${type.charAt(0).toUpperCase() + type.slice(1)}Id`] = value
          }
          
          // Обрабатываем зависимости
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
            updates.selectedTeamId = null
            updates.selectedSpecialistId = null
          }
          
          if (type === 'team') {
            updates.selectedSpecialistId = null
          }
          
          console.log(`🔄 Применяю обновления:`, updates)
          set(updates)
        },
        
        // Сброс фильтров
        resetFilters: () => {
          set({
            selectedProjectId: null,
            selectedStageId: null,
            selectedObjectId: null,
            selectedDepartmentId: null,
            selectedTeamId: null,
            selectedSpecialistId: null,
            selectedStatus: null,
            stages: [],
            objects: []
          })
        },
        
        // Фильтрованные данные
        getFilteredStages: () => {
          const state = get()
          if (!state.selectedProjectId) return []
          
          const taskStore = useTaskTransferStore.getState()
          return taskStore.stages
            .filter(s => s.projectId === state.selectedProjectId)
            .map(s => ({ id: s.id, name: s.name, projectId: s.projectId }))
        },
        
        getFilteredObjects: () => {
          const state = get()
          if (!state.selectedStageId) return []
          
          const taskStore = useTaskTransferStore.getState()
          return taskStore.objects
            .filter(o => o.stageId === state.selectedStageId)
            .map(o => ({ id: o.id, name: o.name, stageId: o.stageId }))
        },
        
        getFilteredTeams: () => {
          const state = get()
          if (!state.selectedDepartmentId) return state.teams
          
          return state.teams.filter(t => t.departmentId === state.selectedDepartmentId)
        },
        
        getFilteredSpecialists: () => {
          const state = get()
          if (!state.selectedTeamId) return []
          
          return state.specialists.filter(s => s.teamId === state.selectedTeamId)
        },
        
        // Методы загрузки (используют данные из основного стора)
        loadStages: (projectId: string) => {
          set({ isLoadingStages: true })
          
          const taskStore = useTaskTransferStore.getState()
          const stages = taskStore.stages
            .filter(s => s.projectId === projectId)
            .map(s => ({ id: s.id, name: s.name, projectId: s.projectId }))
          
          set({ stages, isLoadingStages: false })
        },
        
        loadObjects: (stageId: string) => {
          set({ isLoadingObjects: true })
          
          const taskStore = useTaskTransferStore.getState()
          const objects = taskStore.objects
            .filter(o => o.stageId === stageId)
            .map(o => ({ id: o.id, name: o.name, stageId: o.stageId }))
          
          set({ objects, isLoadingObjects: false })
        }
      }),
      {
        name: 'task-transfer-filter-store',
        partialize: (state) => ({
          direction: state.direction,
          selectedProjectId: state.selectedProjectId,
          selectedStageId: state.selectedStageId,
          selectedObjectId: state.selectedObjectId,
          selectedDepartmentId: state.selectedDepartmentId,
          selectedTeamId: state.selectedTeamId,
          selectedSpecialistId: state.selectedSpecialistId,
          selectedStatus: state.selectedStatus
        })
      }
    )
  )
) 