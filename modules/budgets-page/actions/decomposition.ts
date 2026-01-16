/**
 * Decomposition Server Actions
 *
 * Server Actions для CRUD операций декомпозиции (stages/items)
 * с проверкой аутентификации и Zod валидацией.
 *
 * @module budgets-page/actions/decomposition
 */

'use server'

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/modules/cache'
import { DEFAULT_WORK_CATEGORY_ID } from '../config/constants'

// ============================================================================
// Zod Schemas (BP-006)
// ============================================================================

/** Схема для создания этапа декомпозиции */
const CreateStageSchema = z.object({
  sectionId: z.string().uuid('Некорректный ID раздела'),
  name: z.string().min(1, 'Название обязательно').max(255, 'Название слишком длинное'),
})

/** Схема для удаления этапа декомпозиции */
const DeleteStageSchema = z.object({
  stageId: z.string().uuid('Некорректный ID этапа'),
})

/** Схема для создания задачи декомпозиции */
const CreateItemSchema = z.object({
  stageId: z.string().uuid('Некорректный ID этапа'),
  sectionId: z.string().uuid('Некорректный ID раздела'),
  description: z.string().min(1, 'Описание обязательно').max(1000, 'Описание слишком длинное'),
  workCategoryId: z.string().uuid('Некорректный ID категории работ').optional(),
})

/** Схема для удаления задачи декомпозиции */
const DeleteItemSchema = z.object({
  itemId: z.string().uuid('Некорректный ID задачи'),
})

/** Схема для обновления часов задачи */
const UpdateItemHoursSchema = z.object({
  itemId: z.string().uuid('Некорректный ID задачи'),
  plannedHours: z.number().min(0, 'Часы не могут быть отрицательными').max(10000, 'Слишком много часов'),
})

/** Схема для обновления категории задачи */
const UpdateItemCategorySchema = z.object({
  itemId: z.string().uuid('Некорректный ID задачи'),
  categoryId: z.string().uuid('Некорректный ID категории'),
})

/** Схема для обновления сложности задачи */
const UpdateItemDifficultySchema = z.object({
  itemId: z.string().uuid('Некорректный ID задачи'),
  difficultyId: z.string().uuid('Некорректный ID сложности').nullable(),
})

/** Схема для обновления ставки раздела (BP-003) */
const UpdateSectionRateSchema = z.object({
  sectionId: z.string().uuid('Некорректный ID раздела'),
  hourlyRate: z.number().min(0, 'Ставка не может быть отрицательной').max(1000, 'Ставка слишком большая').nullable(),
})

// ============================================================================
// Types
// ============================================================================

export type CreateStageInput = z.infer<typeof CreateStageSchema>
export type DeleteStageInput = z.infer<typeof DeleteStageSchema>
export type CreateItemInput = z.infer<typeof CreateItemSchema>
export type DeleteItemInput = z.infer<typeof DeleteItemSchema>
export type UpdateItemHoursInput = z.infer<typeof UpdateItemHoursSchema>
export type UpdateItemCategoryInput = z.infer<typeof UpdateItemCategorySchema>
export type UpdateItemDifficultyInput = z.infer<typeof UpdateItemDifficultySchema>
export type UpdateSectionRateInput = z.infer<typeof UpdateSectionRateSchema>

export interface CreatedStage {
  decomposition_stage_id: string
}

export interface CreatedItem {
  decomposition_item_id: string
}

// ============================================================================
// Auth Helper
// ============================================================================

async function requireAuth() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return { supabase: null, error: 'Не авторизован' }
  }

  return { supabase, user, error: null }
}

// ============================================================================
// Stage Actions
// ============================================================================

/**
 * Создать этап декомпозиции
 */
export async function createDecompositionStage(
  input: CreateStageInput
): Promise<ActionResult<CreatedStage>> {
  console.log('[createDecompositionStage] Starting with input:', JSON.stringify(input))

  try {
    // Валидация
    const parsed = CreateStageSchema.safeParse(input)
    if (!parsed.success) {
      console.log('[createDecompositionStage] Validation failed:', parsed.error.errors[0].message)
      return { success: false, error: parsed.error.errors[0].message }
    }

    // Авторизация
    console.log('[createDecompositionStage] Checking auth...')
    const auth = await requireAuth()
    if (auth.error || !auth.supabase) {
      console.log('[createDecompositionStage] Auth failed:', auth.error)
      return { success: false, error: auth.error ?? 'Не авторизован' }
    }
    console.log('[createDecompositionStage] Auth OK, user:', auth.user?.id)

    const { sectionId, name } = parsed.data

    // Получаем максимальный order
    console.log('[createDecompositionStage] Getting max order for section:', sectionId)
    const { data: maxOrderData, error: orderError } = await auth.supabase
      .from('decomposition_stages')
      .select('decomposition_stage_order')
      .eq('decomposition_stage_section_id', sectionId)
      .order('decomposition_stage_order', { ascending: false })
      .limit(1)

    if (orderError) {
      console.log('[createDecompositionStage] Order query error:', orderError)
    }

    const nextOrder = (maxOrderData?.[0]?.decomposition_stage_order ?? -1) + 1
    console.log('[createDecompositionStage] Next order:', nextOrder)

    // Создаём этап
    console.log('[createDecompositionStage] Inserting stage...')
    const { data, error } = await auth.supabase
      .from('decomposition_stages')
      .insert({
        decomposition_stage_name: name,
        decomposition_stage_section_id: sectionId,
        decomposition_stage_order: nextOrder,
      })
      .select('decomposition_stage_id')
      .single()

    if (error) {
      console.error('[createDecompositionStage] Insert error:', error)
      return { success: false, error: error.message }
    }

    console.log('[createDecompositionStage] Success, created ID:', data?.decomposition_stage_id)
    return { success: true, data }
  } catch (error) {
    console.error('[createDecompositionStage] Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка создания этапа',
    }
  }
}

/**
 * Удалить этап декомпозиции
 */
export async function deleteDecompositionStage(
  input: DeleteStageInput
): Promise<ActionResult<null>> {
  try {
    // Валидация
    const parsed = DeleteStageSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message }
    }

    // Авторизация
    const auth = await requireAuth()
    if (auth.error || !auth.supabase) {
      return { success: false, error: auth.error ?? 'Не авторизован' }
    }

    const { stageId } = parsed.data

    const { error } = await auth.supabase
      .from('decomposition_stages')
      .delete()
      .eq('decomposition_stage_id', stageId)

    if (error) {
      console.error('[deleteDecompositionStage] Error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: null }
  } catch (error) {
    console.error('[deleteDecompositionStage] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка удаления этапа',
    }
  }
}

// ============================================================================
// Item Actions
// ============================================================================

/**
 * Создать задачу декомпозиции
 */
export async function createDecompositionItem(
  input: CreateItemInput
): Promise<ActionResult<CreatedItem>> {
  try {
    // Валидация
    const parsed = CreateItemSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message }
    }

    // Авторизация
    const auth = await requireAuth()
    if (auth.error || !auth.supabase) {
      return { success: false, error: auth.error ?? 'Не авторизован' }
    }

    const { stageId, sectionId, description, workCategoryId } = parsed.data

    // Получаем максимальный order
    const { data: maxOrderData } = await auth.supabase
      .from('decomposition_items')
      .select('decomposition_item_order')
      .eq('decomposition_item_stage_id', stageId)
      .order('decomposition_item_order', { ascending: false })
      .limit(1)

    const nextOrder = (maxOrderData?.[0]?.decomposition_item_order ?? -1) + 1

    // Создаём задачу
    const { data, error } = await auth.supabase
      .from('decomposition_items')
      .insert({
        decomposition_item_description: description,
        decomposition_item_section_id: sectionId,
        decomposition_item_stage_id: stageId,
        decomposition_item_work_category_id: workCategoryId ?? DEFAULT_WORK_CATEGORY_ID,
        decomposition_item_planned_hours: 0,
        decomposition_item_order: nextOrder,
      })
      .select('decomposition_item_id')
      .single()

    if (error) {
      console.error('[createDecompositionItem] Error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data }
  } catch (error) {
    console.error('[createDecompositionItem] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка создания задачи',
    }
  }
}

/**
 * Удалить задачу декомпозиции
 */
export async function deleteDecompositionItem(
  input: DeleteItemInput
): Promise<ActionResult<null>> {
  try {
    // Валидация
    const parsed = DeleteItemSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message }
    }

    // Авторизация
    const auth = await requireAuth()
    if (auth.error || !auth.supabase) {
      return { success: false, error: auth.error ?? 'Не авторизован' }
    }

    const { itemId } = parsed.data

    const { error } = await auth.supabase
      .from('decomposition_items')
      .delete()
      .eq('decomposition_item_id', itemId)

    if (error) {
      console.error('[deleteDecompositionItem] Error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: null }
  } catch (error) {
    console.error('[deleteDecompositionItem] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка удаления задачи',
    }
  }
}

/**
 * Обновить плановые часы задачи
 */
export async function updateItemPlannedHours(
  input: UpdateItemHoursInput
): Promise<ActionResult<null>> {
  try {
    // Валидация
    const parsed = UpdateItemHoursSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message }
    }

    // Авторизация
    const auth = await requireAuth()
    if (auth.error || !auth.supabase) {
      return { success: false, error: auth.error ?? 'Не авторизован' }
    }

    const { itemId, plannedHours } = parsed.data

    const { error } = await auth.supabase
      .from('decomposition_items')
      .update({ decomposition_item_planned_hours: plannedHours })
      .eq('decomposition_item_id', itemId)

    if (error) {
      console.error('[updateItemPlannedHours] Error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: null }
  } catch (error) {
    console.error('[updateItemPlannedHours] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка обновления часов',
    }
  }
}

/**
 * Обновить категорию работ задачи
 */
export async function updateItemCategory(
  input: UpdateItemCategoryInput
): Promise<ActionResult<null>> {
  try {
    // Валидация
    const parsed = UpdateItemCategorySchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message }
    }

    // Авторизация
    const auth = await requireAuth()
    if (auth.error || !auth.supabase) {
      return { success: false, error: auth.error ?? 'Не авторизован' }
    }

    const { itemId, categoryId } = parsed.data

    const { error } = await auth.supabase
      .from('decomposition_items')
      .update({ decomposition_item_work_category_id: categoryId })
      .eq('decomposition_item_id', itemId)

    if (error) {
      console.error('[updateItemCategory] Error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: null }
  } catch (error) {
    console.error('[updateItemCategory] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка обновления категории',
    }
  }
}

/**
 * Обновить сложность задачи
 */
export async function updateItemDifficulty(
  input: UpdateItemDifficultyInput
): Promise<ActionResult<null>> {
  console.log('[updateItemDifficulty] Input:', JSON.stringify(input))
  try {
    // Валидация
    const parsed = UpdateItemDifficultySchema.safeParse(input)
    if (!parsed.success) {
      console.log('[updateItemDifficulty] Validation failed:', parsed.error.errors[0].message)
      return { success: false, error: parsed.error.errors[0].message }
    }

    // Авторизация
    const auth = await requireAuth()
    if (auth.error || !auth.supabase) {
      return { success: false, error: auth.error ?? 'Не авторизован' }
    }

    const { itemId, difficultyId } = parsed.data
    console.log('[updateItemDifficulty] Parsed data:', { itemId, difficultyId })

    const { error } = await auth.supabase
      .from('decomposition_items')
      .update({ decomposition_item_difficulty_id: difficultyId })
      .eq('decomposition_item_id', itemId)

    if (error) {
      console.error('[updateItemDifficulty] DB Error:', error)
      return { success: false, error: error.message }
    }

    console.log('[updateItemDifficulty] Success!')
    return { success: true, data: null }
  } catch (error) {
    console.error('[updateItemDifficulty] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка обновления сложности',
    }
  }
}

// ============================================================================
// Section Actions (BP-003)
// ============================================================================

/**
 * Обновить часовую ставку раздела
 * Ставка используется для расчёта бюджета: planned_hours * hourly_rate
 * NULL означает использование дефолтной ставки
 */
export async function updateSectionHourlyRate(
  input: UpdateSectionRateInput
): Promise<ActionResult<null>> {
  try {
    // Валидация
    const parsed = UpdateSectionRateSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message }
    }

    // Авторизация
    const auth = await requireAuth()
    if (auth.error || !auth.supabase) {
      return { success: false, error: auth.error ?? 'Не авторизован' }
    }

    const { sectionId, hourlyRate } = parsed.data

    const { error } = await auth.supabase
      .from('sections')
      .update({ section_hourly_rate: hourlyRate })
      .eq('section_id', sectionId)

    if (error) {
      console.error('[updateSectionHourlyRate] Error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: null }
  } catch (error) {
    console.error('[updateSectionHourlyRate] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка обновления ставки',
    }
  }
}
