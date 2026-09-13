'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'
import * as Sentry from '@sentry/nextjs'
import { toast } from 'sonner'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import {
  realtimeSubscriptions,
  REALTIME_CHANNEL_NAME,
  INVALIDATION_DEBOUNCE_MS,
  type TableSubscription,
} from './config'

/**
 * Компонент для синхронизации кеша с Supabase Realtime
 *
 * Подписывается на изменения в таблицах и инвалидирует соответствующие query keys.
 * Использует debounce для группировки множественных изменений.
 *
 * Особенности:
 * - createBrowserClient из @supabase/ssr уже является singleton
 * - Корректно обрабатывает React Strict Mode (двойной mount/unmount)
 * - Канал сохраняется сразу после создания для гарантированной очистки
 */
export function RealtimeSync() {
  const queryClient = useQueryClient()

  // Refs для управления состоянием
  const channelRef = useRef<RealtimeChannel | null>(null)
  const pendingInvalidationsRef = useRef<Set<string>>(new Set())
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /**
   * Выполняет накопленные инвалидации
   */
  const flushInvalidations = useCallback(() => {
    const keys = Array.from(pendingInvalidationsRef.current)
    if (keys.length === 0) return

    pendingInvalidationsRef.current.clear()

    const uniqueKeyArrays = keys.map((k) => JSON.parse(k) as unknown[])

    if (process.env.NODE_ENV === 'development') {
      console.log('[RealtimeSync] Invalidating keys:', uniqueKeyArrays)
    }

    uniqueKeyArrays.forEach((queryKey) => {
      queryClient.invalidateQueries({ queryKey })
    })
  }, [queryClient])

  /**
   * Добавляет ключи в очередь на инвалидацию с debounce
   */
  const scheduleInvalidation = useCallback(
    (keys: readonly unknown[][]) => {
      keys.forEach((key) => {
        pendingInvalidationsRef.current.add(JSON.stringify(key))
      })

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      debounceTimerRef.current = setTimeout(flushInvalidations, INVALIDATION_DEBOUNCE_MS)
    },
    [flushInvalidations]
  )

  /**
   * Обработчик изменений в таблице
   */
  const handleChange = useCallback(
    (
      subscription: TableSubscription,
      payload: RealtimePostgresChangesPayload<Record<string, unknown>>
    ) => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[RealtimeSync] ${payload.eventType} on ${subscription.table}`)
      }

      scheduleInvalidation(subscription.invalidateKeys)
    },
    [scheduleInvalidation]
  )

  useEffect(() => {
    // Предотвращаем повторную подписку (важно для Strict Mode)
    // Проверяем по ref, а не по состоянию подписки
    if (channelRef.current) {
      return
    }

    const supabase = createClient()
    let reconnectAttempts = 0
    let isActive = true
    const MAX_RECONNECT_ATTEMPTS = 5
    const RECONNECT_DELAY_MS = 3000

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
    }

    const removeCurrentChannel = (channel: RealtimeChannel) => {
      if (channelRef.current !== channel) return false
      channelRef.current = null
      void supabase.removeChannel(channel)
      return true
    }

    /**
     * Создаёт и настраивает канал с подписками
     */
    const createChannel = () => {
      let channel = supabase.channel(REALTIME_CHANNEL_NAME)

      // Подписываемся на каждую таблицу из конфига
      realtimeSubscriptions.forEach((subscription) => {
        const events = subscription.events ?? ['*']

        events.forEach((event) => {
          channel = channel.on(
            'postgres_changes',
            {
              event: event === '*' ? '*' : event,
              schema: 'public',
              table: subscription.table,
              filter: subscription.filter,
            },
            (payload) => handleChange(subscription, payload)
          )
        })
      })

      return channel
    }

    /**
     * Подписывается на канал с обработкой переподключения
     */
    const subscribeWithReconnect = async () => {
      clearReconnectTimer()
      const { data: { session } } = await supabase.auth.getSession()
      if (!isActive || !session) {
        if (process.env.NODE_ENV === 'development' && isActive) {
          console.log('[RealtimeSync] No session, skipping Realtime connection')
        }
        return
      }

      // Явно обновляем JWT на socket перед каждой новой подпиской. Это важно
      // после refresh токена: иначе Realtime может отклонить канал по старому JWT.
      supabase.realtime.setAuth(session.access_token)

      const channel = createChannel()
      channelRef.current = channel

      channel.subscribe((status, err) => {
        if (!isActive || channelRef.current !== channel) return

        if (process.env.NODE_ENV === 'development') {
          console.log('[RealtimeSync] Subscription status:', status, err || '')
        }

        if (status === 'SUBSCRIBED') {
          reconnectAttempts = 0 // Сбрасываем счётчик при успешном подключении
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[RealtimeSync] Channel error/timeout, attempting reconnect...', {
            status,
            error: err?.message,
            attempt: reconnectAttempts + 1,
            tableCount: realtimeSubscriptions.length,
          })

          Sentry.addBreadcrumb({
            message: `Realtime ${status}`,
            category: 'realtime',
            level: 'warning',
            data: { status, error: err?.message, attempt: reconnectAttempts + 1, maxAttempts: MAX_RECONNECT_ATTEMPTS },
          })

          removeCurrentChannel(channel)

          // Пробуем переподключиться
          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++
            reconnectTimerRef.current = setTimeout(
              subscribeWithReconnect,
              RECONNECT_DELAY_MS * reconnectAttempts,
            )
          } else {
            console.error('[RealtimeSync] Max reconnect attempts reached')
            Sentry.captureMessage('Realtime connection failed after max retries', {
              level: 'error',
              tags: { module: 'realtime', error_type: 'connection_failure', user_facing: 'true' },
              extra: { channel: REALTIME_CHANNEL_NAME, maxAttempts: MAX_RECONNECT_ATTEMPTS, lastStatus: status, lastError: err?.message },
            })
            toast.warning('Обновление данных в реальном времени временно недоступно. Перезагрузите страницу.', { duration: 10000 })
          }
        } else if (status === 'CLOSED') {
          // Канал закрыт - пробуем переподключиться
          if (removeCurrentChannel(channel)) {

            Sentry.addBreadcrumb({
              message: 'Realtime CLOSED',
              category: 'realtime',
              level: 'warning',
              data: { attempt: reconnectAttempts + 1, maxAttempts: MAX_RECONNECT_ATTEMPTS },
            })

            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
              reconnectAttempts++
              reconnectTimerRef.current = setTimeout(subscribeWithReconnect, RECONNECT_DELAY_MS)
            } else {
              Sentry.captureMessage('Realtime channel closed, max retries exhausted', {
                level: 'error',
                tags: { module: 'realtime', error_type: 'connection_failure', user_facing: 'true' },
                extra: { channel: REALTIME_CHANNEL_NAME, maxAttempts: MAX_RECONNECT_ATTEMPTS },
              })
              toast.warning('Обновление данных в реальном времени временно недоступно. Перезагрузите страницу.', { duration: 10000 })
            }
          }
        }
      })
    }

    // Запускаем подписку. Повторный запуск после обновления JWT не оставляет
    // старый таймер или канал в памяти.
    void subscribeWithReconnect()

    // Cleanup - всегда удаляем канал если он был создан
    return () => {
      isActive = false
      clearReconnectTimer()
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }

      if (channelRef.current) {
        const channel = channelRef.current
        channelRef.current = null
        void supabase.removeChannel(channel)
      }
    }
  }, [handleChange])

  return null
}
