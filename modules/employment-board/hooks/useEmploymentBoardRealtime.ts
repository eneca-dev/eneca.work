'use client'

import type { MutableRefObject } from 'react'
import { useCallback, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { RealtimeChannel } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'
import type { FilterQueryParams } from '@/modules/inline-filter'
import { queryKeys } from '@/modules/cache/keys/query-keys'
import { removeInactiveEmploymentBoardSnapshots } from '@/modules/cache/realtime/dispatch-change'
import { createClient } from '@/utils/supabase/client'
import { getDepartmentEmploymentBoard } from '../actions'
import { assertBoardResponseDate } from './useEmploymentBoard'
import {
  subscribeEmploymentBoardLoadingChanges,
  type LoadingRealtimePayload,
} from '../lib/realtime-events'
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
  const channelRef = useRef<RealtimeChannel | null>(null)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRealtimeConfirmationRef = useRef(false)
  const isMountedRef = useRef(true)
  const inFlightRef = useRef(false)
  const trailingRefreshRef = useRef(false)
  const mutationGenerationRef = useRef(0)
  const runFreshRef = useRef<() => Promise<void>>(async () => undefined)
  const latestRef = useRef({ departmentId, filters, selectedDate, dateMode })
  latestRef.current = { departmentId, filters, selectedDate, dateMode }

  const removeInactiveSnapshots = useCallback(() => {
    removeInactiveEmploymentBoardSnapshots(queryClient)
  }, [queryClient])

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

    const request = latestRef.current
    if (!request.departmentId) return
    inFlightRef.current = true
    const mutationGeneration = mutationGenerationRef.current
    onRequireFresh()
    const epoch = ++requestEpochRef.current
    const queryKey = queryKeys.employmentBoard.list(
      request.filters?.department_id,
      request.selectedDate,
      request.dateMode,
    )
    await queryClient.cancelQueries({ queryKey, exact: true })

    try {
      const result = await getDepartmentEmploymentBoard({
        filters: request.filters,
        selectedDate: request.selectedDate,
        cachePolicy: 'fresh',
      })
      if (!result.success) throw new Error(result.error)
      assertBoardResponseDate(result.data, request.selectedDate, request.dateMode)

      const latest = latestRef.current
      if (
        isMountedRef.current &&
        epoch === requestEpochRef.current &&
        mutationGeneration === mutationGenerationRef.current &&
        pendingMutationsRef.current === 0 &&
        latest.selectedDate === request.selectedDate &&
        latest.dateMode === request.dateMode
      ) queryClient.setQueryData<EmploymentBoard>(queryKey, result.data)
      else if (isMountedRef.current) trailingRefreshRef.current = true
    } catch (error) {
      if (error instanceof Error && error.name === 'BoardDateBoundaryError') {
        onDateBoundary()
      } else {
        Sentry.captureException(error, {
          tags: { module: 'employment-board', action: 'realtimeFreshRefresh' },
        })
      }
    } finally {
      inFlightRef.current = false
      if (trailingRefreshRef.current && isMountedRef.current && pendingMutationsRef.current === 0) {
        trailingRefreshRef.current = false
        pendingRealtimeConfirmationRef.current = false
        void runFreshRef.current()
      }
    }
  }, [onDateBoundary, onRequireFresh, pendingMutationsRef, queryClient, requestEpochRef])
  runFreshRef.current = runFresh

  const scheduleFreshRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null
      void runFresh()
    }, REFRESH_DEBOUNCE_MS)
  }, [runFresh])

  const confirmRealtimeAndRefresh = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current)
      fallbackTimerRef.current = null
      pendingRealtimeConfirmationRef.current = false
    } else {
      pendingRealtimeConfirmationRef.current = true
    }
    scheduleFreshRefresh()
  }, [scheduleFreshRefresh])

  const scheduleFallbackRefresh = useCallback(() => {
    if (pendingRealtimeConfirmationRef.current) {
      pendingRealtimeConfirmationRef.current = false
      return
    }
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current)
    fallbackTimerRef.current = setTimeout(() => {
      fallbackTimerRef.current = null
      scheduleFreshRefresh()
    }, REALTIME_FALLBACK_MS)
  }, [scheduleFreshRefresh])

  const beginMutation = useCallback(() => {
    pendingMutationsRef.current += 1
    mutationGenerationRef.current += 1
    requestEpochRef.current += 1
  }, [pendingMutationsRef, requestEpochRef])

  const finishMutation = useCallback(() => {
    pendingMutationsRef.current = Math.max(0, pendingMutationsRef.current - 1)
    if (pendingMutationsRef.current > 0) return
    if (trailingRefreshRef.current) {
      if (!inFlightRef.current) {
        trailingRefreshRef.current = false
        pendingRealtimeConfirmationRef.current = false
        void runFreshRef.current()
      }
      return
    }
    scheduleFallbackRefresh()
  }, [pendingMutationsRef, scheduleFallbackRefresh])

  useEffect(() => subscribeEmploymentBoardLoadingChanges((payload) => {
    removeInactiveSnapshots()
    if (!isLoadingInsertRelevant(payload, latestRef.current.selectedDate)) {
      onMarkDateChangeStale()
      return
    }
    scheduleFreshRefresh()
  }), [onMarkDateChangeStale, removeInactiveSnapshots, scheduleFreshRefresh])

  useEffect(() => {
    if (!departmentId) return
    const supabase = createClient()
    let isActive = true
    const channel = supabase.channel(`employment-board:${departmentId}`)
    channelRef.current = channel

    BOARD_TABLES.forEach((table) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `department_id=eq.${departmentId}` },
        () => { if (isActive) confirmRealtimeAndRefresh() },
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

  return { scheduleFallbackRefresh, beginMutation, finishMutation }
}
