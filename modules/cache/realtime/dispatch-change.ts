import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from '../keys/query-keys'
import type { TableSubscription } from './config'
import { emitEmploymentBoardLoadingChange } from './employment-board-events'

export function removeInactiveEmploymentBoardSnapshots(queryClient: QueryClient): void {
  queryClient.removeQueries({ queryKey: queryKeys.employmentBoard.lists(), type: 'inactive' })
}

export function dispatchRealtimeChange(
  subscription: TableSubscription,
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
  scheduleInvalidation: (keys: readonly (readonly unknown[])[]) => void,
  removeInactiveBoardSnapshots: () => void,
): void {
  if (subscription.table !== 'loadings') {
    scheduleInvalidation(subscription.invalidateKeys)
    return
  }

  emitEmploymentBoardLoadingChange(payload)
  removeInactiveBoardSnapshots()
  scheduleInvalidation(
    subscription.invalidateKeys.filter(
      (key) => JSON.stringify(key) !== JSON.stringify(queryKeys.employmentBoard.all),
    ),
  )
}
