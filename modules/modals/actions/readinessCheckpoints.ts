/**
 * Readiness Checkpoints - Server Actions
 *
 * CRUD операции для контрольных точек плановой готовности раздела
 */

'use server'

import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/modules/cache'

// ============================================================================
// Types
// ============================================================================

/**
 * Контрольная точка плановой готовности
 */
export interface ReadinessCheckpoint {
  /** ID контрольной точки */
  id: string
  /** ID раздела */
  sectionId: string
  /** Дата контрольной точки */
  date: string
  /** Плановый процент готовности (0-100) */
  plannedReadiness: number
  /** ID создателя */
  createdBy: string | null
  /** Дата создания */
  createdAt: string | null
}

/**
 * Входные данные для создания контрольной точки
 */
export interface CreateCheckpointInput {
  /** ID раздела */
  sectionId: string
  /** Дата контрольной точки (YYYY-MM-DD) */
  date: string
  /** Плановый процент готовности (0-100) */
  plannedReadiness: number
}

/**
 * Входные данные для обновления контрольной точки
 */
export interface UpdateCheckpointInput {
  /** ID контрольной точки */
  checkpointId: string
  /** Дата контрольной точки (YYYY-MM-DD) */
  date?: string
  /** Плановый процент готовности (0-100) */
  plannedReadiness?: number
}

// ============================================================================
// Query Actions
// ============================================================================

/**
 * Получить контрольные точки плановой готовности для раздела
 *
 * @param sectionId - ID раздела
 * @returns Список контрольных точек, отсортированных по дате
 */
export async function getSectionReadinessCheckpoints(
  sectionId: string
): Promise<ActionResult<ReadinessCheckpoint[]>> {
  try {
    if (!sectionId) {
      return { success: false, error: 'ID раздела обязателен' }
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('section_readiness_checkpoints')
      .select('*')
      .eq('section_id', sectionId)
      .order('checkpoint_date', { ascending: true })

    if (error) {
      console.error('[getSectionReadinessCheckpoints] Supabase error:', error)
      return { success: false, error: error.message }
    }

    const checkpoints: ReadinessCheckpoint[] = (data || []).map((row) => ({
      id: row.checkpoint_id,
      sectionId: row.section_id,
      date: row.checkpoint_date,
      plannedReadiness: row.planned_readiness,
      createdBy: row.created_by,
      createdAt: row.created_at,
    }))

    return { success: true, data: checkpoints }
  } catch (error) {
    console.error('[getSectionReadinessCheckpoints] Error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Ошибка загрузки контрольных точек',
    }
  }
}

// ============================================================================
// Mutation Actions
// ============================================================================

/**
 * Создать новую контрольную точку плановой готовности
 *
 * @param input - Данные для создания
 * @returns Созданная контрольная точка
 */
export async function createReadinessCheckpoint(
  input: CreateCheckpointInput
): Promise<ActionResult<ReadinessCheckpoint>> {
  try {
    // Валидация
    if (!input.sectionId) {
      return { success: false, error: 'ID раздела обязателен' }
    }

    if (!input.date) {
      return { success: false, error: 'Дата обязательна' }
    }

    if (
      typeof input.plannedReadiness !== 'number' ||
      input.plannedReadiness < 0 ||
      input.plannedReadiness > 100
    ) {
      return {
        success: false,
        error: 'Готовность должна быть числом от 0 до 100',
      }
    }

    const supabase = await createClient()

    // Проверка авторизации
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Необходима авторизация' }
    }

    // Проверяем, нет ли уже точки на эту дату
    const { data: existing, error: checkError } = await supabase
      .from('section_readiness_checkpoints')
      .select('checkpoint_id')
      .eq('section_id', input.sectionId)
      .eq('checkpoint_date', input.date)
      .maybeSingle()

    if (checkError) {
      console.error('[createReadinessCheckpoint] Check error:', checkError)
      return { success: false, error: checkError.message }
    }

    if (existing) {
      return {
        success: false,
        error: 'Контрольная точка на эту дату уже существует',
      }
    }

    // Создаём контрольную точку
    const { data, error } = await supabase
      .from('section_readiness_checkpoints')
      .insert({
        section_id: input.sectionId,
        checkpoint_date: input.date,
        planned_readiness: Math.round(input.plannedReadiness),
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error('[createReadinessCheckpoint] Insert error:', error)
      return { success: false, error: error.message }
    }

    const checkpoint: ReadinessCheckpoint = {
      id: data.checkpoint_id,
      sectionId: data.section_id,
      date: data.checkpoint_date,
      plannedReadiness: data.planned_readiness,
      createdBy: data.created_by,
      createdAt: data.created_at,
    }

    return { success: true, data: checkpoint }
  } catch (error) {
    console.error('[createReadinessCheckpoint] Error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Ошибка создания контрольной точки',
    }
  }
}

/**
 * Обновить контрольную точку плановой готовности
 *
 * @param input - Данные для обновления
 * @returns Обновлённая контрольная точка
 */
export async function updateReadinessCheckpoint(
  input: UpdateCheckpointInput
): Promise<ActionResult<ReadinessCheckpoint>> {
  try {
    // Валидация
    if (!input.checkpointId) {
      return { success: false, error: 'ID контрольной точки обязателен' }
    }

    if (
      input.plannedReadiness !== undefined &&
      (typeof input.plannedReadiness !== 'number' ||
        input.plannedReadiness < 0 ||
        input.plannedReadiness > 100)
    ) {
      return {
        success: false,
        error: 'Готовность должна быть числом от 0 до 100',
      }
    }

    const supabase = await createClient()

    // Проверка авторизации
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Необходима авторизация' }
    }

    // Подготавливаем данные для обновления
    const updateData: Record<string, unknown> = {}
    if (input.date !== undefined) {
      updateData.checkpoint_date = input.date
    }
    if (input.plannedReadiness !== undefined) {
      updateData.planned_readiness = Math.round(input.plannedReadiness)
    }

    if (Object.keys(updateData).length === 0) {
      return { success: false, error: 'Нет данных для обновления' }
    }

    // Если меняется дата, проверяем на дубликат
    if (input.date) {
      // Сначала получаем текущую запись чтобы узнать section_id
      const { data: current, error: currentError } = await supabase
        .from('section_readiness_checkpoints')
        .select('section_id')
        .eq('checkpoint_id', input.checkpointId)
        .single()

      if (currentError || !current) {
        return { success: false, error: 'Контрольная точка не найдена' }
      }

      const { data: existing, error: checkError } = await supabase
        .from('section_readiness_checkpoints')
        .select('checkpoint_id')
        .eq('section_id', current.section_id)
        .eq('checkpoint_date', input.date)
        .neq('checkpoint_id', input.checkpointId)
        .maybeSingle()

      if (checkError) {
        console.error('[updateReadinessCheckpoint] Check error:', checkError)
        return { success: false, error: checkError.message }
      }

      if (existing) {
        return {
          success: false,
          error: 'Контрольная точка на эту дату уже существует',
        }
      }
    }

    // Обновляем
    const { data, error } = await supabase
      .from('section_readiness_checkpoints')
      .update(updateData)
      .eq('checkpoint_id', input.checkpointId)
      .select()
      .single()

    if (error) {
      console.error('[updateReadinessCheckpoint] Update error:', error)
      return { success: false, error: error.message }
    }

    const checkpoint: ReadinessCheckpoint = {
      id: data.checkpoint_id,
      sectionId: data.section_id,
      date: data.checkpoint_date,
      plannedReadiness: data.planned_readiness,
      createdBy: data.created_by,
      createdAt: data.created_at,
    }

    return { success: true, data: checkpoint }
  } catch (error) {
    console.error('[updateReadinessCheckpoint] Error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Ошибка обновления контрольной точки',
    }
  }
}

/**
 * Удалить контрольную точку плановой готовности
 *
 * @param checkpointId - ID контрольной точки
 * @returns Успех или ошибка
 */
export async function deleteReadinessCheckpoint(
  checkpointId: string
): Promise<ActionResult<{ deleted: boolean }>> {
  try {
    if (!checkpointId) {
      return { success: false, error: 'ID контрольной точки обязателен' }
    }

    const supabase = await createClient()

    // Проверка авторизации
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Необходима авторизация' }
    }

    const { error } = await supabase
      .from('section_readiness_checkpoints')
      .delete()
      .eq('checkpoint_id', checkpointId)

    if (error) {
      console.error('[deleteReadinessCheckpoint] Delete error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: { deleted: true } }
  } catch (error) {
    console.error('[deleteReadinessCheckpoint] Error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Ошибка удаления контрольной точки',
    }
  }
}
