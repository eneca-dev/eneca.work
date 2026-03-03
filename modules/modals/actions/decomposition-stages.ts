'use server'

/**
 * Server Actions для работы с этапами декомпозиции
 */

import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/modules/cache'

export interface DecompositionStage {
  id: string
  name: string
  description: string | null
  startDate: string | null
  endDate: string | null
  order: number | null
}

export interface FetchDecompositionStagesInput {
  /** ID раздела */
  sectionId: string
}

/**
 * Загрузка этапов декомпозиции для раздела
 */
export async function fetchDecompositionStages(
  input: FetchDecompositionStagesInput
): Promise<ActionResult<DecompositionStage[]>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('decomposition_stages')
      .select(
        `
        decomposition_stage_id,
        decomposition_stage_name,
        decomposition_stage_description,
        decomposition_stage_start,
        decomposition_stage_finish,
        decomposition_stage_order
      `
      )
      .eq('decomposition_stage_section_id', input.sectionId)
      .order('decomposition_stage_order', { ascending: true, nullsFirst: false })

    if (error) {
      console.error('[fetchDecompositionStages] Supabase error:', error)
      return {
        success: false,
        error: `Не удалось загрузить этапы: ${error.message}`,
      }
    }

    const stages: DecompositionStage[] = (data || []).map((row) => ({
      id: row.decomposition_stage_id,
      name: row.decomposition_stage_name,
      description: row.decomposition_stage_description,
      startDate: row.decomposition_stage_start,
      endDate: row.decomposition_stage_finish,
      order: row.decomposition_stage_order,
    }))

    return { success: true, data: stages }
  } catch (error) {
    console.error('[fetchDecompositionStages] Error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Произошла неизвестная ошибка при загрузке этапов',
    }
  }
}
