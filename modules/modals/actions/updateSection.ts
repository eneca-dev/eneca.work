'use server'

import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/modules/cache'

// ============================================================================
// Types
// ============================================================================

export interface UpdateSectionInput {
  name?: string
  description?: string
  responsibleId?: string | null
  statusId?: string | null
  startDate?: string | null
  endDate?: string | null
}

// ============================================================================
// Action
// ============================================================================

/**
 * Обновить данные раздела
 *
 * @param sectionId - ID раздела
 * @param data - Поля для обновления
 */
export async function updateSection(
  sectionId: string,
  data: UpdateSectionInput
): Promise<ActionResult<void>> {
  try {
    const supabase = await createClient()

    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Не авторизован' }
    }

    // Build update object with correct column names
    const updateData: Record<string, unknown> = {}

    if (data.name !== undefined) {
      updateData.section_name = data.name
    }
    if (data.description !== undefined) {
      updateData.section_description = data.description
    }
    if (data.responsibleId !== undefined) {
      updateData.section_responsible = data.responsibleId
    }
    if (data.statusId !== undefined) {
      updateData.section_status_id = data.statusId
    }
    if (data.startDate !== undefined) {
      updateData.section_start_date = data.startDate
    }
    if (data.endDate !== undefined) {
      updateData.section_end_date = data.endDate
    }

    // Nothing to update
    if (Object.keys(updateData).length === 0) {
      return { success: true, data: undefined }
    }

    // Update section
    const { error } = await supabase
      .from('sections')
      .update(updateData)
      .eq('section_id', sectionId)

    if (error) {
      console.error('[updateSection] Error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: undefined }
  } catch (error) {
    console.error('[updateSection] Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}
