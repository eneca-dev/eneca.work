'use server'

import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/modules/cache/types'
import * as Sentry from '@sentry/nextjs'

// ============================================================================
// Types
// ============================================================================

/** Тип чекпоинта из таблицы */
export interface CheckpointType {
  type_id: string
  type: string // unique slug: 'exam', 'task_transfer', 'milestone', etc.
  name: string // display name: 'Экспертиза', 'Передача задания', etc.
  icon: string // lucide icon name
  color: string // hex color
  is_custom: boolean
  created_by: string | null
  created_at: string
}

/** Input для создания типа */
export interface CreateCheckpointTypeInput {
  type: string // unique slug
  name: string
  icon: string
  color: string
}

/** Input для обновления типа */
export interface UpdateCheckpointTypeInput {
  typeId: string
  name?: string
  icon?: string
  color?: string
}

// ============================================================================
// Permission Helper
// ============================================================================

/**
 * Проверить, является ли текущий пользователь админом
 */
async function isAdmin(): Promise<{ isAdmin: boolean; userId: string | null; error?: string }> {
  try {
    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { isAdmin: false, userId: null, error: 'Пользователь не авторизован' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role_id')
      .eq('id', user.id)
      .single()

    if (!profile?.role_id) {
      return { isAdmin: false, userId: user.id, error: 'Роль не назначена' }
    }

    const { data: role } = await supabase
      .from('roles')
      .select('name')
      .eq('id', profile.role_id)
      .single()

    if (role?.name === 'admin') {
      return { isAdmin: true, userId: user.id }
    }

    return { isAdmin: false, userId: user.id, error: 'Недостаточно прав (требуется роль admin)' }
  } catch (error) {
    console.error('[isAdmin] Error:', error)
    return {
      isAdmin: false,
      userId: null,
      error: error instanceof Error ? error.message : 'Ошибка проверки прав',
    }
  }
}

// ============================================================================
// Read Actions
// ============================================================================

/**
 * Получить все типы чекпоинтов
 */
export async function getCheckpointTypes(): Promise<ActionResult<CheckpointType[]>> {
  return await Sentry.startSpan(
    {
      name: 'getCheckpointTypes',
      op: 'db.query',
    },
    async () => {
      try {
        const supabase = await createClient()

        const { data, error } = await supabase
          .from('checkpoint_types')
          .select('*')
          .order('is_custom', { ascending: true }) // Сначала встроенные
          .order('name', { ascending: true })

        if (error) {
          Sentry.captureException(error, {
            tags: { module: 'checkpoints', action: 'getCheckpointTypes' },
          })
          console.error('[getCheckpointTypes] Supabase error:', error)
          return { success: false, error: error.message }
        }

        return { success: true, data: data as CheckpointType[] }
      } catch (error) {
        Sentry.captureException(error, {
          tags: { module: 'checkpoints', action: 'getCheckpointTypes' },
        })
        console.error('[getCheckpointTypes] Error:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        }
      }
    }
  )
}

// ============================================================================
// Write Actions
// ============================================================================

/**
 * Создать кастомный тип чекпоинта (только admin)
 */
export async function createCheckpointType(
  input: CreateCheckpointTypeInput
): Promise<ActionResult<CheckpointType>> {
  return await Sentry.startSpan(
    {
      name: 'createCheckpointType',
      op: 'db.mutation',
      attributes: {
        'checkpointType.type': input.type,
      },
    },
    async () => {
      try {
        const supabase = await createClient()

        // 1. Проверка прав админа
        const adminCheck = await isAdmin()
        if (!adminCheck.isAdmin) {
          return { success: false, error: adminCheck.error || 'Недостаточно прав' }
        }

        // 2. Валидация type slug (только латиница, цифры, underscore)
        if (!/^[a-z][a-z0-9_]*$/.test(input.type)) {
          return {
            success: false,
            error: 'Код типа должен начинаться с буквы и содержать только латиницу, цифры и _',
          }
        }

        // 3. Создать тип
        const { data, error } = await supabase
          .from('checkpoint_types')
          .insert({
            type: input.type,
            name: input.name,
            icon: input.icon,
            color: input.color,
            is_custom: true,
            created_by: adminCheck.userId,
          })
          .select()
          .single()

        if (error) {
          Sentry.captureException(error, {
            tags: { module: 'checkpoints', action: 'createCheckpointType' },
            extra: { input },
          })
          console.error('[createCheckpointType] Insert error:', error)
          // Проверка на duplicate key
          if (error.code === '23505') {
            return { success: false, error: `Тип с кодом "${input.type}" уже существует` }
          }
          return { success: false, error: error.message }
        }

        return { success: true, data: data as CheckpointType }
      } catch (error) {
        Sentry.captureException(error, {
          tags: { module: 'checkpoints', action: 'createCheckpointType' },
          extra: { input },
        })
        console.error('[createCheckpointType] Error:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        }
      }
    }
  )
}

/**
 * Обновить кастомный тип чекпоинта (только admin)
 */
export async function updateCheckpointType(
  input: UpdateCheckpointTypeInput
): Promise<ActionResult<CheckpointType>> {
  return await Sentry.startSpan(
    {
      name: 'updateCheckpointType',
      op: 'db.mutation',
      attributes: {
        'checkpointType.id': input.typeId,
      },
    },
    async () => {
      try {
        const supabase = await createClient()

        // 1. Проверка прав админа
        const adminCheck = await isAdmin()
        if (!adminCheck.isAdmin) {
          return { success: false, error: adminCheck.error || 'Недостаточно прав' }
        }

        // 2. Получить текущий тип
        const { data: existing, error: fetchError } = await supabase
          .from('checkpoint_types')
          .select('*')
          .eq('type_id', input.typeId)
          .single()

        if (fetchError || !existing) {
          return { success: false, error: 'Тип не найден' }
        }

        // 3. Проверить что это кастомный тип
        if (!existing.is_custom) {
          return { success: false, error: 'Нельзя редактировать встроенные типы' }
        }

        // 4. Подготовить обновление
        const updates: Record<string, unknown> = {}
        if (input.name !== undefined) updates.name = input.name
        if (input.icon !== undefined) updates.icon = input.icon
        if (input.color !== undefined) updates.color = input.color

        if (Object.keys(updates).length === 0) {
          return { success: true, data: existing as CheckpointType }
        }

        // 5. Выполнить UPDATE
        const { data, error: updateError } = await supabase
          .from('checkpoint_types')
          .update(updates)
          .eq('type_id', input.typeId)
          .select()
          .single()

        if (updateError) {
          Sentry.captureException(updateError, {
            tags: { module: 'checkpoints', action: 'updateCheckpointType' },
            extra: { input },
          })
          console.error('[updateCheckpointType] Update error:', updateError)
          return { success: false, error: updateError.message }
        }

        return { success: true, data: data as CheckpointType }
      } catch (error) {
        Sentry.captureException(error, {
          tags: { module: 'checkpoints', action: 'updateCheckpointType' },
          extra: { input },
        })
        console.error('[updateCheckpointType] Error:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        }
      }
    }
  )
}

/**
 * Удалить кастомный тип чекпоинта (только admin)
 */
export async function deleteCheckpointType(
  typeId: string
): Promise<ActionResult<{ deleted: boolean }>> {
  return await Sentry.startSpan(
    {
      name: 'deleteCheckpointType',
      op: 'db.mutation',
      attributes: {
        'checkpointType.id': typeId,
      },
    },
    async () => {
      try {
        const supabase = await createClient()

        // 1. Проверка прав админа
        const adminCheck = await isAdmin()
        if (!adminCheck.isAdmin) {
          return { success: false, error: adminCheck.error || 'Недостаточно прав' }
        }

        // 2. Получить текущий тип
        const { data: existing, error: fetchError } = await supabase
          .from('checkpoint_types')
          .select('*')
          .eq('type_id', typeId)
          .single()

        if (fetchError || !existing) {
          return { success: false, error: 'Тип не найден' }
        }

        // 3. Проверить что это кастомный тип
        if (!existing.is_custom) {
          return { success: false, error: 'Нельзя удалять встроенные типы' }
        }

        // 4. Проверить что тип не используется в чекпоинтах
        const { count, error: countError } = await supabase
          .from('section_checkpoints')
          .select('*', { count: 'exact', head: true })
          .eq('type_id', typeId)

        if (countError) {
          console.error('[deleteCheckpointType] Count error:', countError)
          return { success: false, error: 'Ошибка проверки использования типа' }
        }

        if (count && count > 0) {
          return {
            success: false,
            error: `Тип используется в ${count} чекпоинт(ах). Сначала измените тип в этих чекпоинтах.`,
          }
        }

        // 5. Удалить тип
        const { error: deleteError } = await supabase
          .from('checkpoint_types')
          .delete()
          .eq('type_id', typeId)

        if (deleteError) {
          Sentry.captureException(deleteError, {
            tags: { module: 'checkpoints', action: 'deleteCheckpointType' },
            extra: { typeId },
          })
          console.error('[deleteCheckpointType] Delete error:', deleteError)
          return { success: false, error: deleteError.message }
        }

        return { success: true, data: { deleted: true } }
      } catch (error) {
        Sentry.captureException(error, {
          tags: { module: 'checkpoints', action: 'deleteCheckpointType' },
          extra: { typeId },
        })
        console.error('[deleteCheckpointType] Error:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        }
      }
    }
  )
}
