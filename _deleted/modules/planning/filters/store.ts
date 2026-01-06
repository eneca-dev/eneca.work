import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase-client'
import { useUserStore } from '@/stores/useUserStore'
import { toast } from 'sonner'
import type { FilterStore, FilterOption, FilterConfigs, FilterType } from './types'
import type { Department, Team, Employee } from '../types'

// Вспомогательная функция для валидации ID
function validateId(id: string | null, options: FilterOption[]): string | null {
  if (!id) return null
  const exists = options.some(opt => opt.id === id)
  if (!exists) {
    console.warn(`⚠️ Фильтр с ID "${id}" не найден в справочнике, сбрасываю`)
  }
  return exists ? id : null
}

// Счётчики версий для предотвращения race conditions
let projectsLoadVersion = 0
let stagesLoadVersion = 0
let objectsLoadVersion = 0
let subdivisionsLoadVersion = 0
let departmentsLoadVersion = 0
let employeesLoadVersion = 0

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
        initialize: async (config: FilterConfigs) => {
          set({ config })

          // Загружаем базовые данные и ждём завершения
          await Promise.all([
            get().loadSubdivisions(),
            get().loadManagers(),
            get().loadDepartments(),
            get().loadEmployees()
          ])

          // Валидируем сохраненные ID после загрузки справочников
          const state = get()
          const validatedUpdates: Partial<Record<
            'selectedSubdivisionId' | 'selectedDepartmentId' | 'selectedTeamId' |
            'selectedEmployeeId' | 'selectedManagerId' | 'selectedProjectId' |
            'selectedStageId' | 'selectedObjectId',
            string | null
          >> = {}

          // Валидация организационных фильтров
          const validSubdivisionId = validateId(state.selectedSubdivisionId, state.subdivisions)
          if (validSubdivisionId !== state.selectedSubdivisionId) {
            validatedUpdates.selectedSubdivisionId = validSubdivisionId
            validatedUpdates.selectedDepartmentId = null
            validatedUpdates.selectedTeamId = null
            validatedUpdates.selectedEmployeeId = null
          }

          const validDepartmentId = validateId(state.selectedDepartmentId, state.departments)
          if (validDepartmentId !== state.selectedDepartmentId) {
            validatedUpdates.selectedDepartmentId = validDepartmentId
            validatedUpdates.selectedTeamId = null
            validatedUpdates.selectedEmployeeId = null
          }

          const validTeamId = validateId(state.selectedTeamId, state.teams)
          if (validTeamId !== state.selectedTeamId) {
            validatedUpdates.selectedTeamId = validTeamId
            validatedUpdates.selectedEmployeeId = null
          }

          const validEmployeeId = validateId(state.selectedEmployeeId, state.employees)
          if (validEmployeeId !== state.selectedEmployeeId) {
            validatedUpdates.selectedEmployeeId = validEmployeeId
          }

          // Валидация проектных фильтров
          const validManagerId = validateId(state.selectedManagerId, state.managers)
          if (validManagerId !== state.selectedManagerId) {
            validatedUpdates.selectedManagerId = validManagerId
            validatedUpdates.selectedProjectId = null
            validatedUpdates.selectedStageId = null
            validatedUpdates.selectedObjectId = null
          }

          // Применяем валидированные значения
          if (Object.keys(validatedUpdates).length > 0) {
            console.log('🔄 Применяю валидированные фильтры:', validatedUpdates)
            set(validatedUpdates)
          }

          // Восстанавливаем зависимые данные для валидных сохраненных фильтров
          const updatedState = get()

          // Если есть валидный менеджер, загружаем его проекты
          if (updatedState.selectedManagerId) {
            await get().loadProjects(updatedState.selectedManagerId)

            // Валидируем projectId после загрузки проектов
            const projectState = get()
            const validProjectId = validateId(projectState.selectedProjectId, projectState.projects)
            if (validProjectId !== projectState.selectedProjectId) {
              set({
                selectedProjectId: validProjectId,
                selectedStageId: null,
                selectedObjectId: null
              })
            }
          }

          // Если есть валидный проект, загружаем его стадии
          const projectState = get()
          if (projectState.selectedProjectId) {
            await get().loadStages(projectState.selectedProjectId)

            // Валидируем stageId после загрузки стадий
            const stageState = get()
            const validStageId = validateId(stageState.selectedStageId, stageState.stages)
            if (validStageId !== stageState.selectedStageId) {
              set({
                selectedStageId: validStageId,
                selectedObjectId: null
              })
            }
          }

          // Если есть валидная стадия, загружаем её объекты
          const stageState = get()
          if (stageState.selectedStageId) {
            await get().loadObjects(stageState.selectedStageId)

            // Валидируем objectId после загрузки объектов
            const objectState = get()
            const validObjectId = validateId(objectState.selectedObjectId, objectState.objects)
            if (validObjectId !== objectState.selectedObjectId) {
              set({ selectedObjectId: validObjectId })
            }
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
          const updates: Record<string, string | null> = {}

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

          // Subdivision → Department → Team → Employee (каскад вниз)
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
            // Сбрасываем сотрудника при изменении команды
            console.log(`🔄 Сбрасываю сотрудника при изменении команды`)
            updates.selectedEmployeeId = null

            // Каскад вверх: заполняем отдел из данных команды
            if (value) {
              const team = state.teams.find(t => t.id === value)
              if (team?.departmentId && !state.isFilterLocked('department')) {
                console.log(`⬆️ Каскад вверх: устанавливаю отдел ${team.departmentId} из команды`)
                updates.selectedDepartmentId = team.departmentId

                // Также заполняем подразделение из данных отдела
                const dept = state.departments.find(d => d.id === team.departmentId)
                if (dept?.subdivisionId && !state.isFilterLocked('subdivision')) {
                  console.log(`⬆️ Каскад вверх: устанавливаю подразделение ${dept.subdivisionId} из отдела`)
                  updates.selectedSubdivisionId = dept.subdivisionId
                }
              }
            }
          }

          // Каскад вверх при выборе сотрудника
          if (type === 'employee' && value) {
            const employee = state.employees.find(e => e.id === value)
            if (employee) {
              // Заполняем команду из данных сотрудника
              if (employee.teamId && !state.isFilterLocked('team')) {
                console.log(`⬆️ Каскад вверх: устанавливаю команду ${employee.teamId} из сотрудника`)
                updates.selectedTeamId = employee.teamId
              }

              // Заполняем отдел из данных сотрудника
              if (employee.departmentId && !state.isFilterLocked('department')) {
                console.log(`⬆️ Каскад вверх: устанавливаю отдел ${employee.departmentId} из сотрудника`)
                updates.selectedDepartmentId = employee.departmentId

                // Также заполняем подразделение из данных отдела
                const dept = state.departments.find(d => d.id === employee.departmentId)
                if (dept?.subdivisionId && !state.isFilterLocked('subdivision')) {
                  console.log(`⬆️ Каскад вверх: устанавливаю подразделение ${dept.subdivisionId} из отдела`)
                  updates.selectedSubdivisionId = dept.subdivisionId
                }
              }
            }
          }

          console.log(`🔄 Применяю обновления:`, updates)
          set(updates)
        },
        
        // Сброс фильтров
        resetFilters: () => {
          console.log('🔄 resetFilters: сброс фильтров')

          const state = get()
          const isLocked = (t: FilterType) => Boolean(state.lockedFilters && state.lockedFilters.includes(t))

          // Определяем что сбрасывать с учётом блокировок
          const newSubdivisionId = isLocked('subdivision') ? state.selectedSubdivisionId : null
          const newDepartmentId = isLocked('department') ? state.selectedDepartmentId : null
          const newTeamId = isLocked('team') ? state.selectedTeamId : null
          const newManagerId = isLocked('manager') ? state.selectedManagerId : null

          // Если менеджер заблокирован - сохраняем его проекты, иначе очищаем
          const keepProjects = isLocked('manager') && state.selectedManagerId

          set({
            // Организационные фильтры
            selectedSubdivisionId: newSubdivisionId,
            selectedDepartmentId: newDepartmentId,
            selectedTeamId: newTeamId,
            selectedEmployeeId: null,

            // Проектные фильтры
            selectedManagerId: newManagerId,
            selectedProjectId: null,
            selectedStageId: null,
            selectedObjectId: null,

            // Массивы данных - очищаем только зависимые от сброшенных фильтров
            projects: keepProjects ? state.projects : [],
            stages: [],
            objects: []
          })

          console.log('🔄 resetFilters: завершено', {
            subdivision: newSubdivisionId,
            department: newDepartmentId,
            team: newTeamId,
            manager: newManagerId,
            keepProjects
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
          return state.departments.filter(d => d.subdivisionId === state.selectedSubdivisionId)
        },

        getFilteredEmployees: () => {
          const state = get()
          let filtered = state.employees

          // Priority: team > department > subdivision
          if (state.selectedTeamId) {
            filtered = filtered.filter(e => e.teamId === state.selectedTeamId)
          } else if (state.selectedDepartmentId) {
            filtered = filtered.filter(e => e.departmentId === state.selectedDepartmentId)
          } else if (state.selectedSubdivisionId) {
            // Get all departments in this subdivision
            const deptIds = new Set(
              state.departments
                .filter(d => d.subdivisionId === state.selectedSubdivisionId)
                .map(d => d.id)
            )
            // Filter employees by those departments
            filtered = filtered.filter(e => e.departmentId && deptIds.has(e.departmentId))
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
              .filter(d => d.subdivisionId === state.selectedSubdivisionId)
              .map(d => d.id)
            return state.teams.filter(t => t.departmentId && deptIds.includes(t.departmentId))
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
            toast.error('Не удалось загрузить менеджеров')
          }
        },

        loadProjects: async (managerId?: string | null) => {
          // Инкрементируем версию и сохраняем текущую
          const currentVersion = ++projectsLoadVersion
          console.log(`📂 loadProjects v${currentVersion}: начало загрузки для менеджера ${managerId || 'все'}`)

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

            // Проверяем, что версия всё ещё актуальна
            if (currentVersion !== projectsLoadVersion) {
              console.log(`📂 loadProjects v${currentVersion}: устарело (текущая v${projectsLoadVersion}), игнорирую результат`)
              return
            }

            const projects = data?.map(p => ({
              id: p.project_id,
              name: p.project_name,
              managerId: p.project_manager
            })) || []

            console.log(`📂 loadProjects v${currentVersion}: загружено ${projects.length} проектов`)
            set({ projects: projects as FilterOption[], isLoadingProjects: false })
          } catch (error) {
            console.error('Ошибка загрузки проектов:', error)
            // Проверяем версию перед обновлением состояния ошибки
            if (currentVersion === projectsLoadVersion) {
              set({ isLoadingProjects: false })
              toast.error('Не удалось загрузить проекты')
            }
          }
        },

        loadStages: async (projectId: string) => {
          // Инкрементируем версию и сохраняем текущую
          const currentVersion = ++stagesLoadVersion
          console.log(`📋 loadStages v${currentVersion}: начало загрузки для проекта ${projectId}`)

          set({ isLoadingStages: true })
          try {
            const { data, error } = await supabase
              .from('stages')
              .select('stage_id, stage_name, stage_project_id')
              .eq('stage_project_id', projectId)
              .order('stage_name')

            if (error) throw error

            // Проверяем, что версия всё ещё актуальна
            if (currentVersion !== stagesLoadVersion) {
              console.log(`📋 loadStages v${currentVersion}: устарело (текущая v${stagesLoadVersion}), игнорирую результат`)
              return
            }

            const stages = data?.map(s => ({
              id: s.stage_id,
              name: s.stage_name
            })) || []

            console.log(`📋 loadStages v${currentVersion}: загружено ${stages.length} стадий`)
            set({ stages, isLoadingStages: false })
          } catch (error) {
            console.error('Ошибка загрузки этапов:', error)
            if (currentVersion === stagesLoadVersion) {
              set({ isLoadingStages: false })
              toast.error('Не удалось загрузить стадии')
            }
          }
        },

        loadObjects: async (stageId: string) => {
          // Инкрементируем версию и сохраняем текущую
          const currentVersion = ++objectsLoadVersion
          console.log(`📦 loadObjects v${currentVersion}: начало загрузки для стадии ${stageId}`)

          set({ isLoadingObjects: true })
          try {
            const { data, error } = await supabase
              .from('objects')
              .select('object_id, object_name, object_stage_id')
              .eq('object_stage_id', stageId)
              .order('object_name')

            if (error) throw error

            // Проверяем, что версия всё ещё актуальна
            if (currentVersion !== objectsLoadVersion) {
              console.log(`📦 loadObjects v${currentVersion}: устарело (текущая v${objectsLoadVersion}), игнорирую результат`)
              return
            }

            const objects = data?.map(o => ({
              id: o.object_id,
              name: o.object_name
            })) || []

            console.log(`📦 loadObjects v${currentVersion}: загружено ${objects.length} объектов`)
            set({ objects, isLoadingObjects: false })
          } catch (error) {
            console.error('Ошибка загрузки объектов:', error)
            if (currentVersion === objectsLoadVersion) {
              set({ isLoadingObjects: false })
              toast.error('Не удалось загрузить объекты')
            }
          }
        },

        loadSubdivisions: async () => {
          const currentVersion = ++subdivisionsLoadVersion
          console.log(`🏢 loadSubdivisions v${currentVersion}: начало загрузки`)

          try {
            const { data, error } = await supabase
              .from('view_subdivisions_with_heads')
              .select('subdivision_id, subdivision_name')
              .order('subdivision_name')

            if (error) throw error

            if (currentVersion !== subdivisionsLoadVersion) {
              console.log(`🏢 loadSubdivisions v${currentVersion}: устарело, игнорирую`)
              return
            }

            const subdivisions = data?.map(s => ({
              id: s.subdivision_id,
              name: s.subdivision_name
            })) || []

            console.log(`🏢 loadSubdivisions v${currentVersion}: загружено ${subdivisions.length} подразделений`)
            set({ subdivisions: subdivisions as FilterOption[] })
          } catch (error) {
            console.error('Ошибка загрузки подразделений:', error)
            toast.error('Не удалось загрузить подразделения')
          }
        },

        loadDepartments: async () => {
          const currentVersion = ++departmentsLoadVersion
          console.log(`🏬 loadDepartments v${currentVersion}: начало загрузки`)

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

            if (currentVersion !== departmentsLoadVersion) {
              console.log(`🏬 loadDepartments v${currentVersion}: устарело, игнорирую`)
              return
            }

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

            console.log(`🏬 loadDepartments v${currentVersion}: загружено ${departmentsMap.size} отделов, ${teamsMap.size} команд`)
            set({
              departments: Array.from(departmentsMap.values()),
              teams: Array.from(teamsMap.values())
            })
          } catch (error) {
            console.error('Ошибка загрузки отделов:', error)
            toast.error('Не удалось загрузить отделы')
          }
        },

        loadTeams: async () => {
          // Команды уже загружены в loadDepartments
        },

        loadEmployees: async () => {
          const currentVersion = ++employeesLoadVersion
          console.log(`👥 loadEmployees v${currentVersion}: начало загрузки`)

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

            if (currentVersion !== employeesLoadVersion) {
              console.log(`👥 loadEmployees v${currentVersion}: устарело, игнорирую`)
              return
            }

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
            
            console.log(`👥 loadEmployees v${currentVersion}: загружено ${employeesMap.size} сотрудников`)
            set({ employees: Array.from(employeesMap.values()) })
          } catch (error) {
            console.error('Ошибка загрузки сотрудников:', error)
            toast.error('Не удалось загрузить сотрудников')
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
        }),
        onRehydrateStorage: () => (state) => {
          if (!state) return

          // Запускаем валидацию после восстановления из localStorage
          console.log('🔄 Восстановление фильтров из localStorage, запускаю валидацию...')

          // Асинхронно загружаем справочники и валидируем
          const validateAfterRehydration = async () => {
            const store = useFilterStore.getState()

            // Загружаем все справочники
            await Promise.all([
              store.loadSubdivisions(),
              store.loadManagers(),
              store.loadDepartments(),
              store.loadEmployees()
            ])

            // Получаем обновленное состояние после загрузки
            const currentState = useFilterStore.getState()
            const updates: Record<string, string | null> = {}

            // Валидация организационных фильтров
            if (currentState.selectedSubdivisionId) {
              const valid = currentState.subdivisions.some(s => s.id === currentState.selectedSubdivisionId)
              if (!valid) {
                console.warn(`⚠️ Подразделение "${currentState.selectedSubdivisionId}" не найдено, сбрасываю`)
                updates.selectedSubdivisionId = null
                updates.selectedDepartmentId = null
                updates.selectedTeamId = null
                updates.selectedEmployeeId = null
              }
            }

            if (currentState.selectedDepartmentId && !updates.selectedDepartmentId) {
              const valid = currentState.departments.some(d => d.id === currentState.selectedDepartmentId)
              if (!valid) {
                console.warn(`⚠️ Отдел "${currentState.selectedDepartmentId}" не найден, сбрасываю`)
                updates.selectedDepartmentId = null
                updates.selectedTeamId = null
                updates.selectedEmployeeId = null
              }
            }

            if (currentState.selectedTeamId && !updates.selectedTeamId) {
              const valid = currentState.teams.some(t => t.id === currentState.selectedTeamId)
              if (!valid) {
                console.warn(`⚠️ Команда "${currentState.selectedTeamId}" не найдена, сбрасываю`)
                updates.selectedTeamId = null
                updates.selectedEmployeeId = null
              }
            }

            if (currentState.selectedEmployeeId && !updates.selectedEmployeeId) {
              const valid = currentState.employees.some(e => e.id === currentState.selectedEmployeeId)
              if (!valid) {
                console.warn(`⚠️ Сотрудник "${currentState.selectedEmployeeId}" не найден, сбрасываю`)
                updates.selectedEmployeeId = null
              }
            }

            // Валидация проектных фильтров
            if (currentState.selectedManagerId) {
              const valid = currentState.managers.some(m => m.id === currentState.selectedManagerId)
              if (!valid) {
                console.warn(`⚠️ Менеджер "${currentState.selectedManagerId}" не найден, сбрасываю`)
                updates.selectedManagerId = null
                updates.selectedProjectId = null
                updates.selectedStageId = null
                updates.selectedObjectId = null
              }
            }

            // Применяем обновления если есть
            if (Object.keys(updates).length > 0) {
              console.log('🔄 Применяю валидированные фильтры после rehydration:', updates)
              useFilterStore.setState(updates)
            }

            // Загружаем зависимые данные для валидных фильтров
            const finalState = useFilterStore.getState()

            if (finalState.selectedManagerId) {
              await store.loadProjects(finalState.selectedManagerId)

              // Валидируем проект
              const afterProjects = useFilterStore.getState()
              if (afterProjects.selectedProjectId) {
                const validProject = afterProjects.projects.some(p => p.id === afterProjects.selectedProjectId)
                if (!validProject) {
                  console.warn(`⚠️ Проект "${afterProjects.selectedProjectId}" не найден, сбрасываю`)
                  useFilterStore.setState({
                    selectedProjectId: null,
                    selectedStageId: null,
                    selectedObjectId: null
                  })
                }
              }
            }

            const afterProjectValidation = useFilterStore.getState()
            if (afterProjectValidation.selectedProjectId) {
              await store.loadStages(afterProjectValidation.selectedProjectId)

              // Валидируем стадию
              const afterStages = useFilterStore.getState()
              if (afterStages.selectedStageId) {
                const validStage = afterStages.stages.some(s => s.id === afterStages.selectedStageId)
                if (!validStage) {
                  console.warn(`⚠️ Стадия "${afterStages.selectedStageId}" не найдена, сбрасываю`)
                  useFilterStore.setState({
                    selectedStageId: null,
                    selectedObjectId: null
                  })
                }
              }
            }

            const afterStageValidation = useFilterStore.getState()
            if (afterStageValidation.selectedStageId) {
              await store.loadObjects(afterStageValidation.selectedStageId)

              // Валидируем объект
              const afterObjects = useFilterStore.getState()
              if (afterObjects.selectedObjectId) {
                const validObject = afterObjects.objects.some(o => o.id === afterObjects.selectedObjectId)
                if (!validObject) {
                  console.warn(`⚠️ Объект "${afterObjects.selectedObjectId}" не найден, сбрасываю`)
                  useFilterStore.setState({ selectedObjectId: null })
                }
              }
            }

            console.log('✅ Валидация фильтров после rehydration завершена')
          }

          // setTimeout гарантирует что store уже создан к моменту вызова
          setTimeout(() => validateAfterRehydration().catch(console.error), 0)
        }
      }
    )
  )
) 