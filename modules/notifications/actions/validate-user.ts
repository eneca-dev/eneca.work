/**
 * User validation helpers for Server Actions
 *
 * @module modules/notifications/actions/validate-user
 */

'use server'

import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/db'

export interface ValidateUserResult {
  success: true
  user: {
    id: string
    email?: string
  }
}

export interface ValidateUserError {
  success: false
  error: string
}

/**
 * Валидирует авторизацию пользователя в Server Action
 *
 * @param supabase - Серверный Supabase client
 * @param context - Контекст для Sentry логирования (название операции)
 * @returns Результат валидации с user.id или ошибка
 *
 * @example
 * ```typescript
 * const result = await validateAndGetUser(supabase, 'mark_as_read')
 * if (!result.success) {
 *   return { success: false, error: result.error }
 * }
 * const userId = result.user.id
 * ```
 */
export async function validateAndGetUser(
  supabase: SupabaseClient<Database>,
  context: string
): Promise<ValidateUserResult | ValidateUserError> {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
      console.error(`[${context}] Auth error:`, authError)
      Sentry.captureException(authError, {
        tags: {
          module: 'notifications',
          context,
          error_type: 'auth_error',
        },
      })
      return {
        success: false,
        error: 'Ошибка авторизации',
      }
    }

    if (!user) {
      console.error(`[${context}] No user in session`)
      Sentry.captureMessage(`${context}: No user in session`, {
        level: 'warning',
        tags: {
          module: 'notifications',
          context,
        },
      })
      return {
        success: false,
        error: 'Не авторизован',
      }
    }

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
      },
    }
  } catch (error) {
    console.error(`[${context}] Unexpected error:`, error)
    Sentry.captureException(error, {
      tags: {
        module: 'notifications',
        context,
        error_type: 'validation_error',
      },
    })
    return {
      success: false,
      error: 'Внутренняя ошибка',
    }
  }
}

/**
 * Валидирует пользователя и устанавливает Sentry span attributes
 *
 * Это helper-функция которая объединяет:
 * - Валидацию через validateAndGetUser()
 * - Установку Sentry span attributes (auth.status, user.id)
 * - Возврат userId в удобном формате
 *
 * @param supabase - Серверный Supabase client
 * @param context - Контекст операции для логирования
 * @param span - Sentry span для установки attributes
 * @returns { userId: string } при успехе или { error: string } при ошибке
 *
 * @example
 * ```typescript
 * const supabase = await createClient()
 * const result = await validateUserWithSpan(supabase, 'markAsRead', span)
 *
 * if ('error' in result) {
 *   return { success: false, error: result.error }
 * }
 *
 * const userId = result.userId
 * ```
 */
export async function validateUserWithSpan(
  supabase: SupabaseClient<Database>,
  context: string,
  span: any // Sentry.Span type
): Promise<{ userId: string } | { error: string }> {
  const userValidation = await validateAndGetUser(supabase, context)

  if (!userValidation.success) {
    span.setAttribute('auth.status', 'failed')
    return { error: userValidation.error }
  }

  const userId = userValidation.user.id
  span.setAttribute('user.id', userId)
  span.setAttribute('auth.status', 'authenticated')

  return { userId }
}
