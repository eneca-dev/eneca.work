'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'
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
    const MAX_RECONNECT_ATTEMPTS = 5
    const RECONNECT_DELAY_MS = 3000
    let isAuthChecked = false

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
      // Проверяем авторизацию перед подключением
      if (!isAuthChecked) {
        const { data: { session } } = await supabase.auth.getSession()
        isAuthChecked = true

        if (!session) {
          if (process.env.NODE_ENV === 'development') {
            console.log('[RealtimeSync] No session, skipping Realtime connection')
          }
          return
        }
      }

      const channel = createChannel()
      channelRef.current = channel

      channel.subscribe((status, err) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('[RealtimeSync] Subscription status:', status, err || '')
        }

        if (status === 'SUBSCRIBED') {
          reconnectAttempts = 0 // Сбрасываем счётчик при успешном подключении
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[RealtimeSync] Channel error/timeout, attempting reconnect...')

          // Удаляем старый канал
          if (channelRef.current) {
            supabase.removeChannel(channelRef.current)
            channelRef.current = null
          }

          // Пробуем переподключиться
          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++
            console.log(`[RealtimeSync] Reconnect attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`)
            setTimeout(subscribeWithReconnect, RECONNECT_DELAY_MS * reconnectAttempts)
          } else {
            console.error('[RealtimeSync] Max reconnect attempts reached')
          }
        } else if (status === 'CLOSED') {
          // Канал закрыт - пробуем переподключиться
          if (channelRef.current) {
            channelRef.current = null
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
              reconnectAttempts++
              console.log(`[RealtimeSync] Channel closed, reconnect attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`)
              setTimeout(subscribeWithReconnect, RECONNECT_DELAY_MS)
            }
          }
        }
      })
    }

    // Запускаем подписку
    subscribeWithReconnect()

    // Cleanup - всегда удаляем канал если он был создан
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [handleChange])

  return null
}
