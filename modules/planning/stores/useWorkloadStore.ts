import { create } from "zustand" 
import { devtools, persist } from "zustand/middleware"
import { supabase } from "@/lib/supabase-client"
import type { Department, Employee, Team } from "../types"
import { formatDateToLocalString } from "../utils/section-utils"

interface WorkloadState {
  // Данные
  departments: Department[]
  allEmployees: Employee[]
  projects: { id: string; name: string }[]
  isLoading: boolean

  // Фильтры
  selectedDepartmentId: string | null
  selectedTeamId: string | null
  selectedProjectId: string | null

  // Действия
  fetchWorkloadData: () => Promise<void>
  setSelectedDepartment: (departmentId: string | null) => void
  setSelectedTeam: (teamId: string | null) => void
  setSelectedProject: (projectId: string | null) => void
  resetFilters: () => void

  // Вспомогательные методы
  calculateDailyWorkloads: (startDate: Date, daysToShow: number) => void
  getFilteredEmployees: () => Employee[]
}

export const useWorkloadStore = create<WorkloadState>()(
  devtools(
    persist(
      (set, get) => ({
        // Начальное состояние
        departments: [],
        allEmployees: [],
        projects: [],
        isLoading: false,
        selectedDepartmentId: null,
        selectedTeamId: null,
        selectedProjectId: null,

        // Загрузка данных о загрузке сотрудников
        fetchWorkloadData: async () => {
          set({ isLoading: true })
          try {
            // Загружаем данные из представления
            const { data, error } = await supabase.from("view_employee_workloads").select("*")

            if (error) {
              console.error("Ошибка при загрузке данных о загрузке сотрудников:", error)
              throw error
            }

            // Преобразуем данные в структуру для отображения
            const employeesMap = new Map<string, Employee>()
            const teamsMap = new Map<string, Team>()
            const departmentsMap = new Map<string, Department>()
            const projectsMap = new Map<string, { id: string; name: string }>()

            // Сначала создаем сотрудников и их загрузки
            data.forEach((item) => {
              // Если сотрудник еще не добавлен, добавляем его
              if (!employeesMap.has(item.user_id)) {
                employeesMap.set(item.user_id, {
                  id: item.user_id,
                  name: `${item.first_name} ${item.last_name}`,
                  firstName: item.first_name,
                  lastName: item.last_name,
                  fullName: `${item.first_name} ${item.last_name}`,
                  email: item.email,
                  position: item.position_name,
                  avatarUrl: item.avatar_url,
                  teamId: item.final_team_id,
                  teamName: item.final_team_name,
                  teamCode: item.final_team_name,
                  departmentId: item.final_department_id,
                  departmentName: item.final_department_name,
                  workload: 0,
                  loadings: [],
                  dailyWorkloads: {},
                  hasLoadings: item.has_loadings,
                  loadingsCount: item.loadings_count,
                  employmentRate: item.employment_rate || 1,
                })
              }

              // Если у записи есть загрузка, добавляем ее к сотруднику
              if (item.loading_id) {
                const employee = employeesMap.get(item.user_id)!
                employee.loadings = employee.loadings || []
                employee.loadings.push({
                  id: item.loading_id,
                  responsibleId: item.user_id,
                  responsibleName: `${item.first_name} ${item.last_name}`,
                  responsibleAvatarUrl: item.avatar_url,
                  responsibleTeamName: item.final_team_name,
                  sectionId: item.loading_section,
                  sectionName: item.section_name,
                  projectId: item.project_id,
                  projectName: item.project_name,
                  projectStatus: item.project_status,
                  startDate: new Date(item.loading_start),
                  endDate: new Date(item.loading_finish),
                  rate: item.loading_rate || 1,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                })

                // Добавляем проект в список проектов
                if (item.project_id && !projectsMap.has(item.project_id)) {
                  projectsMap.set(item.project_id, {
                    id: item.project_id,
                    name: item.project_name || "Без названия",
                  })
                }
              }
            })

            // Создаем команды и добавляем в них сотрудников
            employeesMap.forEach((employee) => {
              if (employee.teamId) {
                if (!teamsMap.has(employee.teamId)) {
                  teamsMap.set(employee.teamId, {
                    id: employee.teamId,
                    name: employee.teamName || "",
                    code: employee.teamCode || "",
                    departmentId: employee.departmentId || "",
                    departmentName: employee.departmentName,
                    employees: [],
                    totalEmployees: 0,
                    dailyWorkloads: {},
                  })
                }

                const team = teamsMap.get(employee.teamId)!
                team.employees.push(employee)
                team.totalEmployees = (team.totalEmployees || 0) + 1
              }
            })

            // Создаем отделы и добавляем в них команды
            teamsMap.forEach((team) => {
              if (team.departmentId) {
                if (!departmentsMap.has(team.departmentId)) {
                  departmentsMap.set(team.departmentId, {
                    id: team.departmentId,
                    name: team.departmentName || "",
                    teams: [],
                    totalEmployees: 0,
                    dailyWorkloads: {},
                  })
                }

                const department = departmentsMap.get(team.departmentId)!
                department.teams.push(team)
                department.totalEmployees += (team.totalEmployees || 0)
              }
            })

            // Преобразуем Map в массивы
            const departments = Array.from(departmentsMap.values())
            const allEmployees = Array.from(employeesMap.values())
            const projects = Array.from(projectsMap.values())

            set({
              departments,
              allEmployees,
              projects,
              isLoading: false,
            })

            console.log(
              `Загружено ${departments.length} отделов, ${teamsMap.size} команд, ${projects.length} проектов и ${allEmployees.length} сотрудников`,
            )
          } catch (error) {
            console.error("Ошибка при загрузке данных о загрузке сотрудников:", error)
            set({ isLoading: false })
          }
        },

        // Установка выбранного отдела
        setSelectedDepartment: (departmentId) => {
          set({
            selectedDepartmentId: departmentId,
            // Сбрасываем выбранную команду только если меняется отдел
            selectedTeamId: null,
          })
        },

        // Установка выбранной команды
        setSelectedTeam: (teamId) => {
          set({ selectedTeamId: teamId })
        },

        // Установка выбранного проекта
        setSelectedProject: (projectId) => {
          set({ selectedProjectId: projectId })
        },

        // Сброс всех фильтров
        resetFilters: () => {
          set({
            selectedDepartmentId: null,
            selectedTeamId: null,
            selectedProjectId: null,
          })
        },

        // Расчет ежедневной загрузки для сотрудников, команд и отделов
        calculateDailyWorkloads: (startDate, daysToShow) => {
          const { departments, allEmployees } = get()

          // Создаем массив дат для расчета
          const dates: Date[] = []
          const currentDate = new Date(startDate)
          for (let i = 0; i < daysToShow; i++) {
            dates.push(new Date(currentDate))
            currentDate.setDate(currentDate.getDate() + 1)
          }

          // Рассчитываем загрузку для каждого сотрудника
          allEmployees.forEach((employee) => {
            const dailyWorkloads: Record<string, number> = {}

            dates.forEach((date) => {
              const dateKey = formatDateToLocalString(date)
              let totalRate = 0

              // Суммируем ставки всех загрузок сотрудника на эту дату
              employee.loadings?.forEach((loading) => {
                const loadingStart = new Date(loading.startDate)
                const loadingEnd = new Date(loading.endDate)

                // Сбрасываем время для корректного сравнения
                loadingStart.setHours(0, 0, 0, 0)
                loadingEnd.setHours(23, 59, 59, 999)

                const currentDate = new Date(date)
                currentDate.setHours(0, 0, 0, 0)

                if (currentDate >= loadingStart && currentDate <= loadingEnd) {
                  totalRate += loading.rate
                }
              })

              dailyWorkloads[dateKey] = totalRate
            })

            employee.dailyWorkloads = dailyWorkloads
          })

          // Рассчитываем загрузку для каждой команды
          departments.forEach((department) => {
            department.teams.forEach((team) => {
              const dailyWorkloads: Record<string, number> = {}

              dates.forEach((date) => {
                const dateKey = formatDateToLocalString(date)
                let totalRate = 0

                team.employees.forEach((employee) => {
                  totalRate += employee.dailyWorkloads?.[dateKey] || 0
                })

                dailyWorkloads[dateKey] = totalRate
              })

              team.dailyWorkloads = dailyWorkloads
            })

            // Рассчитываем загрузку для отдела
            const departmentDailyWorkloads: Record<string, number> = {}

            dates.forEach((date) => {
              const dateKey = formatDateToLocalString(date)
              let totalRate = 0

              department.teams.forEach((team) => {
                totalRate += team.dailyWorkloads?.[dateKey] || 0
              })

              departmentDailyWorkloads[dateKey] = totalRate
            })

            department.dailyWorkloads = departmentDailyWorkloads
          })

          // Обновляем состояние с рассчитанными загрузками
          set({ departments, allEmployees })
        },

        // Получение отфильтрованных сотрудников
        getFilteredEmployees: () => {
          const { allEmployees, selectedDepartmentId, selectedTeamId, selectedProjectId } = get()

          return allEmployees.filter((employee) => {
            // Фильтр по отделу
            if (selectedDepartmentId && employee.departmentId !== selectedDepartmentId) {
              return false
            }

            // Фильтр по команде
            if (selectedTeamId && employee.teamId !== selectedTeamId) {
              return false
            }

            // Фильтр по проекту
            if (selectedProjectId) {
              // Проверяем, есть ли у сотрудника загрузки на выбранный проект
              return employee.loadings?.some((loading) => loading.projectId === selectedProjectId) || false
            }

            return true
          })
        },
      }),
      {
        name: "workload-storage",
        partialize: (state) => ({
          selectedDepartmentId: state.selectedDepartmentId,
          selectedTeamId: state.selectedTeamId,
          selectedProjectId: state.selectedProjectId,
        }),
      },
    ),
  ),
)
