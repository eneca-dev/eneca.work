'use server'

import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/modules/cache'

// ============================================================================
// Types
// ============================================================================

export interface SectionStatus {
  id: string
  name: string
  color: string
  description?: string | null
}

export interface CreateStatusInput {
  name: string
  color: string
  description?: string | null
}

export interface UpdateStatusInput {
  id: string
  name: string
  color: string
  description?: string | null
}

// ============================================================================
// Query Actions
// ============================================================================

/**
 * Получить список статусов секций
 */
export async function getSectionStatuses(): Promise<ActionResult<SectionStatus[]>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('section_statuses')
      .select('id, name, color, description')
      .order('name')

    if (error) {
      console.error('[getSectionStatuses] Error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: data ?? [] }
  } catch (error) {
    console.error('[getSectionStatuses] Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

// ============================================================================
// Mutation Actions
// ============================================================================

/**
 * Создать новый статус секции
 */
export async function createSectionStatus(
  input: CreateStatusInput
): Promise<ActionResult<SectionStatus>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('section_statuses')
      .insert({
        name: input.name,
        color: input.color,
        description: input.description || null,
      })
      .select('id, name, color, description')
      .single()

    if (error) {
      console.error('[createSectionStatus] Error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data }
  } catch (error) {
    console.error('[createSectionStatus] Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

/**
 * Обновить статус секции
 */
export async function updateSectionStatus(
  input: UpdateStatusInput
): Promise<ActionResult<SectionStatus>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('section_statuses')
      .update({
        name: input.name,
        color: input.color,
        description: input.description || null,
      })
      .eq('id', input.id)
      .select('id, name, color, description')
      .single()

    if (error) {
      console.error('[updateSectionStatus] Error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data }
  } catch (error) {
    console.error('[updateSectionStatus] Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

/**
 * Удалить статус секции
 * Сначала убирает статус со всех секций, потом удаляет сам статус
 */
export async function deleteSectionStatus(
  id: string
): Promise<ActionResult<{ deleted: boolean }>> {
  try {
    const supabase = await createClient()

    // Сначала убираем статус со всех секций (ставим null)
    const { error: updateError } = await supabase
      .from('sections')
      .update({ section_status_id: null })
      .eq('section_status_id', id)

    if (updateError) {
      console.error('[deleteSectionStatus] Error updating sections:', updateError)
      return { success: false, error: 'Не удалось обновить разделы, использующие статус' }
    }

    // Теперь удаляем сам статус
    const { error } = await supabase
      .from('section_statuses')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[deleteSectionStatus] Error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: { deleted: true } }
  } catch (error) {
    console.error('[deleteSectionStatus] Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}
