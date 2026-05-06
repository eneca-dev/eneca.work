/**
 * Work-to-Worksection Sync Hook
 *
 * React хук для синхронизации проекта с Worksection.
 * Использует Server Action и показывает toast уведомления.
 *
 * @module budgets-page/hooks/use-work-to-ws-sync
 */

'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { syncProjectToWorksection, type SyncResult } from '../actions/sync-actions'
import { useToast } from '@/components/ui/use-toast'

// ============================================================================
// Types
// ============================================================================

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error'

export interface UseWorkToWsSyncResult {
  /** Текущий статус синхронизации */
  status: SyncStatus
  /** Идёт ли синхронизация */
  isSyncing: boolean
  /** Последний результат синхронизации */
  lastResult: SyncResult | null
  /** Последняя ошибка */
  lastError: string | null
  /** ID проекта который сейчас синхронизируется */
  syncingProjectId: string | null
  /** Запустить синхронизацию проекта */
  sync: (projectId: string, projectName?: string) => Promise<SyncResult | null>
  /** Сбросить статус */
  reset: () => void
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Хук для синхронизации проекта с Worksection
 *
 * @example
 * ```tsx
 * const { sync, isSyncing, status } = useWorkToWsSync()
 *
 * <button
 *   onClick={() => sync(projectId, projectName)}
 *   disabled={isSyncing}
 * >
 *   {isSyncing ? 'Синхронизация...' : 'Синхронизировать'}
 * </button>
 * ```
 */
export function useWorkToWsSync(): UseWorkToWsSyncResult {
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [lastResult, setLastResult] = useState<SyncResult | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)
  const [syncingProjectId, setSyncingProjectId] = useState<string | null>(null)
  const { toast } = useToast()

  // Ref для хранения таймера сброса статуса
  const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Очистка таймера при unmount компонента
  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current)
      }
    }
  }, [])

  // Вспомогательная функция для безопасного сброса статуса
  const scheduleStatusReset = useCallback(() => {
    // Очищаем предыдущий таймер если есть
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current)
    }
    // Запускаем новый таймер
    resetTimeoutRef.current = setTimeout(() => {
      setStatus('idle')
    }, 5000)
  }, [])

  const sync = useCallback(
    async (projectId: string, projectName?: string): Promise<SyncResult | null> => {
      // Предотвращаем повторный запуск
      if (status === 'syncing') {
        return null
      }

      setStatus('syncing')
      setSyncingProjectId(projectId)
      setLastError(null)

      // Показываем toast о начале синхронизации
      toast({
        title: 'Синхронизация запущена',
        description: projectName
          ? `Проект "${projectName}" синхронизируется с Worksection...`
          : 'Проект синхронизируется с Worksection...',
      })

      try {
        const result = await syncProjectToWorksection({ projectId })

        if (!result.success) {
          // Ошибка от Server Action
          setStatus('error')
          setLastError(result.error)
          setSyncingProjectId(null)

          toast({
            title: 'Ошибка синхронизации',
            description: result.error,
            variant: 'destructive',
          })

          // Сбрасываем статус через 5 секунд
          scheduleStatusReset()

          return null
        }

        // Успешная синхронизация
        setStatus('success')
        setLastResult(result.data)
        setSyncingProjectId(null)

        // Формируем сообщение с результатами
        const stats = result.data.stats
        const created =
          stats.objects.created + stats.sections.created + stats.decomposition.created
        const updated =
          stats.objects.updated + stats.sections.updated + stats.decomposition.updated
        const duration = (stats.duration_ms / 1000).toFixed(1)

        toast({
          title: 'Синхронизация завершена',
          description: `Создано: ${created}, обновлено: ${updated}. Время: ${duration}с`,
          variant: 'default',
        })

        // Сбрасываем статус через 5 секунд
        scheduleStatusReset()

        return result.data
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Неизвестная ошибка'
        setStatus('error')
        setLastError(message)
        setSyncingProjectId(null)

        toast({
          title: 'Ошибка синхронизации',
          description: message,
          variant: 'destructive',
        })

        // Сбрасываем статус через 5 секунд
        scheduleStatusReset()

        return null
      }
    },
    [status, toast, scheduleStatusReset]
  )

  const reset = useCallback(() => {
    // Очищаем таймер при ручном сбросе
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current)
      resetTimeoutRef.current = null
    }
    setStatus('idle')
    setLastResult(null)
    setLastError(null)
    setSyncingProjectId(null)
  }, [])

  return {
    status,
    isSyncing: status === 'syncing',
    lastResult,
    lastError,
    syncingProjectId,
    sync,
    reset,
  }
}
