'use server'

/**
 * Loading Modal New - Server Actions для работы с деревом проектов
 *
 * Операции:
 * - fetchProjectsList: загрузка списка проектов с фильтрацией
 * - fetchProjectTree: загрузка дерева конкретного проекта
 * - createDecompositionStage: создание нового этапа декомпозиции
 */

import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/modules/cache'
import type { Database } from '@/types/db'
import { getFilterContext } from '@/modules/permissions/server/get-filter-context'
import { getRestrictedProjectIds } from '@/modules/permissions/server/restricted-projects'

// ============================================================================
// Types
// ============================================================================

type ProjectTreeRow = Database['public']['Views']['view_project_tree']['Row']
type DecompositionStageInsert = Database['public']['Tables']['decomposition_stages']['Insert']
type DecompositionStageRow = Database['public']['Tables']['decomposition_stages']['Row']

export interface ProjectListItem {
  id: string
  name: string
  status: string
  managerId: string | null
  managerName: string | null
  managerAvatar: string | null
  isFavorite: boolean
  stage_type: string | null
}

export interface ProjectTreeNode {
  id: string
  name: string
  type: 'project' | 'object' | 'section' | 'decomposition_stage'
  level: number
  projectId: string | null
  objectId: string | null
  sectionId: string | null
  decompositionStageId: string | null
  stageType: string | null // Стадия проекта как параметр (из projects.stage_type)
  description: string | null
  responsibleId: string | null
  responsibleName: string | null
  responsibleAvatar: string | null
  departmentId: string | null
  departmentName: string | null
  teamId: string | null
  teamName: string | null
  startDate: string | null
  endDate: string | null
  hasChildren: boolean
}

export interface FetchProjectsListInput {
  /** Режим: 'my' - мои проекты, 'all' - все проекты */
  mode: 'my' | 'all'
  /** ID текущего пользователя (для фильтрации "Мои проекты") */
  userId: string
}

export interface FetchProjectTreeInput {
  /** ID проекта */
  projectId: string
}

export interface CreateDecompositionStageInput {
  /** ID раздела */
  sectionId: string
  /** Название этапа */
  name: string
  /** Описание (опционально) */
  description?: string
  /** Порядок (опционально, если не указан - будет max + 1) */
  order?: number
}

export interface DecompositionStageResult {
  id: string
  name: string
  description: string | null
  sectionId: string
  order: number
  startDate: string | null
  endDate: string | null
  statusId: string | null
  responsibles: string[] | null
  createdBy: string | null
  createdAt: string | null
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Конвертация row из decomposition_stages в DecompositionStageResult
 */
function mapStageRowToResult(row: DecompositionStageRow): DecompositionStageResult {
  return {
    id: row.decomposition_stage_id,
    name: row.decomposition_stage_name,
    description: row.decomposition_stage_description,
    sectionId: row.decomposition_stage_section_id,
    order: row.decomposition_stage_order || 0,
    startDate: row.decomposition_stage_start,
    endDate: row.decomposition_stage_finish,
    statusId: row.decomposition_stage_status_id,
    responsibles: row.decomposition_stage_responsibles,
    createdBy: row.decomposition_stage_created_by,
    createdAt: row.created_at,
  }
}

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Загрузка списка проектов с фильтрацией (Мои/Все)
 */
export async function fetchProjectsList(
  input: FetchProjectsListInput
): Promise<ActionResult<ProjectListItem[]>> {
  try {
    const supabase = await createClient()

    // 🔒 Скрываем restricted-проекты от не-админов.
    // Параллельно: контекст + список restricted — экономит round-trip.
    const [ctx, restrictedIds] = await Promise.all([
      getFilterContext(),
      getRestrictedProjectIds(),
    ])
    const isAdmin = ctx.success && ctx.data
      ? ctx.data.permissions.includes('hierarchy.is_admin')
      : false

    // Получаем уникальные проекты из view (используем view_project_tree_optimized)
    // Фильтруем только узлы типа 'project' для получения списка проектов
    let query = supabase
      .from('view_project_tree_optimized')
      .select('project_id, node_name, stage_type, project_status, manager_id, manager_name, manager_avatar, is_favorite, involved_users')
      .eq('node_type', 'project')
      .order('node_name')

    if (!isAdmin && restrictedIds.length > 0) {
      query = query.not('project_id', 'in', `(${restrictedIds.join(',')})`)
    }

    // Фильтрация "Мои проекты"
    if (input.mode === 'my') {
      if (!input.userId?.trim()) {
        console.error('[fetchProjectsList] User ID пустой для режима "my"')
        return { success: false, error: 'User ID обязателен для режима "my"' }
      }

      // Фильтруем по массиву involved_users (содержит менеджера, ответственных за разделы и пользователей с загрузками)
      // Используем оператор @> (contains) для проверки вхождения UUID в массив
      query = query.contains('involved_users', [input.userId])
    }

    const { data, error } = await query

    if (error) {
      console.error('[fetchProjectsList] Supabase error:', error)
      return {
        success: false,
        error: `Не удалось загрузить список проектов: ${error.message}`,
      }
    }

    // Маппинг данных из view в ProjectListItem
    const projects: ProjectListItem[] = (data || []).map(row => ({
      id: row.project_id!,
      name: row.node_name || 'Неизвестный проект',
      status: row.project_status || 'unknown',
      managerId: row.manager_id,
      managerName: row.manager_name,
      managerAvatar: row.manager_avatar,
      isFavorite: row.is_favorite || false,
      stage_type: row.stage_type,
    }))

    return { success: true, data: projects }
  } catch (error) {
    console.error('[fetchProjectsList] Error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Произошла неизвестная ошибка при загрузке списка проектов',
    }
  }
}

/**
 * Загрузка дерева конкретного проекта
 * Иерархия (4 уровня): project (со stage_type) -> object -> section -> decomposition_stage
 * Использует оптимизированный view для загрузки всей иерархии одним запросом
 */
export async function fetchProjectTree(
  input: FetchProjectTreeInput
): Promise<ActionResult<ProjectTreeNode[]>> {
  try {
    const supabase = await createClient()

    // Валидация
    if (!input.projectId?.trim()) {
      return { success: false, error: 'ID проекта обязателен' }
    }

    // 🔒 Защита: не-админ не может запросить дерево restricted-проекта.
    // Параллельно: контекст + список restricted — экономит round-trip.
    const [ctx, restrictedIds] = await Promise.all([
      getFilterContext(),
      getRestrictedProjectIds(),
    ])
    const isAdmin = ctx.success && ctx.data
      ? ctx.data.permissions.includes('hierarchy.is_admin')
      : false

    if (!isAdmin && restrictedIds.includes(input.projectId)) {
      return { success: false, error: 'Проект не найден или не имеет данных' }
    }

    // Загрузка всей иерархии проекта одним запросом через оптимизированный view
    const { data, error } = await supabase
      .from('view_project_tree_optimized')
      .select('*')
      .eq('project_id', input.projectId)
      .order('hierarchy_level')
      .order('sort_path')
      .order('sort_order')

    if (error) {
      console.error('[fetchProjectTree] Supabase error:', error)
      return {
        success: false,
        error: `Не удалось загрузить дерево проекта: ${error.message}`,
      }
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        error: 'Проект не найден или не имеет данных',
      }
    }

    // Маппинг данных из view в ProjectTreeNode
    const tree: ProjectTreeNode[] = data.map((row: any) => ({
      id: row.node_id,
      name: row.node_name,
      type: row.node_type as 'project' | 'object' | 'section' | 'decomposition_stage',
      level: row.hierarchy_level,
      projectId: row.project_id,
      objectId: row.object_id,
      sectionId: row.section_id,
      decompositionStageId: row.decomposition_stage_id,
      stageType: row.stage_type, // Стадия проекта как параметр
      description: row.description,
      responsibleId: row.responsible_id,
      responsibleName: null,
      responsibleAvatar: null,
      departmentId: null,
      departmentName: null,
      teamId: null,
      teamName: null,
      startDate: row.start_date,
      endDate: row.end_date,
      hasChildren: row.node_type !== 'decomposition_stage', // только decomposition_stage не имеет детей
    }))

    return { success: true, data: tree }
  } catch (error) {
    console.error('[fetchProjectTree] Error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Произошла неизвестная ошибка при загрузке дерева проекта',
    }
  }
}

/**
 * Получение breadcrumbs для section_id или decomposition_stage_id
 * Возвращает путь от проекта до указанного узла
 */
export interface FetchBreadcrumbsInput {
  /** ID раздела или этапа декомпозиции */
  nodeId: string
}

export interface BreadcrumbItem {
  id: string
  name: string
  type: 'project' | 'object' | 'section' | 'decomposition_stage'
}

export interface FetchBreadcrumbsResult {
  /** Breadcrumbs от проекта до узла */
  breadcrumbs: BreadcrumbItem[]
  /** ID проекта для раскрытия дерева */
  projectId: string
}

export async function fetchBreadcrumbs(
  input: FetchBreadcrumbsInput
): Promise<ActionResult<FetchBreadcrumbsResult>> {
  try {
    const supabase = await createClient()

    // Валидация
    if (!input.nodeId?.trim()) {
      return { success: false, error: 'ID узла обязателен' }
    }

    // Ищем узел в view_project_tree_optimized
    const { data, error } = await supabase
      .from('view_project_tree_optimized')
      .select('*')
      .eq('node_id', input.nodeId)
      .single()

    if (error || !data) {
      console.error('[fetchBreadcrumbs] Node not found:', error)
      return {
        success: false,
        error: 'Узел не найден в дереве проектов',
      }
    }

    // Строим breadcrumbs на основе типа узла и связей
    const breadcrumbs: BreadcrumbItem[] = []
    const projectId = data.project_id

    if (!projectId) {
      return {
        success: false,
        error: 'Не удалось определить проект',
      }
    }

    // Добавляем проект
    const { data: projectData } = await supabase
      .from('view_project_tree_optimized')
      .select('*')
      .eq('node_id', projectId)
      .eq('node_type', 'project')
      .single()

    if (projectData && projectData.node_id && projectData.node_name) {
      breadcrumbs.push({
        id: projectData.node_id,
        name: projectData.node_name,
        type: 'project',
      })
    }

    // Добавляем объект (если есть и он не является целевым узлом)
    if (data.object_id && data.object_id !== data.node_id && data.node_type !== 'object') {
      const { data: objectData } = await supabase
        .from('view_project_tree_optimized')
        .select('*')
        .eq('node_id', data.object_id)
        .eq('node_type', 'object')
        .single()

      if (objectData && objectData.node_id && objectData.node_name) {
        breadcrumbs.push({
          id: objectData.node_id,
          name: objectData.node_name,
          type: 'object',
        })
      }
    }

    // Добавляем раздел (если есть и он не является целевым узлом)
    if (data.section_id && data.section_id !== data.node_id && data.node_type !== 'section') {
      const { data: sectionData } = await supabase
        .from('view_project_tree_optimized')
        .select('*')
        .eq('node_id', data.section_id)
        .eq('node_type', 'section')
        .single()

      if (sectionData && sectionData.node_id && sectionData.node_name) {
        breadcrumbs.push({
          id: sectionData.node_id,
          name: sectionData.node_name,
          type: 'section',
        })
      }
    }

    // Добавляем сам узел
    if (data.node_id && data.node_name) {
      breadcrumbs.push({
        id: data.node_id,
        name: data.node_name,
        type: data.node_type as 'project' | 'object' | 'section' | 'decomposition_stage',
      })
    }

    // Дедупликация: удаляем элементы с одинаковыми ID
    const seen = new Set<string>()
    const uniqueBreadcrumbs = breadcrumbs.filter(item => {
      if (seen.has(item.id)) {
        console.warn('[fetchBreadcrumbs] Дублирующийся ID в breadcrumbs:', item.id, item.name, 'nodeId:', input.nodeId)
        return false
      }
      seen.add(item.id)
      return true
    })

    return {
      success: true,
      data: {
        breadcrumbs: uniqueBreadcrumbs,
        projectId,
      },
    }
  } catch (error) {
    console.error('[fetchBreadcrumbs] Error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Произошла неизвестная ошибка при загрузке breadcrumbs',
    }
  }
}

/**
 * Создание нового этапа декомпозиции
 */
export async function createDecompositionStage(
  input: CreateDecompositionStageInput
): Promise<ActionResult<DecompositionStageResult>> {
  try {
    const supabase = await createClient()

    // Валидация
    if (!input.sectionId?.trim()) {
      return { success: false, error: 'ID раздела обязателен' }
    }

    if (!input.name?.trim()) {
      return { success: false, error: 'Название этапа обязательно' }
    }

    // Получить текущего пользователя
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error('[createDecompositionStage] Auth error:', userError)
      return { success: false, error: 'Не удалось получить текущего пользователя' }
    }

    // Если order не указан, получить max order + 1
    let order = input.order
    if (order === undefined) {
      const { data: stages, error: orderError } = await supabase
        .from('decomposition_stages')
        .select('decomposition_stage_order')
        .eq('decomposition_stage_section_id', input.sectionId)
        .order('decomposition_stage_order', { ascending: false })
        .limit(1)

      if (orderError) {
        console.error('[createDecompositionStage] Order error:', orderError)
        return {
          success: false,
          error: `Не удалось определить порядок этапа: ${orderError.message}`,
        }
      }

      const maxOrder = stages?.[0]?.decomposition_stage_order ?? -1
      order = maxOrder + 1
    }

    // Подготовка данных для вставки
    const insertData: DecompositionStageInsert = {
      decomposition_stage_name: input.name.trim(),
      decomposition_stage_description: input.description?.trim() || null,
      decomposition_stage_section_id: input.sectionId,
      decomposition_stage_order: order,
      decomposition_stage_created_by: user.id,
      created_at: new Date().toISOString(),
    }

    // Вставка в БД
    const { data, error } = await supabase
      .from('decomposition_stages')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('[createDecompositionStage] Supabase error:', error)
      return {
        success: false,
        error: `Не удалось создать этап декомпозиции: ${error.message}`,
      }
    }

    return { success: true, data: mapStageRowToResult(data) }
  } catch (error) {
    console.error('[createDecompositionStage] Error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Произошла неизвестная ошибка при создании этапа декомпозиции',
    }
  }
}
