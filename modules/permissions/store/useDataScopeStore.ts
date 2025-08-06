import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { DataScope, FilterConstraint } from '../types'
import { getUserDataScope, isDataLocked } from '../utils/permissionUtils'
import { usePermissionsStore } from './usePermissionsStore'

interface DataScopeState {
  // Состояние
  dataScope: DataScope
  availableProjects: any[]
  availableDepartments: any[]
  availableTeams: any[]
  availableUsers: any[]
  lockedFilters: string[]
  isLoading: boolean
  error: string | null
  
  // Методы
  setDataScope: (scope: DataScope) => void
  setAvailableData: (type: keyof DataScopeState, data: any[]) => void
  setLockedFilters: (filters: string[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  
  // Загрузка данных
  loadAvailableProjects: () => Promise<any[]>
  loadAvailableDepartments: () => Promise<any[]>
  loadAvailableTeams: () => Promise<any[]>
  loadAvailableUsers: () => Promise<any[]>
  
  // Проверки ограничений
  isDataTypeLocked: (dataType: keyof DataScope) => boolean
  getFilterConstraint: (filterType: string) => FilterConstraint
  
  // Обновление на основе разрешений
  updateFromPermissions: () => void
}

const initialDataScope: DataScope = {
  projects: 'participated',
  departments: 'own',
  teams: 'own',
  users: 'self'
}

export const useDataScopeStore = create<DataScopeState>()(
  devtools(
    (set, get) => ({
      // Начальное состояние
      dataScope: initialDataScope,
      availableProjects: [],
      availableDepartments: [],
      availableTeams: [],
      availableUsers: [],
      lockedFilters: [],
      isLoading: false,
      error: null,
      
      // Сеттеры
      setDataScope: (scope: DataScope) => {
        set({ dataScope: scope })
      },
      
      setAvailableData: (type: keyof DataScopeState, data: any[]) => {
        set({ [type]: data } as any)
      },
      
      setLockedFilters: (filters: string[]) => {
        set({ lockedFilters: filters })
      },
      
      setLoading: (loading: boolean) => {
        set({ isLoading: loading })
      },
      
      setError: (error: string | null) => {
        set({ error })
      },
      
      // Загрузка доступных данных
      loadAvailableProjects: async () => {
        const { dataScope } = get()
        
        try {
          // TODO: Реализовать через Supabase с учетом dataScope
          const projects: any[] = []
          
          set({ availableProjects: projects })
          return projects
        } catch (error) {
          console.error('Ошибка загрузки проектов:', error)
          set({ error: 'Ошибка загрузки проектов' })
          return []
        }
      },
      
      loadAvailableDepartments: async () => {
        const { dataScope } = get()
        
        try {
          // TODO: Реализовать через Supabase с учетом dataScope
          const departments: any[] = []
          
          set({ availableDepartments: departments })
          return departments
        } catch (error) {
          console.error('Ошибка загрузки отделов:', error)
          set({ error: 'Ошибка загрузки отделов' })
          return []
        }
      },
      
      loadAvailableTeams: async () => {
        const { dataScope } = get()
        
        try {
          // TODO: Реализовать через Supabase с учетом dataScope
          const teams: any[] = []
          
          set({ availableTeams: teams })
          return teams
        } catch (error) {
          console.error('Ошибка загрузки команд:', error)
          set({ error: 'Ошибка загрузки команд' })
          return []
        }
      },
      
      loadAvailableUsers: async () => {
        const { dataScope } = get()
        
        try {
          // TODO: Реализовать через Supabase с учетом dataScope
          const users: any[] = []
          
          set({ availableUsers: users })
          return users
        } catch (error) {
          console.error('Ошибка загрузки пользователей:', error)
          set({ error: 'Ошибка загрузки пользователей' })
          return []
        }
      },
      
      // Проверки ограничений
      isDataTypeLocked: (dataType: keyof DataScope) => {
        const { dataScope } = get()
        
        switch (dataType) {
          case 'departments':
            return dataScope.departments === 'own'
          case 'teams':
            return dataScope.teams === 'own'
          case 'projects':
            return dataScope.projects !== 'all'
          case 'users':
            return dataScope.users === 'self'
          default:
            return false
        }
      },
      
      getFilterConstraint: (filterType: string): FilterConstraint => {
        const state = get()
        
        switch (filterType) {
          case 'project':
            return {
              filterType,
              isLocked: state.isDataTypeLocked('projects'),
              availableOptions: state.availableProjects,
              defaultValue: state.availableProjects.length === 1 ? state.availableProjects[0].id : undefined
            }
          case 'department':
            return {
              filterType,
              isLocked: state.isDataTypeLocked('departments'),
              availableOptions: state.availableDepartments,
              defaultValue: state.availableDepartments.length === 1 ? state.availableDepartments[0].id : undefined
            }
          case 'team':
            return {
              filterType,
              isLocked: state.isDataTypeLocked('teams'),
              availableOptions: state.availableTeams,
              defaultValue: state.availableTeams.length === 1 ? state.availableTeams[0].id : undefined
            }
          case 'user':
            return {
              filterType,
              isLocked: state.isDataTypeLocked('users'),
              availableOptions: state.availableUsers,
              defaultValue: state.availableUsers.length === 1 ? state.availableUsers[0].id : undefined
            }
          default:
            return {
              filterType,
              isLocked: false,
              availableOptions: []
            }
        }
      },
      
      // Обновление на основе разрешений
      updateFromPermissions: () => {
        const permissionsState = usePermissionsStore.getState()
        const { constraints } = permissionsState
        
        const newDataScope = getUserDataScope(constraints)
        const newLockedFilters: string[] = []
        
        // Определяем заблокированные фильтры
        if (isDataLocked(constraints, 'departments')) {
          newLockedFilters.push('department')
        }
        if (isDataLocked(constraints, 'teams')) {
          newLockedFilters.push('team')
        }
        if (isDataLocked(constraints, 'projects')) {
          newLockedFilters.push('project')
        }
        if (isDataLocked(constraints, 'users')) {
          newLockedFilters.push('user')
        }
        
        set({
          dataScope: newDataScope,
          lockedFilters: newLockedFilters
        })
      }
    }),
    {
      name: 'data-scope-store'
    }
  )
)

// Селекторы для оптимизации
export const useDataScope = () => useDataScopeStore(state => state.dataScope)
export const useAvailableProjects = () => useDataScopeStore(state => state.availableProjects)
export const useAvailableDepartments = () => useDataScopeStore(state => state.availableDepartments)
export const useAvailableTeams = () => useDataScopeStore(state => state.availableTeams)
export const useLockedFilters = () => useDataScopeStore(state => state.lockedFilters)
export const useIsDataLocked = (dataType: keyof DataScope) => 
  useDataScopeStore(state => state.isDataTypeLocked(dataType)) 