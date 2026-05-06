/**
 * Work-to-Worksection Sync Server Actions
 *
 * Server Action для синхронизации проекта из eneca.work в Worksection.
 * Выполняется на сервере, скрывает URL и credentials от клиента.
 *
 * @module budgets-page/actions/sync-actions
 */

'use server'

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/modules/cache'

// ============================================================================
// Types
// ============================================================================

/** Статистика синхронизации по типу сущности */
export interface SyncEntityStats {
  created: number
  updated: number
  unchanged: number
  errors: string[]
}

/** Результат синхронизации проекта */
export interface SyncResult {
  /** Успешность операции */
  success: boolean
  /** ID проекта в Supabase */
  project_id: string
  /** ID проекта в Worksection */
  ws_project_id: string | null
  /** Статистика по сущностям */
  stats: {
    project: {
      action: 'created' | 'updated' | 'unchanged' | 'error'
      wsProjectId: string | null
    }
    objects: SyncEntityStats
    sections: SyncEntityStats
    decomposition: SyncEntityStats
    totalErrors: number
    duration_ms: number
  }
  /** Сообщение об ошибке (если есть) */
  error?: string
}

// ============================================================================
// Zod Schemas
// ============================================================================

/** Схема для валидации входных данных */
const SyncProjectSchema = z.object({
  projectId: z.string().uuid('Некорректный ID проекта'),
  dryRun: z.boolean().optional(),
})

/** Тип входных данных (dryRun опционален) */
export type SyncProjectInput = z.input<typeof SyncProjectSchema>

// ============================================================================
// Server Action
// ============================================================================

/**
 * Синхронизирует проект с Worksection
 *
 * @param input - Входные данные (projectId, dryRun)
 * @returns ActionResult с результатом синхронизации
 */
export async function syncProjectToWorksection(
  input: SyncProjectInput
): Promise<ActionResult<SyncResult>> {
  // 1. Валидация входных данных
  const validated = SyncProjectSchema.safeParse(input)
  if (!validated.success) {
    return {
      success: false,
      error: validated.error.errors[0]?.message || 'Ошибка валидации',
    }
  }

  const { projectId, dryRun = false } = validated.data

  // 2. Проверка аутентификации
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      success: false,
      error: 'Необходима авторизация',
    }
  }

  // 3. Проверка что проект существует
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('project_id, project_name')
    .eq('project_id', projectId)
    .single()

  if (projectError || !project) {
    return {
      success: false,
      error: 'Проект не найден',
    }
  }

  // Получаем URL
  const syncServiceUrl = process.env.WORK_TO_WS_URL || 'https://work-to-ws.eneca.work'

  // 5. Отправляем запрос на VPS сервис
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 180000) // 3 минуты таймаут

    const response = await fetch(`${syncServiceUrl}/api/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Если в будущем добавим API key:
        // 'X-API-Key': process.env.WORK_TO_WS_API_KEY || '',
      },
      body: JSON.stringify({
        project_id: projectId,
        dry_run: dryRun,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    // 6. Обрабатываем ответ
    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = 'Ошибка сервиса синхронизации'

      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.error || errorMessage
      } catch {
        // Не JSON ответ
      }

      return {
        success: false,
        error: `${errorMessage} (${response.status})`,
      }
    }

    const result = await response.json()

    // 7. Проверяем структуру ответа
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Синхронизация завершилась с ошибкой',
      }
    }

    // 8. Возвращаем успешный результат
    return {
      success: true,
      data: {
        success: true,
        project_id: projectId,
        ws_project_id: result.ws_project_id || null,
        stats: result.stats || {
          project: { action: 'unchanged', wsProjectId: null },
          objects: { created: 0, updated: 0, unchanged: 0, errors: [] },
          sections: { created: 0, updated: 0, unchanged: 0, errors: [] },
          decomposition: { created: 0, updated: 0, unchanged: 0, errors: [] },
          totalErrors: 0,
          duration_ms: 0,
        },
      },
    }
  } catch (error) {
    // Обработка ошибок сети/таймаута
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Превышено время ожидания (3 мин). Синхронизация может продолжаться на сервере.',
        }
      }

      return {
        success: false,
        error: `Ошибка соединения: ${error.message}`,
      }
    }

    return {
      success: false,
      error: 'Неизвестная ошибка при синхронизации',
    }
  }
}
