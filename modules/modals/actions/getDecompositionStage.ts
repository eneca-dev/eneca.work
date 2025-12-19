'use server'

import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/modules/cache'
import type { WorkCategory } from './getWorkCategories'
import type { DifficultyLevel } from './getDifficultyLevels'
import type { StageStatus } from './getStageStatuses'

// ============================================================================
// Types
// ============================================================================

export interface DecompositionItem {
  id: string
  description: string
  typeOfWork: string
  difficulty: string
  plannedHours: number
  progress: number
}

export interface DecompositionStage {
  id: string
  name: string
  startDate: string | null
  endDate: string | null
  description: string | null
  statusId: string | null
  responsibles: string[]
  decompositions: DecompositionItem[]
}

export interface Profile {
  user_id: string
  first_name: string
  last_name: string
  email: string
}

export interface Employee {
  user_id: string
  first_name: string
  last_name: string
  full_name: string
  email: string
  position_name: string | null
  avatar_url: string | null
  team_name: string | null
  department_name: string | null
  employment_rate: number | null
}

export interface DecompositionBootstrapData {
  categories: WorkCategory[]
  difficulties: DifficultyLevel[]
  statuses: StageStatus[]
  profiles: Profile[]
  stages: DecompositionStage[]
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Получить bootstrap данные для декомпозиции раздела
 * Использует RPC функцию get_decomposition_bootstrap
 */
export async function getDecompositionBootstrap(
  sectionId: string
): Promise<ActionResult<DecompositionBootstrapData>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.rpc('get_decomposition_bootstrap', {
      p_section_id: sectionId,
    })

    if (error) {
      console.error('[getDecompositionBootstrap] Error:', error)
      return { success: false, error: error.message }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = data as any

    const categories: WorkCategory[] = json?.categories || []
    const difficulties: DifficultyLevel[] = json?.difficultyLevels || []
    const statuses: StageStatus[] = json?.statuses || []
    const profiles: Profile[] = json?.profiles || []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stagesRaw = (json?.stages || []) as any[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const itemsRaw = (json?.items || []) as any[]

    // Build stages with decomposition items
    const stageMap = new Map<string, DecompositionStage>()

    stagesRaw.forEach((s) => {
      stageMap.set(s.decomposition_stage_id, {
        id: s.decomposition_stage_id,
        name: s.decomposition_stage_name,
        startDate: s.decomposition_stage_start || null,
        endDate: s.decomposition_stage_finish || null,
        description: s.decomposition_stage_description || null,
        statusId: s.decomposition_stage_status_id || null,
        responsibles: s.decomposition_stage_responsibles || [],
        decompositions: [],
      })
    })

    itemsRaw.forEach((it) => {
      const stageId = it.decomposition_item_stage_id || '__no_stage__'

      if (stageId === '__no_stage__' && !stageMap.has('__no_stage__')) {
        stageMap.set('__no_stage__', {
          id: '__no_stage__',
          name: 'Без этапа',
          startDate: null,
          endDate: null,
          description: null,
          statusId: null,
          responsibles: [],
          decompositions: [],
        })
      }

      const stage = stageMap.get(stageId)
      if (!stage) return

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const category = categories.find((c: any) => c.work_category_id === it.decomposition_item_work_category_id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const difficulty = difficulties.find((d: any) => d.difficulty_id === it.decomposition_item_difficulty_id)

      const decomp: DecompositionItem = {
        id: it.decomposition_item_id,
        description: it.decomposition_item_description || '',
        typeOfWork: category?.work_category_name || '',
        difficulty: difficulty?.difficulty_abbr || '',
        plannedHours: Number(it.decomposition_item_planned_hours || 0),
        progress: Number(it.decomposition_item_progress || 0),
      }

      stage.decompositions.push(decomp)
    })

    return {
      success: true,
      data: {
        categories,
        difficulties,
        statuses,
        profiles,
        stages: Array.from(stageMap.values()),
      },
    }
  } catch (error) {
    console.error('[getDecompositionBootstrap] Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

/**
 * Получить список сотрудников для назначения ответственных
 */
export async function getEmployees(): Promise<ActionResult<Employee[]>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('view_users')
      .select('user_id, first_name, last_name, full_name, email, position_name, avatar_url, team_name, department_name, employment_rate')
      .order('full_name')

    if (error) {
      console.error('[getEmployees] Error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: data ?? [] }
  } catch (error) {
    console.error('[getEmployees] Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

/**
 * Получить агрегированные часы работы для задач декомпозиции
 * Использует RPC функцию get_work_logs_agg_for_items
 */
export async function getWorkLogsAggregate(
  itemIds: string[]
): Promise<ActionResult<Record<string, number>>> {
  try {
    if (itemIds.length === 0) {
      return { success: true, data: {} }
    }

    // Filter only valid UUIDs (4 dashes)
    const validItemIds = itemIds.filter((id) => {
      const dashCount = (id.match(/-/g) || []).length
      return dashCount === 4
    })

    if (validItemIds.length === 0) {
      return { success: true, data: {} }
    }

    const supabase = await createClient()

    const { data, error } = await supabase.rpc('get_work_logs_agg_for_items', {
      p_item_ids: validItemIds,
    })

    if (error) {
      console.error('[getWorkLogsAggregate] Error:', error)
      return { success: false, error: error.message }
    }

    const hoursById: Record<string, number> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const row of (data as any[]) || []) {
      const key = row.decomposition_item_id as string
      hoursById[key] = Number(row.actual_hours || 0)
    }

    return { success: true, data: hoursById }
  } catch (error) {
    console.error('[getWorkLogsAggregate] Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}
