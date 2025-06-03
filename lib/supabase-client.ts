import { createClient } from "@supabase/supabase-js"
import type { Section, Loading } from "@/modules/planning/types"

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
  loading_start: string | null
  loading_finish: string | null
  loading_rate: number | null
  loading_status: "active" | "archived"
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
  section_responsible_name: string | null
  section_responsible_avatar: string | null
  section_start_date: string | null
  section_end_date: string | null
  latest_plan_loading_status: string | null
  has_loadings: boolean
  loading_id: string | null
  loading_responsible: string | null
  loading_start: string | null
  loading_finish: string | null
  loading_rate: number | null
  loading_status: string | null
  loading_created: string | null
  loading_updated: string | null
  responsible_first_name: string | null
  responsible_last_name: string | null
  responsible_avatar: string | null
  responsible_team_name: string | null
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
  section_name: string | null
  project_id: string | null
  project_name: string | null
  project_status: string | null
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
}

// Валидация переменных окружения
function validateEnvironmentVariables() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL не установлена. Пожалуйста, добавьте переменную окружения в файл .env.local"
    )
  }

  if (!supabaseAnonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY не установлена. Пожалуйста, добавьте переменную окружения в файл .env.local"
    )
  }

  return { supabaseUrl, supabaseAnonKey }
}

// Создаем клиент Supabase с валидацией переменных окружения
const { supabaseUrl, supabaseAnonKey } = validateEnvironmentVariables()
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Интерфейс для структурированной ошибки
interface StructuredError {
  success: false
  error: string
  details?: any
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

// Обновляем функцию fetchLoadings для использования представления active_loadings
export async function fetchLoadings(sectionId: string, checkOnly = false): Promise<LoadingData[] | StructuredError> {
  try {
    let query = supabase
      .from("active_loadings")
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
      .eq("loading_section", sectionId)

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
): Promise<{ sections: Section[]; loadingsMap: Record<string, Loading[]> } | StructuredError> {
  try {
    // Строим запрос к представлению, но добавляем фильтр по активным загрузкам
    let query = supabase.from("view_sections_with_loadings").select("*")

    // Применяем фильтры
    if (projectId) {
      query = query.eq("project_id", projectId)
    }

    // Если выбран менеджер, но не выбран конкретный проект,
    // фильтруем по менеджеру через подзапрос
    if (managerId && !projectId) {
      // Получаем проекты менеджера
      const { data: managerProjects, error: managerProjectsError } = await supabase
        .from("projects")
        .select("project_id")
        .eq("project_manager", managerId)
        .eq("project_status", "active")

      if (managerProjectsError) {
        console.error("Ошибка при загрузке проектов менеджера:", managerProjectsError)
        return {
          success: false,
          error: "Не удалось загрузить проекты менеджера",
          details: managerProjectsError
        }
      }

      const projectIds = managerProjects.map((p) => p.project_id)

      // Если у менеджера нет проектов, возвращаем пустой результат
      if (projectIds.length === 0) {
        return { sections: [], loadingsMap: {} }
      }

      // Фильтруем по проектам менеджера
      query = query.in("project_id", projectIds)
    }

    if (departmentId) {
      query = query.eq("responsible_department_id", departmentId)
    }

    // Добавляем фильтр по команде, если он указан
    if (teamId) {
      query = query.eq("responsible_team_id", teamId)
    }

    // Фильтруем только активные загрузки или записи без загрузок
    query = query.or("loading_status.eq.active,loading_status.is.null")

    const { data, error } = await query

    if (error) {
      console.error("Ошибка при загрузке данных из view_sections_with_loadings:", error)
      return {
        success: false,
        error: "Не удалось загрузить данные разделов с загрузками",
        details: error
      }
    }

    // Группируем данные по разделам и загрузкам
    const sectionsMap = new Map<string, Section>()
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
          departmentName: sectionItem.responsible_department_name || undefined,
          startDate: sectionItem.section_start_date ? new Date(sectionItem.section_start_date) : new Date(),
          endDate: sectionItem.section_end_date ? new Date(sectionItem.section_end_date) : new Date(),
          status: sectionItem.latest_plan_loading_status || undefined,
          hasLoadings: sectionItem.has_loadings,
        })

        // Инициализируем массив загрузок для этого раздела
        loadingsMap[sectionItem.section_id] = []
      }

      // Добавляем загрузку, если она есть и активна
      if (sectionItem.loading_id && sectionItem.loading_status === "active") {
        loadingsMap[sectionItem.section_id].push({
          id: sectionItem.loading_id,
          responsibleId: sectionItem.loading_responsible || "",
          responsibleName:
            sectionItem.responsible_first_name && sectionItem.responsible_last_name
              ? `${sectionItem.responsible_first_name} ${sectionItem.responsible_last_name}`
              : undefined,
          responsibleAvatarUrl: sectionItem.responsible_avatar || undefined,
          responsibleTeamName: sectionItem.responsible_team_name || undefined,
          sectionId: sectionItem.section_id,
          startDate: sectionItem.loading_start ? new Date(sectionItem.loading_start) : new Date(),
          endDate: sectionItem.loading_finish ? new Date(sectionItem.loading_finish) : new Date(),
          rate: sectionItem.loading_rate || 1,
          createdAt: sectionItem.loading_created ? new Date(sectionItem.loading_created) : new Date(),
          updatedAt: sectionItem.loading_updated ? new Date(sectionItem.loading_updated) : new Date(),
        })
      }
    })

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
  },
): Promise<{ success: boolean; error?: string }> {
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

    console.log("Обновление загрузки:", loadingId, updateData)

    const { error } = await supabase.from("loadings").update(updateData).eq("loading_id", loadingId)

    if (error) {
      console.error("Ошибка при обновлении загрузки:", error)
      return { success: false, error: error.message }
    }

    console.log("Загрузка успешно обновлена:", loadingId)
    return { success: true }
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
}): Promise<{ success: boolean; error?: string; loadingId?: string }> {
  try {
    console.log("Создание новой загрузки:", loadingData)

    const { data, error } = await supabase
      .from("loadings")
      .insert({
        loading_responsible: loadingData.responsibleId,
        loading_section: loadingData.sectionId,
        loading_start: loadingData.startDate,
        loading_finish: loadingData.endDate,
        loading_rate: loadingData.rate,
        loading_status: "active",
        loading_created: new Date().toISOString(),
        loading_updated: new Date().toISOString(),
      })
      .select("loading_id")
      .single()

    if (error) {
      console.error("Ошибка при создании загрузки:", error)
      return { success: false, error: error.message }
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
