import { create } from "zustand"
import { devtools, persist } from "zustand/middleware"
import type { Section, Loading, Department } from "../types"
// Обновляем импорты, добавляя новые функции
import {
  fetchLoadings,
  fetchSectionsWithLoadings,
  archiveLoading as archiveLoadingAPI,
  restoreLoading as restoreLoadingAPI,
  fetchArchivedLoadings,
  createLoading as createLoadingAPI,
} from "@/lib/supabase-client"
import { supabase } from "@/lib/supabase-client"

// Обновляем интерфейс PlanningState, добавляя функции архивирования
interface PlanningState {
  // Данные
  sections: Section[]
  allSections: Section[] // Все загруженные разделы
  departments: Department[] // Добавляем отделы
  isLoadingSections: boolean
  isLoadingDepartments: boolean // Добавляем флаг загрузки отделов
  expandedSections: Record<string, boolean> // Отслеживание раскрытых разделов
  expandedDepartments: Record<string, boolean> // Отслеживание раскрытых отделов
  showDepartments: boolean // Флаг для показа/скрытия отделов

  // Пагинация
  currentPage: number
  sectionsPerPage: number

  // Фильтры
  selectedProjectId: string | null
  selectedDepartmentId: string | null
  selectedTeamId: string | null
  selectedManagerId: string | null

  // Карта загрузок
  loadingsMap: Record<string, Loading[]> // Карта загрузок по ID раздела

  // Поиск
  searchQuery: string
  projectSearchQuery: string

  // Действия
  fetchSections: () => Promise<void>
  fetchDepartments: () => Promise<void>
  fetchSectionLoadings: (sectionId: string) => Promise<Loading[]>
  setFilters: (
    projectId: string | null,
    departmentId: string | null,
    teamId: string | null,
    managerId?: string | null,
  ) => void
  addSection: (section: Section) => void
  updateSection: (id: string, updates: Partial<Section>) => void
  deleteSection: (id: string) => void
  updateLoading: (loadingId: string, updates: Partial<Loading>) => Promise<{ success: boolean; error?: string }>
  deleteLoading: (loadingId: string) => Promise<{ success: boolean; error?: string }>
  createLoading: (loadingData: {
    responsibleId: string
    sectionId: string
    startDate: Date
    endDate: Date
    rate: number
    projectName?: string
    sectionName?: string
  }) => Promise<{ success: boolean; error?: string; loadingId?: string }>
  archiveLoading: (loadingId: string) => Promise<{ success: boolean; error?: string }>
  restoreLoading: (loadingId: string) => Promise<{ success: boolean; error?: string }>
  fetchArchivedLoadings: (sectionId?: string, employeeId?: string) => Promise<Loading[]>
  toggleSectionExpanded: (sectionId: string) => void
  toggleDepartmentExpanded: (departmentId: string) => void
  expandAllSections: () => Promise<void>
  collapseAllSections: () => void
  expandAllDepartments: () => void
  collapseAllDepartments: () => void
  setCurrentPage: (page: number) => void
  toggleShowDepartments: () => void
  filterSectionsByName: (query: string) => void
  filterSectionsByProject: (query: string) => void
}

// Функция для правильного преобразования timestamptz в объект Date
const parseTimestampTz = (timestamptz: string | null): Date | null => {
  if (!timestamptz) return null

  try {
    // Если строка не содержит информацию о timezone, добавляем 'Z' для UTC
    let dateString = timestamptz
    if (!timestamptz.includes('Z') && !timestamptz.includes('+') && !timestamptz.includes('-', 10)) {
      dateString = timestamptz + 'Z'
    }
    
    // Преобразуем строку в объект Date
    return new Date(dateString)
  } catch (error) {
    console.error("Ошибка при преобразовании даты:", error, timestamptz)
    return null
  }
}

export const usePlanningStore = create<PlanningState>()(
  devtools(
    persist(
      (set, get) => ({
        // Начальное состояние
        sections: [],
        allSections: [],
        departments: [],
        isLoadingSections: false,
        isLoadingDepartments: false,
        selectedProjectId: null,
        selectedDepartmentId: null,
        selectedTeamId: null,
        selectedManagerId: null,
        expandedSections: {},
        expandedDepartments: {},
        showDepartments: false,
        currentPage: 1,
        sectionsPerPage: 20,
        loadingsMap: {},
        searchQuery: "",
        projectSearchQuery: "",

        // Установка фильтров
        setFilters: (projectId, departmentId, teamId, managerId = null) => {
          set({
            selectedProjectId: projectId,
            selectedDepartmentId: departmentId,
            selectedTeamId: teamId,
            selectedManagerId: managerId,
            currentPage: 1,
          })
          // После установки фильтров загружаем разделы
          get().fetchSections()
          // Если показаны отделы, загружаем их тоже
          if (get().showDepartments) {
            get().fetchDepartments()
          }
        },

        // Установка текущей страницы
        setCurrentPage: (page) => {
          set({ currentPage: page })

          // Обновляем отображаемые разделы
          const { allSections, sectionsPerPage, loadingsMap, expandedSections } = get()
          const startIndex = (page - 1) * sectionsPerPage
          const endIndex = startIndex + sectionsPerPage
          const visibleSections = allSections.slice(startIndex, endIndex)

          // Добавляем загрузки к разделам, которые раскрыты
          const sectionsWithLoadings = visibleSections.map((section) => {
            if (expandedSections[section.id]) {
              return {
                ...section,
                loadings: loadingsMap[section.id] || [],
              }
            }
            return section
          })

          set({ sections: sectionsWithLoadings })
        },

        // Обновляем метод fetchSections для учета фильтра по команде
        fetchSections: async () => {
          set({ isLoadingSections: true })
          try {
            // Получаем текущие фильтры из состояния
            const {
              selectedProjectId,
              selectedDepartmentId,
              selectedTeamId,
              selectedManagerId,
              sectionsPerPage,
              currentPage,
            } = get()

            // Загружаем данные из нового представления (только активные загрузки)
            const result = await fetchSectionsWithLoadings(
              selectedProjectId,
              selectedDepartmentId,
              selectedTeamId,
              selectedManagerId,
            )

            // Проверяем, что результат не является ошибкой
            if ('success' in result && !result.success) {
              console.error("Ошибка при загрузке разделов:", result.error)
              throw new Error(result.error)
            }

            const { sections: allSections, loadingsMap } = result as { sections: Section[]; loadingsMap: Record<string, Loading[]> }

            console.log(`Загружено ${allSections.length} разделов и активные загрузки для них`)

            // Применяем пагинацию
            const startIndex = (currentPage - 1) * sectionsPerPage
            const endIndex = startIndex + sectionsPerPage
            const visibleSections = allSections.slice(startIndex, endIndex)

            // Добавляем загрузки к видимым разделам
            const sectionsWithLoadings = visibleSections.map((section) => ({
              ...section,
              loadings: loadingsMap[section.id] || [],
            }))

            set({
              allSections: allSections,
              sections: sectionsWithLoadings,
              loadingsMap,
              isLoadingSections: false,
              expandedSections: {},
            })
          } catch (error) {
            console.error("Ошибка при загрузке разделов:", error)
            set({ isLoadingSections: false })
          }
        },

        // Обновляем функцию загрузки отделов для использования view_employee_workloads
        fetchDepartments: async () => {
          set({ isLoadingDepartments: true })
          try {
            // Получаем текущие фильтры из состояния
            const { selectedDepartmentId } = get()

            // Загружаем данные из представления view_employee_workloads
            let query = supabase
              .from("view_employee_workloads")
              .select("*")
              .or("loading_status.eq.active,loading_status.is.null")

            // Применяем фильтр по отделу, если он выбран
            if (selectedDepartmentId) {
              query = query.eq("final_department_id", selectedDepartmentId)
            }

            const { data, error } = await query

            if (error) {
              console.error("Ошибка при загрузке данных о сотрудниках:", error)
              throw error
            }

            console.log("📊 Данные из view_employee_workloads:", data?.length, "записей")

            // Группируем данные по отделам и командам, используя финальные поля
            const departmentsMap = new Map<string, Department>()
            const teamsMap = new Map<string, any>()
            const employeesMap = new Map<string, any>()

            // Обрабатываем каждую запись
            data?.forEach((item) => {
              // Создаем или обновляем сотрудника
              if (!employeesMap.has(item.user_id)) {
                employeesMap.set(item.user_id, {
                  id: item.user_id,
                  firstName: item.first_name,
                  lastName: item.last_name,
                  fullName: item.full_name, // Используем умно обработанное полное имя
                  email: item.email,
                  position: item.position_name,
                  avatarUrl: item.avatar_url,
                  // Используем финальные поля для группировки
                  teamId: item.final_team_id,
                  teamName: item.final_team_name,
                  teamCode: "", // В представлении нет team_code, оставляем пустым
                  departmentId: item.final_department_id,
                  departmentName: item.final_department_name,
                  loadings: [],
                  dailyWorkloads: {},
                  hasLoadings: item.has_loadings,
                  loadingsCount: item.loadings_count,
                  employmentRate: item.employment_rate || 1,
                })

                console.log("👤 Сотрудник:", {
                  fullName: item.full_name,
                  finalDepartment: item.final_department_name,
                  finalTeam: item.final_team_name,
                  originalDepartment: item.original_department_name,
                  originalTeam: item.original_team_name,
                })
              }

              const employee = employeesMap.get(item.user_id)

              // Добавляем загрузку, если она есть
              if (item.loading_id) {
                employee.loadings.push({
                  id: item.loading_id,
                  responsibleId: item.user_id,
                  responsibleName: item.full_name,
                  responsibleAvatarUrl: item.avatar_url,
                  responsibleTeamName: item.final_team_name,
                  sectionId: item.loading_section,
                  sectionName: item.section_name,
                  projectId: null, // В представлении нет project_id
                  projectName: item.project_name,
                  projectStatus: item.project_status,
                  startDate: new Date(item.loading_start),
                  endDate: new Date(item.loading_finish),
                  rate: item.loading_rate || 1,
                })
              }
            })

            // Вычисляем dailyWorkloads для каждого сотрудника
            employeesMap.forEach((employee) => {
              employee.dailyWorkloads = {}
              if (employee.loadings && employee.loadings.length > 0) {
                employee.loadings.forEach((loading: Loading) => {
                  const startDate = new Date(loading.startDate)
                  const endDate = new Date(loading.endDate)
                  const currentDate = new Date(startDate)

                  while (currentDate <= endDate) {
                    const dateKey = currentDate.toISOString().split("T")[0]
                    if (!employee.dailyWorkloads[dateKey]) {
                      employee.dailyWorkloads[dateKey] = 0
                    }
                    employee.dailyWorkloads[dateKey] += loading.rate || 1
                    currentDate.setDate(currentDate.getDate() + 1)
                  }
                })
              }
            })

            // Группируем сотрудников по командам, используя финальные поля
            employeesMap.forEach((employee) => {
              const teamKey = `${employee.departmentId}-${employee.teamId}`

              if (!teamsMap.has(teamKey)) {
                teamsMap.set(teamKey, {
                  id: employee.teamId,
                  name: employee.teamName,
                  code: employee.teamCode || "",
                  departmentId: employee.departmentId,
                  departmentName: employee.departmentName,
                  employees: [],
                  totalEmployees: 0,
                  dailyWorkloads: {},
                })
              }

              const team = teamsMap.get(teamKey)
              team.employees.push(employee)
              team.totalEmployees += 1

              // Суммируем dailyWorkloads команды
              Object.keys(employee.dailyWorkloads || {}).forEach((dateKey) => {
                if (!team.dailyWorkloads[dateKey]) {
                  team.dailyWorkloads[dateKey] = 0
                }
                team.dailyWorkloads[dateKey] += employee.dailyWorkloads[dateKey]
              })
            })

            // Группируем команды по отделам, используя финальные поля
            teamsMap.forEach((team) => {
              if (!departmentsMap.has(team.departmentId)) {
                departmentsMap.set(team.departmentId, {
                  id: team.departmentId,
                  name: team.departmentName,
                  teams: [],
                  totalEmployees: 0,
                  dailyWorkloads: {},
                })
              }

              const department = departmentsMap.get(team.departmentId)
              if (department) {
                department.teams.push(team)
                department.totalEmployees += team.totalEmployees

                // Суммируем dailyWorkloads отдела
                Object.keys(team.dailyWorkloads || {}).forEach((dateKey) => {
                  if (!department.dailyWorkloads) {
                    department.dailyWorkloads = {}
                  }
                  if (!department.dailyWorkloads[dateKey]) {
                    department.dailyWorkloads[dateKey] = 0
                  }
                  department.dailyWorkloads[dateKey] += team.dailyWorkloads[dateKey]
                })
              }
            })

            const departments = Array.from(departmentsMap.values())

            console.log("🏢 Структура отделов:", {
              totalDepartments: departments.length,
              departments: departments.map((dept) => ({
                id: dept.id,
                name: dept.name,
                totalEmployees: dept.totalEmployees,
                teams: dept.teams.map((team) => ({
                  id: team.id,
                  name: team.name,
                  employeeCount: team.employees.length,
                  employees: team.employees.map((emp) => emp.fullName),
                })),
              })),
            })

            set({
              departments,
              isLoadingDepartments: false,
            })

            console.log(`✅ Загружено ${departments.length} отделов`)
          } catch (error) {
            console.error("❌ Ошибка при загрузке отделов:", error)
            set({ isLoadingDepartments: false })
          }
        },

        // Проверка наличия загрузок для раздела (только активные)
        checkSectionHasLoadings: async (sectionId: string): Promise<boolean> => {
          try {
            const loadings = await fetchLoadings(sectionId, true)
            return Array.isArray(loadings) && loadings.length > 0
          } catch (error) {
            console.error("Ошибка при проверке загрузок раздела:", error)
            return false
          }
        },

        // Загрузка загрузок для конкретного раздела (только активные)
        fetchSectionLoadings: async (sectionId: string): Promise<Loading[]> => {
          try {
            const loadingsData = await fetchLoadings(sectionId)

            // Преобразуем данные в формат Loading
            const loadings: Loading[] = Array.isArray(loadingsData) ? loadingsData.map((item: any) => ({
              id: item.loading_id,
              responsibleId: item.loading_responsible,
              responsibleName: item.responsible_name || undefined,
              responsibleAvatarUrl: item.responsible_avatar || undefined,
              sectionId: item.loading_section,
              startDate: parseTimestampTz(item.loading_start) || new Date(),
              endDate: parseTimestampTz(item.loading_finish) || new Date(),
              rate: item.loading_rate || 1,
              createdAt: parseTimestampTz(item.loading_created),
              updatedAt: parseTimestampTz(item.loading_updated),
            })) : []

            // Обновляем раздел с загрузками в обоих массивах: sections и allSections
            const { sections, allSections } = get()

            const updatedSections = sections.map((section) => {
              if (section.id === sectionId) {
                return {
                  ...section,
                  loadings,
                }
              }
              return section
            })

            const updatedAllSections = allSections.map((section) => {
              if (section.id === sectionId) {
                return {
                  ...section,
                  loadings,
                }
              }
              return section
            })

            set({
              sections: updatedSections,
              allSections: updatedAllSections,
            })

            return loadings
          } catch (error) {
            console.error("Ошибка при загрузке загрузок раздела:", error)
            return []
          }
        },

        // Создание новой загрузки
        createLoading: async (loadingData) => {
          try {
            // Подготавливаем данные для API
            const apiData = {
              responsibleId: loadingData.responsibleId,
              sectionId: loadingData.sectionId,
              startDate: loadingData.startDate.toISOString().split("T")[0],
              endDate: loadingData.endDate.toISOString().split("T")[0],
              rate: loadingData.rate,
            }

            // Вызываем API
            const result = await createLoadingAPI(apiData)

            if (!result.success) {
              return result
            }

            // Создаем объект новой загрузки для локального состояния
            const newLoading: Loading = {
              id: result.loadingId!,
              responsibleId: loadingData.responsibleId,
              responsibleName: undefined, // Будет заполнено при перезагрузке
              responsibleAvatarUrl: undefined,
              responsibleTeamName: undefined,
              sectionId: loadingData.sectionId,
              sectionName: loadingData.sectionName,
              projectId: undefined,
              projectName: loadingData.projectName,
              startDate: loadingData.startDate,
              endDate: loadingData.endDate,
              rate: loadingData.rate,
              createdAt: new Date(),
              updatedAt: new Date(),
            }

            // Обновляем локальное состояние
            const { sections, allSections, loadingsMap, departments } = get()

            // Обновляем в карте загрузок
            const updatedLoadingsMap = { ...loadingsMap }
            if (!updatedLoadingsMap[loadingData.sectionId]) {
              updatedLoadingsMap[loadingData.sectionId] = []
            }
            updatedLoadingsMap[loadingData.sectionId].push(newLoading)

            // Обновляем в разделах
            const updatedSections = sections.map((section) => {
              if (section.id === loadingData.sectionId) {
                return {
                  ...section,
                  hasLoadings: true,
                  loadings: section.loadings ? [...section.loadings, newLoading] : [newLoading],
                }
              }
              return section
            })

            const updatedAllSections = allSections.map((section) => {
              if (section.id === loadingData.sectionId) {
                return {
                  ...section,
                  hasLoadings: true,
                  loadings: section.loadings ? [...section.loadings, newLoading] : [newLoading],
                }
              }
              return section
            })

            set({
              sections: updatedSections,
              allSections: updatedAllSections,
              loadingsMap: updatedLoadingsMap,
            })

            // Перезагружаем данные для получения актуальной информации
            await get().fetchSections()
            if (get().showDepartments) {
              await get().fetchDepartments()
            }

            return { success: true, loadingId: result.loadingId }
          } catch (error) {
            console.error("Ошибка при создании загрузки:", error)
            return { success: false, error: "Произошла неожиданная ошибка" }
          }
        },

        // Обновление загрузки
        updateLoading: async (loadingId: string, updates: Partial<Loading>) => {
          try {
            // Подготавливаем данные для API
            const apiUpdates: any = {}
            if (updates.startDate) {
              apiUpdates.startDate = updates.startDate.toISOString()
            }
            if (updates.endDate) {
              apiUpdates.endDate = updates.endDate.toISOString()
            }
            if (updates.rate !== undefined) {
              apiUpdates.rate = updates.rate
            }
            if (updates.sectionId) {
              apiUpdates.sectionId = updates.sectionId
            }
            if (updates.projectId) {
              apiUpdates.projectId = updates.projectId
            }

            // Импортируем функцию обновления
            const { updateLoading: updateLoadingAPI } = await import("@/lib/supabase-client")

            // Вызываем API
            const result = await updateLoadingAPI(loadingId, apiUpdates)

            if (!result.success) {
              return result
            }

            // Обновляем локальное состояние
            const { sections, allSections, loadingsMap, departments } = get()

            // Обновляем в разделах
            const updatedSections = sections.map((section) => ({
              ...section,
              loadings: section.loadings?.map((loading) =>
                loading.id === loadingId ? { ...loading, ...updates } : loading,
              ),
            }))

            const updatedAllSections = allSections.map((section) => ({
              ...section,
              loadings: section.loadings?.map((loading) =>
                loading.id === loadingId ? { ...loading, ...updates } : loading,
              ),
            }))

            // Обновляем в карте загрузок
            const updatedLoadingsMap = { ...loadingsMap }
            Object.keys(updatedLoadingsMap).forEach((sectionId) => {
              updatedLoadingsMap[sectionId] = (updatedLoadingsMap[sectionId] ?? []).map((loading) =>
                loading.id === loadingId ? { ...loading, ...updates } : loading,
              )
            })

            // Если изменился раздел, нужно переместить загрузку из одного раздела в другой
            if (updates.sectionId) {
              // Находим загрузку
              let loadingToMove: Loading | undefined

              // Ищем загрузку в текущем разделе
              Object.keys(updatedLoadingsMap).forEach((sectionId) => {
                const loadingIndex = updatedLoadingsMap[sectionId].findIndex((l) => l.id === loadingId)
                if (loadingIndex !== -1) {
                  loadingToMove = { ...updatedLoadingsMap[sectionId][loadingIndex], ...updates }
                  // Удаляем загрузку из текущего раздела
                  updatedLoadingsMap[sectionId] = updatedLoadingsMap[sectionId].filter((l) => l.id !== loadingId)
                }
              })

              // Добавляем загрузку в новый раздел
              if (loadingToMove) {
                if (!updatedLoadingsMap[updates.sectionId]) {
                  updatedLoadingsMap[updates.sectionId] = []
                }
                updatedLoadingsMap[updates.sectionId].push(loadingToMove)
              }
            }

            // Обновляем в отделах
            const updatedDepartments = departments.map((department) => ({
              ...department,
              teams: department.teams.map((team) => ({
                ...team,
                employees: team.employees.map((employee) => ({
                  ...employee,
                  loadings: employee.loadings?.map((loading) =>
                    loading.id === loadingId ? { ...loading, ...updates } : loading,
                  ),
                })),
              })),
            }))

            set({
              sections: updatedSections,
              allSections: updatedAllSections,
              loadingsMap: updatedLoadingsMap,
              departments: updatedDepartments,
            })

            return { success: true }
          } catch (error) {
            console.error("Ошибка при обновлении загрузки:", error)
            return { success: false, error: "Произошла неожиданная ошибка" }
          }
        },

        // Удаление загрузки
        deleteLoading: async (loadingId: string) => {
          try {
            // Импортируем функцию удаления
            const { deleteLoading: deleteLoadingAPI } = await import("@/lib/supabase-client")

            // Вызываем API
            const result = await deleteLoadingAPI(loadingId)

            if (!result.success) {
              return result
            }

            // Обновляем локальное состояние
            const { sections, allSections, loadingsMap, departments } = get()

            // Обновляем в разделах
            const updatedSections = sections.map((section) => ({
              ...section,
              loadings: section.loadings?.filter((loading) => loading.id !== loadingId),
            }))

            const updatedAllSections = allSections.map((section) => ({
              ...section,
              loadings: section.loadings?.filter((loading) => loading.id !== loadingId),
            }))

            // Обновляем в карте загрузок
            const updatedLoadingsMap = { ...loadingsMap }
            Object.keys(updatedLoadingsMap).forEach((sectionId) => {
              updatedLoadingsMap[sectionId] = updatedLoadingsMap[sectionId].filter(
                (loading) => loading.id !== loadingId,
              )
            })

            // Обновляем в отделах
            const updatedDepartments = departments.map((department) => ({
              ...department,
              teams: department.teams.map((team) => ({
                ...team,
                employees: team.employees.map((employee) => ({
                  ...employee,
                  loadings: employee.loadings?.filter((loading) => loading.id !== loadingId),
                })),
              })),
            }))

            set({
              sections: updatedSections,
              allSections: updatedAllSections,
              loadingsMap: updatedLoadingsMap,
              departments: updatedDepartments,
            })

            return { success: true }
          } catch (error) {
            console.error("Ошибка при удалении загрузки:", error)
            return { success: false, error: "Произошла неожиданная ошибка" }
          }
        },

        // Архивирование загрузки
        archiveLoading: async (loadingId: string) => {
          try {
            // Вызываем API
            const result = await archiveLoadingAPI(loadingId)

            if (!result.success) {
              return result
            }

            // Обновляем локальное состояние - удаляем загрузку из активных данных
            const { sections, allSections, loadingsMap, departments } = get()

            // Обновляем в разделах
            const updatedSections = sections.map((section) => ({
              ...section,
              loadings: section.loadings?.filter((loading) => loading.id !== loadingId),
            }))

            const updatedAllSections = allSections.map((section) => ({
              ...section,
              loadings: section.loadings?.filter((loading) => loading.id !== loadingId),
            }))

            // Обновляем в карте загрузок
            const updatedLoadingsMap = { ...loadingsMap }
            Object.keys(updatedLoadingsMap).forEach((sectionId) => {
              updatedLoadingsMap[sectionId] = updatedLoadingsMap[sectionId].filter(
                (loading) => loading.id !== loadingId,
              )
            })

            // Обновляем в отделах
            const updatedDepartments = departments.map((department) => ({
              ...department,
              teams: department.teams.map((team) => ({
                ...team,
                employees: team.employees.map((employee) => ({
                  ...employee,
                  loadings: employee.loadings?.filter((loading) => loading.id !== loadingId),
                })),
              })),
            }))

            set({
              sections: updatedSections,
              allSections: updatedAllSections,
              loadingsMap: updatedLoadingsMap,
              departments: updatedDepartments,
            })

            return { success: true }
          } catch (error) {
            console.error("Ошибка при архивировании загрузки:", error)
            return { success: false, error: "Произошла неожиданная ошибка" }
          }
        },

        // Восстановление загрузки из архива
        restoreLoading: async (loadingId: string) => {
          try {
            // Вызываем API
            const result = await restoreLoadingAPI(loadingId)

            if (!result.success) {
              return result
            }

            // После восстановления перезагружаем данные
            await get().fetchSections()
            if (get().showDepartments) {
              await get().fetchDepartments()
            }

            return { success: true }
          } catch (error) {
            console.error("Ошибка при восстановлении загрузки:", error)
            return { success: false, error: "Произошла неожиданная ошибка" }
          }
        },

        // Получение архивных загрузок
        fetchArchivedLoadings: async (sectionId?: string, employeeId?: string): Promise<Loading[]> => {
          try {
            const loadingsData = await fetchArchivedLoadings(sectionId, employeeId)

            // Преобразуем данные в формат Loading
            const loadings: Loading[] = Array.isArray(loadingsData) ? loadingsData.map((item: any) => ({
              id: item.loading_id,
              responsibleId: item.loading_responsible,
              responsibleName: item.responsible_name || undefined,
              responsibleAvatarUrl: item.responsible_avatar || undefined,
              sectionId: item.loading_section,
              startDate: parseTimestampTz(item.loading_start) || new Date(),
              endDate: parseTimestampTz(item.loading_finish) || new Date(),
              rate: item.loading_rate || 1,
              createdAt: parseTimestampTz(item.loading_created),
              updatedAt: parseTimestampTz(item.loading_updated),
            })) : []

            return loadings
          } catch (error) {
            console.error("Ошибка при загрузке архивных загрузок:", error)
            return []
          }
        },

        // Переключение состояния раскрытия раздела
        toggleSectionExpanded: async (sectionId: string) => {
          const { sections, expandedSections, loadingsMap } = get()

          // Находим раздел
          const section = sections.find((s) => s.id === sectionId)

          // Если раздел не найден или у него нет загрузок, ничего не делаем
          if (!section || !section.hasLoadings) return

          // Обновляем состояние раскрытия
          set((state) => ({
            expandedSections: {
              ...state.expandedSections,
              [sectionId]: !state.expandedSections[sectionId],
            },
            sections: state.sections.map((s) => {
              if (s.id === sectionId) {
                // Если раздел раскрывается, добавляем загрузки из loadingsMap
                const isExpanded = !state.expandedSections[sectionId]
                return {
                  ...s,
                  isExpanded,
                  // Добавляем загрузки только если раздел раскрывается и у него нет загрузок
                  loadings: isExpanded && !s.loadings ? loadingsMap[sectionId] || [] : s.loadings,
                }
              }
              return s
            }),
            allSections: state.allSections.map((s) =>
              s.id === sectionId ? { ...s, isExpanded: !state.expandedSections[sectionId] } : s,
            ),
          }))
        },

        // Добавляем функцию переключения состояния раскрытия отдела
        toggleDepartmentExpanded: (departmentId: string) => {
          set((state) => ({
            expandedDepartments: {
              ...state.expandedDepartments,
              [departmentId]: !state.expandedDepartments[departmentId],
            },
            departments: state.departments.map((d) =>
              d.id === departmentId ? { ...d, isExpanded: !state.expandedDepartments[departmentId] } : d,
            ),
          }))
        },

        // Развернуть все разделы
        expandAllSections: async () => {
          const { sections, loadingsMap } = get()
          const sectionsWithLoadings = sections.filter((section) => section.hasLoadings)

          // Создаем объект с состоянием раскрытия для всех разделов с загрузками
          const newExpandedSections: Record<string, boolean> = {}
          sectionsWithLoadings.forEach((section) => {
            newExpandedSections[section.id] = true
          })

          // Обновляем состояние
          set((state) => ({
            expandedSections: newExpandedSections,
            sections: state.sections.map((s) => {
              if (s.hasLoadings) {
                return {
                  ...s,
                  isExpanded: true,
                  // Добавляем загрузки из loadingsMap, если их еще нет
                  loadings: s.loadings || loadingsMap[s.id] || [],
                }
              }
              return s
            }),
            allSections: state.allSections.map((s) => (s.hasLoadings ? { ...s, isExpanded: true } : s)),
          }))
        },

        // Свернуть все разделы
        collapseAllSections: () => {
          set((state) => ({
            expandedSections: {},
            sections: state.sections.map((s) => ({ ...s, isExpanded: false })),
            allSections: state.allSections.map((s) => ({ ...s, isExpanded: false })),
          }))
        },

        // Добавляем функцию раскрытия всех отделов
        expandAllDepartments: () => {
          const { departments } = get()
          const newExpandedDepartments: Record<string, boolean> = {}

          departments.forEach((department) => {
            newExpandedDepartments[department.id] = true
          })

          set((state) => ({
            expandedDepartments: newExpandedDepartments,
            departments: state.departments.map((d) => ({ ...d, isExpanded: true })),
          }))
        },

        // Добавляем функцию сворачивания всех отделов
        collapseAllDepartments: () => {
          set((state) => ({
            expandedDepartments: {},
            departments: state.departments.map((d) => ({ ...d, isExpanded: false })),
          }))
        },

        // Добавляем функцию переключения показа отделов
        toggleShowDepartments: () => {
          const { showDepartments, departments } = get()
          const newShowDepartments = !showDepartments

          // Если включаем показ отделов и они еще не загружены, загружаем их
          if (newShowDepartments && departments.length === 0) {
            get().fetchDepartments()
          }

          set({ showDepartments: newShowDepartments })
        },

        // Добавление нового раздела
        addSection: (section) => {
          set((state) => ({
            allSections: [...state.allSections, section],
            sections: [...state.sections, section],
          }))
        },

        // Обновление существующего раздела
        updateSection: (id, updates) => {
          set((state) => ({
            sections: state.sections.map((section) => (section.id === id ? { ...section, ...updates } : section)),
            allSections: state.allSections.map((section) => (section.id === id ? { ...section, ...updates } : section)),
          }))
        },

        // Удаление раздела
        deleteSection: (id) => {
          set((state) => ({
            sections: state.sections.filter((section) => section.id !== id),
            allSections: state.allSections.filter((section) => section.id !== id),
          }))
        },

        // Фильтрация разделов по названию
        filterSectionsByName: (query) => {
          set({ searchQuery: query })

          // Если запрос пустой, просто обновляем страницу с текущими фильтрами
          if (!query.trim()) {
            const { currentPage, sectionsPerPage, allSections, expandedSections, loadingsMap, projectSearchQuery } =
              get()

            // Если есть активный поиск по проекту, применяем его
            let filteredByProject = allSections
            if (projectSearchQuery.trim()) {
              filteredByProject = allSections.filter((section) =>
                section.projectName?.toLowerCase().includes(projectSearchQuery.toLowerCase()),
              )
            }

            const startIndex = (currentPage - 1) * sectionsPerPage
            const endIndex = startIndex + sectionsPerPage
            const visibleSections = filteredByProject.slice(startIndex, endIndex)

            // Добавляем загрузки к разделам, которые раскрыты
            const sectionsWithLoadings = visibleSections.map((section) => {
              if (expandedSections[section.id]) {
                return {
                  ...section,
                  loadings: loadingsMap[section.id] || [],
                }
              }
              return section
            })

            set({ sections: sectionsWithLoadings })
            return
          }

          // Фильтруем все разделы по названию
          const { allSections, expandedSections, loadingsMap, projectSearchQuery } = get()

          // Сначала фильтруем по названию раздела
          let filteredSections = allSections.filter((section) =>
            section.name.toLowerCase().includes(query.toLowerCase()),
          )

          // Если есть активный поиск по проекту, применяем его дополнительно
          if (projectSearchQuery.trim()) {
            filteredSections = filteredSections.filter((section) =>
              section.projectName?.toLowerCase().includes(projectSearchQuery.toLowerCase()),
            )
          }

          // Добавляем загрузки к разделам, которые раскрыты
          const sectionsWithLoadings = filteredSections.map((section) => {
            if (expandedSections[section.id]) {
              return {
                ...section,
                loadings: loadingsMap[section.id] || [],
              }
            }
            return section
          })

          // Обновляем состояние с отфильтрованными разделами
          set({ sections: sectionsWithLoadings })
        },

        // Фильтрация разделов по названию проекта
        filterSectionsByProject: (query) => {
          set({ projectSearchQuery: query })

          // Если запрос пустой, просто обновляем страницу с текущими фильтрами
          if (!query.trim()) {
            const { currentPage, sectionsPerPage, allSections, expandedSections, loadingsMap, searchQuery } = get()

            // Если есть активный поиск по названию раздела, применяем его
            let filteredByName = allSections
            if (searchQuery.trim()) {
              filteredByName = allSections.filter((section) =>
                section.name.toLowerCase().includes(searchQuery.toLowerCase()),
              )
            }

            const startIndex = (currentPage - 1) * sectionsPerPage
            const endIndex = startIndex + sectionsPerPage
            const visibleSections = filteredByName.slice(startIndex, endIndex)

            // Добавляем загрузки к разделам, которые раскрыты
            const sectionsWithLoadings = visibleSections.map((section) => {
              if (expandedSections[section.id]) {
                return {
                  ...section,
                  loadings: loadingsMap[section.id] || [],
                }
              }
              return section
            })

            set({ sections: sectionsWithLoadings })
            return
          }

          // Фильтруем все разделы по названию проекта
          const { allSections, expandedSections, loadingsMap, searchQuery } = get()

          // Сначала фильтруем по проекту
          let filteredSections = allSections.filter((section) =>
            section.projectName?.toLowerCase().includes(query.toLowerCase()),
          )

          // Если есть активный поиск по названию раздела, применяем его дополнительно
          if (searchQuery.trim()) {
            filteredSections = filteredSections.filter((section) =>
              section.name.toLowerCase().includes(searchQuery.toLowerCase()),
            )
          }

          // Добавляем загрузки к разделам, которые раскрыты
          const sectionsWithLoadings = filteredSections.map((section) => {
            if (expandedSections[section.id]) {
              return {
                ...section,
                loadings: loadingsMap[section.id] || [],
              }
            }
            return section
          })

          // Обновляем состояние с отфильтрованными разделами
          set({ sections: sectionsWithLoadings })
        },
      }),
      {
        name: "planning-data-storage",
        partialize: (state) => ({
          selectedProjectId: state.selectedProjectId,
          selectedDepartmentId: state.selectedDepartmentId,
          selectedTeamId: state.selectedTeamId,
          selectedManagerId: state.selectedManagerId,
          expandedSections: state.expandedSections,
          expandedDepartments: state.expandedDepartments,
          showDepartments: state.showDepartments,
          currentPage: state.currentPage,
        }),
      },
    ),
  ),
)
