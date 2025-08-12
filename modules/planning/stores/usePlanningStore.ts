import { create } from "zustand"
import { devtools, persist } from "zustand/middleware"
import type { Section, Loading, Department, Team } from "../types"
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
  showSections: boolean // Флаг для показа/скрытия разделов
  showDepartments: boolean // Флаг для показа/скрытия отделов

  // Пагинация
  currentPage: number
  sectionsPerPage: number

  // Состояние синхронизации фильтров и данных
  syncState: {
    isApplyingFilters: boolean
    lastAppliedFilters: {
      projectId: string | null
      departmentId: string | null
      teamId: string | null
      managerId: string | null
      employeeId: string | null
      stageId: string | null
      objectId: string | null
    } | null
    currentFilters: {
      projectId: string | null
      departmentId: string | null
      teamId: string | null
      managerId: string | null
      employeeId: string | null
      stageId: string | null
      objectId: string | null
    }
    filtersKey: string
    lastDataLoadTime: number | null
    abortController: AbortController | null
  }

  // Карта загрузок
  loadingsMap: Record<string, Loading[]> // Карта загрузок по ID раздела

  // Поиск
  searchQuery: string
  projectSearchQuery: string

  // Действия
  fetchSections: () => Promise<void>
  fetchDepartments: () => Promise<void>
  fetchSectionLoadings: (sectionId: string) => Promise<Loading[]>
  fetchSectionsWithSync: (abortController: AbortController) => Promise<void>
  fetchDepartmentsWithSync: (abortController: AbortController) => Promise<void>
  setFilters: (
    projectId: string | null,
    departmentId: string | null,
    teamId: string | null,
    managerId?: string | null,
    employeeId?: string | null,
    stageId?: string | null,
    objectId?: string | null,
  ) => void
  // Новый метод для синхронизации с новой системой фильтров
  syncWithFilterStore: () => void
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
    responsibleName?: string
    responsibleAvatarUrl?: string | null
    responsibleTeamName?: string | null
  }) => Promise<{ success: boolean; error?: string; loadingId?: string }>
  refreshSectionLoadings: (sectionId: string) => Promise<{ success: boolean; error?: string }>
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
  toggleShowSections: () => void
  toggleShowDepartments: () => void
  filterSectionsByName: (query: string) => void
  filterSectionsByProject: (query: string) => void

  // Функции синхронизации
  generateFiltersKey: (filters: {
    projectId: string | null
    departmentId: string | null
    teamId: string | null
    managerId: string | null
    employeeId: string | null
    stageId: string | null
    objectId: string | null
  }) => string
  isDataSynced: () => boolean
  getDataSyncStatus: () => {
    isSynced: boolean
    isApplying: boolean
    hasStaleData: boolean
  }
  cancelPendingRequests: () => void
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

// Вспомогательная функция для объединения загрузок без дубликатов
const mergeLoadingsWithoutDuplicates = (sectionLoadings: Loading[], mapLoadings: Loading[]): Loading[] => {
  const allLoadings = [...(sectionLoadings || [])]
  
  // Добавляем загрузки из карты, которых нет в разделе
  ;(mapLoadings || []).forEach(loading => {
    if (!allLoadings.some(existing => existing.id === loading.id)) {
      allLoadings.push(loading)
    }
  })
  
  return allLoadings
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
        expandedSections: {},
        expandedDepartments: {},
        showSections: true, // По умолчанию разделы показываются
        showDepartments: false,
        currentPage: 1,
        sectionsPerPage: 20,
        loadingsMap: {},
        searchQuery: "",
        projectSearchQuery: "",

        // Состояние синхронизации фильтров и данных
        syncState: {
          isApplyingFilters: false,
          lastAppliedFilters: null,
          currentFilters: {
            projectId: null,
            departmentId: null,
            teamId: null,
            managerId: null,
            employeeId: null,
            stageId: null,
            objectId: null,
          },
          filtersKey: "",
          lastDataLoadTime: null,
          abortController: null,
        },

        // Установка фильтров
        setFilters: (projectId, departmentId, teamId, managerId = null, employeeId = null, stageId = null, objectId = null) => {
          const currentState = get()
          
          // Создаем новые фильтры
          const newFilters = {
            projectId,
            departmentId,
            teamId,
            managerId,
            employeeId,
            stageId,
            objectId,
          }
          
          // Генерируем ключ для новых фильтров
          const newFiltersKey = currentState.generateFiltersKey(newFilters)
          
          // Проверяем, изменились ли фильтры
          const filtersChanged = currentState.syncState.filtersKey !== newFiltersKey
          
          // Проверяем, нужна ли первоначальная загрузка данных
          const needsInitialLoad = currentState.syncState.lastDataLoadTime === null

          console.log("🎯 Установка фильтров в usePlanningStore:", {
            projectId,
            departmentId,
            teamId,
            managerId,
            employeeId,
            stageId,
            objectId,
            filtersChanged,
            needsInitialLoad,
            oldKey: currentState.syncState.filtersKey,
            newKey: newFiltersKey
          })
          
          // Отменяем предыдущие запросы
          if (currentState.syncState.abortController) {
            currentState.syncState.abortController.abort()
          }
          
          // Создаем новый AbortController
          const abortController = new AbortController()
          
          // Обновляем состояние фильтров и синхронизации
          set({
            currentPage: 1,
            syncState: {
              ...currentState.syncState,
              isApplyingFilters: filtersChanged || needsInitialLoad,
              currentFilters: newFilters,
              filtersKey: newFiltersKey,
              abortController: (filtersChanged || needsInitialLoad) ? abortController : null,
            }
          })

          // Загружаем данные если фильтры изменились или нужна первоначальная загрузка
          if (filtersChanged || needsInitialLoad) {
            // Загружаем разделы с новым AbortController
            get().fetchSectionsWithSync(abortController)
            // Если показаны отделы, загружаем их тоже
            if (currentState.showDepartments) {
              get().fetchDepartmentsWithSync(abortController)
            }
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
            // Получаем текущие фильтры из новой системы фильтров
            const { useFilterStore } = await import('../filters/store')
            const {
              selectedProjectId,
              selectedDepartmentId,
              selectedTeamId,
              selectedManagerId,
              selectedEmployeeId,
              selectedStageId,
              selectedObjectId,
            } = useFilterStore.getState()
            
            const { sectionsPerPage, currentPage } = get()

            console.log("📋 Загрузка разделов с фильтрами:", {
              selectedProjectId,
              selectedDepartmentId,
              selectedTeamId,
              selectedManagerId,
              selectedEmployeeId,
              selectedStageId,
              selectedObjectId
            })

            // Загружаем данные из нового представления (только активные загрузки)
            const result = await fetchSectionsWithLoadings(
              selectedProjectId,
              selectedDepartmentId,
              selectedTeamId,
              selectedManagerId,
              selectedEmployeeId,
              selectedStageId,
              selectedObjectId,
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

        // Обновляем функцию загрузки отделов для использования view_organizational_structure
        fetchDepartments: async () => {
          set({ isLoadingDepartments: true })
          try {
            // Получаем текущие фильтры из новой системы фильтров
            const { useFilterStore } = await import('../filters/store')
            const { selectedDepartmentId, selectedTeamId } = useFilterStore.getState()

            // Загружаем организационную структуру из нового представления
            let query = supabase.from("view_organizational_structure").select("*")

            // Применяем фильтр по отделу, если он выбран
            if (selectedDepartmentId) {
              query = query.eq("department_id", selectedDepartmentId)
            }

            // Применяем фильтр по команде, если она выбрана
            if (selectedTeamId) {
              query = query.eq("team_id", selectedTeamId)
            }

            const { data: orgData, error: orgError } = await query

            if (orgError) {
              console.error("Ошибка при загрузке организационной структуры:", orgError)
              throw orgError
            }

            console.log("🏢 Данные из view_organizational_structure:", orgData?.length, "записей")

            // Загружаем данные о сотрудниках с их загрузками
            let employeeQuery = supabase
              .from("view_employee_workloads")
              .select("*")
              .or("loading_status.eq.active,loading_status.is.null")

            // Применяем те же фильтры для сотрудников
            if (selectedDepartmentId) {
              employeeQuery = employeeQuery.eq("final_department_id", selectedDepartmentId)
            }

            if (selectedTeamId) {
              employeeQuery = employeeQuery.eq("final_team_id", selectedTeamId)
            }

            const { data: employeeData, error: employeeError } = await employeeQuery

            if (employeeError) {
              console.error("Ошибка при загрузке данных о сотрудниках:", employeeError)
              throw employeeError
            }

            console.log("👥 Данные о сотрудниках:", employeeData?.length, "записей")

            // Получаем видимый период таймлайна, чтобы подтянуть только нужные дни отпусков
            const { usePlanningViewStore } = await import("../stores/usePlanningViewStore")
            const { startDate, daysToShow } = usePlanningViewStore.getState()
            const vacationsPeriodStart = new Date(startDate)
            const vacationsPeriodEnd = new Date(startDate)
            vacationsPeriodEnd.setDate(vacationsPeriodEnd.getDate() + daysToShow - 1)

            // Формируем фильтры по отделу/команде для отпусков
            // Выбираем через функцию (RLS-friendly)
            const { data: vacationsDaily, error: vacationsError } = await supabase
              .rpc("get_employee_vacations_daily", {
                p_start: vacationsPeriodStart.toISOString().split("T")[0],
                p_end: vacationsPeriodEnd.toISOString().split("T")[0],
                p_department: selectedDepartmentId || null,
                p_team: selectedTeamId || null,
              })

            if (vacationsError) {
              console.error("Ошибка при загрузке отпусков:", vacationsError)
              throw vacationsError
            }

            console.log("🏝️ Отпуска (дни):", vacationsDaily?.length, "период:", vacationsPeriodStart.toISOString().split("T")[0], "—", vacationsPeriodEnd.toISOString().split("T")[0])
            if (vacationsDaily && vacationsDaily.length > 0) {
              console.log("🏝️ Первые 3 отпуска:", vacationsDaily.slice(0, 3))
            }

            // Группируем данные по отделам и командам
            const departmentsMap = new Map<string, Department>()
            const teamsMap = new Map<string, Team>()
            const employeesMap = new Map<string, any>()

            // Сначала обрабатываем сотрудников и их загрузки
            employeeData?.forEach((item) => {
              if (!employeesMap.has(item.user_id)) {
                employeesMap.set(item.user_id, {
                  id: item.user_id,
                  firstName: item.first_name,
                  lastName: item.last_name,
                  fullName: item.full_name,
                  email: item.email,
                  position: item.position_name,
                  avatarUrl: item.avatar_url,
                  teamId: item.final_team_id,
                  teamName: item.final_team_name,
                  teamCode: "",
                  departmentId: item.final_department_id,
                  departmentName: item.final_department_name,
                  loadings: [],
                  dailyWorkloads: {},
                  vacationsDaily: {},
                  hasLoadings: item.has_loadings,
                  loadingsCount: item.loadings_count,
                  employmentRate: item.employment_rate || 1,
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
                  projectId: null,
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

            // Вносим отпуска: считаем каждый день как 1.0 ставки и отмечаем для отрисовки
            let vacationsProcessed = 0
            vacationsDaily?.forEach((v) => {
              const userId = v.user_id as string
              const dateKey = new Date(v.vacation_date).toISOString().split("T")[0]
              const employee = employeesMap.get(userId)
              if (!employee) {
                console.log("🚨 Сотрудник не найден для отпуска:", userId, dateKey)
                return
              }
              if (!employee.vacationsDaily) employee.vacationsDaily = {}
              employee.vacationsDaily[dateKey] = 1
              // Отпуск не влияет на расчёт workloadRate - оставляем оригинальную загрузку для правильного отображения
              // employee.dailyWorkloads[dateKey] остается как есть
              vacationsProcessed++
            })
            console.log("🏝️ Обработано отпусков:", vacationsProcessed)

            // Теперь обрабатываем организационную структуру
            orgData?.forEach((item) => {
              // Создаем или обновляем отдел
              if (!departmentsMap.has(item.department_id)) {
                departmentsMap.set(item.department_id, {
                  id: item.department_id,
                  name: item.department_name,
                  wsDepartmentId: item.ws_department_id,
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

            // Распределяем сотрудников по командам
            employeesMap.forEach((employee) => {
              const teamKey = `${employee.departmentId}-${employee.teamId}`
              const team = teamsMap.get(teamKey)
              
              if (team) {
                team.employees.push(employee)
                
                // Суммируем dailyWorkloads команды
                Object.keys(employee.dailyWorkloads || {}).forEach((dateKey) => {
                  if (!team.dailyWorkloads) {
                    team.dailyWorkloads = {}
                  }
                  if (!team.dailyWorkloads[dateKey]) {
                    team.dailyWorkloads[dateKey] = 0
                  }
                  team.dailyWorkloads[dateKey] += employee.dailyWorkloads[dateKey]
                })
              }
            })

            // Распределяем команды по отделам
            teamsMap.forEach((team) => {
              const department = departmentsMap.get(team.departmentId)
              if (department) {
                department.teams.push(team)

                // Суммируем dailyWorkloads отдела
                Object.keys(team.dailyWorkloads || {}).forEach((dateKey) => {
                  if (!department.dailyWorkloads) {
                    department.dailyWorkloads = {}
                  }
                  if (!department.dailyWorkloads[dateKey]) {
                    department.dailyWorkloads[dateKey] = 0
                  }
                  department.dailyWorkloads[dateKey] += (team.dailyWorkloads || {})[dateKey] || 0
                })
              }
            })

            const departments = Array.from(departmentsMap.values())

            console.log("🏢 Организационная структура:", {
              totalDepartments: departments.length,
              departments: departments.map((dept) => ({
                id: dept.id,
                name: dept.name,
                headName: dept.departmentHeadName,
                totalEmployees: dept.totalEmployees,
                teams: dept.teams.map((team) => ({
                  id: team.id,
                  name: team.name,
                  leadName: team.teamLeadName,
                  employeeCount: team.employees.length,
                })),
              })),
            })

            set({
              departments,
              isLoadingDepartments: false,
            })

            console.log(`✅ Загружено ${departments.length} отделов с руководителями`)
          } catch (error) {
            console.error("❌ Ошибка при загрузке организационной структуры:", error)
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

            // Проверяем, что данные получены успешно
            if (!Array.isArray(loadingsData)) {
              // Если получили объект ошибки
              if (loadingsData && 'success' in loadingsData && !loadingsData.success) {
                console.error("Ошибка при загрузке загрузок раздела:", loadingsData.error, loadingsData.details)
                return []
              }
              // Если получили что-то неожиданное
              console.warn("Неожиданный формат данных от fetchLoadings:", loadingsData)
              return []
            }

            // Преобразуем данные в формат Loading
            const loadings: Loading[] = loadingsData.map((item: any) => ({
              id: item.loading_id,
              responsibleId: item.loading_responsible,
              responsibleName: item.responsible_name || undefined,
              responsibleAvatarUrl: item.responsible_avatar || undefined,
              sectionId: item.section_id, // Исправлено: используем section_id из view_sections_with_loadings
              startDate: parseTimestampTz(item.loading_start) || new Date(),
              endDate: parseTimestampTz(item.loading_finish) || new Date(),
              rate: item.loading_rate || 1,
              createdAt: parseTimestampTz(item.loading_created) || new Date(),
              updatedAt: parseTimestampTz(item.loading_updated) || new Date(),
            }))

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
              responsibleName: loadingData.responsibleName || undefined,
              responsibleAvatarUrl: loadingData.responsibleAvatarUrl || undefined,
              responsibleTeamName: loadingData.responsibleTeamName || undefined,
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
            const { sections, allSections, loadingsMap, departments, expandedSections } = get()

            // Обновляем в карте загрузок
            const updatedLoadingsMap = { ...loadingsMap }
            if (!updatedLoadingsMap[loadingData.sectionId]) {
              updatedLoadingsMap[loadingData.sectionId] = []
            }
            
            // Проверяем, есть ли уже такая загрузка в карте, чтобы избежать дубликатов
            const existingInMap = updatedLoadingsMap[loadingData.sectionId].some(loading => loading.id === newLoading.id)
            if (!existingInMap) {
              updatedLoadingsMap[loadingData.sectionId].push(newLoading)
            }

            // Обновляем в разделах
            const updatedSections = sections.map((section) => {
              if (section.id === loadingData.sectionId) {
                // Проверяем, есть ли уже такая загрузка, чтобы избежать дубликатов
                const existingLoadings = section.loadings || []
                const hasExistingLoading = existingLoadings.some(loading => loading.id === newLoading.id)
                
                return {
                  ...section,
                  hasLoadings: true,
                  loadings: hasExistingLoading ? existingLoadings : [...existingLoadings, newLoading],
                }
              }
              return section
            })

            const updatedAllSections = allSections.map((section) => {
              if (section.id === loadingData.sectionId) {
                // Проверяем, есть ли уже такая загрузка, чтобы избежать дубликатов
                const existingLoadings = section.loadings || []
                const hasExistingLoading = existingLoadings.some(loading => loading.id === newLoading.id)
                
                return {
                  ...section,
                  hasLoadings: true,
                  loadings: hasExistingLoading ? existingLoadings : [...existingLoadings, newLoading],
                }
              }
              return section
            })

            // Обновляем загрузки сотрудников в отделах
            const updatedDepartments = departments.map(department => ({
              ...department,
              teams: department.teams.map(team => ({
                ...team,
                employees: team.employees.map(employee => {
                  if (employee.id === loadingData.responsibleId) {
                    const existingLoadings = employee.loadings || []
                    const hasExistingLoading = existingLoadings.some(loading => loading.id === newLoading.id)
                    
                    // Пересчитываем dailyWorkloads
                    const updatedLoadings = hasExistingLoading ? existingLoadings : [...existingLoadings, newLoading]
                    const dailyWorkloads: Record<string, number> = {}
                    
                    updatedLoadings.forEach((loading: Loading) => {
                      const startDate = new Date(loading.startDate)
                      const endDate = new Date(loading.endDate)
                      const currentDate = new Date(startDate)

                      while (currentDate <= endDate) {
                        const dateKey = currentDate.toISOString().split("T")[0]
                        if (!dailyWorkloads[dateKey]) {
                          dailyWorkloads[dateKey] = 0
                        }
                        dailyWorkloads[dateKey] += loading.rate || 1
                        currentDate.setDate(currentDate.getDate() + 1)
                      }
                    })

                    return {
                      ...employee,
                      loadings: updatedLoadings,
                      dailyWorkloads,
                      hasLoadings: updatedLoadings.length > 0,
                      loadingsCount: updatedLoadings.length,
                    }
                  }
                  return employee
                })
              }))
            }))

            // Автоматически раскрываем раздел для показа новой загрузки
            if (!expandedSections[loadingData.sectionId]) {
              get().toggleSectionExpanded(loadingData.sectionId)
            }

            // Обновляем состояние с отделами
            set({
              sections: updatedSections,
              allSections: updatedAllSections,
              loadingsMap: updatedLoadingsMap,
              departments: updatedDepartments,
            })

            console.log("✅ Загрузка успешно создана и добавлена в локальное состояние:", {
              loadingId: result.loadingId,
              sectionId: loadingData.sectionId,
              responsibleId: loadingData.responsibleId,
              loadingsCount: updatedLoadingsMap[loadingData.sectionId]?.length || 0
            })

            return { success: true, loadingId: result.loadingId }
          } catch (error) {
            console.error("Ошибка при создании загрузки:", error)
            return { success: false, error: "Произошла неожиданная ошибка" }
          }
        },

        // Функция для обновления конкретного раздела с загрузками
        refreshSectionLoadings: async (sectionId: string) => {
          try {
            console.log("🔄 Обновление загрузок для раздела:", sectionId)
            
            // Загружаем свежие данные для конкретного раздела
            const freshLoadings = await get().fetchSectionLoadings(sectionId)
            
            const { sections, allSections, loadingsMap } = get()

            // Обновляем карту загрузок
            const updatedLoadingsMap = {
              ...loadingsMap,
              [sectionId]: freshLoadings
            }

            // Обновляем раздел в sections
            const updatedSections = sections.map(section => {
              if (section.id === sectionId) {
                return {
                  ...section,
                  loadings: freshLoadings,
                  hasLoadings: freshLoadings.length > 0
                }
              }
              return section
            })

            // Обновляем раздел в allSections
            const updatedAllSections = allSections.map(section => {
              if (section.id === sectionId) {
                return {
                  ...section,
                  loadings: freshLoadings,
                  hasLoadings: freshLoadings.length > 0
                }
              }
              return section
            })

            set({
              sections: updatedSections,
              allSections: updatedAllSections,
              loadingsMap: updatedLoadingsMap,
            })

            console.log("✅ Раздел успешно обновлен:", {
              sectionId,
              loadingsCount: freshLoadings.length
            })

            return { success: true }
          } catch (error) {
            console.error("Ошибка при обновлении раздела:", error)
            return { success: false, error: "Не удалось обновить раздел" }
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

            // Если API вернул обновленные данные, используем их
            let finalUpdates = updates
            if (result.updatedLoading) {
              console.log("🔄 Используем актуальные данные из API:", result.updatedLoading)
              finalUpdates = {
                ...updates,
                sectionId: result.updatedLoading.sectionId,
                sectionName: result.updatedLoading.sectionName,
                projectId: result.updatedLoading.projectId,
                projectName: result.updatedLoading.projectName,
                startDate: result.updatedLoading.startDate,
                endDate: result.updatedLoading.endDate,
                rate: result.updatedLoading.rate,
              }
            }

            // Обновляем локальное состояние
            const { sections, allSections, loadingsMap, departments } = get()

            // Обновляем в разделах
            const updatedSections = sections.map((section) => ({
              ...section,
              loadings: section.loadings?.map((loading) =>
                loading.id === loadingId ? { ...loading, ...finalUpdates } : loading,
              ),
            }))

            const updatedAllSections = allSections.map((section) => ({
              ...section,
              loadings: section.loadings?.map((loading) =>
                loading.id === loadingId ? { ...loading, ...finalUpdates } : loading,
              ),
            }))

            // Обновляем в карте загрузок
            const updatedLoadingsMap = { ...loadingsMap }
            Object.keys(updatedLoadingsMap).forEach((sectionId) => {
              updatedLoadingsMap[sectionId] = (updatedLoadingsMap[sectionId] ?? []).map((loading) =>
                loading.id === loadingId ? { ...loading, ...finalUpdates } : loading,
              )
            })

            // Если изменился раздел, нужно переместить загрузку из одного раздела в другой
            if (finalUpdates.sectionId) {
              // Находим текущую загрузку для сравнения
              let currentLoading: Loading | undefined
              Object.keys(loadingsMap).forEach((sectionId) => {
                const found = loadingsMap[sectionId]?.find((l) => l.id === loadingId)
                if (found) {
                  currentLoading = found
                }
              })

              // Проверяем, изменился ли раздел
              if (currentLoading && finalUpdates.sectionId !== currentLoading.sectionId) {
                // Находим загрузку
                let loadingToMove: Loading | undefined

                // Ищем загрузку в текущем разделе
                Object.keys(updatedLoadingsMap).forEach((sectionId) => {
                  const loadingIndex = updatedLoadingsMap[sectionId].findIndex((l) => l.id === loadingId)
                  if (loadingIndex !== -1) {
                    loadingToMove = { ...updatedLoadingsMap[sectionId][loadingIndex], ...finalUpdates }
                    // Удаляем загрузку из текущего раздела
                    updatedLoadingsMap[sectionId] = updatedLoadingsMap[sectionId].filter((l) => l.id !== loadingId)
                  }
                })

                // Добавляем загрузку в новый раздел
                if (loadingToMove && finalUpdates.sectionId) {
                  if (!updatedLoadingsMap[finalUpdates.sectionId]) {
                    updatedLoadingsMap[finalUpdates.sectionId] = []
                  }
                  updatedLoadingsMap[finalUpdates.sectionId].push(loadingToMove)
                }
              }
            }

            // Обновляем в отделах с пересчетом dailyWorkloads
            const updatedDepartments = departments.map((department) => ({
              ...department,
              teams: department.teams.map((team) => ({
                ...team,
                employees: team.employees.map((employee) => {
                  const updatedLoadings = employee.loadings?.map((loading) =>
                    loading.id === loadingId ? { ...loading, ...finalUpdates } : loading,
                  ) || []
                  
                  // Пересчитываем dailyWorkloads
                  const dailyWorkloads: Record<string, number> = {}
                  updatedLoadings.forEach((loading) => {
                    const startDate = new Date(loading.startDate)
                    const endDate = new Date(loading.endDate)
                    const currentDate = new Date(startDate)

                    while (currentDate <= endDate) {
                      const dateKey = currentDate.toISOString().split("T")[0]
                      if (!dailyWorkloads[dateKey]) {
                        dailyWorkloads[dateKey] = 0
                      }
                      dailyWorkloads[dateKey] += loading.rate || 1
                      currentDate.setDate(currentDate.getDate() + 1)
                    }
                  })

                  return {
                    ...employee,
                    loadings: updatedLoadings,
                    dailyWorkloads,
                    hasLoadings: updatedLoadings.length > 0,
                    loadingsCount: updatedLoadings.length,
                  }
                }),
              })),
            }))

            set({
              sections: updatedSections,
              allSections: updatedAllSections,
              loadingsMap: updatedLoadingsMap,
              departments: updatedDepartments,
            })

            console.log("✅ Загрузка успешно обновлена и UI обновлен:", {
              loadingId,
              finalUpdates,
              sectionsUpdated: updatedSections.length,
              departmentsUpdated: updatedDepartments.length
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

            // Обновляем в отделах с пересчетом dailyWorkloads
            const updatedDepartments = departments.map((department) => ({
              ...department,
              teams: department.teams.map((team) => ({
                ...team,
                employees: team.employees.map((employee) => {
                  const updatedLoadings = employee.loadings?.filter((loading) => loading.id !== loadingId) || []
                  
                  // Пересчитываем dailyWorkloads
                  const dailyWorkloads: Record<string, number> = {}
                  updatedLoadings.forEach((loading) => {
                    const startDate = new Date(loading.startDate)
                    const endDate = new Date(loading.endDate)
                    const currentDate = new Date(startDate)

                    while (currentDate <= endDate) {
                      const dateKey = currentDate.toISOString().split("T")[0]
                      if (!dailyWorkloads[dateKey]) {
                        dailyWorkloads[dateKey] = 0
                      }
                      dailyWorkloads[dateKey] += loading.rate || 1
                      currentDate.setDate(currentDate.getDate() + 1)
                    }
                  })

                  return {
                    ...employee,
                    loadings: updatedLoadings,
                    dailyWorkloads,
                    hasLoadings: updatedLoadings.length > 0,
                    loadingsCount: updatedLoadings.length,
                  }
                }),
              })),
            }))

            set({
              sections: updatedSections,
              allSections: updatedAllSections,
              loadingsMap: updatedLoadingsMap,
              departments: updatedDepartments,
            })

            console.log("✅ Загрузка успешно удалена и UI обновлен:", {
              loadingId,
              sectionsUpdated: updatedSections.length,
              departmentsUpdated: updatedDepartments.length
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

            // Обновляем в отделах с пересчетом dailyWorkloads
            const updatedDepartments = departments.map((department) => ({
              ...department,
              teams: department.teams.map((team) => ({
                ...team,
                employees: team.employees.map((employee) => {
                  const updatedLoadings = employee.loadings?.filter((loading) => loading.id !== loadingId) || []
                  
                  // Пересчитываем dailyWorkloads
                  const dailyWorkloads: Record<string, number> = {}
                  updatedLoadings.forEach((loading) => {
                    const startDate = new Date(loading.startDate)
                    const endDate = new Date(loading.endDate)
                    const currentDate = new Date(startDate)

                    while (currentDate <= endDate) {
                      const dateKey = currentDate.toISOString().split("T")[0]
                      if (!dailyWorkloads[dateKey]) {
                        dailyWorkloads[dateKey] = 0
                      }
                      dailyWorkloads[dateKey] += loading.rate || 1
                      currentDate.setDate(currentDate.getDate() + 1)
                    }
                  })

                  return {
                    ...employee,
                    loadings: updatedLoadings,
                    dailyWorkloads,
                    hasLoadings: updatedLoadings.length > 0,
                    loadingsCount: updatedLoadings.length,
                  }
                }),
              })),
            }))

            set({
              sections: updatedSections,
              allSections: updatedAllSections,
              loadingsMap: updatedLoadingsMap,
              departments: updatedDepartments,
            })

            console.log("✅ Загрузка успешно заархивирована и UI обновлен:", {
              loadingId,
              sectionsUpdated: updatedSections.length,
              departmentsUpdated: updatedDepartments.length
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

            console.log("✅ Загрузка успешно восстановлена и UI обновлен:", {
              loadingId
            })

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
              createdAt: parseTimestampTz(item.loading_created) || new Date(),
              updatedAt: parseTimestampTz(item.loading_updated) || new Date(),
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
                  // Объединяем загрузки из раздела и карты загрузок, избегая дубликатов
                  loadings: isExpanded 
                    ? mergeLoadingsWithoutDuplicates(s.loadings || [], loadingsMap[sectionId] || [])
                    : s.loadings,
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
                  // Объединяем загрузки из раздела и карты загрузок, избегая дубликатов
                  loadings: mergeLoadingsWithoutDuplicates(s.loadings || [], loadingsMap[s.id] || []),
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

        // Добавляем функцию переключения показа разделов
        toggleShowSections: () => {
          const { showSections } = get()
          set({ showSections: !showSections })
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

        // Функции синхронизации с поддержкой AbortController
        fetchSectionsWithSync: async (abortController: AbortController) => {
          set({ isLoadingSections: true })
          try {
            // Получаем текущие фильтры из новой системы фильтров
            const { useFilterStore } = await import('../filters/store')
            const {
              selectedProjectId,
              selectedDepartmentId,
              selectedTeamId,
              selectedManagerId,
              selectedEmployeeId,
              selectedStageId,
              selectedObjectId,
            } = useFilterStore.getState()
            
            const { sectionsPerPage, currentPage } = get()

            console.log("📋 Синхронная загрузка разделов с фильтрами:", {
              selectedProjectId,
              selectedDepartmentId,
              selectedTeamId,
              selectedManagerId,
              selectedEmployeeId,
              selectedStageId,
              selectedObjectId
            })

            // Проверяем, не был ли запрос отменен
            if (abortController.signal.aborted) {
              console.log("🚫 Запрос загрузки разделов был отменен")
              return
            }

            // Загружаем данные из нового представления (только активные загрузки)
            const result = await fetchSectionsWithLoadings(
              selectedProjectId,
              selectedDepartmentId,
              selectedTeamId,
              selectedManagerId,
              selectedEmployeeId,
              selectedStageId,
              selectedObjectId,
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
              syncState: {
                ...get().syncState,
                lastDataLoadTime: Date.now(),
              }
            })
          } catch (error) {
            if (abortController.signal.aborted) {
              console.log("🚫 Запрос загрузки разделов был отменен из-за ошибки")
              return
            }
            console.error("Ошибка при синхронной загрузке разделов:", error)
            set({ isLoadingSections: false })
          }
        },

        fetchDepartmentsWithSync: async (abortController: AbortController) => {
          set({ isLoadingDepartments: true })
          try {
            // Получаем текущие фильтры из новой системы фильтров
            const { useFilterStore } = await import('../filters/store')
            const { selectedDepartmentId, selectedTeamId, selectedEmployeeId } = useFilterStore.getState()

            console.log("🏢 Синхронная загрузка отделов с фильтрами:", {
              selectedDepartmentId,
              selectedTeamId,
              selectedEmployeeId
            })

            // Проверяем, не был ли запрос отменен
            if (abortController.signal.aborted) {
              console.log("🚫 Запрос загрузки отделов был отменен")
              return
            }

            // Загружаем организационную структуру из нового представления
            let query = supabase.from("view_organizational_structure").select("*")

            // Применяем фильтр по отделу, если он выбран
            if (selectedDepartmentId) {
              query = query.eq("department_id", selectedDepartmentId)
            }

            // Применяем фильтр по команде, если она выбрана
            if (selectedTeamId) {
              query = query.eq("team_id", selectedTeamId)
            }

            const { data: orgData, error: orgError } = await query

            // Проверяем, не был ли запрос отменен после загрузки
            if (abortController.signal.aborted) {
              console.log("🚫 Запрос загрузки отделов был отменен после получения данных")
              return
            }

            if (orgError) {
              console.error("Ошибка при загрузке организационной структуры:", orgError)
              throw orgError
            }

            console.log("🏢 Данные из view_organizational_structure:", orgData?.length, "записей")

            // Загружаем данные о сотрудниках с их загрузками
            let employeeQuery = supabase
              .from("view_employee_workloads")
              .select("*")
              .or("loading_status.eq.active,loading_status.is.null")

            // Применяем те же фильтры для сотрудников
            if (selectedDepartmentId) {
              employeeQuery = employeeQuery.eq("final_department_id", selectedDepartmentId)
            }

            if (selectedTeamId) {
              employeeQuery = employeeQuery.eq("final_team_id", selectedTeamId)
            }

            // Применяем фильтр по сотруднику, если он выбран
            if (selectedEmployeeId) {
              employeeQuery = employeeQuery.eq("user_id", selectedEmployeeId)
            }

            const { data: employeeData, error: employeeError } = await employeeQuery

            // Проверяем, не был ли запрос отменен после второй загрузки
            if (abortController.signal.aborted) {
              console.log("🚫 Запрос загрузки отделов был отменен после получения данных о сотрудниках")
              return
            }

            if (employeeError) {
              console.error("Ошибка при загрузке данных о сотрудниках:", employeeError)
              throw employeeError
            }

            console.log("👥 Данные о сотрудниках:", employeeData?.length, "записей")

            // Группируем данные по отделам и командам (тот же код что и в fetchDepartments)
            const departmentsMap = new Map<string, Department>()
            const teamsMap = new Map<string, Team>()
            const employeesMap = new Map<string, any>()

            // Сначала обрабатываем сотрудников и их загрузки
            employeeData?.forEach((item) => {
              if (!employeesMap.has(item.user_id)) {
                employeesMap.set(item.user_id, {
                  id: item.user_id,
                  firstName: item.first_name,
                  lastName: item.last_name,
                  fullName: item.full_name,
                  email: item.email,
                  position: item.position_name,
                  avatarUrl: item.avatar_url,
                  teamId: item.final_team_id,
                  teamName: item.final_team_name,
                  teamCode: "",
                  departmentId: item.final_department_id,
                  departmentName: item.final_department_name,
                  loadings: [],
                  dailyWorkloads: {},
                  hasLoadings: item.has_loadings,
                  loadingsCount: item.loadings_count,
                  employmentRate: item.employment_rate || 1,
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
                  projectId: null,
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

            // Теперь обрабатываем организационную структуру
            orgData?.forEach((item) => {
              // Создаем или обновляем отдел
              if (!departmentsMap.has(item.department_id)) {
                departmentsMap.set(item.department_id, {
                  id: item.department_id,
                  name: item.department_name,
                  wsDepartmentId: item.ws_department_id,
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

            // Распределяем сотрудников по командам
            employeesMap.forEach((employee) => {
              const teamKey = `${employee.departmentId}-${employee.teamId}`
              const team = teamsMap.get(teamKey)
              
              if (team) {
                team.employees.push(employee)
                
                // Суммируем dailyWorkloads команды
                Object.keys(employee.dailyWorkloads || {}).forEach((dateKey) => {
                  if (!team.dailyWorkloads) {
                    team.dailyWorkloads = {}
                  }
                  if (!team.dailyWorkloads[dateKey]) {
                    team.dailyWorkloads[dateKey] = 0
                  }
                  team.dailyWorkloads[dateKey] += employee.dailyWorkloads[dateKey]
                })
              }
            })

            // Распределяем команды по отделам
            teamsMap.forEach((team) => {
              const department = departmentsMap.get(team.departmentId)
              if (department) {
                department.teams.push(team)

                // Суммируем dailyWorkloads отдела
                Object.keys(team.dailyWorkloads || {}).forEach((dateKey) => {
                  if (!department.dailyWorkloads) {
                    department.dailyWorkloads = {}
                  }
                  if (!department.dailyWorkloads[dateKey]) {
                    department.dailyWorkloads[dateKey] = 0
                  }
                  department.dailyWorkloads[dateKey] += (team.dailyWorkloads || {})[dateKey] || 0
                })
              }
            })

            const departments = Array.from(departmentsMap.values())

            console.log("🏢 Синхронная организационная структура:", {
              totalDepartments: departments.length,
              departments: departments.map((dept) => ({
                id: dept.id,
                name: dept.name,
                headName: dept.departmentHeadName,
                totalEmployees: dept.totalEmployees,
                teams: dept.teams.map((team) => ({
                  id: team.id,
                  name: team.name,
                  leadName: team.teamLeadName,
                  employeeCount: team.employees.length,
                })),
              })),
            })

            set({
              departments,
              isLoadingDepartments: false,
              syncState: {
                ...get().syncState,
                lastDataLoadTime: Date.now(),
              }
            })

            console.log(`✅ Синхронно загружено ${departments.length} отделов с руководителями`)
          } catch (error) {
            if (abortController.signal.aborted) {
              console.log("🚫 Запрос загрузки отделов был отменен из-за ошибки")
              return
            }
            console.error("❌ Ошибка при синхронной загрузке организационной структуры:", error)
            set({ isLoadingDepartments: false })
          }
        },

        // Функции синхронизации
        generateFiltersKey: (filters: {
          projectId: string | null
          departmentId: string | null
          teamId: string | null
          managerId: string | null
          employeeId: string | null
          stageId: string | null
          objectId: string | null
        }) => {
          const { projectId, departmentId, teamId, managerId, employeeId, stageId, objectId } = filters
          return `${projectId}-${departmentId}-${teamId}-${managerId}-${employeeId}-${stageId}-${objectId}`
        },
        isDataSynced: () => {
          const { syncState } = get()
          return syncState.isApplyingFilters === false && syncState.lastDataLoadTime !== null
        },
        getDataSyncStatus: () => {
          const { syncState } = get()
          const currentTime = Date.now()
          const lastDataLoadTime = syncState.lastDataLoadTime || 0
          const isApplying = syncState.isApplyingFilters
          const hasStaleData = currentTime - lastDataLoadTime > 10000 // 10 seconds
          return { isSynced: isApplying === false, isApplying, hasStaleData }
        },
        cancelPendingRequests: () => {
          const { syncState } = get()
          if (syncState.abortController) {
            syncState.abortController.abort()
          }
          set((state) => ({
            syncState: {
              ...state.syncState,
              isApplyingFilters: false,
              abortController: null,
            }
          }))
        },
        // Новый метод для синхронизации с новой системой фильтров
        syncWithFilterStore: () => {
          // Динамический импорт для избежания циклических зависимостей
          import('../filters/store').then(({ useFilterStore }) => {
            const filterStore = useFilterStore.getState()
            const {
              selectedProjectId,
              selectedDepartmentId,
              selectedTeamId,
              selectedManagerId,
              selectedEmployeeId,
              selectedStageId,
              selectedObjectId,
            } = filterStore

            console.log("🔄 Синхронизация с новой системой фильтров:", {
              selectedProjectId,
              selectedDepartmentId,
              selectedTeamId,
              selectedManagerId,
              selectedEmployeeId,
              selectedStageId,
              selectedObjectId
            })

            const currentState = get()
            
            // Создаем новые фильтры со всеми параметрами
            const newFilters = {
              projectId: selectedProjectId,
              departmentId: selectedDepartmentId,
              teamId: selectedTeamId,
              managerId: selectedManagerId,
              employeeId: selectedEmployeeId,
              stageId: selectedStageId,
              objectId: selectedObjectId,
            }
            
            // Генерируем ключ для новых фильтров
            const newFiltersKey = currentState.generateFiltersKey(newFilters)
            
            // Проверяем, изменились ли фильтры
            const filtersChanged = currentState.syncState.filtersKey !== newFiltersKey
            
            // Проверяем, нужна ли первоначальная загрузка данных
            const needsInitialLoad = currentState.syncState.lastDataLoadTime === null

            if (filtersChanged || needsInitialLoad) {
              // Отменяем предыдущие запросы
              if (currentState.syncState.abortController) {
                currentState.syncState.abortController.abort()
              }
              
              // Создаем новый AbortController
              const abortController = new AbortController()
              
              // Обновляем состояние фильтров и синхронизации
              set({
                currentPage: 1,
                syncState: {
                  ...currentState.syncState,
                  isApplyingFilters: true,
                  currentFilters: newFilters,
                  filtersKey: newFiltersKey,
                  abortController: abortController,
                }
              })

              // Загружаем данные с новым AbortController
              get().fetchSectionsWithSync(abortController)
              // Если показаны отделы, загружаем их тоже
              if (currentState.showDepartments) {
                get().fetchDepartmentsWithSync(abortController)
              }
            }
          })
        },
      }),
      {
        name: "planning-data-storage",
        partialize: (state) => ({
          expandedSections: state.expandedSections,
          expandedDepartments: state.expandedDepartments,
          showDepartments: state.showDepartments,
          currentPage: state.currentPage,
        }),
      },
    ),
  ),
)
