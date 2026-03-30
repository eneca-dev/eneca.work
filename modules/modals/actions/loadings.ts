'use server'

/**
 * Loading Modal New - Server Actions для CRUD операций с загрузками сотрудников
 *
 * Операции:
 * - createLoading: создание новой загрузки
 * - updateLoading: обновление существующей загрузки
 * - archiveLoading: архивация загрузки (soft delete)
 * - deleteLoading: удаление загрузки (hard delete)
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { addDays, format, parseISO } from 'date-fns'
import type { ActionResult } from '@/modules/cache'
import type { Database } from '@/types/db'

// ============================================================================
// Types
// ============================================================================

type LoadingStatusType = Database['public']['Enums']['loading_status_type']
type LoadingRow = Database['public']['Tables']['loadings']['Row']
type LoadingInsert = Database['public']['Tables']['loadings']['Insert']
type LoadingUpdate = Database['public']['Tables']['loadings']['Update']

export interface CreateLoadingInput {
  /** ID этапа декомпозиции */
  stageId: string
  /** ID раздела */
  sectionId: string
  /** ID сотрудника */
  employeeId: string
  /** Дата начала */
  startDate: string
  /** Дата окончания */
  endDate: string
  /** Ставка загрузки (0.0 - 1.0) */
  rate: number
  /** Комментарий (опционально) */
  comment?: string
}

export interface UpdateLoadingInput {
  /** ID загрузки */
  loadingId: string
  /** ID этапа декомпозиции (опционально, для смены этапа) */
  stageId?: string
  /** ID сотрудника */
  employeeId?: string
  /** Дата начала */
  startDate?: string
  /** Дата окончания */
  endDate?: string
  /** Ставка загрузки (0.0 - 1.0) */
  rate?: number
  /** Комментарий */
  comment?: string
}

export interface ArchiveLoadingInput {
  /** ID загрузки */
  loadingId: string
}

export interface DeleteLoadingInput {
  /** ID загрузки */
  loadingId: string
}

export interface LoadingResult {
  id: string
  stageId: string
  employeeId: string
  startDate: string
  endDate: string
  rate: number
  comment: string | null
  status: LoadingStatusType
  createdAt: string
  updatedAt: string | null
}

export interface CreateLoadingBatchInput {
  /** ID этапа декомпозиции */
  stageId: string
  /** ID раздела */
  sectionId: string
  /** Массив ID сотрудников */
  employeeIds: string[]
  /** Дата начала */
  startDate: string
  /** Дата окончания */
  endDate: string
  /** Ставка загрузки */
  rate: number
  /** Комментарий (опционально) */
  comment?: string
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Валидация даты (формат YYYY-MM-DD)
 */
function isValidDate(dateString: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/
  if (!regex.test(dateString)) return false

  const date = new Date(dateString)
  return !isNaN(date.getTime())
}

/**
 * Валидация ставки загрузки (0.01 - 2.0)
 */
function isValidRate(rate: number): boolean {
  return rate >= 0.01 && rate <= 2.0
}

/**
 * Общая валидация полей загрузки (без employee — он отличается в single/batch)
 */
function validateLoadingFields(input: {
  stageId: string
  startDate: string
  endDate: string
  rate: number
}): string | null {
  if (!input.stageId?.trim()) return 'ID этапа обязателен'
  if (!isValidDate(input.startDate)) return 'Неверный формат даты начала'
  if (!isValidDate(input.endDate)) return 'Неверный формат даты окончания'
  if (new Date(input.startDate) > new Date(input.endDate)) {
    return 'Дата начала не может быть позже даты окончания'
  }
  if (!isValidRate(input.rate)) return 'Ставка загрузки должна быть от 0.01 до 2.0'
  return null
}

/**
 * Конвертация строки БД в LoadingResult
 */
function mapLoadingToResult(row: LoadingRow): LoadingResult {
  return {
    id: row.loading_id,
    stageId: row.loading_stage || '',
    employeeId: row.loading_responsible || '',
    startDate: row.loading_start,
    endDate: row.loading_finish,
    rate: row.loading_rate || 0,
    comment: row.loading_comment,
    status: row.loading_status,
    createdAt: row.loading_created || '',
    updatedAt: row.loading_updated,
  }
}

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Создание новой загрузки сотрудника
 */
export async function createLoading(
  input: CreateLoadingInput
): Promise<ActionResult<LoadingResult>> {
  try {
    const supabase = await createClient()

    // Валидация общих полей
    const validationError = validateLoadingFields(input)
    if (validationError) return { success: false, error: validationError }

    if (!input.employeeId?.trim()) {
      return { success: false, error: 'ID сотрудника обязателен' }
    }

    // Подготовка данных для вставки
    const insertData: LoadingInsert = {
      loading_stage: input.stageId,
      loading_section: input.sectionId,
      loading_responsible: input.employeeId,
      loading_start: input.startDate,
      loading_finish: input.endDate,
      loading_rate: input.rate,
      loading_comment: input.comment || null,
      loading_status: 'active',
      is_shortage: false,
      loading_created: new Date().toISOString(),
    }

    // Вставка в БД
    const { data, error } = await supabase
      .from('loadings')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('[createLoading] Supabase error:', error)
      return {
        success: false,
        error: `Не удалось создать загрузку: ${error.message}`,
      }
    }

    // Revalidate paths
    revalidatePath('/resource-graph')
    revalidatePath('/tasks')

    return { success: true, data: mapLoadingToResult(data) }
  } catch (error) {
    console.error('[createLoading] Error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Произошла неизвестная ошибка при создании загрузки',
    }
  }
}

/**
 * Batch-создание загрузок для нескольких сотрудников.
 * Один INSERT в Supabase, один revalidatePath.
 */
export async function createLoadingBatch(
  input: CreateLoadingBatchInput
): Promise<ActionResult<{ created: number; total: number }>> {
  try {
    const supabase = await createClient()

    // Валидация общих полей
    const validationError = validateLoadingFields(input)
    if (validationError) return { success: false, error: validationError }

    if (!input.employeeIds || input.employeeIds.length === 0) {
      return { success: false, error: 'Необходимо указать хотя бы одного сотрудника' }
    }

    const now = new Date().toISOString()

    // Подготовка массива для batch insert
    const rows: LoadingInsert[] = input.employeeIds.map((employeeId) => ({
      loading_stage: input.stageId,
      loading_section: input.sectionId,
      loading_responsible: employeeId,
      loading_start: input.startDate,
      loading_finish: input.endDate,
      loading_rate: input.rate,
      loading_comment: input.comment || null,
      loading_status: 'active' as const,
      is_shortage: false,
      loading_created: now,
    }))

    // Один INSERT для всех сотрудников (без .select() — нам не нужны возвращённые данные)
    const { error } = await supabase
      .from('loadings')
      .insert(rows)

    if (error) {
      console.error('[createLoadingBatch] Supabase error:', error)
      return {
        success: false,
        error: `Не удалось создать загрузки: ${error.message}`,
      }
    }

    // Один revalidatePath
    revalidatePath('/resource-graph')
    revalidatePath('/tasks')

    return {
      success: true,
      data: { created: rows.length, total: input.employeeIds.length },
    }
  } catch (error) {
    console.error('[createLoadingBatch] Error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Произошла неизвестная ошибка при создании загрузок',
    }
  }
}

/**
 * Обновление существующей загрузки
 */
export async function updateLoading(
  input: UpdateLoadingInput
): Promise<ActionResult<LoadingResult>> {
  try {
    const supabase = await createClient()

    // Валидация ID загрузки
    if (!input.loadingId?.trim()) {
      return { success: false, error: 'ID загрузки обязателен' }
    }

    // Подготовка данных для обновления
    const updateData: LoadingUpdate = {
      loading_updated: new Date().toISOString(),
    }

    if (input.stageId !== undefined) {
      if (!input.stageId.trim()) {
        return { success: false, error: 'ID этапа не может быть пустым' }
      }
      updateData.loading_stage = input.stageId
    }

    if (input.employeeId !== undefined) {
      if (!input.employeeId.trim()) {
        return { success: false, error: 'ID сотрудника не может быть пустым' }
      }
      updateData.loading_responsible = input.employeeId
    }

    if (input.startDate !== undefined) {
      if (!isValidDate(input.startDate)) {
        return { success: false, error: 'Неверный формат даты начала' }
      }
      updateData.loading_start = input.startDate
    }

    if (input.endDate !== undefined) {
      if (!isValidDate(input.endDate)) {
        return { success: false, error: 'Неверный формат даты окончания' }
      }
      updateData.loading_finish = input.endDate
    }

    if (input.rate !== undefined) {
      if (!isValidRate(input.rate)) {
        return {
          success: false,
          error: 'Ставка загрузки должна быть от 0.01 до 2.0',
        }
      }
      updateData.loading_rate = input.rate
    }

    if (input.comment !== undefined) {
      updateData.loading_comment = input.comment || null
    }

    // Проверка дат (если обе переданы)
    if (updateData.loading_start && updateData.loading_finish) {
      if (new Date(updateData.loading_start) > new Date(updateData.loading_finish)) {
        return {
          success: false,
          error: 'Дата начала не может быть позже даты окончания',
        }
      }
    }

    // Обновление в БД
    const { data, error } = await supabase
      .from('loadings')
      .update(updateData)
      .eq('loading_id', input.loadingId)
      .select()
      .single()

    if (error) {
      console.error('[updateLoading] Supabase error:', error)
      return {
        success: false,
        error: `Не удалось обновить загрузку: ${error.message}`,
      }
    }

    // Revalidate paths
    revalidatePath('/resource-graph')
    revalidatePath('/tasks')

    return { success: true, data: mapLoadingToResult(data) }
  } catch (error) {
    console.error('[updateLoading] Error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Произошла неизвестная ошибка при обновлении загрузки',
    }
  }
}

/**
 * Архивация загрузки (soft delete)
 */
export async function archiveLoading(
  input: ArchiveLoadingInput
): Promise<ActionResult<LoadingResult>> {
  try {
    const supabase = await createClient()

    // Валидация ID загрузки
    if (!input.loadingId?.trim()) {
      return { success: false, error: 'ID загрузки обязателен' }
    }

    // Обновление статуса на archived
    const { data, error } = await supabase
      .from('loadings')
      .update({
        loading_status: 'archived',
        loading_updated: new Date().toISOString(),
      })
      .eq('loading_id', input.loadingId)
      .select()
      .single()

    if (error) {
      console.error('[archiveLoading] Supabase error:', error)
      return {
        success: false,
        error: `Не удалось архивировать загрузку: ${error.message}`,
      }
    }

    // Revalidate paths
    revalidatePath('/resource-graph')
    revalidatePath('/tasks')

    return { success: true, data: mapLoadingToResult(data) }
  } catch (error) {
    console.error('[archiveLoading] Error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Произошла неизвестная ошибка при архивации загрузки',
    }
  }
}

/**
 * Получение загрузки по ID
 */
export async function getLoadingById(
  loadingId: string
): Promise<ActionResult<LoadingResult>> {
  try {
    const supabase = await createClient()

    // Валидация ID загрузки
    if (!loadingId?.trim()) {
      return { success: false, error: 'ID загрузки обязателен' }
    }

    // Получение загрузки из БД
    const { data, error } = await supabase
      .from('loadings')
      .select('*')
      .eq('loading_id', loadingId)
      .single()

    if (error) {
      console.error('[getLoadingById] Supabase error:', error)
      return {
        success: false,
        error: `Не удалось получить загрузку: ${error.message}`,
      }
    }

    if (!data) {
      return {
        success: false,
        error: 'Загрузка не найдена',
      }
    }

    return { success: true, data: mapLoadingToResult(data) }
  } catch (error) {
    console.error('[getLoadingById] Error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Произошла неизвестная ошибка при получении загрузки',
    }
  }
}

export interface DepartmentLoadingItem {
  loadingId: string
  employeeId: string
  employeeName: string
  employeeEmail: string
  sectionId: string
  sectionName: string
  projectId: string
  projectName: string
  startDate: string
  endDate: string
  rate: number
  comment: string | null
  status: LoadingStatusType
}

/**
 * Получение всех загрузок сотрудников отдела
 */
export async function getDepartmentLoadings(
  departmentId: string
): Promise<ActionResult<DepartmentLoadingItem[]>> {
  try {
    const supabase = await createClient()

    // Валидация ID отдела
    if (!departmentId?.trim()) {
      return { success: false, error: 'ID отдела обязателен' }
    }

    // Получаем загрузки через JOIN с profiles и sections
    // Каст через any нужен из-за ts(2589): Supabase не справляется с выводом типа
    // при 4 уровнях вложенных JOIN — TypeScript превышает лимит глубины рекурсии
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const from = supabase.from('loadings') as any
    const { data, error } = await from
      .select(`
        loading_id,
        loading_responsible,
        loading_start,
        loading_finish,
        loading_rate,
        loading_comment,
        loading_status,
        loading_stage,
        profiles!loadings_loading_responsible_fkey (
          user_id,
          first_name,
          last_name,
          email,
          department_id
        ),
        decomposition_stages!loadings_loading_stage_fkey (
          stage_id,
          stage_section_id,
          sections!decomposition_stages_stage_section_id_fkey (
            section_id,
            section_name,
            section_project_id,
            projects!sections_section_project_id_fkey (
              project_id,
              project_name
            )
          )
        )
      `)
      .eq('profiles.department_id', departmentId)
      .eq('loading_status', 'active')
      .order('loading_start', { ascending: false })

    if (error) {
      console.error('[getDepartmentLoadings] Supabase error:', error)
      return {
        success: false,
        error: `Не удалось получить загрузки отдела: ${error.message}`,
      }
    }

    // Маппинг данных
    const loadings: DepartmentLoadingItem[] = (data || [])
      .filter((item: any) => {
        // Фильтруем записи с корректными связями
        return (
          item.profiles &&
          item.decomposition_stages &&
          item.decomposition_stages.sections &&
          item.decomposition_stages.sections.projects
        )
      })
      .map((item: any) => ({
        loadingId: item.loading_id,
        employeeId: item.profiles.user_id,
        employeeName: `${item.profiles.first_name} ${item.profiles.last_name}`,
        employeeEmail: item.profiles.email,
        sectionId: item.decomposition_stages.sections.section_id,
        sectionName: item.decomposition_stages.sections.section_name,
        projectId: item.decomposition_stages.sections.projects.project_id,
        projectName: item.decomposition_stages.sections.projects.project_name,
        startDate: item.loading_start,
        endDate: item.loading_finish,
        rate: item.loading_rate || 0,
        comment: item.loading_comment,
        status: item.loading_status,
      }))

    return { success: true, data: loadings }
  } catch (error) {
    console.error('[getDepartmentLoadings] Error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Произошла неизвестная ошибка при получении загрузок отдела',
    }
  }
}

/**
 * Удаление загрузки (hard delete)
 */
export async function deleteLoading(
  input: DeleteLoadingInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = await createClient()

    // Валидация ID загрузки
    if (!input.loadingId?.trim()) {
      return { success: false, error: 'ID загрузки обязателен' }
    }

    // Удаление из БД
    const { error } = await supabase
      .from('loadings')
      .delete()
      .eq('loading_id', input.loadingId)

    if (error) {
      console.error('[deleteLoading] Supabase error:', error)
      return {
        success: false,
        error: `Не удалось удалить загрузку: ${error.message}`,
      }
    }

    // Revalidate paths
    revalidatePath('/resource-graph')
    revalidatePath('/tasks')

    return { success: true, data: { id: input.loadingId } }
  } catch (error) {
    console.error('[deleteLoading] Error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Произошла неизвестная ошибка при удалении загрузки',
    }
  }
}

// ============================================================================
// Split Loading
// ============================================================================

export interface SplitLoadingInput {
  /** ID загрузки для разрезания */
  loadingId: string
  /** Дата начала ВТОРОЙ части (YYYY-MM-DD) */
  splitDate: string
}

export interface SplitLoadingResult {
  /** Обновлённый оригинал (endDate = splitDate - 1) */
  original: LoadingResult
  /** Новая загрузка (startDate = splitDate) */
  created: LoadingResult
}

/**
 * Разрезание загрузки на две части
 *
 * Оригинальная загрузка обновляется: endDate = splitDate - 1 день.
 * Создаётся новая загрузка: startDate = splitDate, endDate = original endDate.
 * Все остальные поля (employee, section, stage, rate, comment) копируются.
 */
export async function splitLoading(
  input: SplitLoadingInput
): Promise<ActionResult<SplitLoadingResult>> {
  try {
    const supabase = await createClient()

    // Валидация
    if (!input.loadingId?.trim()) {
      return { success: false, error: 'ID загрузки обязателен' }
    }
    if (!isValidDate(input.splitDate)) {
      return { success: false, error: 'Неверный формат даты разреза' }
    }

    // Получаем оригинальную загрузку
    const { data: original, error: fetchError } = await supabase
      .from('loadings')
      .select('*')
      .eq('loading_id', input.loadingId)
      .single()

    if (fetchError || !original) {
      return { success: false, error: 'Загрузка не найдена' }
    }

    if (original.loading_status !== 'active') {
      return { success: false, error: 'Можно разрезать только активную загрузку' }
    }

    const splitDate = parseISO(input.splitDate)
    const startDate = parseISO(original.loading_start)
    const finishDate = parseISO(original.loading_finish)

    // splitDate должна быть строго между start и finish
    if (splitDate <= startDate || splitDate > finishDate) {
      return {
        success: false,
        error: 'Дата разреза должна быть строго внутри диапазона загрузки',
      }
    }

    const originalNewEnd = format(addDays(splitDate, -1), 'yyyy-MM-dd')
    const now = new Date().toISOString()

    // UPDATE оригинал: сокращаем endDate
    const { data: updatedOriginal, error: updateError } = await supabase
      .from('loadings')
      .update({
        loading_finish: originalNewEnd,
        loading_updated: now,
      })
      .eq('loading_id', input.loadingId)
      .select()
      .single()

    if (updateError) {
      console.error('[splitLoading] Update error:', updateError)
      return { success: false, error: `Не удалось обновить оригинал: ${updateError.message}` }
    }

    // INSERT новая загрузка: копия с новыми датами
    const insertData: LoadingInsert = {
      loading_stage: original.loading_stage,
      loading_section: original.loading_section,
      loading_responsible: original.loading_responsible,
      loading_start: input.splitDate,
      loading_finish: original.loading_finish,
      loading_rate: original.loading_rate,
      loading_comment: original.loading_comment,
      loading_status: 'active',
      is_shortage: original.is_shortage ?? false,
      loading_created: now,
    }

    const { data: newLoading, error: insertError } = await supabase
      .from('loadings')
      .insert(insertData)
      .select()
      .single()

    if (insertError) {
      console.error('[splitLoading] Insert error:', insertError)
      // Откат: восстановить оригинальную дату окончания
      await supabase
        .from('loadings')
        .update({ loading_finish: original.loading_finish, loading_updated: now })
        .eq('loading_id', input.loadingId)

      return { success: false, error: `Не удалось создать вторую часть: ${insertError.message}` }
    }

    revalidatePath('/resource-graph')
    revalidatePath('/tasks')

    return {
      success: true,
      data: {
        original: mapLoadingToResult(updatedOriginal),
        created: mapLoadingToResult(newLoading),
      },
    }
  } catch (error) {
    console.error('[splitLoading] Error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Произошла неизвестная ошибка при разрезании загрузки',
    }
  }
}
