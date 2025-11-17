import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { createClient } from '@/utils/supabase/client'

type Id = string

export interface OrgOption {
  id: Id
  name: string
  departmentId?: Id
  teamId?: Id
}

interface OrgFiltersState {
  isLoading: boolean
  departments: OrgOption[]
  teams: OrgOption[]
  employees: OrgOption[] // id=user_id

  selectedDepartmentId: Id | null
  selectedTeamId: Id | null
  selectedEmployeeId: Id | null

  // Безопасные значения по умолчанию, установленные на основе прав доступа
  defaultDepartmentId: Id | null
  defaultTeamId: Id | null
  defaultEmployeeId: Id | null

  // SECURITY: Список заблокированных фильтров (которые нельзя изменить)
  lockedFilters: Array<'department' | 'team' | 'employee'>

  initialize: () => Promise<void>
  setDepartment: (departmentId: Id | null) => void
  setTeam: (teamId: Id | null) => void
  setEmployee: (employeeId: Id | null) => void

  // Метод для установки безопасных defaults на основе прав доступа
  setSecurityDefaults: (params: {
    defaultDepartmentId?: Id | null
    defaultTeamId?: Id | null
    defaultEmployeeId?: Id | null
    lockedFilters: Array<'department' | 'team' | 'employee'>
  }) => void

  getTeamsForSelectedDepartment: () => OrgOption[]
  getEmployeesFiltered: () => OrgOption[]
}

const supabase = createClient()

export const useReportsOrgFiltersStore = create<OrgFiltersState>()(
  devtools(
    persist(
      (set, get) => ({
        isLoading: false,
        departments: [],
        teams: [],
        employees: [],

        selectedDepartmentId: null,
        selectedTeamId: null,
        selectedEmployeeId: null,

        // Безопасные defaults (не сохраняются в persist, вычисляются при каждой загрузке)
        defaultDepartmentId: null,
        defaultTeamId: null,
        defaultEmployeeId: null,
        lockedFilters: [],

        initialize: async () => {
          // Загружаем отделы/команды и сотрудников параллельно
          set({ isLoading: true })
          try {
            const [orgRes, empRes] = await Promise.all([
              supabase
                .from('view_organizational_structure')
                .select('*')
                .order('department_name'),
              supabase
                .from('view_employee_workloads')
                .select('user_id, full_name, final_team_id, final_department_id')
                .order('full_name')
            ])

            if (orgRes.error) throw orgRes.error
            if (empRes.error) throw empRes.error

            const departmentsMap = new Map<Id, OrgOption>()
            const teamsMap = new Map<Id, OrgOption>()

            orgRes.data?.forEach((row: any) => {
              if (row.department_id && !departmentsMap.has(row.department_id)) {
                departmentsMap.set(row.department_id, {
                  id: row.department_id,
                  name: row.department_name
                })
              }
              if (row.team_id && !teamsMap.has(row.team_id)) {
                teamsMap.set(row.team_id, {
                  id: row.team_id,
                  name: row.team_name,
                  departmentId: row.department_id
                })
              }
            })

            // Дедупликация сотрудников по user_id
            const employeesMap = new Map<Id, OrgOption>()
            ;(empRes.data || []).forEach((row: any) => {
              if (!employeesMap.has(row.user_id)) {
                employeesMap.set(row.user_id, {
                  id: row.user_id as Id,
                  name: row.full_name as string,
                  teamId: row.final_team_id as Id | undefined,
                  departmentId: row.final_department_id as Id | undefined
                })
              }
            })
            const employees = Array.from(employeesMap.values())

            set({
              departments: Array.from(departmentsMap.values()),
              teams: Array.from(teamsMap.values()),
              employees,
              isLoading: false
            })
          } catch (e) {
            console.error('Ошибка инициализации фильтров организации (reports):', e)
            set({ isLoading: false })
          }
        },

        setDepartment: (departmentId) => {
          set({
            selectedDepartmentId: departmentId,
            // При изменении отдела сбрасываем команду и сотрудника
            selectedTeamId: null,
            selectedEmployeeId: null
          })
        },

        setTeam: (teamId) => {
          set({
            selectedTeamId: teamId,
            // При изменении команды сбрасываем сотрудника
            selectedEmployeeId: null
          })
        },

        setEmployee: (employeeId) => {
          set({ selectedEmployeeId: employeeId })
        },

        // Устанавливает безопасные defaults на основе прав доступа
        // Автоматически применяет defaults к locked filters
        setSecurityDefaults: (params) => {
          const state = get()
          set({
            defaultDepartmentId: params.defaultDepartmentId ?? null,
            defaultTeamId: params.defaultTeamId ?? null,
            defaultEmployeeId: params.defaultEmployeeId ?? null,
            lockedFilters: params.lockedFilters,
            // CRITICAL: Применяем locked defaults к текущим selections
            // Это защищает от использования persisted значений, которые нарушают security constraints
            selectedDepartmentId: params.lockedFilters.includes('department')
              ? (params.defaultDepartmentId ?? null)
              : state.selectedDepartmentId,
            selectedTeamId: params.lockedFilters.includes('team')
              ? (params.defaultTeamId ?? null)
              : state.selectedTeamId,
            selectedEmployeeId: params.lockedFilters.includes('employee')
              ? (params.defaultEmployeeId ?? null)
              : state.selectedEmployeeId,
          })
        },

        getTeamsForSelectedDepartment: () => {
          const { teams, selectedDepartmentId } = get()
          if (!selectedDepartmentId) return teams
          return teams.filter(t => t.departmentId === selectedDepartmentId)
        },

        getEmployeesFiltered: () => {
          const { employees, selectedDepartmentId, selectedTeamId } = get()
          let result = employees
          if (selectedDepartmentId) {
            result = result.filter(e => e.departmentId === selectedDepartmentId)
          }
          if (selectedTeamId) {
            result = result.filter(e => e.teamId === selectedTeamId)
          }
          return result
        }
      }),
      {
        name: 'reports-org-filters',
        partialize: (state) => ({
          selectedDepartmentId: state.selectedDepartmentId,
          selectedTeamId: state.selectedTeamId,
          selectedEmployeeId: state.selectedEmployeeId
        })
      }
    )
  )
)

