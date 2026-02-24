'use server'

import { createClient } from '@/utils/supabase/server'
import { z } from 'zod'
import type { ActionResult, ProjectStatusEnum, CacheProjectViewRow } from '../types'
import type { ProjectFilters } from '../keys/query-keys'

// ============================================================================
// Types
// ============================================================================

/** Статус проекта (из БД enum) */
export type ProjectStatus = ProjectStatusEnum

export interface ProjectManager {
  user_id: string
  first_name: string
  last_name: string
  avatar_url: string | null
}

export interface ProjectClient {
  client_id: string
  client_name: string
}

export interface Project {
  project_id: string
  project_name: string
  project_description: string | null
  project_status: ProjectStatus | null
  project_created: string | null
  project_updated: string | null
  manager: ProjectManager | null
  lead_engineer: ProjectManager | null
  client: ProjectClient | null
}

export interface ProjectListItem {
  project_id: string
  project_name: string
  project_status: ProjectStatus | null
  project_created: string | null
  manager_name: string | null
  client_name: string | null
}

// ============================================================================
// Types for v_cache_projects view
// ============================================================================

/** Строка из view v_cache_projects (из Database types) */
export type CacheProjectRow = CacheProjectViewRow

/** Проект с подсчётами для списка */
export interface ProjectWithCounts {
  project_id: string
  project_name: string
  project_status: ProjectStatus | null
  project_created: string | null
  manager_name: string | null
  client_name: string | null
  stages_count: number
  objects_count: number
  sections_count: number
}

/** Секция в структуре проекта */
export interface SectionNode {
  section_id: string
  section_name: string
  section_responsible_name: string | null
  section_status_name: string | null
  section_status_color: string | null
  decomposition_stages_count: number
  active_loadings_count: number
}

/** Объект в структуре проекта */
export interface ObjectNode {
  object_id: string
  object_name: string
  sections: SectionNode[]
}

/** Стадия в структуре проекта */
export interface StageNode {
  stage_id: string
  stage_name: string
  objects: ObjectNode[]
}

/** Полная структура проекта */
export interface ProjectStructure {
  project_id: string
  project_name: string
  project_status: ProjectStatus | null
  project_description: string | null
  manager_name: string | null
  lead_engineer_name: string | null
  client_name: string | null
  stages: StageNode[]
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Получить список проектов
 */
export async function getProjects(
  filters?: ProjectFilters
): Promise<ActionResult<ProjectListItem[]>> {
  try {
    const supabase = await createClient()

    let query = supabase
      .from('projects')
      .select(`
        project_id,
        project_name,
        project_status,
        project_created,
        manager:profiles!projects_project_manager_fkey (
          first_name,
          last_name
        ),
        client:clients!projects_client_id_fkey (
          client_name
        )
      `)
      .order('project_created', { ascending: false })

    // Применяем фильтры
    if (filters?.status) {
      query = query.eq('project_status', filters.status)
    }

    if (filters?.managerId) {
      query = query.eq('project_manager', filters.managerId)
    }

    if (filters?.clientId) {
      query = query.eq('client_id', filters.clientId)
    }

    if (filters?.search) {
      query = query.ilike('project_name', `%${filters.search}%`)
    }

    // Пагинация
    const page = filters?.page ?? 1
    const pageSize = filters?.pageSize ?? 50
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    query = query.range(from, to)

    const { data, error } = await query

    if (error) {
      console.error('[getProjects] Supabase error:', error)
      return { success: false, error: error.message }
    }

    // Трансформируем данные
    const projects: ProjectListItem[] = (data ?? []).map((project: Record<string, unknown>) => {
      const manager = Array.isArray(project.manager)
        ? project.manager[0]
        : project.manager

      const client = Array.isArray(project.client)
        ? project.client[0]
        : project.client

      return {
        project_id: project.project_id,
        project_name: project.project_name,
        project_status: project.project_status as ProjectStatus | null,
        project_created: project.project_created,
        manager_name: manager
          ? `${manager.first_name} ${manager.last_name}`
          : null,
        client_name: client?.client_name ?? null,
      }
    })

    return { success: true, data: projects }
  } catch (error) {
    console.error('[getProjects] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

/**
 * Получить проект по ID
 */
export async function getProjectById(
  projectId: string
): Promise<ActionResult<Project>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('projects')
      .select(`
        project_id,
        project_name,
        project_description,
        project_status,
        project_created,
        project_updated,
        manager:profiles!projects_project_manager_fkey (
          user_id,
          first_name,
          last_name,
          avatar_url
        ),
        lead_engineer:profiles!projects_project_lead_engineer_fkey (
          user_id,
          first_name,
          last_name,
          avatar_url
        ),
        client:clients!projects_client_id_fkey (
          client_id,
          client_name
        )
      `)
      .eq('project_id', projectId)
      .maybeSingle()

    if (error) {
      console.error('[getProjectById] Supabase error:', error)
      return { success: false, error: error.message }
    }

    if (!data) {
      return { success: false, error: 'Проект не найден' }
    }

    // Трансформируем данные
    const project: Project = {
      project_id: data.project_id,
      project_name: data.project_name,
      project_description: data.project_description,
      project_status: data.project_status as ProjectStatus | null,
      project_created: data.project_created,
      project_updated: data.project_updated,
      manager: Array.isArray(data.manager)
        ? (data.manager[0] as ProjectManager) ?? null
        : (data.manager as ProjectManager) ?? null,
      lead_engineer: Array.isArray(data.lead_engineer)
        ? (data.lead_engineer[0] as ProjectManager) ?? null
        : (data.lead_engineer as ProjectManager) ?? null,
      client: Array.isArray(data.client)
        ? (data.client[0] as ProjectClient) ?? null
        : (data.client as ProjectClient) ?? null,
    }

    return { success: true, data: project }
  } catch (error) {
    console.error('[getProjectById] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

// ============================================================================
// Actions using v_cache_projects view
// ============================================================================

/**
 * Получить список проектов из view с подсчётами
 */
export async function getProjectsWithCounts(
  filters?: ProjectFilters
): Promise<ActionResult<ProjectWithCounts[]>> {
  try {
    const supabase = await createClient()

    // Получаем данные из view
    let query = supabase
      .from('v_cache_projects')
      .select('*')

    // Применяем фильтры
    if (filters?.status) {
      query = query.eq('project_status', filters.status)
    }

    if (filters?.managerId) {
      query = query.eq('manager_id', filters.managerId)
    }

    if (filters?.clientId) {
      query = query.eq('client_id', filters.clientId)
    }

    if (filters?.search) {
      query = query.ilike('project_name', `%${filters.search}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error('[getProjectsWithCounts] Supabase error:', error)
      return { success: false, error: error.message }
    }

    // Агрегируем данные по проектам
    const projectsMap = new Map<string, ProjectWithCounts>()
    const stagesSet = new Map<string, Set<string>>() // project_id -> Set<stage_id>
    const objectsSet = new Map<string, Set<string>>() // project_id -> Set<object_id>
    const sectionsSet = new Map<string, Set<string>>() // project_id -> Set<section_id>

    for (const row of data as CacheProjectRow[]) {
      if (!projectsMap.has(row.project_id)) {
        projectsMap.set(row.project_id, {
          project_id: row.project_id,
          project_name: row.project_name,
          project_status: row.project_status,
          project_created: row.project_created,
          manager_name: row.manager_name,
          client_name: row.client_name,
          stages_count: 0,
          objects_count: 0,
          sections_count: 0,
        })
        stagesSet.set(row.project_id, new Set())
        objectsSet.set(row.project_id, new Set())
        sectionsSet.set(row.project_id, new Set())
      }

      if (row.stage_id) stagesSet.get(row.project_id)!.add(row.stage_id)
      if (row.object_id) objectsSet.get(row.project_id)!.add(row.object_id)
      if (row.section_id) sectionsSet.get(row.project_id)!.add(row.section_id)
    }

    // Заполняем подсчёты
    const projects: ProjectWithCounts[] = []
    for (const [projectId, project] of projectsMap) {
      project.stages_count = stagesSet.get(projectId)!.size
      project.objects_count = objectsSet.get(projectId)!.size
      project.sections_count = sectionsSet.get(projectId)!.size
      projects.push(project)
    }

    // Сортируем по дате создания (новые первые)
    projects.sort((a, b) => {
      if (!a.project_created) return 1
      if (!b.project_created) return -1
      return new Date(b.project_created).getTime() - new Date(a.project_created).getTime()
    })

    // Пагинация
    const page = filters?.page ?? 1
    const pageSize = filters?.pageSize ?? 50
    const start = (page - 1) * pageSize
    const paginatedProjects = projects.slice(start, start + pageSize)

    return { success: true, data: paginatedProjects }
  } catch (error) {
    console.error('[getProjectsWithCounts] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

/**
 * Получить структуру проекта (дерево: stages → objects → sections)
 */
export async function getProjectStructure(
  projectId: string
): Promise<ActionResult<ProjectStructure>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('v_cache_projects')
      .select('*')
      .eq('project_id', projectId)

    if (error) {
      console.error('[getProjectStructure] Supabase error:', error)
      return { success: false, error: error.message }
    }

    if (!data || data.length === 0) {
      return { success: false, error: 'Проект не найден' }
    }

    const rows = data as CacheProjectRow[]
    const firstRow = rows[0]

    // Строим дерево структуры
    const stagesMap = new Map<string, StageNode>()
    const objectsMap = new Map<string, ObjectNode>()

    for (const row of rows) {
      // Пропускаем строки без секций (проект без структуры)
      if (!row.stage_id || !row.object_id || !row.section_id) continue

      // Stage
      if (!stagesMap.has(row.stage_id)) {
        stagesMap.set(row.stage_id, {
          stage_id: row.stage_id,
          stage_name: row.stage_name!,
          objects: [],
        })
      }

      // Object
      const objectKey = `${row.stage_id}:${row.object_id}`
      if (!objectsMap.has(objectKey)) {
        const objectNode: ObjectNode = {
          object_id: row.object_id,
          object_name: row.object_name!,
          sections: [],
        }
        objectsMap.set(objectKey, objectNode)
        stagesMap.get(row.stage_id)!.objects.push(objectNode)
      }

      // Section
      const sectionNode: SectionNode = {
        section_id: row.section_id,
        section_name: row.section_name!,
        section_responsible_name: row.section_responsible_name,
        section_status_name: row.section_status_name,
        section_status_color: row.section_status_color,
        decomposition_stages_count: row.decomposition_stages_count,
        active_loadings_count: row.active_loadings_count,
      }
      objectsMap.get(objectKey)!.sections.push(sectionNode)
    }

    const structure: ProjectStructure = {
      project_id: firstRow.project_id,
      project_name: firstRow.project_name,
      project_status: firstRow.project_status,
      project_description: firstRow.project_description,
      manager_name: firstRow.manager_name,
      lead_engineer_name: firstRow.lead_engineer_name,
      client_name: firstRow.client_name,
      stages: Array.from(stagesMap.values()),
    }

    return { success: true, data: structure }
  } catch (error) {
    console.error('[getProjectStructure] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Схема валидации для обновления проекта
 */
const updateProjectSchema = z.object({
  project_id: z.string().uuid('Некорректный ID проекта'),
  project_name: z
    .string()
    .min(1, 'Название проекта обязательно')
    .max(500, 'Название слишком длинное')
    .optional(),
  project_description: z.string().nullable().optional(),
  project_status: z
    .enum([
      'active',
      'completed',
      'paused',
      'waiting for input data',
      'author supervision',
      'actual calculation',
      'customer approval',
      'draft',
      'potential project',
    ])
    .nullable()
    .optional(),
})

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>

/**
 * Обновить проект
 */
export async function updateProject(
  input: UpdateProjectInput
): Promise<ActionResult<ProjectListItem>> {
  try {
    // Валидация входных данных
    const validated = updateProjectSchema.safeParse(input)

    if (!validated.success) {
      const errors = validated.error.flatten().fieldErrors
      const firstError = Object.values(errors)[0]?.[0] ?? 'Ошибка валидации'
      return { success: false, error: firstError }
    }

    const { project_id, ...updateData } = validated.data

    // Убираем undefined поля
    const cleanData = Object.fromEntries(
      Object.entries(updateData).filter(([, v]) => v !== undefined)
    )

    if (Object.keys(cleanData).length === 0) {
      return { success: false, error: 'Нет данных для обновления' }
    }

    const supabase = await createClient()

    // Обновляем проект
    const { data, error } = await supabase
      .from('projects')
      .update({
        ...cleanData,
        project_updated: new Date().toISOString(),
      })
      .eq('project_id', project_id)
      .select(`
        project_id,
        project_name,
        project_status,
        project_created,
        manager:profiles!projects_project_manager_fkey (
          first_name,
          last_name
        ),
        client:clients!projects_client_id_fkey (
          client_name
        )
      `)
      .single()

    if (error) {
      console.error('[updateProject] Supabase error:', error)
      return { success: false, error: error.message }
    }

    if (!data) {
      return { success: false, error: 'Проект не найден' }
    }

    // Трансформируем результат
    const manager = Array.isArray(data.manager)
      ? data.manager[0]
      : data.manager

    const client = Array.isArray(data.client)
      ? data.client[0]
      : data.client

    const result: ProjectListItem = {
      project_id: data.project_id,
      project_name: data.project_name,
      project_status: data.project_status as ProjectStatus | null,
      project_created: data.project_created,
      manager_name: manager
        ? `${(manager as { first_name: string; last_name: string }).first_name} ${(manager as { first_name: string; last_name: string }).last_name}`
        : null,
      client_name: (client as { client_name: string } | null)?.client_name ?? null,
    }

    return { success: true, data: result }
  } catch (error) {
    console.error('[updateProject] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}
