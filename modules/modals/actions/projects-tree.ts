'use server'

/**
 * Loading Modal 2 - Server Actions для работы с деревом проектов
 *
 * Операции:
 * - fetchProjectsList: загрузка списка проектов с фильтрацией
 * - fetchProjectTree: загрузка дерева конкретного проекта
 * - createDecompositionStage: создание нового этапа декомпозиции
 */

import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/modules/cache'
import type { Database } from '@/types/db'

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
}

export interface ProjectTreeNode {
  id: string
  name: string
  type: 'project' | 'stage' | 'object' | 'section'
  level: number
  projectId: string | null
  stageId: string | null
  objectId: string | null
  sectionId: string | null
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
 * Конвертация view_project_tree в ProjectTreeNode
 */
function mapTreeRowToNode(row: ProjectTreeRow): ProjectTreeNode {
  const nodeType = row.node_type as 'project' | 'stage' | 'object' | 'section'

  return {
    id:
      row.section_id ||
      row.object_id ||
      row.stage_id ||
      row.project_id ||
      '',
    name:
      row.section_name ||
      row.object_name ||
      row.stage_name ||
      row.project_name ||
      'Unknown',
    type: nodeType,
    level: row.hierarchy_level || 0,
    projectId: row.project_id,
    stageId: row.stage_id,
    objectId: row.object_id,
    sectionId: row.section_id,
    description:
      row.section_description ||
      row.object_description ||
      row.stage_description ||
      row.project_description,
    responsibleId: row.section_responsible_id || row.manager_id,
    responsibleName: row.section_responsible_name || row.manager_name,
    responsibleAvatar: row.section_responsible_avatar || row.manager_avatar,
    departmentId: row.responsible_department_id,
    departmentName: row.responsible_department_name,
    teamId: row.responsible_team_id,
    teamName: row.responsible_team_name,
    startDate: row.section_start_date || row.object_start_date,
    endDate: row.section_end_date || row.object_end_date,
    hasChildren: nodeType !== 'section', // sections are leaf nodes
  }
}

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

    // Базовый запрос проектов
    let query = supabase
      .from('view_project_tree')
      .select('*')
      .eq('node_type', 'project')
      .order('project_name')

    // Фильтрация "Мои проекты" (где user является менеджером или руководителем)
    if (input.mode === 'my') {
      if (!input.userId?.trim()) {
        return { success: false, error: 'User ID обязателен для режима "my"' }
      }

      // Фильтруем по manager_id (руководитель проекта)
      query = query.eq('manager_id', input.userId)
    }

    const { data, error } = await query

    if (error) {
      console.error('[fetchProjectsList] Supabase error:', error)
      return {
        success: false,
        error: `Не удалось загрузить список проектов: ${error.message}`,
      }
    }

    // Маппинг в ProjectListItem
    const projects: ProjectListItem[] = (data || []).map((row) => ({
      id: row.project_id || '',
      name: row.project_name || 'Неизвестный проект',
      status: row.project_status || 'unknown',
      managerId: row.manager_id,
      managerName: row.manager_name,
      managerAvatar: row.manager_avatar,
      isFavorite: row.is_favorite || false,
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
 * Загрузка дерева конкретного проекта (иерархия: project -> stage -> object -> section)
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

    // Загрузка дерева проекта из view
    const { data, error } = await supabase
      .from('view_project_tree')
      .select('*')
      .eq('project_id', input.projectId)
      .order('hierarchy_level')
      .order('stage_name')
      .order('object_name')
      .order('section_name')

    if (error) {
      console.error('[fetchProjectTree] Supabase error:', error)
      return {
        success: false,
        error: `Не удалось загрузить дерево проекта: ${error.message}`,
      }
    }

    // Маппинг в ProjectTreeNode
    const tree: ProjectTreeNode[] = (data || []).map(mapTreeRowToNode)

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
