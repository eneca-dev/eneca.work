import { create } from "zustand"
import { devtools, persist } from "zustand/middleware"
import { supabase } from "@/lib/supabase-client"

// Типы для фильтров
export interface Project {
  id: string
  name: string
}

export interface Department {
  id: string
  name: string
}

export interface Team {
  id: string
  name: string
  departmentId: string
}

// Добавляем новый интерфейс для менеджеров после интерфейса Team
export interface Manager {
  id: string
  name: string
  avatarUrl?: string | null
  projectsCount?: number // Добавляем количество проектов
}

// В интерфейсе PlanningFiltersState добавляем новые поля:
interface PlanningFiltersState {
  // Доступные проекты, отделы, команды и менеджеры
  availableProjects: Project[]
  availableDepartments: Department[]
  availableTeams: Team[]
  availableManagers: Manager[] // Добавляем менеджеров
  isLoading: boolean
  isFilterPanelOpen: boolean

  // Выбранные фильтры
  selectedProjectId: string | null
  selectedDepartmentId: string | null
  selectedTeamId: string | null
  selectedManagerId: string | null // Добавляем выбранного менеджера

  managerProjects: Project[] // Добавляем проекты выбранного менеджера
  isLoadingManagerProjects: boolean // Флаг загрузки проектов менеджера

  // Действия
  fetchFilterOptions: () => Promise<void>
  setSelectedProject: (projectId: string | null) => void
  setSelectedDepartment: (departmentId: string | null) => void
  setSelectedTeam: (teamId: string | null) => void
  setSelectedManager: (managerId: string | null) => void // Добавляем метод для выбора менеджера
  resetFilters: () => void
  toggleFilterPanel: () => void

  // Добавляем метод для получения отфильтрованных проектов
  getFilteredProjects: () => Project[]
  fetchManagerProjects: (managerId: string) => Promise<void> // Новый метод
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
        managerProjects: [], // Добавляем пустой массив проектов менеджера
        isLoading: false,
        isLoadingManagerProjects: false, // Добавляем флаг загрузки
        isFilterPanelOpen: false,
        selectedProjectId: null,
        selectedDepartmentId: null,
        selectedTeamId: null,
        selectedManagerId: null,

        // Загрузка опций фильтров из базы данных
        fetchFilterOptions: async () => {
          set({ isLoading: true })
          try {
            // Загружаем проекты (оставляем как есть)
            const { data: projectsData, error: projectsError } = await supabase
              .from("projects")
              .select("project_id, project_name")
              .eq("project_status", "active")
              .order("project_name")

            if (projectsError) {
              console.error("Ошибка при загрузке проектов:", projectsError)
              throw projectsError
            }

            const projects = projectsData.map((project) => ({
              id: project.project_id,
              name: project.project_name,
            }))

            // Загружаем менеджеров из представления
            const { data: managersData, error: managersError } = await supabase
              .from("view_project_managers")
              .select("manager_id, first_name, last_name, manager_name, avatar_url, projects_count")
              .order("manager_name")

            if (managersError) {
              console.error("Ошибка при загрузке менеджеров:", managersError)
              throw managersError
            }

            const managers = managersData.map((manager) => ({
              id: manager.manager_id,
              name: manager.manager_name,
              avatarUrl: manager.avatar_url,
              projectsCount: manager.projects_count,
            }))

            console.log("Загружены менеджеры:", managers) // Добавляем отладочную информацию

            // Загружаем отделы (оставляем как есть)
            const { data: departmentsData, error: departmentsError } = await supabase
              .from("departments")
              .select("department_id, department_name")
              .order("department_name")

            if (departmentsError) {
              console.error("Ошибка при загрузке отделов:", departmentsError)
              throw departmentsError
            }

            const departments = departmentsData.map((department) => ({
              id: department.department_id,
              name: department.department_name,
            }))

            // Загружаем команды (оставляем как есть)
            const { data: teamsData, error: teamsError } = await supabase
              .from("teams")
              .select("team_id, team_name, department_id")
              .order("team_name")

            if (teamsError) {
              console.error("Ошибка при загрузке команд:", teamsError)
              throw teamsError
            }

            const teams = teamsData.map((team) => ({
              id: team.team_id,
              name: team.team_name,
              departmentId: team.department_id,
            }))

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
            // Сбрасываем выбранную команду, если меняется отдел
            selectedTeamId: null,
          })
        },

        // Установка выбранной команды
        setSelectedTeam: (teamId) => {
          set({ selectedTeamId: teamId })
        },

        // Обновляем метод для установки выбранного менеджера:
        setSelectedManager: async (managerId) => {
          set({
            selectedManagerId: managerId,
            // Сбрасываем выбранный проект при смене менеджера
            selectedProjectId: null,
            managerProjects: [], // Сбрасываем проекты менеджера
          })

          // Если выбран менеджер, загружаем его проекты
          if (managerId) {
            await get().fetchManagerProjects(managerId)
          }
        },

        // Обновляем метод для получения отфильтрованных проектов:
        getFilteredProjects: () => {
          const { availableProjects, selectedManagerId } = get()

          if (!selectedManagerId) {
            return availableProjects
          }

          // Если выбран менеджер, загружаем его проекты
          // Это будет синхронный вызов, поэтому нужно будет загружать проекты менеджера отдельно
          return get().managerProjects || []
        },

        // Исправляем метод для загрузки проектов менеджера - используем правильное название поля:
        fetchManagerProjects: async (managerId: string) => {
          set({ isLoadingManagerProjects: true })
          try {
            const { data: projectsData, error: projectsError } = await supabase
              .from("projects")
              .select("project_id, project_name")
              .eq("project_manager", managerId)
              .eq("project_status", "active")
              .order("project_name")

            if (projectsError) {
              console.error("Ошибка при загрузке проектов менеджера:", projectsError)
              throw projectsError
            }

            const managerProjects = projectsData.map((project) => ({
              id: project.project_id,
              name: project.project_name,
            }))

            set({
              managerProjects,
              isLoadingManagerProjects: false,
            })
          } catch (error) {
            console.error("Ошибка при загрузке проектов менеджера:", error)
            set({
              managerProjects: [],
              isLoadingManagerProjects: false,
            })
          }
        },

        // Сброс всех фильтров
        resetFilters: () => {
          set({
            selectedProjectId: null,
            selectedDepartmentId: null,
            selectedTeamId: null,
            selectedManagerId: null, // Добавляем сброс менеджера
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
          selectedManagerId: state.selectedManagerId, // Добавляем сохранение менеджера
          isFilterPanelOpen: state.isFilterPanelOpen,
        }),
      },
    ),
  ),
)
