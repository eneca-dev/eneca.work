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
  type: 'project' | 'stage' | 'object' | 'section' | 'decomposition_stage'
  level: number
  projectId: string | null
  stageId: string | null
  objectId: string | null
  sectionId: string | null
  decompositionStageId: string | null
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
    console.log('📡 [fetchProjectsList] Начало запроса:', input)
    const supabase = await createClient()

    // Получаем уникальные проекты из view (берем записи stage, т.к. project_id есть там)
    // Используем DISTINCT для получения уникальных проектов
    let query = supabase
      .from('view_project_tree')
      .select('project_id, project_name, project_status, manager_id, manager_name, manager_avatar, is_favorite')
      .not('project_id', 'is', null)
      .order('project_name')

    // Фильтрация "Мои проекты"
    if (input.mode === 'my') {
      if (!input.userId?.trim()) {
        console.error('[fetchProjectsList] User ID пустой для режима "my"')
        return { success: false, error: 'User ID обязателен для режима "my"' }
      }

      console.log('[fetchProjectsList] Фильтрация: проекты пользователя', input.userId)

      // Получаем все записи где пользователь задействован:
      // 1. Менеджер проекта (manager_id)
      // 2. Ответственный за раздел (section_responsible_id)
      // 3. Имеет загрузку (через таблицу loadings)

      // Для начала фильтруем по manager_id ИЛИ section_responsible_id
      query = query.or(`manager_id.eq.${input.userId},section_responsible_id.eq.${input.userId}`)
    }

    const { data, error } = await query

    if (error) {
      console.error('[fetchProjectsList] Supabase error:', error)
      return {
        success: false,
        error: `Не удалось загрузить список проектов: ${error.message}`,
      }
    }

    console.log('[fetchProjectsList] Загружено строк:', data?.length || 0)

    // Дедупликация проектов (один проект может встречаться в разных узлах дерева)
    const uniqueProjects = new Map<string, ProjectListItem>()

    for (const row of data || []) {
      const projectId = row.project_id
      if (projectId && !uniqueProjects.has(projectId)) {
        uniqueProjects.set(projectId, {
          id: projectId,
          name: row.project_name || 'Неизвестный проект',
          status: row.project_status || 'unknown',
          managerId: row.manager_id,
          managerName: row.manager_name,
          managerAvatar: row.manager_avatar,
          isFavorite: row.is_favorite || false,
        })
      }
    }

    const projects = Array.from(uniqueProjects.values())

    if (projects.length > 0) {
      console.log('[fetchProjectsList] Первые 3 уникальных проекта:', projects.slice(0, 3).map(p => ({
        id: p.id,
        name: p.name,
        manager_id: p.managerId,
      })))
    } else {
      console.warn('[fetchProjectsList] ⚠️ Нет проектов после дедупликации')
    }

    console.log('[fetchProjectsList] Успех, проектов:', projects.length)
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
 * Загрузка дерева конкретного проекта (иерархия: project -> stage -> object -> section -> decomposition_stage)
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

    // 1. Загрузка самого проекта (уровень 1)
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('project_id', input.projectId)
      .single()

    if (projectError || !projectData) {
      console.error('[fetchProjectTree] Project error:', projectError)
      return {
        success: false,
        error: `Не удалось загрузить проект: ${projectError?.message || 'Проект не найден'}`,
      }
    }

    const tree: ProjectTreeNode[] = []

    // Добавляем сам проект как корневой узел (уровень 1)
    const projectNode: ProjectTreeNode = {
      id: projectData.project_id,
      name: projectData.project_name,
      type: 'project',
      level: 1,
      projectId: projectData.project_id,
      stageId: null,
      objectId: null,
      sectionId: null,
      decompositionStageId: null,
      description: projectData.project_description,
      responsibleId: projectData.project_manager,
      responsibleName: null,
      responsibleAvatar: null,
      departmentId: null,
      departmentName: null,
      teamId: null,
      teamName: null,
      startDate: null,
      endDate: null,
      hasChildren: true,
    }
    tree.push(projectNode)

    // 2. Загрузка стадий проекта (уровень 2)
    const { data: stagesData, error: stagesError } = await supabase
      .from('stages')
      .select('*')
      .eq('stage_project_id', input.projectId)
      .order('stage_name')

    if (!stagesError && stagesData && stagesData.length > 0) {
      for (const stage of stagesData) {
        const stageNode: ProjectTreeNode = {
          id: stage.stage_id,
          name: stage.stage_name,
          type: 'stage',
          level: 2,
          projectId: projectData.project_id,
          stageId: stage.stage_id,
          objectId: null,
          sectionId: null,
          decompositionStageId: null,
          description: stage.stage_description,
          responsibleId: null,
          responsibleName: null,
          responsibleAvatar: null,
          departmentId: null,
          departmentName: null,
          teamId: null,
          teamName: null,
          startDate: null,
          endDate: null,
          hasChildren: true,
        }
        tree.push(stageNode)

        // 3. Загрузка объектов стадии (уровень 3)
        const { data: objectsData, error: objectsError } = await supabase
          .from('objects')
          .select('*')
          .eq('object_stage_id', stage.stage_id)
          .order('object_name')

        if (!objectsError && objectsData && objectsData.length > 0) {
          for (const object of objectsData) {
            const objectNode: ProjectTreeNode = {
              id: object.object_id,
              name: object.object_name,
              type: 'object',
              level: 3,
              projectId: projectData.project_id,
              stageId: stage.stage_id,
              objectId: object.object_id,
              sectionId: null,
              decompositionStageId: null,
              description: object.object_description,
              responsibleId: null,
              responsibleName: null,
              responsibleAvatar: null,
              departmentId: null,
              departmentName: null,
              teamId: null,
              teamName: null,
              startDate: object.object_start_date,
              endDate: object.object_end_date,
              hasChildren: true,
            }
            tree.push(objectNode)

            // 4. Загрузка разделов объекта (уровень 4)
            const { data: sectionsData, error: sectionsError } = await supabase
              .from('sections')
              .select('*')
              .eq('section_object_id', object.object_id)
              .order('section_name')

            if (!sectionsError && sectionsData && sectionsData.length > 0) {
              for (const section of sectionsData) {
                const sectionNode: ProjectTreeNode = {
                  id: section.section_id,
                  name: section.section_name,
                  type: 'section',
                  level: 4,
                  projectId: projectData.project_id,
                  stageId: stage.stage_id,
                  objectId: object.object_id,
                  sectionId: section.section_id,
                  decompositionStageId: null,
                  description: section.section_description,
                  responsibleId: section.section_responsible,
                  responsibleName: null,
                  responsibleAvatar: null,
                  departmentId: null,
                  departmentName: null,
                  teamId: null,
                  teamName: null,
                  startDate: section.section_start_date,
                  endDate: section.section_end_date,
                  hasChildren: true,
                }
                tree.push(sectionNode)

                // 5. Загрузка этапов декомпозиции раздела (уровень 5)
                const { data: decompositionData, error: decompositionError } = await supabase
                  .from('decomposition_stages')
                  .select('*')
                  .eq('decomposition_stage_section_id', section.section_id)
                  .order('decomposition_stage_order')

                if (!decompositionError && decompositionData && decompositionData.length > 0) {
                  for (const decomp of decompositionData) {
                    const decompNode: ProjectTreeNode = {
                      id: decomp.decomposition_stage_id,
                      name: decomp.decomposition_stage_name,
                      type: 'decomposition_stage',
                      level: 5,
                      projectId: projectData.project_id,
                      stageId: stage.stage_id,
                      objectId: object.object_id,
                      sectionId: section.section_id,
                      decompositionStageId: decomp.decomposition_stage_id,
                      description: decomp.decomposition_stage_description,
                      responsibleId: null,
                      responsibleName: null,
                      responsibleAvatar: null,
                      departmentId: null,
                      departmentName: null,
                      teamId: null,
                      teamName: null,
                      startDate: decomp.decomposition_stage_start,
                      endDate: decomp.decomposition_stage_finish,
                      hasChildren: false,
                    }
                    tree.push(decompNode)
                  }
                }
              }
            }
          }
        }
      }
    }

    console.log('[fetchProjectTree] Tree built:', {
      projectId: input.projectId,
      totalNodes: tree.length,
      byLevel: tree.reduce((acc, node) => {
        acc[node.level] = (acc[node.level] || 0) + 1
        return acc
      }, {} as Record<number, number>)
    })

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
