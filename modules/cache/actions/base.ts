'use server'

import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '../types'

/**
 * Получить Supabase клиент для Server Actions
 */
export async function getSupabaseClient() {
  return createClient()
}

/**
 * Обёртка для безопасного выполнения Server Action
 *
 * Автоматически обрабатывает ошибки и возвращает типизированный результат
 */
export async function safeAction<T>(
  action: () => Promise<T>
): Promise<ActionResult<T>> {
  try {
    const data = await action()
    return { success: true, data }
  } catch (error) {
    console.error('[Server Action Error]:', error)

    const message =
      error instanceof Error
        ? error.message
        : 'Произошла неизвестная ошибка'

    return { success: false, error: message }
  }
}
