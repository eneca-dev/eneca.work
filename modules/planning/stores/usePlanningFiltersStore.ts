import { create } from "zustand"
import { devtools, persist } from "zustand/middleware"
import { supabase } from "@/lib/supabase-client"
import type { Department, Team } from "../types"

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
  // Доступные проекты, отделы, команды и менеджеры
  availableProjects: Project[]
  availableDepartments: Department[]
  availableTeams: Team[]
  availableManagers: Manager[]
  managerProjects: Project[]
  isLoading: boolean
  isLoadingManagerProjects: boolean
  isFilterPanelOpen: boolean

  // Выбранные фильтры
  selectedProjectId: string | null
  selectedDepartmentId: string | null
  selectedTeamId: string | null
  selectedManagerId: string | null

  // Контроллер для отмены запросов
  abortController: AbortController | null

  // Действия
  fetchFilterOptions: () => Promise<void>
  setSelectedProject: (projectId: string | null) => void
  setSelectedDepartment: (departmentId: string | null) => void
  setSelectedTeam: (teamId: string | null) => void
  setSelectedManager: (managerId: string | null) => void
  resetFilters: () => void
  toggleFilterPanel: () => void
  getFilteredProjects: () => Project[]
  fetchManagerProjects: (managerId: string) => Promise<void>
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
        managerProjects: [],
        isLoading: false,
        isLoadingManagerProjects: false,
        isFilterPanelOpen: false,
        selectedProjectId: null,
        selectedDepartmentId: null,
        selectedTeamId: null,
        selectedManagerId: null,
        abortController: null,

        // Загрузка опций фильтров из базы данных (параллельно)
        fetchFilterOptions: async () => {
          set({ isLoading: true })
          try {
            // Выполняем все запросы параллельно
            const [projectsResult, managersResult, departmentsResult, teamsResult] = await Promise.allSettled([
              supabase
                .from("projects")
                .select("project_id, project_name")
                .eq("project_status", "active")
                .order("project_name"),
              
              supabase
                .from("view_project_managers")
                .select("manager_id, first_name, last_name, manager_name, avatar_url, projects_count")
                .order("manager_name"),
              
              supabase
                .from("departments")
                .select("department_id, department_name")
                .order("department_name"),
              
              supabase
                .from("teams")
                .select("team_id, team_name, department_id")
                .order("team_name")
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
              managers = managersResult.value.data?.map((manager) => ({
                id: manager.manager_id,
                name: manager.manager_name,
                avatarUrl: manager.avatar_url,
                projectsCount: manager.projects_count,
              })) || []
            } else if (managersResult.status === 'rejected' || managersResult.value.error) {
              console.error("Ошибка при загрузке менеджеров:", managersResult.status === 'rejected' ? managersResult.reason : managersResult.value.error)
            }

            // Обрабатываем результаты отделов
            let departments: Department[] = []
            if (departmentsResult.status === 'fulfilled' && !departmentsResult.value.error) {
              departments = departmentsResult.value.data?.map((department) => ({
                id: department.department_id,
                name: department.department_name,
                totalEmployees: 0,
                teams: []
              })) || []
            } else if (departmentsResult.status === 'rejected' || departmentsResult.value.error) {
              console.error("Ошибка при загрузке отделов:", departmentsResult.status === 'rejected' ? departmentsResult.reason : departmentsResult.value.error)
            }

            // Обрабатываем результаты команд
            let teams: Team[] = []
            if (teamsResult.status === 'fulfilled' && !teamsResult.value.error) {
              teams = teamsResult.value.data?.map((team) => ({
                id: team.team_id,
                name: team.team_name,
                departmentId: team.department_id,
                employees: []
              })) || []
            } else if (teamsResult.status === 'rejected' || teamsResult.value.error) {
              console.error("Ошибка при загрузке команд:", teamsResult.status === 'rejected' ? teamsResult.reason : teamsResult.value.error)
            }

            set({
              availableProjects: projects,
              availableManagers: managers,
              availableDepartments: departments,
              availableTeams: teams,
              isLoading: false,
            })
          } catch (error) {
            console.error("Ошибка при загрузке опций фильтров:", error)
            set({ isLoading: false })
          }
        },

        // Установка выбранного проекта
        setSelectedProject: (projectId) => {
          set({ selectedProjectId: projectId })
        },

        // Установка выбранного отдела
        setSelectedDepartment: (departmentId) => {
          set({
            selectedDepartmentId: departmentId,
            selectedTeamId: null,
          })
        },

        // Установка выбранной команды
        setSelectedTeam: (teamId) => {
          set({ selectedTeamId: teamId })
        },

        // Установка выбранного менеджера с механизмом отмены
        setSelectedManager: async (managerId) => {
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

          set({
            selectedProjectId: null,
            selectedDepartmentId: null,
            selectedTeamId: null,
            selectedManagerId: null,
            managerProjects: [],
            isLoadingManagerProjects: false,
            abortController: null,
          })
        },

        // Переключение видимости панели фильтров
        toggleFilterPanel: () => {
          set((state) => ({ isFilterPanelOpen: !state.isFilterPanelOpen }))
        },
      }),
      {
        name: "planning-filters-storage",
        partialize: (state) => ({
          selectedProjectId: state.selectedProjectId,
          selectedDepartmentId: state.selectedDepartmentId,
          selectedTeamId: state.selectedTeamId,
          selectedManagerId: state.selectedManagerId,
          isFilterPanelOpen: state.isFilterPanelOpen,
        }),
      },
    ),
  ),
)
