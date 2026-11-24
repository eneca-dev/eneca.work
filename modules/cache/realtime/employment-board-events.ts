import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { QueryClient } from '@tanstack/react-query'
import * as Sentry from '@sentry/nextjs'
import { queryKeys } from '../keys/query-keys'

export type LoadingRealtimePayload = RealtimePostgresChangesPayload<Record<string, unknown>>
type LoadingListener = (payload: LoadingRealtimePayload) => void

const listeners = new Set<LoadingListener>()

// A personnel edit may happen while the board is unmounted. Keep the freshness
// requirement for this QueryClient, without retaining clients or using a TTL that
// could expire before a late cache-aside write reaches Redis.
const personnelRevisions = new WeakMap<QueryClient, number>()
const personnelListeners = new WeakMap<QueryClient, Set<() => void>>()

export function getEmploymentBoardPersonnelRevision(queryClient: QueryClient): number {
  return personnelRevisions.get(queryClient) ?? 0
}

export function notifyEmploymentBoardPersonnelChanged(queryClient: QueryClient): void {
  personnelRevisions.set(queryClient, getEmploymentBoardPersonnelRevision(queryClient) + 1)
  void queryClient.cancelQueries({ queryKey: queryKeys.employmentBoard.lists() })
  queryClient.removeQueries({ queryKey: queryKeys.employmentBoard.lists(), type: 'inactive' })
  personnelListeners.get(queryClient)?.forEach((listener) => {
    try { listener() } catch (error) {
      Sentry.captureException(error, { tags: { module: 'cache', action: 'personnelChangeListener' } })
    }
  })
}

export function subscribeEmploymentBoardPersonnelChanges(
  queryClient: QueryClient,
  listener: () => void,
): () => void {
  const clientListeners = personnelListeners.get(queryClient) ?? new Set<() => void>()
  personnelListeners.set(queryClient, clientListeners)
  clientListeners.add(listener)
  return () => { clientListeners.delete(listener) }
}

export function emitEmploymentBoardLoadingChange(payload: LoadingRealtimePayload): void {
  listeners.forEach((listener) => listener(payload))
}

export function subscribeEmploymentBoardLoadingChanges(listener: LoadingListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
