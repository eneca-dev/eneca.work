import { createClient } from "@/utils/supabase/client"
import type { Section, Loading, PlannedLoading, DecompositionStage } from "@/types/planning"
import { parseMinskDate } from '@/lib/timezone-utils'

// Используем единый клиент Supabase вместо создания нового
export const supabase = createClient()

// Обновляем интерфейс SectionHierarchy, добавляя поля аватаров
export interface SectionHierarchy {
  section_id: string
  section_name: string
  object_id: string
  object_name: string
  stage_id: string
  stage_name: string
  project_id: string
  project_name: string
  client_id: string
  client_name: string
  project_lead_engineer_name: string | null
  project_manager_name: string | null
  section_responsible_name: string | null
  // Добавляем поля аватаров
  project_lead_engineer_avatar: string | null
  project_manager_avatar: string | null
  section_responsible_avatar: string | null
  responsible_department_id: string | null
  responsible_department_name: string | null
  responsible_team_name: string | null
  total_loading_rate: number | null
  tasks_count: number | null
  latest_plan_loading_status: string | null
  section_start_date?: string | null
  section_end_date?: string | null
}

// Обновляем интерфейс LoadingData, добавляя поле статуса
export interface LoadingData {
  loading_id: string
  loading_responsible: string
  responsible_name?: string | null
  responsible_avatar: string | null
  loading_section: string
  loading_stage?: string | null
  loading_start: string | null
  loading_finish: string | null
  loading_rate: number | null
  loading_status: "active" | "archived"
  loading_comment?: string | null
  loading_created: string | null
  loading_updated: string | null
}

// Обновляем интерфейс SectionWithLoadings, добавляя поле для ID команды
export interface SectionWithLoadings {
  section_id: string
  section_name: string
  project_id: string
  project_name: string
  object_id: string | null
  object_name: string | null
  stage_id: string | null
  stage_name: string | null
  client_id: string | null
  responsible_department_id: string | null
  responsible_department_name: string | null
  section_responsible_id: string | null
  section_responsible_name: string | null
  section_responsible_avatar: string | null
  section_start_date: string | null
  section_end_date: string | null
  latest_plan_loading_status: string | null
  has_loadings: boolean
  loading_id: string | null
  loading_responsible: string | null
  loading_stage?: string | null
  loading_start: string | null
  loading_finish: string | null
  loading_rate: number | null
  loading_status: string | null
  loading_comment?: string | null
  loading_created: string | null
  loading_updated: string | null
  responsible_first_name: string | null
  responsible_last_name: string | null
  responsible_avatar: string | null
  responsible_team_name: string | null
  // Этапы декомпозиции раздела (подгружаются отдельным запросом)
  decompositionStages?: DecompositionStage[] | null
  // Доп. поля для плановых загрузок (nullable в view не гарантируется) — получим из отдельного запроса
}

// Добавляем новый интерфейс для данных о загрузке сотрудников
export interface EmployeeWorkloadData {
  user_id: string
  first_name: string
  last_name: string
  email: string
  position_name: string | null
  avatar_url: string | null
  team_id: string | null
  team_name: string | null
  team_code: string | null
  department_id: string | null
  department_name: string | null
  loading_id: string | null
  loading_section: string | null
  loading_start: string | null
  loading_finish: string | null
  loading_rate: number | null
  loading_status: "active" | "archived" | null
  loading_comment?: string | null
  section_name: string | null
  project_id: string | null
  project_name: string | null
  project_status: string | null
  stage_id: string | null
  stage_name: string | null
  has_loadings: boolean
  loadings_count: number
  employment_rate: number | null
}

// Интерфейс для данных обновления загрузки
interface LoadingUpdateData {
  loading_updated: string
  loading_start?: string
  loading_finish?: string
  loading_rate?: number
  loading_section?: string
  loading_responsible?: string
  loading_stage?: string
  loading_comment?: string
}


// Клиент Supabase уже создан выше в начале файла

// Интерфейс для структурированной ошибки
interface StructuredError {
  success: false
  error: string
  details?: any
}

// Тип для дефицитных загрузок (агрегированные данные)
export interface ShortageLoadingRow {
  loading_id: string
  loading_start: string
  loading_finish: string
  loading_rate: number
  loading_section: string | null
  shortage_department_id: string | null
  shortage_team_id: string | null
  shortage_description: string | null
  loading_status: "active" | "archived"
}


// Функция для получения разделов из представления view_section_hierarchy
export async function fetchSectionHierarchy(): Promise<SectionHierarchy[] | StructuredError> {
  try {
    const { data, error } = await supabase.from("view_section_hierarchy").select("*")

    if (error) {
      console.error("Ошибка при загрузке разделов:", error)
      return {
        success: false,
        error: "Не удалось загрузить разделы",
        details: error
      }
    }

    return data || []
  } catch (error) {
    console.error("Ошибка при загрузке разделов:", error)
    return {
      success: false,
      error: "Произошла неожиданная ошибка при загрузке разделов",
      details: error
    }
  }
}

// Обновляем функцию fetchLoadings для использования представления view_sections_with_loadings_v2
export async function fetchLoadings(sectionId: string, checkOnly = false): Promise<LoadingData[] | StructuredError> {
  try {
    let query = supabase
      .from("view_sections_with_loadings_v2")
      .select(`
        loading_id,
        loading_responsible,
        section_id,
        loading_stage,
        stage_name,
        loading_start,
        loading_finish,
        loading_rate,
        loading_created,
        loading_updated,
        loading_status,
        loading_comment,
        responsible_first_name,
        responsible_last_name,
        responsible_avatar
      `)
      .eq("section_id", sectionId)
      .not("loading_id", "is", null) // Только записи с загрузками

    // Если нужна только проверка наличия, ограничиваем выборку одной записью
    if (checkOnly) {
      query = query.limit(1)
    }

    const { data, error } = await query

    if (error) {
      console.error("Ошибка при загрузке активных загрузок:", error)
      return {
        success: false,
        error: "Не удалось загрузить активные загрузки",
        details: error
      }
    }

    // Преобразуем данные с добавлением полного имени ответственного
    return (data || []).map((item) => ({
      loading_id: item.loading_id,
      loading_responsible: item.loading_responsible,
      loading_section: item.section_id, // Маппим section_id в loading_section
      loading_stage: item.loading_stage ?? null,
      stage_name: item.stage_name ?? null,
      loading_start: item.loading_start,
      loading_finish: item.loading_finish,
      loading_rate: item.loading_rate,
      loading_status: item.loading_status,
      loading_comment: item.loading_comment ?? null,
      loading_created: item.loading_created,
      loading_updated: item.loading_updated,
      responsible_name: (item.responsible_first_name && item.responsible_last_name)
        ? `${item.responsible_first_name} ${item.responsible_last_name}`
        : null,
      responsible_avatar: item.responsible_avatar,
    }))
  } catch (error) {
    console.error("Ошибка при загрузке активных загрузок:", error)
    return {
      success: false,
      error: "Произошла неожиданная ошибка при загрузке активных загрузок",
      details: error
    }
  }
}

// Обновляем функцию fetchSectionsWithLoadings для использования только активных загрузок
export async function fetchSectionsWithLoadings(
  projectId: string | null = null,
  departmentId: string | null = null,
  teamId: string | null = null,
  managerId: string | null = null,
  employeeId: string | null = null,
  stageId: string | null = null,
  objectId: string | null = null,
  subdivisionId: string | null = null,
): Promise<{ sections: Section[]; loadingsMap: Record<string, Loading[]> } | StructuredError> {
  try {
    console.log("🔍 Фильтры для fetchSectionsWithLoadings:", {
      projectId,
      departmentId,
      teamId,
      managerId,
      employeeId,
      stageId,
      objectId,
      subdivisionId
    })

    let query = supabase.from("view_sections_with_loadings_v2").select("*")

    // Добавляем фильтр по проекту, если он указан
    if (projectId) {
      console.log("📁 Применяю фильтр по проекту:", projectId)
      query = query.eq("project_id", projectId)
    }

    // Добавляем фильтр по стадии, если она указана
    if (stageId) {
      console.log("🎯 Применяю фильтр по стадии:", stageId)
      query = query.eq("stage_id", stageId)
    }

    // Добавляем фильтр по объекту, если он указан
    if (objectId) {
      console.log("🏗️ Применяю фильтр по объекту:", objectId)
      query = query.eq("object_id", objectId)
    }

    if (managerId) {
      // Получаем проекты менеджера
      const { data: managerProjects, error: managerError } = await supabase
        .from("view_manager_projects")
        .select("project_id")
        .eq("manager_id", managerId)

      if (managerError) {
        console.error("Ошибка при получении проектов менеджера:", managerError)
        return {
          success: false,
          error: "Не удалось получить проекты менеджера",
          details: managerError
        }
      }

      const projectIds = managerProjects?.map(p => p.project_id) || []
      
      if (projectIds.length === 0) {
        console.log("У менеджера нет проектов")
        return { sections: [], loadingsMap: {} }
      }

      // Фильтруем по проектам менеджера (только если не указан конкретный проект)
      if (!projectId) {
        query = query.in("project_id", projectIds)
      }
    }

    // Если выбрано подразделение (и не выбран конкретный отдел)
    if (subdivisionId && !departmentId) {
      console.log("🏢 Применяю фильтр по подразделению:", subdivisionId)

      // Получаем все отделы подразделения
      const { data: subdivisionDepts, error: deptError } = await supabase
        .from("departments")
        .select("department_id")
        .eq("subdivision_id", subdivisionId)

      if (deptError) {
        console.error("Ошибка при получении отделов подразделения:", deptError)
        return {
          success: false,
          error: "Не удалось получить отделы подразделения",
          details: deptError
        }
      }

      const departmentIds = subdivisionDepts?.map(d => d.department_id) || []

      if (departmentIds.length === 0) {
        console.log("В подразделении нет отделов")
        return { sections: [], loadingsMap: {} }
      }

      // Фильтруем по отделам подразделения
      query = query.in("responsible_department_id", departmentIds)
    }

    if (departmentId) {
      console.log("🏢 Применяю фильтр по отделу:", departmentId)
      query = query.eq("responsible_department_id", departmentId)
    }

    // Добавляем фильтр по команде, если он указан
    if (teamId) {
      console.log("👥 Применяю фильтр по команде:", teamId)
      query = query.eq("responsible_team_id", teamId)
    }

    // Добавляем фильтр по сотруднику, если он указан
    if (employeeId) {
      console.log("👤 Применяю фильтр по сотруднику:", employeeId)
      // Показываем разделы где сотрудник либо ответственный за раздел, либо имеет активную загрузку
      query = query.or(`section_responsible_id.eq.${employeeId},loading_responsible.eq.${employeeId}`)
    }

    // Фильтруем только активные загрузки или записи без загрузок
    query = query.or("loading_status.eq.active,loading_status.is.null")

    const { data, error } = await query

    if (error) {
      console.error("Ошибка при загрузке данных из view_sections_with_loadings_v2:", error)
      return {
        success: false,
        error: "Не удалось загрузить данные разделов с загрузками",
        details: error
      }
    }

    console.log("📊 Получено записей из view_sections_with_loadings:", data?.length || 0)

    // Группируем данные по разделам и загрузкам
    const sectionsMap = new Map<string, Section & { decompositionStages: DecompositionStage[] }>()
    const loadingsMap: Record<string, Loading[]> = {}

    data?.forEach((item) => {
      const sectionItem = item as SectionWithLoadings

      // Обрабатываем раздел, если его еще нет в карте
      if (!sectionsMap.has(sectionItem.section_id)) {
        sectionsMap.set(sectionItem.section_id, {
          id: sectionItem.section_id,
          name: sectionItem.section_name,
          departmentId: sectionItem.responsible_department_id || "",
          projectId: sectionItem.project_id,
          projectName: sectionItem.project_name,
          objectId: sectionItem.object_id || undefined,
          objectName: sectionItem.object_name || undefined,
          stageId: sectionItem.stage_id || undefined,
          stageName: sectionItem.stage_name || undefined,
          clientId: sectionItem.client_id || undefined,
          responsibleName: sectionItem.section_responsible_name || undefined,
          responsibleAvatarUrl: sectionItem.section_responsible_avatar || undefined,
          // Прокидываем ID ответственного, чтобы сортировать загрузки и ставить метку
          // @ts-ignore - расширяем Section в рантайме
          responsibleId: sectionItem.section_responsible_id || undefined,
          departmentName: sectionItem.responsible_department_name || undefined,
          startDate: sectionItem.section_start_date ? new Date(sectionItem.section_start_date) : new Date(),
          endDate: sectionItem.section_end_date ? new Date(sectionItem.section_end_date) : new Date(),
          status: sectionItem.latest_plan_loading_status || undefined,
          hasLoadings: sectionItem.has_loadings,
          decompositionStages: [], // Будет заполнено ниже
        })

        // Инициализируем массив загрузок для этого раздела
        loadingsMap[sectionItem.section_id] = []
      }

      // Добавляем загрузку, если она есть и активна
      if (sectionItem.loading_id && sectionItem.loading_status === "active") {
        loadingsMap[sectionItem.section_id].push({
          id: sectionItem.loading_id,
          projectId: sectionItem.project_id || undefined,
          projectName: sectionItem.project_name || undefined,
          sectionId: sectionItem.section_id,
          sectionName: sectionItem.section_name || undefined,
          stageId: sectionItem.loading_stage || "",
          stageName: sectionItem.stage_name || undefined,
          responsibleId: sectionItem.loading_responsible || "",
          responsibleName:
            sectionItem.responsible_first_name && sectionItem.responsible_last_name
              ? `${sectionItem.responsible_first_name} ${sectionItem.responsible_last_name}`
              : undefined,
          responsibleAvatarUrl: sectionItem.responsible_avatar || undefined,
          responsibleTeamName: sectionItem.responsible_team_name || undefined,
          // ✅ Парсим даты в часовом поясе Минска
          startDate: sectionItem.loading_start ? parseMinskDate(sectionItem.loading_start) : new Date(),
          endDate: sectionItem.loading_finish ? parseMinskDate(sectionItem.loading_finish) : new Date(),
          rate: sectionItem.loading_rate || 1,
          comment: (sectionItem as any).loading_comment || undefined,
          createdAt: sectionItem.loading_created ? new Date(sectionItem.loading_created) : new Date(),
          updatedAt: sectionItem.loading_updated ? new Date(sectionItem.loading_updated) : new Date(),
        })
      }
    })

    // Загружаем этапы декомпозиции и плановые загрузки для всех разделов одним набором запросов
    const sectionIds = Array.from(sectionsMap.keys())
    if (sectionIds.length > 0) {
      const [stagesQ] = await Promise.all([
        supabase
          .from('decomposition_stages')
          .select('decomposition_stage_id, decomposition_stage_section_id, decomposition_stage_name, decomposition_stage_start, decomposition_stage_finish, decomposition_stage_order')
          .in('decomposition_stage_section_id', sectionIds)
          .order('decomposition_stage_order', { ascending: true })
      ])

      const stagesData = stagesQ.data
      const stagesError = stagesQ.error

      if (!stagesError && stagesData) {
        const stagesBySectionId: Record<string, any[]> = {}
        const allStageIds: string[] = []
        stagesData.forEach((stage: any) => {
          const sectionId = stage.decomposition_stage_section_id
          if (!stagesBySectionId[sectionId]) stagesBySectionId[sectionId] = []
          const stageObj = {
            id: stage.decomposition_stage_id,
            name: stage.decomposition_stage_name,
            start: stage.decomposition_stage_start ? new Date(stage.decomposition_stage_start) : null,
            finish: stage.decomposition_stage_finish ? new Date(stage.decomposition_stage_finish) : null,
          }
          stagesBySectionId[sectionId].push(stageObj)
          if (stageObj.id) allStageIds.push(stageObj.id)
        })

        // Загружаем статистику сложностей по этапам из представления и раскладываем по этапам
        let statsByStageId: Record<string, any[]> = {}
        if (allStageIds.length > 0) {
          const { data: statsData, error: statsError } = await supabase
            .from('view_stage_difficulty_stats')
            .select('stage_id, difficulty_id, difficulty_abbr, difficulty_definition, difficulty_weight, items_count, planned_hours, weighted_hours')
            .in('stage_id', allStageIds)

          if (!statsError && Array.isArray(statsData)) {
            for (const row of statsData) {
              const sId = row.stage_id as string
              ;(statsByStageId[sId] ||= []).push({
                difficulty_id: row.difficulty_id,
                difficulty_abbr: row.difficulty_abbr,
                difficulty_definition: row.difficulty_definition,
                difficulty_weight: Number(row.difficulty_weight ?? 0),
                items_count: Number(row.items_count ?? 0),
                planned_hours: Number(row.planned_hours ?? 0),
                weighted_hours: Number(row.weighted_hours ?? 0),
              })
            }
          } else if (statsError) {
            console.warn('Не удалось загрузить view_stage_difficulty_stats:', statsError)
          }
        }

        sectionsMap.forEach((section, sectionId) => {
          const stages = stagesBySectionId[sectionId] || []
          // Прикрепляем статистику сложностей к каждому этапу
          stages.forEach((st: any) => {
            st.difficultyStats = statsByStageId[st.id] || []
          })
          section.decompositionStages = stages
        })
      }
    }

    return {
      sections: Array.from(sectionsMap.values()),
      loadingsMap,
    }
  } catch (error) {
    console.error("Ошибка при загрузке данных из view_sections_with_loadings:", error)
    return {
      success: false,
      error: "Произошла неожиданная ошибка при загрузке данных разделов с загрузками",
      details: error
    }
  }
}

// Загрузка саммари проектов из представления view_project_summary
export async function fetchProjectSummaries(filters?: {
  projectId?: string | null
  managerId?: string | null
  departmentId?: string | null
  teamId?: string | null
  employeeId?: string | null
}): Promise<import("@/modules/planning/types").ProjectSummary[]> {
  try {
    let query = supabase.from("view_project_summary").select("*")

    if (filters?.projectId) {
      query = query.eq("project_id", filters.projectId)
    }
    if (filters?.managerId) {
      query = query.eq("manager_id", filters.managerId)
    }
    if (filters?.departmentId) {
      // uuid[] колонка department_ids позволяет contains([id])
      query = query.contains("department_ids", [filters.departmentId])
    }
    if (filters?.teamId) {
      query = query.contains("team_ids", [filters.teamId])
    }
    if (filters?.employeeId) {
      query = query.contains("employee_ids", [filters.employeeId])
    }

    const { data, error } = await query.order("project_name", { ascending: true })
    if (error) {
      console.error("Ошибка загрузки view_project_summary:", error)
      return []
    }

    return (data || []).map((row: any) => ({
      projectId: row.project_id,
      projectName: row.project_name,
      projectStatus: row.project_status ?? null,
      projectCreated: row.project_created ? new Date(row.project_created) : null,
      clientId: row.client_id ?? null,
      clientName: row.client_name ?? null,
      managerId: row.manager_id ?? null,
      managerName: row.manager_name ?? null,
      projectStartDate: row.project_start_date ? new Date(row.project_start_date) : null,
      projectEndDate: row.project_end_date ? new Date(row.project_end_date) : null,
      sectionsCount: Number(row.sections_count) || 0,
      employeesWithLoadingsToday: Number(row.employees_with_loadings_today) || 0,
      loadingsCountToday: Number(row.loadings_count_today) || 0,
      totalLoadingRateToday: Number(row.total_loading_rate_today) || 0,
      employeesWithLoadingsActive: Number(row.employees_with_loadings_active) || 0,
      loadingsCountActive: Number(row.loadings_count_active) || 0,
      totalLoadingRateActive: Number(row.total_loading_rate_active) || 0,
      engagedEmployeesTotal: Number(row.engaged_employees_total) || 0,
    }))
  } catch (e) {
    console.error("Неожиданная ошибка при загрузке view_project_summary:", e)
    return []
  }
}

// Создание дефицитной загрузки (без ответственного сотрудника)
export async function createShortageLoading(params: {
  startDate: string
  endDate: string
  rate: number
  departmentId?: string | null
  teamId?: string | null
  sectionId: string
  description?: string | null
}): Promise<{ success: boolean; error?: string; loadingId?: string }> {
  try {
    const payload: any = {
      is_shortage: true,
      loading_responsible: null,
      loading_start: params.startDate,
      loading_finish: params.endDate,
      loading_rate: params.rate,
      loading_status: "active",
      loading_created: new Date().toISOString(),
      loading_updated: new Date().toISOString(),
      shortage_department_id: params.departmentId || null,
      shortage_team_id: params.teamId || null,
      shortage_description: params.description || null,
      loading_section: params.sectionId,
    }

    const { data, error } = await supabase
      .from("loadings")
      .insert(payload)
      .select("loading_id")
      .single()

    if (error) {
      console.error("Ошибка при создании дефицитной загрузки:", error)
      return { success: false, error: error.message }
    }

    return { success: true, loadingId: data?.loading_id }
  } catch (error) {
    console.error("Неожиданная ошибка при создании дефицитной загрузки:", error)
    return { success: false, error: "Произошла неожиданная ошибка" }
  }
}

// Загрузка дефицитных загрузок по отделу/команде и диапазону дат
export async function fetchShortageLoadings(params: {
  startDate: string
  endDate: string
  departmentId?: string | null
  teamId?: string | null
}): Promise<ShortageLoadingRow[] | StructuredError> {
  try {
    let query = supabase
      .from("loadings")
      .select(
        `loading_id, loading_start, loading_finish, loading_rate, loading_status, loading_section, shortage_department_id, shortage_team_id, shortage_description`
      )
      .eq("is_shortage", true)
      .eq("loading_status", "active")
      // Пересечение периодов: начало <= конец периода и конец >= начало периода
      .lte("loading_start", params.endDate)
      .gte("loading_finish", params.startDate)

    if (params.teamId) {
      query = query.eq("shortage_team_id", params.teamId)
    } else if (params.departmentId) {
      query = query.eq("shortage_department_id", params.departmentId)
    }

    const { data, error } = await query

    if (error) {
      console.error("Ошибка при загрузке дефицитных загрузок:", error)
      return { success: false, error: "Не удалось загрузить дефицитные загрузки", details: error }
    }

    return (data || []) as ShortageLoadingRow[]
  } catch (error) {
    console.error("Неожиданная ошибка при загрузке дефицитных загрузок:", error)
    return { success: false, error: "Произошла неожиданная ошибка при загрузке дефицитных загрузок", details: error }
  }
}

// Обновляем функцию для получения данных о загрузке сотрудников (только активные)
export async function fetchEmployeeWorkloads(
  departmentId: string | null = null,
  teamId: string | null = null,
): Promise<EmployeeWorkloadData[] | StructuredError> {
  try {
    let query = supabase.from("view_employee_workloads").select("*")

    if (departmentId) {
      query = query.eq("department_id", departmentId)
    }

    if (teamId) {
      query = query.eq("team_id", teamId)
    }

    const { data, error } = await query

    if (error) {
      console.error("Ошибка при загрузке данных о загруженности сотрудников:", error)
      return {
        success: false,
        error: "Не удалось загрузить данные о загруженности сотрудников",
        details: error
      }
    }

    return data || []
  } catch (error) {
    console.error("Ошибка при загрузке данных о загруженности сотрудников:", error)
    return {
      success: false,
      error: "Произошла неожиданная ошибка при загрузке данных о загруженности сотрудников",
      details: error
    }
  }
}

// Функция для обновления загрузки
export async function updateLoading(
  loadingId: string,
  updates: {
    startDate?: string
    endDate?: string
    rate?: number
    projectId?: string
    sectionId?: string
    responsibleId?: string
    stageId?: string
    comment?: string
  },
): Promise<{
  success: boolean;
  error?: string;
  updatedLoading?: {
    id: string
    sectionId: string
    sectionName: string
    projectId: string
    projectName: string
    startDate: Date
    endDate: Date
    rate: number
    comment?: string
  }
}> {
  try {
    // Подготавливаем объект для обновления с правильной типизацией
    const updateData: LoadingUpdateData = {
      loading_updated: new Date().toISOString(),
    }

    // Добавляем только те поля, которые переданы
    if (updates.startDate) {
      updateData.loading_start = updates.startDate
    }
    if (updates.endDate) {
      updateData.loading_finish = updates.endDate
    }
    if (updates.rate !== undefined) {
      updateData.loading_rate = updates.rate
    }
    if (updates.sectionId) {
      updateData.loading_section = updates.sectionId
    }
    if (updates.responsibleId) {
      updateData.loading_responsible = updates.responsibleId
    }
    if (updates.stageId) {
      updateData.loading_stage = updates.stageId
    }
    if (updates.comment !== undefined) {
      updateData.loading_comment = updates.comment
    }

    console.log("Обновление загрузки:", loadingId, updateData)

    const { error } = await supabase.from("loadings").update(updateData).eq("loading_id", loadingId)

    if (error) {
      console.error("Ошибка при обновлении загрузки:", error)
      return { success: false, error: error.message }
    }

    // После успешного обновления получаем актуальные данные о загрузке с информацией о проекте и разделе
    const { data: loadingData, error: fetchError } = await supabase
      .from("view_sections_with_loadings_v2")
      .select(`
        loading_id,
        section_id,
        section_name,
        project_id,
        project_name,
        loading_start,
        loading_finish,
        loading_rate,
        loading_comment
      `)
      .eq("loading_id", loadingId)
      .single()

    if (fetchError) {
      console.error("Ошибка при получении обновленных данных загрузки:", fetchError)
      // Возвращаем успех, но без обновленных данных
      return { success: true }
    }

    const updatedLoading = {
      id: loadingData.loading_id,
      sectionId: loadingData.section_id,
      sectionName: loadingData.section_name,
      projectId: loadingData.project_id,
      projectName: loadingData.project_name,
      // ✅ Парсим даты в часовом поясе Минска
      startDate: parseMinskDate(loadingData.loading_start),
      endDate: parseMinskDate(loadingData.loading_finish),
      rate: loadingData.loading_rate || 1,
      comment: loadingData.loading_comment || undefined,
    }

    console.log("Загрузка успешно обновлена с актуальными данными:", updatedLoading)
    return { success: true, updatedLoading }
  } catch (error) {
    console.error("Ошибка при обновлении загрузки:", error)
    return { success: false, error: "Произошла неожиданная ошибка" }
  }
}

// Функция для удаления загрузки
export async function deleteLoading(loadingId: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log("Удаление загрузки:", loadingId)

    const { error } = await supabase.from("loadings").delete().eq("loading_id", loadingId)

    if (error) {
      console.error("Ошибка при удалении загрузки:", error)
      return { success: false, error: error.message }
    }

    console.log("Загрузка успешно удалена:", loadingId)
    return { success: true }
  } catch (error) {
    console.error("Ошибка при удалении загрузки:", error)
    return { success: false, error: "Произошла неожиданная ошибка" }
  }
}

// Новая функция для создания загрузки
export async function createLoading(loadingData: {
  responsibleId: string
  sectionId: string
  startDate: string
  endDate: string
  rate: number
  // Необязательный комментарий (если в БД нет колонки, запрос упадет — обработаем фолбэком)
  comment?: string
  stageId?: string
}): Promise<{ success: boolean; error?: string; loadingId?: string }> {
  try {
    console.log("Создание новой загрузки:", loadingData)

    // Первая попытка — с комментарием, если он передан
    const insertPayloadBase: any = {
      loading_responsible: loadingData.responsibleId,
      loading_section: loadingData.sectionId,
      loading_start: loadingData.startDate,
      loading_finish: loadingData.endDate,
      loading_rate: loadingData.rate,
      loading_stage: loadingData.stageId ?? null,
      loading_status: "active",
      loading_created: new Date().toISOString(),
      loading_updated: new Date().toISOString(),
    }

    const tryInsert = async (withComment: boolean) => {
      const payload = { ...insertPayloadBase, ...(withComment && loadingData.comment ? { loading_comment: loadingData.comment } : {}) }
      return await supabase
        .from("loadings")
        .insert(payload)
        .select("loading_id")
        .single()
    }

    let data, error
    ;({ data, error } = await tryInsert(true))

    if (error) {
      console.warn("createLoading: попытка с полем loading_comment не удалась, пробую без него", error?.message)
      ;({ data, error } = await tryInsert(false))
    }

    if (error) {
      console.error("Ошибка при создании загрузки:", error)
      return { success: false, error: error.message }
    }
    if (!data) {
      console.error("Ошибка: данные не получены после успешной вставки")
      return { success: false, error: "Данные не получены" }
    }

    console.log("Загрузка успешно создана:", data.loading_id)
    return { success: true, loadingId: data.loading_id }
  } catch (error) {
    console.error("Ошибка при создании загрузки:", error)
    return { success: false, error: "Произошла неожиданная ошибка" }
  }
}

// Новая функция для архивирования загрузки
export async function archiveLoading(loadingId: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log("Архивирование загрузки:", loadingId)

    const { error } = await supabase
      .from("loadings")
      .update({
        loading_status: "archived",
        loading_updated: new Date().toISOString(),
      })
      .eq("loading_id", loadingId)

    if (error) {
      console.error("Ошибка при архивировании загрузки:", error)
      return { success: false, error: error.message }
    }

    console.log("Загрузка успешно архивирована:", loadingId)
    return { success: true }
  } catch (error) {
    console.error("Ошибка при архивировании загрузки:", error)
    return { success: false, error: "Произошла неожиданная ошибка" }
  }
}

// Функция для восстановления загрузки из архива
export async function restoreLoading(loadingId: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log("Восстановление загрузки из архива:", loadingId)

    const { error } = await supabase
      .from("loadings")
      .update({
        loading_status: "active",
        loading_updated: new Date().toISOString(),
      })
      .eq("loading_id", loadingId)

    if (error) {
      console.error("Ошибка при восстановлении загрузки:", error)
      return { success: false, error: error.message }
    }

    console.log("Загрузка успешно восстановлена:", loadingId)
    return { success: true }
  } catch (error) {
    console.error("Ошибка при восстановлении загрузки:", error)
    return { success: false, error: "Произошла неожиданная ошибка" }
  }
}

// Функция для получения архивных загрузок
export async function fetchArchivedLoadings(
  sectionId?: string,
  employeeId?: string,
  limit = 50,
): Promise<LoadingData[] | StructuredError> {
  try {
    let query = supabase
      .from("archived_loadings")
      .select(`
        loading_id,
        loading_responsible,
        profiles:loading_responsible (
          first_name,
          last_name,
          avatar_url
        ),
        loading_section,
        loading_start,
        loading_finish,
        loading_rate,
        loading_status,
        loading_created,
        loading_updated
      `)
      .limit(limit)
      .order("loading_updated", { ascending: false })

    if (sectionId) {
      query = query.eq("loading_section", sectionId)
    }

    if (employeeId) {
      query = query.eq("loading_responsible", employeeId)
    }

    const { data, error } = await query

    if (error) {
      console.error("Ошибка при загрузке архивных загрузок:", error)
      return {
        success: false,
        error: "Не удалось загрузить архивные загрузки",
        details: error
      }
    }

    // Преобразуем данные для добавления имени и аватара ответственного
    return (data || []).map((item) => {
      // Исправляем типизацию профиля - это может быть объект или null
      const profile = Array.isArray(item.profiles) 
        ? item.profiles[0] as { first_name: string; last_name: string; avatar_url: string | null } | undefined
        : item.profiles as { first_name: string; last_name: string; avatar_url: string | null } | null
      return {
        ...item,
        responsible_name: profile ? `${profile.first_name} ${profile.last_name}` : null,
        responsible_avatar: profile?.avatar_url || null,
        profiles: undefined, // Удаляем вложенный объект profiles
      }
    })
  } catch (error) {
    console.error("Ошибка при загрузке архивных загрузок:", error)
    return {
      success: false,
      error: "Произошла неожиданная ошибка при загрузке архивных загрузок",
      details: error
    }
  }
}

// Функция для обновления ответственного за раздел
export async function updateSectionResponsible(
  sectionId: string,
  responsibleId: string,
): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    console.log("updateSectionResponsible: начало обновления", { sectionId, responsibleId })

    // Сначала проверим, существует ли раздел
    const { data: existingSection, error: checkError } = await supabase
      .from("sections")
      .select("section_id, section_name, section_responsible")
      .eq("section_id", sectionId)
      .single()

    if (checkError) {
      console.error("updateSectionResponsible: ошибка при проверке раздела:", checkError)
      return { success: false, error: `Раздел не найден: ${checkError.message}` }
    }

    console.log("updateSectionResponsible: найден раздел:", existingSection)

    // Обновляем ответственного
    const { data, error } = await supabase
      .from("sections")
      .update({
        section_responsible: responsibleId,
        section_updated: new Date().toISOString(),
      })
      .eq("section_id", sectionId)
      .select("section_id, section_name, section_responsible, section_updated")

    if (error) {
      console.error("updateSectionResponsible: ошибка при обновлении:", error)
      return { success: false, error: error.message }
    }

    console.log("updateSectionResponsible: успешное обновление:", data)
    return { success: true, data: data?.[0] }
  } catch (error) {
    console.error("updateSectionResponsible: неожиданная ошибка:", error)
    return { success: false, error: "Произошла неожиданная ошибка" }
  }
}

// Функция для обновления проекта
export async function updateProject(
  projectId: string,
  updates: {
    project_name?: string
    project_description?: string | null
    project_manager?: string | null
    project_lead_engineer?: string | null
    project_status?:
      | 'draft'
      | 'active'
      | 'completed'
      | 'paused'
      | 'waiting for input data'
      | 'author supervision'
      | 'actual calculation'
      | 'customer approval'
    client_id?: string | null
  }
): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    console.log("updateProject: начало обновления", { projectId, updates })

    // Сначала проверим, существует ли проект
    const { data: existingProject, error: checkError } = await supabase
      .from("projects")
      .select("project_id, project_name")
      .eq("project_id", projectId)
      .single()

    if (checkError) {
      console.error("updateProject: ошибка при проверке проекта:", checkError)
      return { success: false, error: `Проект не найден: ${checkError.message}` }
    }

    console.log("updateProject: найден проект:", existingProject)

    // Обновляем проект
    const { data, error } = await supabase
      .from("projects")
      .update({
        ...updates,
        project_updated: new Date().toISOString(),
      })
      .eq("project_id", projectId)
      .select()

    if (error) {
      console.error("updateProject: ошибка при обновлении:", error)
      return { success: false, error: error.message }
    }

    console.log("updateProject: успешное обновление:", data)
    return { success: true, data: data?.[0] }
  } catch (error) {
    console.error("updateProject: неожиданная ошибка:", error)
    return { success: false, error: "Произошла неожиданная ошибка" }
  }
}

// Функция для создания проекта
export async function createProject(newProject: {
  project_name: string
  project_description?: string | null
  project_manager?: string | null
  project_lead_engineer?: string | null
  project_status:
    | 'draft'
    | 'active'
    | 'completed'
    | 'paused'
    | 'waiting for input data'
    | 'author supervision'
    | 'actual calculation'
    | 'customer approval'
  client_id?: string | null
}): Promise<{ success: boolean; error?: string; projectId?: string }> {
  try {
    console.log('createProject: создание проекта', newProject)
    const { data, error } = await supabase
      .from('projects')
      .insert({
        project_name: newProject.project_name,
        project_description: newProject.project_description ?? null,
        project_manager: newProject.project_manager ?? null,
        project_lead_engineer: newProject.project_lead_engineer ?? null,
        project_status: newProject.project_status,
        client_id: newProject.client_id ?? null,
        project_created: new Date().toISOString(),
        project_updated: new Date().toISOString(),
      })
      .select('project_id')
      .single()

    if (error) {
      console.error('createProject: ошибка при создании', error)
      return { success: false, error: error.message }
    }

    return { success: true, projectId: data.project_id }
  } catch (error) {
    console.error('createProject: неожиданная ошибка', error)
    return { success: false, error: 'Произошла неожиданная ошибка' }
  }
}

// Функция для получения объектов проекта
export async function fetchProjectObjects(
  projectId: string,
  signal?: AbortSignal,
): Promise<{ id: string; name: string; projectId: string }[] | StructuredError> {
  try {
    if (!projectId) {
      console.warn("fetchProjectObjects: projectId не предоставлен")
      return []
    }

    console.log("fetchProjectObjects: начало загрузки объектов для проекта", projectId)

    // Проверяем подключение к Supabase
    if (!supabase) {
      console.error("fetchProjectObjects: клиент Supabase не инициализирован")
      return {
        success: false,
        error: "Клиент Supabase не инициализирован",
        details: { projectId }
      }
    }

    // Сначала проверим, существует ли представление
    console.log("fetchProjectObjects: проверяем доступность представления view_section_hierarchy")
    const { data: viewExists, error: viewError } = await supabase
      .from("view_section_hierarchy")
      .select("object_id")
      .limit(1)

    if (viewError) {
      // Безопасное логирование ошибки
      const errorInfo = {
        message: viewError.message || 'Неизвестная ошибка',
        code: viewError.code || 'NO_CODE',
        details: viewError.details || 'Нет деталей',
        hint: viewError.hint || 'Нет подсказки',
        originalError: JSON.stringify(viewError, null, 2)
      }

      console.error("fetchProjectObjects: представление view_section_hierarchy недоступно:", errorInfo)
      return {
        success: false,
        error: `Представление view_section_hierarchy недоступно: ${errorInfo.message}`,
        details: errorInfo
      }
    }

    console.log("fetchProjectObjects: представление доступно, найдено записей для проверки:", viewExists?.length || 0)

    // Получаем уникальные объекты для проекта через представление view_section_hierarchy
    const query = supabase
      .from("view_section_hierarchy")
      .select("object_id, object_name")
      .eq("project_id", projectId)
      .not("object_id", "is", null)
      .not("object_name", "is", null)

    console.log("fetchProjectObjects: выполняем запрос к БД для проекта", projectId)

    // Добавляем AbortSignal только если он предоставлен
    const { data, error } = signal 
      ? await query.abortSignal(signal)
      : await query

    if (error) {
      // Безопасное логирование ошибки с детальной информацией
      const errorInfo = {
        projectId,
        message: error.message || 'Неизвестная ошибка',
        code: error.code || 'NO_CODE',
        details: error.details || 'Нет деталей',
        hint: error.hint || 'Нет подсказки',
        originalError: JSON.stringify(error, null, 2),
        errorType: typeof error,
        errorConstructor: error.constructor?.name || 'Unknown'
      }
      
      console.error("fetchProjectObjects: ошибка запроса к БД:", errorInfo)
      return {
        success: false,
        error: `Не удалось загрузить объекты проекта: ${errorInfo.message}`,
        details: errorInfo
      }
    }

    console.log("fetchProjectObjects: получены данные:", {
      projectId,
      dataLength: data?.length || 0,
      sampleData: data?.slice(0, 3) // Показываем первые 3 записи для отладки
    })

    // Убираем дубликаты и преобразуем в нужный формат
    const uniqueObjects = new Map<string, { id: string; name: string; projectId: string }>()

    data?.forEach((item) => {
      if (item.object_id && item.object_name && !uniqueObjects.has(item.object_id)) {
        uniqueObjects.set(item.object_id, {
          id: item.object_id,
          name: item.object_name,
          projectId: projectId,
        })
      }
    })

    const result = Array.from(uniqueObjects.values()).sort((a, b) => a.name.localeCompare(b.name))
    
    console.log("fetchProjectObjects: успешно обработано объектов:", {
      projectId,
      totalObjects: result.length,
      objectNames: result.map(obj => obj.name)
    })

    return result
  } catch (error) {
    // Если операция была отменена, не логируем это как ошибку
    if (error instanceof Error && error.name === 'AbortError') {
      console.log("fetchProjectObjects: операция отменена для проекта", projectId)
      throw error
    }
    
    // Безопасное логирование неожиданной ошибки
    const errorInfo = {
      projectId,
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : 'Нет стека',
      originalError: JSON.stringify(error, Object.getOwnPropertyNames(error), 2),
      errorType: typeof error,
      errorConstructor: error?.constructor?.name || 'Unknown'
    }
    
    console.error("fetchProjectObjects: неожиданная ошибка:", errorInfo)
    
    return {
      success: false,
      error: `Произошла неожиданная ошибка при загрузке объектов проекта: ${errorInfo.errorMessage}`,
      details: errorInfo
    }
  }
}

// Функция для получения этапов проекта
export async function fetchProjectStages(
  projectId: string,
  signal?: AbortSignal,
): Promise<{ id: string; name: string; description?: string; projectId: string }[] | StructuredError> {
  try {
    if (!projectId) {
      console.warn("fetchProjectStages: projectId не предоставлен")
      return []
    }

    console.log("fetchProjectStages: начало загрузки этапов для проекта", projectId)

    if (!supabase) {
      console.error("fetchProjectStages: клиент Supabase не инициализирован")
      return {
        success: false,
        error: "Клиент Supabase не инициализирован",
        details: { projectId }
      }
    }

    const query = supabase
      .from("stages")
      .select("stage_id, stage_name, stage_description")
      .eq("stage_project_id", projectId)

    console.log("fetchProjectStages: выполняем запрос к БД для проекта", projectId)

    const { data, error } = signal 
      ? await query.abortSignal(signal)
      : await query

    if (error) {
      const errorInfo = {
        projectId,
        message: error.message || 'Неизвестная ошибка',
        code: error.code || 'NO_CODE',
        details: error.details || 'Нет деталей',
        originalError: JSON.stringify(error, null, 2)
      }
      
      console.error("fetchProjectStages: ошибка запроса к БД:", errorInfo)
      return {
        success: false,
        error: `Не удалось загрузить этапы проекта: ${errorInfo.message}`,
        details: errorInfo
      }
    }

    console.log("fetchProjectStages: получены данные:", {
      projectId,
      dataLength: data?.length || 0,
      sampleData: data?.slice(0, 3)
    })

    const result = data?.map((item) => ({
      id: item.stage_id,
      name: item.stage_name,
      description: item.stage_description || undefined,
      projectId: projectId,
    })).sort((a, b) => a.name.localeCompare(b.name)) || []
    
    console.log("fetchProjectStages: успешно обработано этапов:", {
      projectId,
      totalStages: result.length,
      stageNames: result.map(stage => stage.name)
    })

    return result
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log("fetchProjectStages: операция отменена для проекта", projectId)
      throw error
    }
    
    const errorInfo = {
      projectId,
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : 'Нет стека',
      originalError: JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
    }
    
    console.error("fetchProjectStages: неожиданная ошибка:", errorInfo)
    
    return {
      success: false,
      error: `Произошла неожиданная ошибка при загрузке этапов проекта: ${errorInfo.errorMessage}`,
      details: errorInfo
    }
  }
}

// Функция для получения объектов этапа
export async function fetchStageObjects(
  stageId: string,
  signal?: AbortSignal,
): Promise<{ id: string; name: string; description?: string; stageId: string }[] | StructuredError> {
  try {
    if (!stageId) {
      console.warn("fetchStageObjects: stageId не предоставлен")
      return []
    }

    console.log("fetchStageObjects: начало загрузки объектов для этапа", stageId)

    if (!supabase) {
      console.error("fetchStageObjects: клиент Supabase не инициализирован")
      return {
        success: false,
        error: "Клиент Supabase не инициализирован",
        details: { stageId }
      }
    }

    const query = supabase
      .from("objects")
      .select("object_id, object_name, object_description")
      .eq("object_stage_id", stageId)

    console.log("fetchStageObjects: выполняем запрос к БД для этапа", stageId)

    const { data, error } = signal 
      ? await query.abortSignal(signal)
      : await query

    if (error) {
      const errorInfo = {
        stageId,
        message: error.message || 'Неизвестная ошибка',
        code: error.code || 'NO_CODE',
        details: error.details || 'Нет деталей',
        originalError: JSON.stringify(error, null, 2)
      }
      
      console.error("fetchStageObjects: ошибка запроса к БД:", errorInfo)
      return {
        success: false,
        error: `Не удалось загрузить объекты этапа: ${errorInfo.message}`,
        details: errorInfo
      }
    }

    console.log("fetchStageObjects: получены данные:", {
      stageId,
      dataLength: data?.length || 0,
      sampleData: data?.slice(0, 3)
    })

    const result = data?.map((item) => ({
      id: item.object_id,
      name: item.object_name,
      description: item.object_description || undefined,
      stageId: stageId,
    })).sort((a, b) => a.name.localeCompare(b.name)) || []
    
    console.log("fetchStageObjects: успешно обработано объектов:", {
      stageId,
      totalObjects: result.length,
      objectNames: result.map(obj => obj.name)
    })

    return result
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log("fetchStageObjects: операция отменена для этапа", stageId)
      throw error
    }
    
    const errorInfo = {
      stageId,
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : 'Нет стека',
      originalError: JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
    }
    
    console.error("fetchStageObjects: неожиданная ошибка:", errorInfo)
    
    return {
      success: false,
      error: `Произошла неожиданная ошибка при загрузке объектов этапа: ${errorInfo.errorMessage}`,
      details: errorInfo
    }
  }
}
