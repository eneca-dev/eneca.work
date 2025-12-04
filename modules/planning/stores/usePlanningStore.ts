import { create } from "zustand"
import { devtools, persist } from "zustand/middleware"
import * as Sentry from "@sentry/nextjs"
import type { Section, Loading, Department, Team, Employee, ProjectSummary, TeamFreshness, DepartmentFreshness } from "../types"
import type { CalendarEvent } from "@/modules/calendar/types"
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
import { fetchTeamFreshness, confirmTeamActivity as confirmTeamActivityAPI, confirmMultipleTeamsActivity as confirmMultipleTeamsActivityAPI } from "../api/teamActivity"

// Переменная для хранения текущего Promise запроса саммари проектов
let fetchProjectSummariesPromise: Promise<void> | null = null

// Переменная для хранения текущего Promise загрузки отпусков
let loadVacationsPromise: Promise<void> | null = null

// Переменная для хранения текущего Promise загрузки freshness
let loadFreshnessPromise: Promise<void> | null = null

// Обновляем интерфейс PlanningState, добавляя функции архивирования
interface PlanningState {
  // Данные
  sections: Section[]
  allSections: Section[] // Все загруженные разделы
  departments: Department[] // Добавляем отделы
  // Саммари по проектам (ленивая загрузка секций при раскрытии)
  projectSummaries: ProjectSummary[]
  isLoadingProjectSummaries: boolean
  // Флаги загрузки секций по проектам
  projectSectionsLoading: Record<string, boolean>
  isLoadingSections: boolean
  isLoadingDepartments: boolean // Добавляем флаг загрузки отделов
  isDepartmentsFetching: boolean // Флаг для защиты от одновременных вызовов fetchDepartments
  expandedSections: Record<string, boolean> // Отслеживание раскрытых разделов
  expandedDepartments: Record<string, boolean> // Отслеживание раскрытых отделов
  expandedTeams: Record<string, boolean> // Отслеживание раскрытых команд
  expandedEmployees: Record<string, boolean> // Отслеживание раскрытых сотрудников
  showSections: boolean // Флаг для показа/скрытия разделов
  showDepartments: boolean // Флаг для показа/скрытия отделов
  // Группировка
  groupByProject: boolean
  expandedProjectGroups: Record<string, boolean>

  // Пагинация
  currentPage: number
  sectionsPerPage: number

  // Состояние синхронизации фильтров и данных
  syncState: {
    isApplyingFilters: boolean
    lastAppliedFilters: {
      subdivisionId: string | null
      projectId: string | null
      departmentId: string | null
      teamId: string | null
      managerId: string | null
      employeeId: string | null
      stageId: string | null
      objectId: string | null
    } | null
    currentFilters: {
      subdivisionId: string | null
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

  // Кэш отпусков, больничных и отгулов (загружаем ВСЕ без фильтров, фильтруем на клиенте)
  vacationsCache: {
    // ВСЕ отпуска (без фильтрации по отделу/команде)
    data: Record<string, Record<string, number>>  // userId -> { date -> rate }
    // Метаданные по сотрудникам (для фильтрации на клиенте)
    metadata: Record<string, {
      departmentId: string | null
      teamId: string | null
    }>
    // Границы загруженного диапазона (с буфером)
    cacheStartDate: string | null
    cacheEndDate: string | null
    // Метаданные
    lastLoaded: number | null
    isLoading: boolean
  }

  // Кэш больничных
  sickLeavesCache: {
    data: Record<string, Record<string, number>>  // userId -> { date -> rate }
    metadata: Record<string, {
      departmentId: string | null
      teamId: string | null
    }>
  }

  // Кэш отгулов
  timeOffsCache: {
    data: Record<string, Record<string, number>>  // userId -> { date -> rate }
    metadata: Record<string, {
      departmentId: string | null
      teamId: string | null
    }>
  }

  // Кэш актуальности команд (freshness)
  freshnessCache: {
    data: Record<string, TeamFreshness>  // teamId -> freshness data
    departmentAggregates: Record<string, DepartmentFreshness>
    lastLoaded: number | null
    isLoading: boolean
  }

  // Глобальные события календаря (для рабочих/нерабочих дней)
  globalCalendarEvents: CalendarEvent[]
  isLoadingGlobalEvents: boolean

  // Действия
  fetchProjectSummaries: () => Promise<void>
  ensureProjectSectionsLoaded: (projectId: string) => Promise<void>
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
    subdivisionId?: string | null,
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
    stageId?: string
    projectId?: string
    projectName?: string
    sectionName?: string
    decompositionStageId?: string
    decompositionStageName?: string
    responsibleName?: string
    responsibleAvatarUrl?: string | null
    responsibleTeamName?: string | null
    comment?: string | null
  }) => Promise<{ success: boolean; error?: string; loadingId?: string }>
  refreshSectionLoadings: (sectionId: string) => Promise<{ success: boolean; error?: string }>
  archiveLoading: (loadingId: string) => Promise<{ success: boolean; error?: string }>
  restoreLoading: (loadingId: string) => Promise<{ success: boolean; error?: string }>
  fetchArchivedLoadings: (sectionId?: string, employeeId?: string) => Promise<Loading[]>
  toggleSectionExpanded: (sectionId: string) => void
  toggleDepartmentExpanded: (departmentId: string) => void
  toggleTeamExpanded: (teamId: string) => void
  toggleEmployeeExpanded: (employeeId: string) => void
  expandAllSections: () => Promise<void>
  collapseAllSections: () => void
  expandAllDepartments: () => void
  collapseAllDepartments: () => void
  expandAllTeams: () => void
  collapseAllTeams: () => void
  expandAllEmployees: () => void
  collapseAllEmployees: () => void
  setCurrentPage: (page: number) => void
  toggleShowSections: () => void
  toggleShowDepartments: () => void
  toggleGroupByProject: () => void
  toggleProjectGroup: (projectName: string) => void
  toggleProjectGroupById: (projectId: string) => void
  expandAllProjectGroups: () => void
  collapseAllProjectGroups: () => void
  filterSectionsByName: (query: string) => void
  filterSectionsByProject: (query: string) => void

  // Методы для работы с отпусками
  loadVacations: (forceReload?: boolean) => Promise<void>
  clearVacationsCache: () => void

  // Методы для работы с актуальностью команд (freshness)
  loadFreshness: (forceReload?: boolean) => Promise<void>
  invalidateFreshness: () => void
  confirmTeamActivity: (teamId: string) => Promise<{ success: boolean; error?: string }>
  confirmMultipleTeamsActivity: (teamIds: string[]) => Promise<{ success: boolean; error?: string }>

  // Методы для работы с глобальными событиями календаря
  loadGlobalCalendarEvents: () => Promise<void>

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
    Sentry.captureException(error, {
      tags: { 
        module: 'planning', 
        action: 'parse_timestamp',
        function: 'parseTimestampTz'
      },
      extra: {
        timestamptz: timestamptz,
        timestamp: new Date().toISOString()
      },
      level: 'warning'
    })
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
        projectSummaries: [],
        isLoadingProjectSummaries: false,
        projectSectionsLoading: {},
        isLoadingSections: false,
        isLoadingDepartments: false,
        isDepartmentsFetching: false,
        expandedSections: {},
        expandedDepartments: {},
        expandedTeams: {},
        expandedEmployees: {},
        showSections: true, // По умолчанию показываем разделы (группы проектов)
        showDepartments: true, // По умолчанию отделы показываются
        groupByProject: true,
        expandedProjectGroups: {},
        currentPage: 1,
        sectionsPerPage: 20,
        loadingsMap: {},
        searchQuery: "",
        projectSearchQuery: "",

        // Начальное состояние кэша отпусков
        vacationsCache: {
          data: {},
          metadata: {},
          cacheStartDate: null,
          cacheEndDate: null,
          lastLoaded: null,
          isLoading: false,
        },

        // Начальное состояние кэша больничных
        sickLeavesCache: {
          data: {},
          metadata: {},
        },

        // Начальное состояние кэша отгулов
        timeOffsCache: {
          data: {},
          metadata: {},
        },

        // Начальное состояние кэша актуальности команд
        freshnessCache: {
          data: {},
          departmentAggregates: {},
          lastLoaded: null,
          isLoading: false,
        },

        // Начальное состояние глобальных событий календаря
        globalCalendarEvents: [],
        isLoadingGlobalEvents: false,

        // Состояние синхронизации фильтров и данных
        syncState: {
          isApplyingFilters: false,
          lastAppliedFilters: null,
          currentFilters: {
            subdivisionId: null,
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
        setFilters: (projectId, departmentId, teamId, managerId = null, employeeId = null, stageId = null, objectId = null, subdivisionId = null) => {
          const currentState = get()

          // Создаем новые фильтры
          const newFilters = {
            subdivisionId,
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
            subdivisionId,
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

        // Загрузка саммари по проектам
        fetchProjectSummaries: async () => {
          // Если запрос уже выполняется, возвращаем существующий Promise
          if (fetchProjectSummariesPromise) {
            return fetchProjectSummariesPromise
          }

          // Создаём новый Promise и сохраняем его
          fetchProjectSummariesPromise = (async () => {
            set({ isLoadingProjectSummaries: true })
            try {
              const { fetchProjectSummaries } = await import("@/lib/supabase-client")
              const { useFilterStore } = await import('../filters/store')
              const {
                selectedProjectId,
                selectedManagerId,
                selectedDepartmentId,
                selectedTeamId,
                selectedEmployeeId,
              } = useFilterStore.getState()
              const summaries = await fetchProjectSummaries({
                projectId: selectedProjectId || undefined,
                managerId: selectedManagerId || undefined,
                departmentId: selectedDepartmentId || undefined,
                teamId: selectedTeamId || undefined,
                employeeId: selectedEmployeeId || undefined,
              })
              set({ projectSummaries: summaries, isLoadingProjectSummaries: false })
            } catch (error) {
              Sentry.captureException(error, {
                tags: {
                  module: 'planning',
                  action: 'fetch_project_summaries',
                  store: 'usePlanningStore'
                },
                extra: {
                  timestamp: new Date().toISOString()
                }
              })
              set({ isLoadingProjectSummaries: false })
            } finally {
              // Очищаем Promise после завершения
              fetchProjectSummariesPromise = null
            }
          })()

          return fetchProjectSummariesPromise
        },

        // Лениво подгружаем секции/загрузки для конкретного проекта
        ensureProjectSectionsLoaded: async (projectId: string) => {
          const { allSections, loadingsMap, projectSectionsLoading } = get()
          const alreadyLoaded = allSections.some((s) => s.projectId === projectId)
          if (alreadyLoaded) return
          try {
            // set loading flag
            set({ projectSectionsLoading: { ...projectSectionsLoading, [projectId]: true } })
            const { fetchSectionsWithLoadings } = await import("@/lib/supabase-client")
            // Подтягиваем актуальные фильтры из стора фильтров, чтобы не игнорировать организационные/этапные фильтры при раскрытии группы проекта
            const { useFilterStore } = await import("../filters/store")
            const {
              selectedDepartmentId,
              selectedTeamId,
              selectedManagerId,
              selectedEmployeeId,
              selectedStageId,
              selectedObjectId,
            } = useFilterStore.getState()

            const result = await fetchSectionsWithLoadings(
              projectId,
              selectedDepartmentId,
              selectedTeamId,
              selectedManagerId,
              selectedEmployeeId,
              selectedStageId,
              selectedObjectId,
            )
            if ('success' in result && !(result as any).sections) {
              console.error("ensureProjectSectionsLoaded: unexpected result", result)
              return
            }
            const { sections: newSections, loadingsMap: newLoadingsMap } = result as { sections: Section[]; loadingsMap: Record<string, Loading[]> }

            const existingById = new Map(allSections.map(s => [s.id, s]))
            const mergedSections: Section[] = [...allSections]
            newSections.forEach(s => { if (!existingById.has(s.id)) mergedSections.push(s) })

            const mergedLoadingsMap: Record<string, Loading[]> = { ...loadingsMap }
            Object.entries(newLoadingsMap).forEach(([sectionId, arr]) => {
              const existing = mergedLoadingsMap[sectionId] || []
              const existingIds = new Set(existing.map(l => l.id))
              mergedLoadingsMap[sectionId] = [...existing, ...arr.filter(l => !existingIds.has(l.id))]
            })

            set({ allSections: mergedSections, loadingsMap: mergedLoadingsMap })
          } catch (error) {
            Sentry.captureException(error, {
              tags: { 
                module: 'planning', 
                action: 'ensure_project_sections_loaded',
                store: 'usePlanningStore'
              },
              extra: {
                projectId
              }
            })
          } finally {
            const cur = get().projectSectionsLoading
            const next = { ...cur }
            delete next[projectId]
            set({ projectSectionsLoading: next })
          }
        },

        // Обновляем метод fetchSections для учета фильтра по команде
        fetchSections: async () => {
          set({ isLoadingSections: true })
          try {
            // Получаем текущие фильтры из новой системы фильтров
            const { useFilterStore } = await import('../filters/store')
            const {
              selectedSubdivisionId,
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
              selectedSubdivisionId,
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
              selectedSubdivisionId,
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
            Sentry.captureException(error, {
              tags: { 
                module: 'planning', 
                action: 'fetch_sections',
                store: 'usePlanningStore'
              },
              extra: {
                timestamp: new Date().toISOString()
              }
            })
            set({ isLoadingSections: false })
          }
        },

        // Обновляем функцию загрузки отделов для использования view_organizational_structure
        fetchDepartments: async () => {
          console.log("🏁 fetchDepartments() ВЫЗВАНА")
          // Защита от одновременных вызовов
          const state = get()
          if (state.isDepartmentsFetching) {
            console.log("⏸️ fetchDepartments уже выполняется, выход")
            return
          }

          console.log("📍 Начинаем загрузку отделов...")
          set({ isLoadingDepartments: true, isDepartmentsFetching: true })
          try {
            // Получаем текущие фильтры из новой системы фильтров
            const { useFilterStore } = await import('../filters/store')
            const { selectedSubdivisionId, selectedDepartmentId, selectedTeamId } = useFilterStore.getState()

            // Загружаем организационную структуру из нового представления
            let query = supabase.from("view_organizational_structure").select("*")

            // Если выбрано подразделение (и не выбран конкретный отдел)
            if (selectedSubdivisionId && !selectedDepartmentId) {
              // Получаем отделы подразделения
              const { data: depts } = await supabase
                .from("departments")
                .select("department_id")
                .eq("subdivision_id", selectedSubdivisionId)

              const deptIds = depts?.map(d => d.department_id) || []
              if (deptIds.length > 0) {
                query = query.in("department_id", deptIds)
              }
            }

            // Применяем фильтр по отделу, если он выбран (приоритет выше subdivision)
            if (selectedDepartmentId) {
              query = query.eq("department_id", selectedDepartmentId)
            }

            // Применяем фильтр по команде, если она выбрана
            if (selectedTeamId) {
              query = query.eq("team_id", selectedTeamId)
            }

            // Увеличиваем лимит с дефолтных 1000 до 10000 для получения всех данных
            const { data: orgData, error: orgError } = await query.limit(10000)

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
            // Если выбрано подразделение (и не выбран конкретный отдел), фильтруем по отделам подразделения
            if (selectedSubdivisionId && !selectedDepartmentId) {
              const { data: subdivDepts } = await supabase
                .from("departments")
                .select("department_id")
                .eq("subdivision_id", selectedSubdivisionId)

              const subdivDeptIds = subdivDepts?.map(d => d.department_id) || []
              if (subdivDeptIds.length > 0) {
                employeeQuery = employeeQuery.in("final_department_id", subdivDeptIds)
              }
            }

            if (selectedDepartmentId) {
              employeeQuery = employeeQuery.eq("final_department_id", selectedDepartmentId)
            }

            if (selectedTeamId) {
              employeeQuery = employeeQuery.eq("final_team_id", selectedTeamId)
            }

            // Увеличиваем лимит с дефолтных 1000 до 10000 для получения всех данных
            const { data: employeeData, error: employeeError } = await employeeQuery.limit(10000)

            if (employeeError) {
              console.error("Ошибка при загрузке данных о сотрудниках:", employeeError)
              throw employeeError
            }

            console.log("👥 Данные о сотрудниках:", employeeData?.length, "записей")

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
                const stageId = item.stage_id || undefined

                employee.loadings.push({
                  id: item.loading_id,
                  responsibleId: item.user_id,
                  responsibleName: item.full_name,
                  responsibleAvatarUrl: item.avatar_url,
                  responsibleTeamName: item.final_team_name,
                  sectionId: item.loading_section,
                  sectionName: item.section_name,
                  stageId: stageId,
                  stageName: item.stage_name || undefined,
                  projectId: item.project_id || null,
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

            // Получаем события ИЗ КЭША (фильтруем на клиенте по metadata)
            const vacationsCache = get().vacationsCache.data
            const vacationsMetadata = get().vacationsCache.metadata
            const sickLeavesCache = get().sickLeavesCache.data
            const timeOffsCache = get().timeOffsCache.data

            let vacationsProcessed = 0
            let sickLeavesProcessed = 0
            let timeOffsProcessed = 0

            employeesMap.forEach((employee) => {
              const userId = employee.id

              // Проверяем, должны ли отображаться события этого сотрудника (фильтрация на клиенте)
              const employeeMetadata = vacationsMetadata[userId]
              const shouldIncludeEvents =
                employeeMetadata &&
                (!selectedDepartmentId || employeeMetadata.departmentId === selectedDepartmentId) &&
                (!selectedTeamId || employeeMetadata.teamId === selectedTeamId)

              if (shouldIncludeEvents) {
                if (vacationsCache[userId]) {
                  employee.vacationsDaily = vacationsCache[userId]
                  vacationsProcessed += Object.keys(vacationsCache[userId]).length
                } else {
                  employee.vacationsDaily = {}
                }

                if (sickLeavesCache[userId]) {
                  employee.sickLeavesDaily = sickLeavesCache[userId]
                  sickLeavesProcessed += Object.keys(sickLeavesCache[userId]).length
                } else {
                  employee.sickLeavesDaily = {}
                }

                if (timeOffsCache[userId]) {
                  employee.timeOffsDaily = timeOffsCache[userId]
                  timeOffsProcessed += Object.keys(timeOffsCache[userId]).length
                } else {
                  employee.timeOffsDaily = {}
                }
              } else {
                employee.vacationsDaily = {}
                employee.sickLeavesDaily = {}
                employee.timeOffsDaily = {}
              }
            })
            console.log("🏝️ События из кэша:", {
              отпуска: vacationsProcessed,
              больничные: sickLeavesProcessed,
              отгулы: timeOffsProcessed
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

            // Добавляем синтетическую строку "Дефицит ..." для каждой команды на основании дефицитных загрузок
            try {
              // Получаем видимый период таймлайна для загрузки дефицитных загрузок
              const { usePlanningViewStore } = await import("../stores/usePlanningViewStore")
              const { startDate: timelineStartDate, daysToShow } = usePlanningViewStore.getState()
              const periodStart = new Date(timelineStartDate)
              const periodEnd = new Date(timelineStartDate)
              periodEnd.setDate(periodEnd.getDate() + daysToShow - 1)

              const shortageParams = {
                startDate: periodStart.toISOString().split("T")[0],
                endDate: periodEnd.toISOString().split("T")[0],
                departmentId: selectedDepartmentId || null,
                teamId: selectedTeamId || null,
              }
              const { fetchShortageLoadings } = await import("@/lib/supabase-client")
              const shortageRows = await fetchShortageLoadings(shortageParams)

              if (Array.isArray(shortageRows) && shortageRows.length > 0) {
                // Строим по днейным ключам нагрузки дефицита на команду и список записей дефицита
                const teamShortageDaily: Map<string, Record<string, number>> = new Map()
                const teamShortageLoadings: Map<string, Loading[]> = new Map()
                // Собираем section_id для последующего маппинга имен
                const shortageSectionIds: string[] = []

                shortageRows.forEach((row) => {
                  const teamId = (row as any).shortage_team_id as string | null
                  const departmentId = (row as any).shortage_department_id as string | null
                  // Привязываем к команде, если есть, иначе к отделу — здесь учитываем только команды
                  if (!teamId) return

                  const teamKey = teamId
                  if (!teamShortageDaily.has(teamKey)) {
                    teamShortageDaily.set(teamKey, {})
                  }
                  const daily = teamShortageDaily.get(teamKey)!

                  // Разворачиваем период в дни
                  const start = new Date(row.loading_start as string)
                  const finish = new Date(row.loading_finish as string)
                  const cur = new Date(start)
                  while (cur <= finish) {
                    const dateKey = cur.toISOString().split("T")[0]
                    daily[dateKey] = (daily[dateKey] || 0) + (Number(row.loading_rate) || 0)
                    cur.setDate(cur.getDate() + 1)
                  }

                  // Сохраняем саму запись дефицита как Loading
                  if ((row as any).loading_section) {
                    shortageSectionIds.push((row as any).loading_section as string)
                  }
                  const loadingItem: Loading = {
                    id: (row as any).loading_id,
                    sectionId: (row as any).loading_section,
                    startDate: new Date(row.loading_start as string),
                    endDate: new Date(row.loading_finish as string),
                    rate: Number(row.loading_rate) || 0,
                    stageId: "",
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    responsibleName: "Дефицит",
                    projectName: undefined,
                    sectionName: undefined,
                  }
                  if (!teamShortageLoadings.has(teamKey)) teamShortageLoadings.set(teamKey, [])
                  teamShortageLoadings.get(teamKey)!.push(loadingItem)
                })

                // Маппинг имен проекта/раздела по section_id
                try {
                  const uniqueSectionIds = Array.from(new Set(shortageSectionIds))
                  if (uniqueSectionIds.length > 0) {
                    const { data: sectionInfos } = await supabase
                      .from("view_section_hierarchy")
                      .select("section_id, section_name, project_name")
                      .in("section_id", uniqueSectionIds)
                    const sectionMap = new Map<string, { section_name: string; project_name: string }>()
                    ;(sectionInfos || []).forEach((s: any) => {
                      if (s.section_id) sectionMap.set(s.section_id, { section_name: s.section_name, project_name: s.project_name })
                    })
                    // Проставляем названия во все записи дефицита
                    teamShortageLoadings.forEach((arr) => {
                      arr.forEach((l) => {
                        if (l.sectionId && sectionMap.has(l.sectionId)) {
                          const info = sectionMap.get(l.sectionId)!
                          l.sectionName = info.section_name
                          l.projectName = info.project_name
                        }
                      })
                    })
                  }
                } catch (e) {
                  console.warn("Не удалось сопоставить имена проекта/раздела для дефицита:", e)
                }

                // Для каждой команды с дефицитом добавляем "фантомного" сотрудника
                teamsMap.forEach((team) => {
                  const teamKey = team.id
                  const daily = teamShortageDaily.get(teamKey)
                  if (daily && Object.keys(daily).length > 0) {
                    const shortageEmployee: Employee = {
                      id: `shortage:${team.id}`,
                      name: `Дефицит ${team.departmentName || "Отдел"} ${team.name}`,
                      fullName: `Дефицит ${team.departmentName || "Отдел"} ${team.name}`,
                      teamId: team.id,
                      teamName: team.name,
                      departmentId: team.departmentId,
                      departmentName: team.departmentName,
                      position: "",
                      avatarUrl: undefined,
                      workload: 0,
                      employmentRate: 1,
                      hasLoadings: true,
                      loadingsCount: (teamShortageLoadings.get(team.id) || []).length,
                      dailyWorkloads: daily,
                      vacationsDaily: {},
                      loadings: teamShortageLoadings.get(team.id) || [],
                      isShortage: true,
                      shortageDescription: null,
                    }

                    // Вставляем в начало списка сотрудников команды
                    team.employees = [shortageEmployee, ...team.employees]

                    // Добавляем дефицит к суммарной загрузке команды
                    if (!team.dailyWorkloads) team.dailyWorkloads = {}
                    Object.keys(daily).forEach((dateKey) => {
                      team.dailyWorkloads![dateKey] = (team.dailyWorkloads![dateKey] || 0) + (daily as any)[dateKey]
                    })
                  }
                })
              }
            } catch (e) {
              console.warn("Не удалось загрузить дефицитные загрузки:", e)
            }

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
              isDepartmentsFetching: false,
            })

            console.log(`✅ Загружено ${departments.length} отделов с руководителями`)

            // Загружаем данные freshness для команд
            await get().loadFreshness()
          } catch (error) {
            Sentry.captureException(error, {
              tags: {
                module: 'planning',
                action: 'fetch_departments',
                store: 'usePlanningStore'
              },
              extra: {
                timestamp: new Date().toISOString()
              }
            })
            set({ isLoadingDepartments: false, isDepartmentsFetching: false })
          }
        },

        // Проверка наличия загрузок для раздела (только активные)
        checkSectionHasLoadings: async (sectionId: string): Promise<boolean> => {
          try {
            const loadings = await fetchLoadings(sectionId, true)
            return Array.isArray(loadings) && loadings.length > 0
          } catch (error) {
            Sentry.captureException(error, {
              tags: { 
                module: 'planning', 
                action: 'check_section_has_loadings',
                store: 'usePlanningStore'
              },
              extra: {
                section_id: sectionId,
                timestamp: new Date().toISOString()
              }
            })
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
              // Берём корректные поля из ответа fetchLoadings (view_sections_with_loadings)
              sectionId: item.section_id,
              stageId: item.loading_stage || undefined,  // loading_stage - это decomposition_stage_id из loadings
              stageName: item.stage_name || undefined,
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
            Sentry.captureException(error, {
              tags: { 
                module: 'planning', 
                action: 'fetch_section_loadings',
                store: 'usePlanningStore'
              },
              extra: {
                section_id: sectionId,
                timestamp: new Date().toISOString()
              }
            })
            return []
          }
        },

        // Создание новой загрузки
        createLoading: async (loadingData) => {
          return Sentry.startSpan(
            {
              op: "store.action",
              name: "Создание загрузки в сторе планирования",
            },
            async (span) => {
              try {
                span.setAttribute("responsible_id", loadingData.responsibleId)
                span.setAttribute("section_id", loadingData.sectionId)
                span.setAttribute("project_name", loadingData.projectName || "")
                span.setAttribute("rate", loadingData.rate)

                // Подготавливаем данные для API
            const apiData = {
              responsibleId: loadingData.responsibleId,
              sectionId: loadingData.sectionId,
              startDate: loadingData.startDate.toISOString().split("T")[0],
              endDate: loadingData.endDate.toISOString().split("T")[0],
              rate: loadingData.rate,
              stageId: loadingData.stageId,
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
              projectId: loadingData.projectId,
              projectName: loadingData.projectName,
              startDate: loadingData.startDate,
              endDate: loadingData.endDate,
              rate: loadingData.rate,
              stageId: loadingData.stageId || "",
              comment: (loadingData as any).comment,
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
        }
        );
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
          return Sentry.startSpan(
            {
              op: "store.action",
              name: "Обновление загрузки в сторе планирования",
            },
            async (span) => {
              try {
                span.setAttribute("loading_id", loadingId)
                if (updates.sectionId) span.setAttribute("section_id", updates.sectionId)
                if (updates.rate !== undefined) span.setAttribute("rate", updates.rate)
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
            if (updates.responsibleId) {
              apiUpdates.responsibleId = updates.responsibleId
            }
            if (updates.stageId) {
              apiUpdates.stageId = updates.stageId
            }
            if (updates.comment !== undefined) {
              apiUpdates.comment = updates.comment
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
            // Если изменился responsibleId, нужно переместить загрузку между сотрудниками
            let loadingToMove: Loading | undefined
            let oldResponsibleId: string | undefined

            // Сначала находим загрузку и определяем, изменился ли сотрудник
            if (finalUpdates.responsibleId) {
              departments.forEach((department) => {
                department.teams.forEach((team) => {
                  team.employees.forEach((employee) => {
                    const found = employee.loadings?.find((l) => l.id === loadingId)
                    if (found && employee.id !== finalUpdates.responsibleId) {
                      loadingToMove = { ...found, ...finalUpdates }
                      oldResponsibleId = employee.id
                    }
                  })
                })
              })
            }

            const updatedDepartments = departments.map((department) => {
              const updatedTeams = department.teams.map((team) => {
                const updatedEmployees = team.employees.map((employee) => {
                  let updatedLoadings: Loading[]

                  if (loadingToMove && oldResponsibleId) {
                    // Смена сотрудника: удаляем у старого, добавляем новому
                    if (employee.id === oldResponsibleId) {
                      // Удаляем загрузку у старого сотрудника
                      updatedLoadings = employee.loadings?.filter((l) => l.id !== loadingId) || []
                    } else if (employee.id === finalUpdates.responsibleId) {
                      // Добавляем загрузку новому сотруднику
                      updatedLoadings = [...(employee.loadings || []), loadingToMove]
                    } else {
                      // Другие сотрудники - без изменений
                      updatedLoadings = employee.loadings || []
                    }
                  } else {
                    // Обычное обновление без смены сотрудника
                    updatedLoadings = employee.loadings?.map((loading) =>
                      loading.id === loadingId ? { ...loading, ...finalUpdates } : loading,
                    ) || []
                  }

                  // Пересчитываем dailyWorkloads сотрудника
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
                })

                // Пересчитываем dailyWorkloads команды на основе сотрудников
                const teamDailyWorkloads: Record<string, number> = {}
                updatedEmployees.forEach((employee) => {
                  Object.keys(employee.dailyWorkloads || {}).forEach((dateKey) => {
                    if (!teamDailyWorkloads[dateKey]) {
                      teamDailyWorkloads[dateKey] = 0
                    }
                    teamDailyWorkloads[dateKey] += employee.dailyWorkloads[dateKey]
                  })
                })

                return {
                  ...team,
                  employees: updatedEmployees,
                  dailyWorkloads: teamDailyWorkloads,
                }
              })

              // Пересчитываем dailyWorkloads отдела на основе команд
              const departmentDailyWorkloads: Record<string, number> = {}
              updatedTeams.forEach((team) => {
                Object.keys(team.dailyWorkloads || {}).forEach((dateKey) => {
                  if (!departmentDailyWorkloads[dateKey]) {
                    departmentDailyWorkloads[dateKey] = 0
                  }
                  departmentDailyWorkloads[dateKey] += (team.dailyWorkloads || {})[dateKey] || 0
                })
              })

              return {
                ...department,
                teams: updatedTeams,
                dailyWorkloads: departmentDailyWorkloads,
              }
            })

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
                span.setAttribute("db.success", false)
                Sentry.captureException(error, {
                  tags: { 
                    module: 'planning', 
                    action: 'update_loading',
                    store: 'usePlanningStore'
                  },
                  extra: {
                    loading_id: loadingId,
                    updates: JSON.stringify(updates),
                    timestamp: new Date().toISOString()
                  }
                })
                return { success: false, error: "Произошла неожиданная ошибка" }
              }
            }
          )
        },

        // Удаление загрузки
        deleteLoading: async (loadingId: string) => {
          return Sentry.startSpan(
            {
              op: "store.action",
              name: "Удаление загрузки в сторе планирования",
            },
            async (span) => {
              try {
                span.setAttribute("loading_id", loadingId)
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
                span.setAttribute("db.success", false)
                Sentry.captureException(error, {
                  tags: { 
                    module: 'planning', 
                    action: 'delete_loading',
                    store: 'usePlanningStore'
                  },
                  extra: {
                    loading_id: loadingId,
                    timestamp: new Date().toISOString()
                  }
                })
                return { success: false, error: "Произошла неожиданная ошибка" }
              }
            }
          )
        },

        // Архивирование загрузки
        archiveLoading: async (loadingId: string) => {
          return Sentry.startSpan(
            {
              op: "store.action",
              name: "Архивирование загрузки в сторе планирования",
            },
            async (span) => {
              try {
                span.setAttribute("loading_id", loadingId)
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
                span.setAttribute("db.success", false)
                Sentry.captureException(error, {
                  tags: { 
                    module: 'planning', 
                    action: 'archive_loading',
                    store: 'usePlanningStore'
                  },
                  extra: {
                    loading_id: loadingId,
                    timestamp: new Date().toISOString()
                  }
                })
                return { success: false, error: "Произошла неожиданная ошибка" }
              }
            }
          )
        },

        // Восстановление загрузки из архива
        restoreLoading: async (loadingId: string) => {
          return Sentry.startSpan(
            {
              op: "store.action", 
              name: "Восстановление загрузки из архива",
            },
            async (span) => {
              try {
                span.setAttribute("loading_id", loadingId)
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
                span.setAttribute("db.success", false)
                Sentry.captureException(error, {
                  tags: { 
                    module: 'planning', 
                    action: 'restore_loading',
                    store: 'usePlanningStore'
                  },
                  extra: {
                    loading_id: loadingId,
                    timestamp: new Date().toISOString()
                  }
                })
                return { success: false, error: "Произошла неожиданная ошибка" }
              }
            }
          )
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
              stageId: "",
              endDate: parseTimestampTz(item.loading_finish) || new Date(),
              rate: item.loading_rate || 1,
              createdAt: parseTimestampTz(item.loading_created) || new Date(),
              updatedAt: parseTimestampTz(item.loading_updated) || new Date(),
            })) : []

            return loadings
          } catch (error) {
            Sentry.captureException(error, {
              tags: { 
                module: 'planning', 
                action: 'fetch_archived_loadings',
                store: 'usePlanningStore'
              },
              extra: {
                section_id: sectionId,
                employee_id: employeeId,
                timestamp: new Date().toISOString()
              }
            })
            return []
          }
        },

        // Переключение состояния раскрытия раздела
        toggleSectionExpanded: async (sectionId: string) => {
          const { sections, allSections, expandedSections, loadingsMap } = get()

          // Находим раздел в sections или allSections (для группировки по проектам)
          const section = sections.find((s) => s.id === sectionId) || allSections.find((s) => s.id === sectionId)

          // Раздел должен иметь потомков: либо загрузки, либо этапы
          const hasStages = section && Array.isArray(section.decompositionStages) && section.decompositionStages.length > 0
          const hasChildren = section && (section.hasLoadings || hasStages)
          if (!section || !hasChildren) return

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

        // Переключение состояния раскрытия команды (запоминаем глобально)
        toggleTeamExpanded: (teamId: string) => {
          set((state) => ({
            expandedTeams: {
              ...state.expandedTeams,
              [teamId]: !state.expandedTeams[teamId],
            },
            departments: state.departments.map((dept) => ({
              ...dept,
              teams: dept.teams.map((team) => (
                team.id === teamId ? ({ ...team, isExpanded: !state.expandedTeams[teamId] } as any) : team
              )),
            })),
          }))
        },

        // Переключение состояния раскрытия сотрудника (для показа его детальных загрузок)
        toggleEmployeeExpanded: (employeeId: string) => {
          set((state) => ({
            expandedEmployees: {
              ...state.expandedEmployees,
              [employeeId]: !state.expandedEmployees[employeeId],
            },
          }))
        },

        // Развернуть все разделы
        expandAllSections: async () => {
          const { sections, loadingsMap } = get()
          const sectionsToExpand = sections.filter((section) => {
            const hasStages = Array.isArray(section.decompositionStages) && section.decompositionStages.length > 0
            return section.hasLoadings || hasStages
          })

          // Создаем объект с состоянием раскрытия для всех разделов с потомками
          const newExpandedSections: Record<string, boolean> = {}
          sectionsToExpand.forEach((section) => {
            newExpandedSections[section.id] = true
          })

          const idsToExpand = new Set(sectionsToExpand.map((s) => s.id))

          // Обновляем состояние
          set((state) => ({
            expandedSections: newExpandedSections,
            sections: state.sections.map((s) => {
              if (idsToExpand.has(s.id)) {
                return {
                  ...s,
                  isExpanded: true,
                  // Для разделов с загрузками — актуализируем список загрузок из карты
                  loadings: s.hasLoadings
                    ? mergeLoadingsWithoutDuplicates(s.loadings || [], loadingsMap[s.id] || [])
                    : s.loadings,
                }
              }
              return s
            }),
            allSections: state.allSections.map((s) => (idsToExpand.has(s.id) ? { ...s, isExpanded: true } : s)),
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

        // Развернуть все команды во всех отделах
        expandAllTeams: () => {
          const { departments } = get()
          const newExpandedTeams: Record<string, boolean> = {}
          departments.forEach((dept) => {
            dept.teams.forEach((team) => {
              newExpandedTeams[team.id] = true
            })
          })
          set((state) => ({
            expandedTeams: newExpandedTeams,
          }))
        },

        // Свернуть все команды во всех отделах
        collapseAllTeams: () => {
          set({ expandedTeams: {} })
        },

        // Развернуть всех сотрудников (детали) у кого есть загрузки
        expandAllEmployees: () => {
          const { departments } = get()
          const newExpandedEmployees: Record<string, boolean> = {}
          departments.forEach((dept) => {
            dept.teams.forEach((team) => {
              team.employees.forEach((emp) => {
                if (emp.loadings && emp.loadings.length > 0) {
                  newExpandedEmployees[emp.id] = true
                }
              })
            })
          })
          set({ expandedEmployees: newExpandedEmployees })
        },

        // Свернуть всех сотрудников (детали)
        collapseAllEmployees: () => {
          set({ expandedEmployees: {} })
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

        // Переключатель группировки по проектам
        toggleGroupByProject: () => {
          const { groupByProject } = get()
          set({ groupByProject: !groupByProject })
        },

        // Переключить конкретную проектную группу
        toggleProjectGroup: (projectName: string) => {
          set((state) => ({
            expandedProjectGroups: {
              ...state.expandedProjectGroups,
              [projectName]: !state.expandedProjectGroups[projectName],
            },
          }))
        },
        // Переключение группы по projectId с ленивой подгрузкой при раскрытии
        toggleProjectGroupById: (projectId: string) => {
          const { expandedProjectGroups, ensureProjectSectionsLoaded } = get()
          const willExpand = !(expandedProjectGroups[projectId] === true)
          set({
            expandedProjectGroups: {
              ...expandedProjectGroups,
              [projectId]: willExpand,
            },
          })
          if (willExpand) {
            void ensureProjectSectionsLoaded(projectId)
          }
        },

        // Развернуть все проектные группы
        expandAllProjectGroups: () => {
          const { sections } = get()
          const all: Record<string, boolean> = {}
          sections.forEach((s) => {
            const key = s.projectName || "Без проекта"
            all[key] = true
          })
          set({ expandedProjectGroups: all })
        },

        // Свернуть все проектные группы
        collapseAllProjectGroups: () => {
          const { sections } = get()
          const all: Record<string, boolean> = {}
          sections.forEach((s) => {
            const key = s.projectName || "Без проекта"
            all[key] = false
          })
          set({ expandedProjectGroups: all })
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

        // Загрузка отпусков с буферным кэшированием
        loadVacations: async (forceReload = false) => {
          // Если принудительное обновление, сбрасываем существующий promise
          if (forceReload) {
            loadVacationsPromise = null
          }

          // Если запрос уже выполняется, возвращаем существующий Promise
          if (loadVacationsPromise) {
            return loadVacationsPromise
          }

          // Создаём новый Promise и сохраняем его
          loadVacationsPromise = (async () => {
            const cache = get().vacationsCache

            // ✅ НЕМЕДЛЕННО устанавливаем флаг
            set({ vacationsCache: { ...cache, isLoading: true } })

            const { usePlanningViewStore } = await import("../stores/usePlanningViewStore")

            const { startDate, daysToShow } = usePlanningViewStore.getState()

            // Вычисляем ВИДИМЫЙ диапазон (FIX: off-by-one error)
            const visibleStart = new Date(startDate)
            const visibleEnd = new Date(startDate)
            visibleEnd.setDate(visibleEnd.getDate() + daysToShow - 1) // ← исправлено: -1

          // Константы кэширования
          const CACHE_BUFFER_DAYS = 60        // Буфер с каждой стороны
          const CACHE_TTL_MS = 10 * 60 * 1000 // 10 минут

          // Проверяем кэш (только по датам, БЕЗ фильтров!)
          if (!forceReload && cache.cacheStartDate && cache.cacheEndDate) {
            const cacheStart = new Date(cache.cacheStartDate)
            const cacheEnd = new Date(cache.cacheEndDate)

            // Проверяем TTL
            const isExpired = Date.now() - (cache.lastLoaded || 0) > CACHE_TTL_MS

            // Проверяем буфер
            const hasBuffer = visibleStart >= cacheStart && visibleEnd <= cacheEnd

            // Проверяем запас в буфере (для предзагрузки)
            const daysUntilCacheStart = Math.floor((visibleStart.getTime() - cacheStart.getTime()) / (1000 * 60 * 60 * 24))
            const daysUntilCacheEnd = Math.floor((cacheEnd.getTime() - visibleEnd.getTime()) / (1000 * 60 * 60 * 24))
            const RELOAD_THRESHOLD_DAYS = 30

            if (!isExpired && hasBuffer && daysUntilCacheStart >= RELOAD_THRESHOLD_DAYS && daysUntilCacheEnd >= RELOAD_THRESHOLD_DAYS) {
              console.log("✅ Используем кэш отпусков", {
                кэш: `${cache.cacheStartDate} — ${cache.cacheEndDate}`,
                видимо: `${visibleStart.toISOString().split("T")[0]} — ${visibleEnd.toISOString().split("T")[0]}`,
                запасСлева: daysUntilCacheStart,
                запасСправа: daysUntilCacheEnd
              })
              // Сбрасываем флаг isLoading перед возвратом
              set({ vacationsCache: { ...cache, isLoading: false } })
              return
            }

            if (isExpired) {
              console.log("🔄 Кэш отпусков устарел (TTL истёк)")
            } else if (!hasBuffer) {
              console.log("🔄 Видимый диапазон вышел за границы кэша")
            } else {
              console.log("🔄 Мало запаса в буфере, предзагрузка")
            }
          } else {
            console.log("🔄 Кэш отпусков пуст, первая загрузка")
          }

          try {
            // Вычисляем диапазон С БУФЕРОМ
            const cacheStart = new Date(visibleStart)
            cacheStart.setDate(cacheStart.getDate() - CACHE_BUFFER_DAYS)

            const cacheEnd = new Date(visibleEnd)
            cacheEnd.setDate(cacheEnd.getDate() + CACHE_BUFFER_DAYS)

            const cacheStartStr = cacheStart.toISOString().split("T")[0]
            const cacheEndStr = cacheEnd.toISOString().split("T")[0]

            console.log(`🏝️ Загрузка отпусков, больничных и отгулов (без фильтров): ${cacheStartStr} — ${cacheEndStr}`)

            // Загружаем ВСЕ события из calendar_events (БЕЗ ФИЛЬТРОВ по department/team!)
            const { data: calendarEvents, error } = await supabase
              .from("calendar_events")
              .select(`
                calendar_event_id,
                calendar_event_type,
                calendar_event_created_by,
                calendar_event_date_start,
                calendar_event_date_end,
                profiles:calendar_event_created_by (
                  department_id,
                  team_id
                )
              `)
              .eq("calendar_event_is_global", false)
              .in("calendar_event_type", ["Отпуск одобрен", "Больничный", "Отгул"])
              .gte("calendar_event_date_start", cacheStartStr)
              .lte("calendar_event_date_start", cacheEndStr)

            if (error) throw error

            // Вспомогательная функция для раскладывания события по дням
            const expandEventToDays = (startDate: Date, endDate: Date | null): string[] => {
              const days: string[] = []
              const current = new Date(startDate)
              const end = endDate ? new Date(endDate) : new Date(startDate)

              while (current <= end) {
                days.push(current.toISOString().split("T")[0])
                current.setDate(current.getDate() + 1)
              }
              return days
            }

            // Группируем по типу и user_id
            const vacationsMap: Record<string, Record<string, number>> = {}
            const sickLeavesMap: Record<string, Record<string, number>> = {}
            const timeOffsMap: Record<string, Record<string, number>> = {}
            const metadata: Record<string, { departmentId: string | null; teamId: string | null }> = {}

            calendarEvents?.forEach((event: any) => {
              const userId = event.calendar_event_created_by
              const eventType = event.calendar_event_type
              const profile = Array.isArray(event.profiles) ? event.profiles[0] : event.profiles

              const days = expandEventToDays(
                new Date(event.calendar_event_date_start),
                event.calendar_event_date_end ? new Date(event.calendar_event_date_end) : null
              )

              // Определяем целевую карту в зависимости от типа события
              let targetMap: Record<string, Record<string, number>>

              if (eventType === "Отпуск одобрен") {
                targetMap = vacationsMap
              } else if (eventType === "Больничный") {
                targetMap = sickLeavesMap
              } else if (eventType === "Отгул") {
                targetMap = timeOffsMap
              } else {
                return // Пропускаем неизвестные типы
              }

              // Инициализируем карту для пользователя если нужно
              if (!targetMap[userId]) {
                targetMap[userId] = {}
              }

              // Добавляем все дни события
              days.forEach(day => {
                targetMap[userId][day] = 1
              })

              // Сохраняем метаданные для фильтрации на клиенте (один раз на пользователя)
              if (!metadata[userId] && profile) {
                metadata[userId] = {
                  departmentId: profile.department_id,
                  teamId: profile.team_id,
                }
              }
            })

            set({
              vacationsCache: {
                data: vacationsMap,
                metadata,
                cacheStartDate: cacheStartStr,
                cacheEndDate: cacheEndStr,
                lastLoaded: Date.now(),
                isLoading: false,
              },
              sickLeavesCache: {
                data: sickLeavesMap,
                metadata,
              },
              timeOffsCache: {
                data: timeOffsMap,
                metadata,
              },
            })

            const totalDays = Math.floor((cacheEnd.getTime() - cacheStart.getTime()) / (1000 * 60 * 60 * 24))
            console.log(`✅ Загружено событий: отпуска (${Object.keys(vacationsMap).length}), больничные (${Object.keys(sickLeavesMap).length}), отгулы (${Object.keys(timeOffsMap).length}) за ${totalDays} дней`)
          } catch (error) {
            console.error("❌ Ошибка загрузки отпусков:", error)
            Sentry.captureException(error, {
              tags: {
                module: 'planning',
                action: 'load_vacations',
                store: 'usePlanningStore'
              }
            })
            set({ vacationsCache: { ...get().vacationsCache, isLoading: false } })
          } finally {
            // Очищаем Promise после завершения
            loadVacationsPromise = null
          }
          })()

          return loadVacationsPromise
        },

        // Очистка кэша отпусков, больничных и отгулов
        clearVacationsCache: () => {
          console.log("🗑️ Очистка кэша событий (отпуска, больничные, отгулы)")
          set({
            vacationsCache: {
              data: {},
              metadata: {},
              cacheStartDate: null,
              cacheEndDate: null,
              lastLoaded: null,
              isLoading: false,
            },
            sickLeavesCache: {
              data: {},
              metadata: {},
            },
            timeOffsCache: {
              data: {},
              metadata: {},
            },
          })
        },

        // Загрузка данных актуальности команд (freshness)
        loadFreshness: async (forceReload = false) => {
          const state = get()
          const now = Date.now()
          const TTL = 5 * 60 * 1000 // 5 минут

          // Если принудительная перезагрузка, очищаем существующий promise
          if (forceReload) {
            loadFreshnessPromise = null
          }

          // Если запрос уже выполняется, возвращаем существующий promise
          if (loadFreshnessPromise) {
            return loadFreshnessPromise
          }

          // Проверка кеша
          if (!forceReload && state.freshnessCache.lastLoaded && (now - state.freshnessCache.lastLoaded) < TTL) {
            return
          }

          // Создаем новый promise и сохраняем его
          loadFreshnessPromise = (async () => {
            set({ freshnessCache: { ...state.freshnessCache, isLoading: true } })

            try {
              const freshness = await fetchTeamFreshness()

              const dataMap: Record<string, TeamFreshness> = {}
              freshness.forEach((f) => {
                dataMap[f.teamId] = f
              })

              const departmentAgg: Record<string, DepartmentFreshness> = {}
              freshness.forEach((f) => {
                // Пропускаем команды без данных о daysSinceUpdate
                if (f.daysSinceUpdate === undefined) return

                if (!departmentAgg[f.departmentId]) {
                  departmentAgg[f.departmentId] = {
                    departmentId: f.departmentId,
                    daysSinceUpdate: f.daysSinceUpdate,
                    teamsCount: 1,
                  }
                } else {
                  departmentAgg[f.departmentId].daysSinceUpdate = Math.max(
                    departmentAgg[f.departmentId].daysSinceUpdate,
                    f.daysSinceUpdate
                  )
                  departmentAgg[f.departmentId].teamsCount++
                }
              })

              set({
                freshnessCache: {
                  data: dataMap,
                  departmentAggregates: departmentAgg,
                  lastLoaded: now,
                  isLoading: false,
                },
              })
            } catch (error) {
              console.error("❌ Ошибка загрузки freshness:", error)
              set({ freshnessCache: { ...state.freshnessCache, isLoading: false } })
            } finally {
              loadFreshnessPromise = null
            }
          })()

          return loadFreshnessPromise
        },

        invalidateFreshness: () => {
          set({
            freshnessCache: {
              data: {},
              departmentAggregates: {},
              lastLoaded: null,
              isLoading: false,
            },
          })
        },

        confirmTeamActivity: async (teamId: string) => {
          console.log("🔔 confirmTeamActivity() вызвана для команды:", teamId)
          try {
            const result = await confirmTeamActivityAPI(teamId)

            if (result.success) {
              console.log(`✅ Команда ${teamId} актуализирована`)
              await get().loadFreshness(true)
            } else {
              console.error(`❌ Ошибка актуализации команды ${teamId}:`, result.error)
            }

            return result
          } catch (error) {
            console.error("❌ Неожиданная ошибка при актуализации:", error)
            return { success: false, error: "Неожиданная ошибка" }
          }
        },

        confirmMultipleTeamsActivity: async (teamIds: string[]) => {
          console.log(`🔔 confirmMultipleTeamsActivity() вызвана для ${teamIds.length} команд`)
          try {
            const result = await confirmMultipleTeamsActivityAPI(teamIds)

            if (result.success) {
              console.log(`✅ Все ${teamIds.length} команд актуализированы`)
              await get().loadFreshness(true)
            } else {
              console.error(`❌ Ошибка актуализации команд:`, result.error)
            }

            return result
          } catch (error) {
            console.error("❌ Неожиданная ошибка при актуализации команд:", error)
            return { success: false, error: "Неожиданная ошибка" }
          }
        },

        // Загрузка глобальных событий календаря
        loadGlobalCalendarEvents: async () => {
          return Sentry.startSpan(
            {
              op: "planning.load_global_calendar_events",
              name: "Load Global Calendar Events",
            },
            async (span) => {
              try {
                set({ isLoadingGlobalEvents: true })

                // Загружаем только глобальные события
                const { data, error } = await supabase
                  .from('calendar_events')
                  .select('*')
                  .eq('calendar_event_is_global', true)
                  .order('calendar_event_date_start', { ascending: true })

                if (error) {
                  span.setAttribute("load.success", false)
                  span.setAttribute("load.error", error.message)
                  Sentry.captureException(error, {
                    tags: {
                      module: 'planning',
                      action: 'load_global_calendar_events',
                      error_type: 'db_error'
                    },
                    extra: {
                      timestamp: new Date().toISOString()
                    }
                  })
                  throw error
                }

                span.setAttribute("load.success", true)
                span.setAttribute("events.count", data?.length || 0)

                console.log("✅ Загружено глобальных событий:", data?.length || 0)

                set({ globalCalendarEvents: data || [] })
              } catch (error) {
                span.setAttribute("load.success", false)
                span.recordException(error as Error)
                console.error("❌ Ошибка загрузки глобальных событий:", error)
                // Не бросаем ошибку дальше, чтобы не ломать UI
                set({ globalCalendarEvents: [] })
              } finally {
                set({ isLoadingGlobalEvents: false })
              }
            }
          )
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
            const { selectedSubdivisionId, selectedDepartmentId, selectedTeamId, selectedEmployeeId } = useFilterStore.getState()

            console.log("🏢 Синхронная загрузка отделов с фильтрами:", {
              selectedSubdivisionId,
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

            // Получаем ID отделов подразделения для фильтрации (если выбрано подразделение, но не конкретный отдел)
            let subdivDeptIds: string[] = []
            if (selectedSubdivisionId && !selectedDepartmentId) {
              const { data: depts } = await supabase
                .from("departments")
                .select("department_id")
                .eq("subdivision_id", selectedSubdivisionId)

              subdivDeptIds = depts?.map(d => d.department_id) || []
              if (subdivDeptIds.length > 0) {
                query = query.in("department_id", subdivDeptIds)
              }
            }

            // Применяем фильтр по отделу, если он выбран
            if (selectedDepartmentId) {
              query = query.eq("department_id", selectedDepartmentId)
            }

            // Применяем фильтр по команде, если она выбрана
            if (selectedTeamId) {
              query = query.eq("team_id", selectedTeamId)
            }

            // Увеличиваем лимит с дефолтных 1000 до 10000 для получения всех данных
            const { data: orgData, error: orgError } = await query.limit(10000)

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
            // Если выбрано подразделение (и не выбран конкретный отдел), фильтруем по отделам подразделения
            if (selectedSubdivisionId && !selectedDepartmentId && subdivDeptIds.length > 0) {
              employeeQuery = employeeQuery.in("final_department_id", subdivDeptIds)
            }

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

            // Увеличиваем лимит с дефолтных 1000 до 10000 для получения всех данных
            const { data: employeeData, error: employeeError } = await employeeQuery.limit(10000)

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
                const stageId = item.stage_id || undefined

                employee.loadings.push({
                  id: item.loading_id,
                  responsibleId: item.user_id,
                  responsibleName: item.full_name,
                  responsibleAvatarUrl: item.avatar_url,
                  responsibleTeamName: item.final_team_name,
                  sectionId: item.loading_section,
                  sectionName: item.section_name,
                  stageId: stageId,
                  stageName: item.stage_name || undefined,
                  projectId: item.project_id || null,
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

            // Получаем события ИЗ КЭША (фильтруем на клиенте по metadata)
            const vacationsCache = get().vacationsCache.data
            const vacationsMetadata = get().vacationsCache.metadata
            const sickLeavesCache = get().sickLeavesCache.data
            const timeOffsCache = get().timeOffsCache.data

            let vacationsProcessed = 0
            let sickLeavesProcessed = 0
            let timeOffsProcessed = 0

            employeesMap.forEach((employee) => {
              const userId = employee.id

              // Проверяем, должны ли отображаться события этого сотрудника (фильтрация на клиенте)
              const employeeMetadata = vacationsMetadata[userId]
              const shouldIncludeEvents =
                employeeMetadata &&
                (!selectedDepartmentId || employeeMetadata.departmentId === selectedDepartmentId) &&
                (!selectedTeamId || employeeMetadata.teamId === selectedTeamId) &&
                (!selectedEmployeeId || userId === selectedEmployeeId)

              if (shouldIncludeEvents) {
                if (vacationsCache[userId]) {
                  employee.vacationsDaily = vacationsCache[userId]
                  vacationsProcessed += Object.keys(vacationsCache[userId]).length
                } else {
                  employee.vacationsDaily = {}
                }

                if (sickLeavesCache[userId]) {
                  employee.sickLeavesDaily = sickLeavesCache[userId]
                  sickLeavesProcessed += Object.keys(sickLeavesCache[userId]).length
                } else {
                  employee.sickLeavesDaily = {}
                }

                if (timeOffsCache[userId]) {
                  employee.timeOffsDaily = timeOffsCache[userId]
                  timeOffsProcessed += Object.keys(timeOffsCache[userId]).length
                } else {
                  employee.timeOffsDaily = {}
                }
              } else {
                employee.vacationsDaily = {}
                employee.sickLeavesDaily = {}
                employee.timeOffsDaily = {}
              }
            })
            console.log("🏝️ События из кэша (дни):", {
              отпуска: vacationsProcessed,
              больничные: sickLeavesProcessed,
              отгулы: timeOffsProcessed
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

            // Загружаем данные freshness для команд
            await get().loadFreshness()
            console.log("🎯 loadFreshness() завершена")
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
              selectedSubdivisionId,
              selectedProjectId,
              selectedDepartmentId,
              selectedTeamId,
              selectedManagerId,
              selectedEmployeeId,
              selectedStageId,
              selectedObjectId,
            } = filterStore

            console.log("🔄 Синхронизация с новой системой фильтров:", {
              selectedSubdivisionId,
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
              subdivisionId: selectedSubdivisionId,
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
        version: 2,
        migrate: (persistedState: any, version: number) => {
          try {
            // До v2 мы сохраняли showDepartments и могли зафиксировать false,
            // что сбивает дефолт при первой загрузке. Принудительно включаем.
            if (version < 2 && persistedState) {
              const { showDepartments: _oldShowDepartments, ...rest } = persistedState as any
              return { ...rest, showDepartments: true }
            }
          } catch (_) {
            // no-op, вернём как есть ниже
          }
          return persistedState as any
        },
        partialize: (state) => ({
          expandedSections: state.expandedSections,
          expandedDepartments: state.expandedDepartments,
          currentPage: state.currentPage,
        }),
      },
    ),
  ),
)
