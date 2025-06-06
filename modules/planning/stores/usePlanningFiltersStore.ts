import { create } from "zustand"
import { devtools, persist } from "zustand/middleware"
import { supabase } from "@/lib/supabase-client"
import type { Department, Team, Employee } from "../types"
import { useUserStore } from "@/stores/useUserStore"

// Интерфейсы для фильтров
export interface Project {
  id: string
  name: string
}

export interface Manager {
  id: string
  name: string
  avatarUrl?: string | null
  projectsCount?: number
}

interface PlanningFiltersState {
  // Доступные проекты, отделы, команды, менеджеры и сотрудники
  availableProjects: Project[]
  availableDepartments: Department[]
  availableTeams: Team[]
  availableManagers: Manager[]
  availableEmployees: Employee[]
  managerProjects: Project[]
  isLoading: boolean
  isLoadingManagerProjects: boolean
  isFilterPanelOpen: boolean

  // Выбранные фильтры
  selectedProjectId: string | null
  selectedDepartmentId: string | null
  selectedTeamId: string | null
  selectedManagerId: string | null
  selectedEmployeeId: string | null

  // Контроллер для отмены запросов
  abortController: AbortController | null

  // Действия
  fetchFilterOptions: () => Promise<void>
  setSelectedProject: (projectId: string | null) => void
  setSelectedDepartment: (departmentId: string | null) => void
  setSelectedTeam: (teamId: string | null) => void
  setSelectedManager: (managerId: string | null) => void
  setSelectedEmployee: (employeeId: string | null) => void
  resetFilters: () => void
  toggleFilterPanel: () => void
  getFilteredProjects: () => Project[]
  getFilteredEmployees: () => Employee[]
  fetchManagerProjects: (managerId: string) => Promise<void>
  applyPermissionBasedFilters: () => void
  isFilterLocked: (filterType: 'project' | 'department' | 'team' | 'manager' | 'employee') => boolean
  getActivePermission: () => string | null
}

export const usePlanningFiltersStore = create<PlanningFiltersState>()(
  devtools(
    persist(
      (set, get) => ({
        // Начальное состояние
        availableProjects: [],
        availableDepartments: [],
        availableTeams: [],
        availableManagers: [],
        availableEmployees: [],
        managerProjects: [],
        isLoading: false,
        isLoadingManagerProjects: false,
        isFilterPanelOpen: false,
        selectedProjectId: null,
        selectedDepartmentId: null,
        selectedTeamId: null,
        selectedManagerId: null,
        selectedEmployeeId: null,
        abortController: null,

        // Загрузка опций фильтров из базы данных (параллельно)
        fetchFilterOptions: async () => {
          set({ isLoading: true })
          try {
            // Выполняем все запросы параллельно
            const [projectsResult, managersResult, orgStructureResult, employeesResult] = await Promise.allSettled([
              supabase
                .from("projects")
                .select("project_id, project_name")
                .eq("project_status", "active")
                .order("project_name"),
              
              supabase
                .from("view_manager_projects")
                .select("manager_id, manager_name")
                .order("manager_name"),
              
              supabase
                .from("view_organizational_structure")
                .select("*")
                .order("department_name, team_name"),

              supabase
                .from("view_employee_workloads")
                .select(`
                  user_id,
                  full_name,
                  first_name,
                  last_name,
                  email,
                  avatar_url,
                  final_team_id,
                  final_team_name,
                  final_department_id,
                  final_department_name,
                  position_name,
                  employment_rate
                `)
                .order("full_name")
            ])

            // Обрабатываем результаты проектов
            let projects: Project[] = []
            if (projectsResult.status === 'fulfilled' && !projectsResult.value.error) {
              projects = projectsResult.value.data?.map((project) => ({
                id: project.project_id,
                name: project.project_name,
              })) || []
            } else if (projectsResult.status === 'rejected' || projectsResult.value.error) {
              console.error("Ошибка при загрузке проектов:", projectsResult.status === 'rejected' ? projectsResult.reason : projectsResult.value.error)
            }

            // Обрабатываем результаты менеджеров
            let managers: Manager[] = []
            if (managersResult.status === 'fulfilled' && !managersResult.value.error) {
              // Группируем менеджеров и считаем количество проектов
              const managerMap = new Map<string, { name: string; projectsCount: number }>()
              
              managersResult.value.data?.forEach((row) => {
                const managerId = row.manager_id
                const managerName = row.manager_name
                
                if (managerMap.has(managerId)) {
                  managerMap.get(managerId)!.projectsCount += 1
                } else {
                  managerMap.set(managerId, {
                    name: managerName,
                    projectsCount: 1
                  })
                }
              })
              
              managers = Array.from(managerMap.entries()).map(([id, data]) => ({
                id,
                name: data.name,
                projectsCount: data.projectsCount,
              }))
            } else if (managersResult.status === 'rejected' || managersResult.value.error) {
              console.error("Ошибка при загрузке менеджеров:", managersResult.status === 'rejected' ? managersResult.reason : managersResult.value.error)
            }

            // Обрабатываем результаты организационной структуры
            let departments: Department[] = []
            let teams: Team[] = []
            
            if (orgStructureResult.status === 'fulfilled' && !orgStructureResult.value.error) {
              const departmentsMap = new Map<string, Department>()
              const teamsMap = new Map<string, Team>()
              
              orgStructureResult.value.data?.forEach((item) => {
                // Создаем или обновляем отдел
                if (!departmentsMap.has(item.department_id)) {
                  departmentsMap.set(item.department_id, {
                    id: item.department_id,
                    name: item.department_name,
                    totalEmployees: item.department_employee_count || 0,
                    teams: [],
                    dailyWorkloads: {},
                    // Добавляем информацию о руководителе отдела
                    departmentHeadId: item.department_head_id,
                    departmentHeadName: item.department_head_full_name,
                    departmentHeadEmail: item.department_head_email,
                    departmentHeadAvatarUrl: item.department_head_avatar_url,
                    managerName: item.department_head_full_name, // Для обратной совместимости
                  })
                }

                // Создаем или обновляем команду, если она есть
                if (item.team_id) {
                  const teamKey = `${item.department_id}-${item.team_id}`
                  if (!teamsMap.has(teamKey)) {
                    teamsMap.set(teamKey, {
                      id: item.team_id,
                      name: item.team_name,
                      code: "",
                      departmentId: item.department_id,
                      departmentName: item.department_name,
                      totalEmployees: item.team_employee_count || 0,
                      employees: [],
                      dailyWorkloads: {},
                      // Добавляем информацию о руководителе команды
                      teamLeadId: item.team_lead_id,
                      teamLeadName: item.team_lead_full_name,
                      teamLeadEmail: item.team_lead_email,
                      teamLeadAvatarUrl: item.team_lead_avatar_url,
                    })
                  }
                }
              })

              departments = Array.from(departmentsMap.values())
              teams = Array.from(teamsMap.values())
            } else if (orgStructureResult.status === 'rejected' || orgStructureResult.value.error) {
              console.error("Ошибка при загрузке организационной структуры:", orgStructureResult.status === 'rejected' ? orgStructureResult.reason : orgStructureResult.value.error)
            }

            // Обрабатываем результаты сотрудников
            let employees: Employee[] = []
            if (employeesResult.status === 'fulfilled' && !employeesResult.value.error) {
              employees = employeesResult.value.data?.map((emp) => ({
                id: emp.user_id,
                name: emp.full_name,
                fullName: emp.full_name,
                firstName: emp.first_name,
                lastName: emp.last_name,
                email: emp.email,
                avatarUrl: emp.avatar_url,
                teamId: emp.final_team_id,
                teamName: emp.final_team_name,
                departmentId: emp.final_department_id,
                departmentName: emp.final_department_name,
                position: emp.position_name,
                employmentRate: emp.employment_rate,
                workload: 0, // Будет рассчитано позже
                dailyWorkloads: {},
              })) || []
            } else if (employeesResult.status === 'rejected' || employeesResult.value.error) {
              console.error("Ошибка при загрузке сотрудников:", employeesResult.status === 'rejected' ? employeesResult.reason : employeesResult.value.error)
            }

            set({
              availableProjects: projects,
              availableManagers: managers,
              availableDepartments: departments,
              availableTeams: teams,
              availableEmployees: employees,
              isLoading: false,
            })

            // Применяем фильтры на основе разрешений после загрузки данных
            get().applyPermissionBasedFilters()
          } catch (error) {
            console.error("Ошибка при загрузке опций фильтров:", error)
            set({ isLoading: false })
          }
        },

        // Установка выбранного проекта
        setSelectedProject: (projectId) => {
          if (get().isFilterLocked('project')) {
            console.warn("🔒 Изменение фильтра проекта заблокировано разрешениями пользователя");
            return;
          }
          set({ selectedProjectId: projectId })
        },

        // Установка выбранного отдела
        setSelectedDepartment: (departmentId) => {
          if (get().isFilterLocked('department')) {
            console.warn("🔒 Изменение фильтра отдела заблокировано разрешениями пользователя");
            return;
          }
          set({
            selectedDepartmentId: departmentId,
            selectedTeamId: null,
            selectedEmployeeId: null,
          })
        },

        // Установка выбранной команды
        setSelectedTeam: (teamId) => {
          if (get().isFilterLocked('team')) {
            console.warn("🔒 Изменение фильтра команды заблокировано разрешениями пользователя");
            return;
          }
          set({ 
            selectedTeamId: teamId,
            selectedEmployeeId: null,
          })
        },

        // Установка выбранного сотрудника
        setSelectedEmployee: (employeeId) => {
          if (get().isFilterLocked('employee')) {
            console.warn("🔒 Изменение фильтра сотрудника заблокировано разрешениями пользователя");
            return;
          }
          set({ selectedEmployeeId: employeeId })
        },

        // Установка выбранного менеджера с механизмом отмены
        setSelectedManager: async (managerId) => {
          if (get().isFilterLocked('manager')) {
            console.warn("🔒 Изменение фильтра менеджера заблокировано разрешениями пользователя");
            return;
          }

          // Отменяем предыдущий запрос, если он есть
          const currentController = get().abortController
          if (currentController) {
            currentController.abort()
          }

          // Создаем новый контроллер для отмены
          const newController = new AbortController()
          
          set({
            selectedManagerId: managerId,
            selectedProjectId: null,
            managerProjects: [],
            abortController: newController,
          })

          // Если выбран менеджер, загружаем его проекты
          if (managerId) {
            try {
              await get().fetchManagerProjects(managerId)
            } catch (error) {
              // Игнорируем ошибки отмены
              if (error instanceof Error && error.name !== 'AbortError') {
                console.error("Ошибка при загрузке проектов менеджера:", error)
              }
            }
          }
        },

        // Получение отфильтрованных проектов
        getFilteredProjects: () => {
          const { availableProjects, selectedManagerId, managerProjects } = get()

          if (!selectedManagerId) {
            return availableProjects
          }

          return managerProjects
        },

        // Получение отфильтрованных сотрудников
        getFilteredEmployees: () => {
          const { availableEmployees, selectedDepartmentId, selectedTeamId } = get()

          let filteredEmployees = availableEmployees

          // Фильтруем по отделу
          if (selectedDepartmentId) {
            filteredEmployees = filteredEmployees.filter(emp => emp.departmentId === selectedDepartmentId)
          }

          // Фильтруем по команде
          if (selectedTeamId) {
            filteredEmployees = filteredEmployees.filter(emp => emp.teamId === selectedTeamId)
          }

          return filteredEmployees
        },

        // Загрузка проектов менеджера
        fetchManagerProjects: async (managerId: string) => {
          const controller = get().abortController
          
          set({ isLoadingManagerProjects: true })
          try {
            const queryBuilder = supabase
              .from("projects")
              .select("project_id, project_name")
              .eq("project_manager", managerId)
              .eq("project_status", "active")
              .order("project_name")

            // Добавляем AbortSignal только если контроллер существует
            const query = controller ? queryBuilder.abortSignal(controller.signal) : queryBuilder
            const { data: projectsData, error: projectsError } = await query

            // Проверяем, не был ли запрос отменен
            if (controller?.signal.aborted) {
              set({ isLoadingManagerProjects: false })
              return
            }

            if (projectsError) {
              console.error("Ошибка при загрузке проектов менеджера:", projectsError)
              throw projectsError
            }

            const managerProjects = projectsData?.map((project) => ({
              id: project.project_id,
              name: project.project_name,
            })) || []

            // Проверяем еще раз, не был ли запрос отменен
            if (!controller?.signal.aborted) {
              set({
                managerProjects,
                isLoadingManagerProjects: false,
                abortController: null, // Очищаем контроллер после успешного завершения
              })
            }
          } catch (error) {
            if (!controller?.signal.aborted) {
              console.error("Ошибка при загрузке проектов менеджера:", error)
              set({
                managerProjects: [],
                isLoadingManagerProjects: false,
                abortController: null, // Очищаем контроллер после ошибки
              })
            } else {
              // Если запрос был отменен, также сбрасываем флаг загрузки
              set({ isLoadingManagerProjects: false })
            }
          }
        },

        // Сброс всех фильтров
        resetFilters: () => {
          // Отменяем текущий запрос, если он есть
          const currentController = get().abortController
          if (currentController) {
            currentController.abort()
          }

          // Сбрасываем только незаблокированные фильтры
          const updates: Partial<PlanningFiltersState> = {
            managerProjects: [],
            isLoadingManagerProjects: false,
            abortController: null,
          };

          if (!get().isFilterLocked('project')) {
            updates.selectedProjectId = null;
          }
          if (!get().isFilterLocked('department')) {
            updates.selectedDepartmentId = null;
          }
          if (!get().isFilterLocked('team')) {
            updates.selectedTeamId = null;
          }
          if (!get().isFilterLocked('manager')) {
            updates.selectedManagerId = null;
          }
          if (!get().isFilterLocked('employee')) {
            updates.selectedEmployeeId = null;
          }

          set(updates);

          // Повторно применяем фильтры на основе разрешений
          setTimeout(() => {
            get().applyPermissionBasedFilters();
          }, 0);
        },

        // Переключение видимости панели фильтров
        toggleFilterPanel: () => {
          set((state) => ({ isFilterPanelOpen: !state.isFilterPanelOpen }))
        },

        // Применение фильтров на основе разрешений пользователя
        applyPermissionBasedFilters: () => {
          const userStore = useUserStore.getState();
          const activePermission = userStore.getActivePermission();
          const userProfile = userStore.profile;
          
          if (!activePermission || !userProfile) {
            return;
          }

          console.log("🔐 Применение фильтров на основе разрешения:", activePermission);

          switch (activePermission) {
            case 'is_top_manager':
              // Топ-менеджер: никаких ограничений
              break;
              
            case 'is_project_manager':
              // Менеджер проектов: фильтр по менеджеру (себе)
              set({
                selectedManagerId: userStore.id,
                selectedProjectId: null, // Сбрасываем проект, чтобы показать все проекты менеджера
                selectedDepartmentId: null,
                selectedTeamId: null,
                selectedEmployeeId: null,
              });
              // Загружаем проекты менеджера
              if (userStore.id) {
                get().fetchManagerProjects(userStore.id);
              }
              break;
              
            case 'is_head_of_department':
              // Руководитель отдела: фильтр по отделу
              set({
                selectedDepartmentId: userProfile.departmentId,
                selectedTeamId: null, // Сбрасываем команду, чтобы показать весь отдел
                selectedEmployeeId: null,
                selectedManagerId: null,
                selectedProjectId: null,
              });
              break;
              
            case 'is_teamlead':
              // Руководитель команды: фильтр по отделу и команде
              set({
                selectedDepartmentId: userProfile.departmentId,
                selectedTeamId: userProfile.teamId,
                selectedEmployeeId: null, // Сбрасываем сотрудника, чтобы показать всю команду
                selectedManagerId: null,
                selectedProjectId: null,
              });
              break;
          }
        },

        // Проверка блокировки изменения фильтра
        isFilterLocked: (filterType: 'project' | 'department' | 'team' | 'manager' | 'employee') => {
          const userStore = useUserStore.getState();
          const activePermission = userStore.getActivePermission();
          
          if (!activePermission) {
            return false;
          }

          switch (activePermission) {
            case 'is_top_manager':
              // Топ-менеджер: никаких блокировок
              return false;
              
            case 'is_project_manager':
              // Менеджер проектов: блокируем изменение менеджера
              return filterType === 'manager';
              
            case 'is_head_of_department':
              // Руководитель отдела: блокируем изменение отдела
              return filterType === 'department';
              
            case 'is_teamlead':
              // Руководитель команды: блокируем изменение отдела и команды
              return filterType === 'department' || filterType === 'team';
              
            default:
              return false;
          }
        },

        // Получение активного разрешения
        getActivePermission: () => {
          const userStore = useUserStore.getState();
          return userStore.getActivePermission();
        },
      }),
      {
        name: "planning-filters-storage",
        partialize: (state) => ({
          selectedProjectId: state.selectedProjectId,
          selectedDepartmentId: state.selectedDepartmentId,
          selectedTeamId: state.selectedTeamId,
          selectedManagerId: state.selectedManagerId,
          selectedEmployeeId: state.selectedEmployeeId,
          isFilterPanelOpen: state.isFilterPanelOpen,
        }),
      },
    ),
  ),
)
