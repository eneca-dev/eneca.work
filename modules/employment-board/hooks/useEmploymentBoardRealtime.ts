'use client'

import type { MutableRefObject } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { RealtimeChannel } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'
import type { FilterQueryParams } from '@/modules/inline-filter'
import { queryKeys } from '@/modules/cache/keys/query-keys'
import {
  removeInactiveEmploymentBoardSnapshots,
  subscribeEmploymentBoardLoadingChanges,
  type LoadingRealtimePayload,
} from '@/modules/cache/realtime'
import { createClient } from '@/utils/supabase/client'
import { getDepartmentEmploymentBoard } from '../actions'
import { assertBoardResponseDate } from './useEmploymentBoard'
import type { EmploymentBoard, EmploymentBoardDateMode } from '../types'

const BOARD_TABLES = ['department_pinned_projects', 'department_board_placements'] as const
const REFRESH_DEBOUNCE_MS = 150
const REALTIME_FALLBACK_MS = 2_000

interface EmploymentBoardRealtimeOptions {
  departmentId?: string
  filters?: FilterQueryParams
  selectedDate: string
  dateMode: EmploymentBoardDateMode
  requestEpochRef: MutableRefObject<number>
  onRequireFresh: () => void
  onMarkDateChangeStale: () => void
  onDateBoundary: () => void
  pendingMutationsRef: MutableRefObject<number>
}

export function isLoadingInsertRelevant(
  payload: LoadingRealtimePayload,
  selectedDate: string,
): boolean {
  if (payload.eventType !== 'INSERT') return true
  const row = payload.new
  const { loading_status: status, is_shortage: isShortage } = row
  const { loading_start: start, loading_finish: finish } = row

  if (
    typeof status !== 'string' ||
    typeof isShortage !== 'boolean' ||
    typeof start !== 'string' ||
    typeof finish !== 'string'
  ) return true

  return status === 'active' && !isShortage && start <= selectedDate && finish >= selectedDate
}

export function useEmploymentBoardRealtime({
  departmentId,
  filters,
  selectedDate,
  dateMode,
  requestEpochRef,
  onRequireFresh,
  onMarkDateChangeStale,
  onDateBoundary,
  pendingMutationsRef,
}: EmploymentBoardRealtimeOptions) {
  const queryClient = useQueryClient()
  const [refreshError, setRefreshError] = useState<Error | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMountedRef = useRef(true)
  const inFlightRef = useRef(false)
  const trailingRefreshRef = useRef(false)
  const mutationGenerationRef = useRef(0)
  const confirmedMutationGenerationRef = useRef<number | null>(null)
  const renderedQueryKeyHashRef = useRef<string | null>(null)
  const runFreshRef = useRef<() => Promise<void>>(async () => undefined)
  const queryKey = queryKeys.employmentBoard.list(
    filters?.department_id,
    selectedDate,
    dateMode,
  )
  const queryKeyHash = JSON.stringify(queryKey)
  const latestRef = useRef({
    departmentId,
    filters,
    selectedDate,
    dateMode,
    queryKey,
    queryKeyHash,
  })
  latestRef.current = {
    departmentId,
    filters,
    selectedDate,
    dateMode,
    queryKey,
    queryKeyHash,
  }

  useEffect(() => {
    if (
      renderedQueryKeyHashRef.current !== null &&
      renderedQueryKeyHashRef.current !== queryKeyHash &&
      refreshTimerRef.current
    ) {
      clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
    renderedQueryKeyHashRef.current = queryKeyHash
    setRefreshError(null)
  }, [queryKeyHash])

  const reportRefreshError = useCallback((error: unknown, requestKeyHash: string, epoch: number) => {
    const refreshFailure = error instanceof Error
      ? error
      : new Error('Не удалось обновить доску')

    Sentry.captureException(refreshFailure, {
      tags: { module: 'employment-board', action: 'realtimeFreshRefresh' },
    })
    if (
      isMountedRef.current &&
      latestRef.current.queryKeyHash === requestKeyHash &&
      requestEpochRef.current === epoch
    ) setRefreshError(refreshFailure)
  }, [requestEpochRef])

  const runFresh = useCallback(async () => {
    if (!isMountedRef.current) return
    if (pendingMutationsRef.current > 0) {
      trailingRefreshRef.current = true
      return
    }
    if (inFlightRef.current) {
      trailingRefreshRef.current = true
      return
    }

    // Любой реально начавшийся fresh-запрос заменяет ожидающий fallback.
    // Иначе глобальное событие во время мутации может запустить второй запрос
    // через две секунды после уже выполненного подтверждающего чтения.
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current)
      fallbackTimerRef.current = null
    }

    const request = latestRef.current
    inFlightRef.current = true
    const mutationGeneration = mutationGenerationRef.current
    setRefreshError(null)
    const epoch = ++requestEpochRef.current
    let terminalFailure = false

    try {
      await queryClient.cancelQueries({ queryKey: request.queryKey, exact: true })

      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const result = await getDepartmentEmploymentBoard({
            filters: request.filters,
            selectedDate: request.selectedDate,
            cachePolicy: 'fresh',
          })
          if (!result.success) throw new Error(result.error)
          assertBoardResponseDate(result.data, request.selectedDate, request.dateMode)

          if (
            isMountedRef.current &&
            epoch === requestEpochRef.current &&
            mutationGeneration === mutationGenerationRef.current &&
            pendingMutationsRef.current === 0 &&
            latestRef.current.queryKeyHash === request.queryKeyHash
          ) {
            queryClient.setQueryData<EmploymentBoard>(request.queryKey, result.data)
            setRefreshError(null)
          }
          return
        } catch (error) {
          if (error instanceof Error && error.name === 'BoardDateBoundaryError') {
            const requestIsCurrent =
              isMountedRef.current &&
              epoch === requestEpochRef.current &&
              mutationGeneration === mutationGenerationRef.current &&
              latestRef.current.queryKeyHash === request.queryKeyHash
            // Новый ключ загрузится обычным query после обновления даты. Для
            // актуального boundary-ответа повтор старого ключа не нужен. Если
            // запрос уже устарел, сохраняем trailing refresh нового ключа.
            if (requestIsCurrent) {
              trailingRefreshRef.current = false
              onDateBoundary()
            }
            return
          }

          const requestIsCurrent =
            isMountedRef.current &&
            epoch === requestEpochRef.current &&
            mutationGeneration === mutationGenerationRef.current &&
            latestRef.current.queryKeyHash === request.queryKeyHash
          if (!requestIsCurrent) return
          if (attempt === 1) {
            terminalFailure = true
            reportRefreshError(error, request.queryKeyHash, epoch)
          }
        }
      }
    } catch (error) {
      terminalFailure = true
      reportRefreshError(error, request.queryKeyHash, epoch)
    } finally {
      inFlightRef.current = false
      if (terminalFailure) {
        trailingRefreshRef.current = false
      } else if (
        trailingRefreshRef.current &&
        isMountedRef.current &&
        pendingMutationsRef.current === 0
      ) {
        trailingRefreshRef.current = false
        void runFreshRef.current()
      }
    }
  }, [
    onDateBoundary,
    pendingMutationsRef,
    queryClient,
    reportRefreshError,
    requestEpochRef,
  ])
  runFreshRef.current = runFresh

  const scheduleFreshRefresh = useCallback(() => {
    // Latch включается в момент события, до debounce: смена даты в этом окне
    // тоже обязана обойти ранее записанный Redis-снимок.
    onRequireFresh()
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null
      void runFreshRef.current()
    }, REFRESH_DEBOUNCE_MS)
  }, [onRequireFresh])

  const retryRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
    onRequireFresh()
    void runFreshRef.current()
  }, [onRequireFresh])

  const confirmRealtimeAndRefresh = useCallback(() => {
    removeInactiveEmploymentBoardSnapshots(queryClient)
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current)
      fallbackTimerRef.current = null
    }
    if (pendingMutationsRef.current > 0) {
      confirmedMutationGenerationRef.current = mutationGenerationRef.current
    }
    scheduleFreshRefresh()
  }, [pendingMutationsRef, queryClient, scheduleFreshRefresh])

  const scheduleFallbackRefresh = useCallback(() => {
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current)
    fallbackTimerRef.current = setTimeout(() => {
      fallbackTimerRef.current = null
      scheduleFreshRefresh()
    }, REALTIME_FALLBACK_MS)
  }, [scheduleFreshRefresh])

  const beginMutation = useCallback(() => {
    pendingMutationsRef.current += 1
    mutationGenerationRef.current += 1
    confirmedMutationGenerationRef.current = null
    requestEpochRef.current += 1
  }, [pendingMutationsRef, requestEpochRef])

  const finishMutation = useCallback(() => {
    pendingMutationsRef.current = Math.max(0, pendingMutationsRef.current - 1)
    if (pendingMutationsRef.current > 0) return
    if (trailingRefreshRef.current) {
      if (!inFlightRef.current) {
        trailingRefreshRef.current = false
        confirmedMutationGenerationRef.current = null
        void runFreshRef.current()
      }
      return
    }
    if (confirmedMutationGenerationRef.current === mutationGenerationRef.current) {
      confirmedMutationGenerationRef.current = null
      return
    }
    scheduleFallbackRefresh()
  }, [pendingMutationsRef, scheduleFallbackRefresh])

  useEffect(() => subscribeEmploymentBoardLoadingChanges((payload) => {
    if (!isLoadingInsertRelevant(payload, latestRef.current.selectedDate)) {
      onMarkDateChangeStale()
      return
    }
    scheduleFreshRefresh()
  }), [onMarkDateChangeStale, scheduleFreshRefresh])

  useEffect(() => {
    if (!departmentId) return
    const supabase = createClient()
    let isActive = true
    const channel = supabase.channel(`employment-board:${departmentId}`)
    channelRef.current = channel

    const handleLocalChange = () => { if (isActive) confirmRealtimeAndRefresh() }
    BOARD_TABLES.forEach((table) => {
      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table, filter: `department_id=eq.${departmentId}` },
        handleLocalChange,
      )
      channel.on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table, filter: `department_id=eq.${departmentId}` },
        handleLocalChange,
      )
      // Postgres Changes не применяет фильтры к DELETE без полного old row.
      // Обновляем открытые доски консервативно, пока таблицы не используют
      // REPLICA IDENTITY FULL или серверный Broadcast.
      channel.on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table },
        handleLocalChange,
      )
    })

    channel.subscribe((status, error) => {
      if (!isActive || channelRef.current !== channel || status === 'SUBSCRIBED') return
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
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
      if (channelRef.current === channel) channelRef.current = null
      void supabase.removeChannel(channel)
    }
  }, [confirmRealtimeAndRefresh, departmentId])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current)
    }
  }, [])

  return {
    scheduleFallbackRefresh,
    beginMutation,
    finishMutation,
    refreshError,
    retryRefresh,
  }
}
