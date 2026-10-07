import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

export type LoadingRealtimePayload = RealtimePostgresChangesPayload<Record<string, unknown>>
type LoadingListener = (payload: LoadingRealtimePayload) => void

const listeners = new Set<LoadingListener>()

export function emitEmploymentBoardLoadingChange(payload: LoadingRealtimePayload): void {
  listeners.forEach((listener) => listener(payload))
}

export function subscribeEmploymentBoardLoadingChanges(listener: LoadingListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
