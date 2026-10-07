/**
 * Realtime Module
 *
 * Синхронизация кеша TanStack Query с Supabase Realtime
 */

export { RealtimeSync } from './realtime-sync'
export {
  realtimeSubscriptions,
  REALTIME_CHANNEL_NAME,
  INVALIDATION_DEBOUNCE_MS,
  type TableSubscription,
  type RealtimeEvent,
} from './config'
export {
  emitEmploymentBoardLoadingChange,
  subscribeEmploymentBoardLoadingChanges,
  type LoadingRealtimePayload,
} from './employment-board-events'
export { removeInactiveEmploymentBoardSnapshots } from './dispatch-change'
