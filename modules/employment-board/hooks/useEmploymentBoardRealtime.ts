'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { RealtimeChannel } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'
import { queryKeys } from '@/modules/cache'
import { createClient } from '@/utils/supabase/client'

const BOARD_TABLES = ['department_pinned_projects', 'department_board_placements'] as const
const REFETCH_DEBOUNCE_MS = 150
const REALTIME_FALLBACK_MS = 2_000

/**
 * Отдельный короткий канал только для ручных изменений текущей доски.
 * Глобальный RealtimeSync не подписывается на эти две таблицы: одна ошибка в
 * большой общей подписке больше не задерживает подтверждение drag-and-drop.
 */
export function useEmploymentBoardRealtime(departmentId?: string) {
  const queryClient = useQueryClient()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refreshActiveBoard = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.employmentBoard.all,
      refetchType: 'active',
    })
  }, [queryClient])

  /**
   * Вызывается только после успешного INSERT/DELETE. Обычно этот таймер отменит
   * Realtime; он нужен на случай временного разрыва websocket-соединения.
   */
  const scheduleFallbackRefresh = useCallback(() => {
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current)
    fallbackTimerRef.current = setTimeout(() => {
      fallbackTimerRef.current = null
      refreshActiveBoard()
    }, REALTIME_FALLBACK_MS)
  }, [refreshActiveBoard])

  useEffect(() => {
    if (!departmentId) return

    const supabase = createClient()
    let isActive = true
    const channel = supabase.channel(`employment-board:${departmentId}`)
    channelRef.current = channel

    const refresh = () => {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current)
        fallbackTimerRef.current = null
      }
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current)
      refetchTimerRef.current = setTimeout(() => {
        if (!isActive) return
        refreshActiveBoard()
      }, REFETCH_DEBOUNCE_MS)
    }

    BOARD_TABLES.forEach((table) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `department_id=eq.${departmentId}` },
        refresh,
      )
    })

    channel.subscribe((status, error) => {
      if (!isActive || channelRef.current !== channel || status === 'SUBSCRIBED') return

      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[EmploymentBoardRealtime] Subscription issue', {
          status,
          departmentId,
          error: error?.message,
        })
        Sentry.addBreadcrumb({
          category: 'employment-board.realtime',
          message: `Employment board subscription ${status}`,
          level: 'warning',
          data: { departmentId, error: error?.message },
        })
      }
    })

    return () => {
      isActive = false
      if (refetchTimerRef.current) {
        clearTimeout(refetchTimerRef.current)
        refetchTimerRef.current = null
      }
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current)
        fallbackTimerRef.current = null
      }
      if (channelRef.current === channel) channelRef.current = null
      void supabase.removeChannel(channel)
    }
  }, [departmentId, refreshActiveBoard])

  return { scheduleFallbackRefresh }
}
