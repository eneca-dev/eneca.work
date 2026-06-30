'use client'

import { createSimpleCacheQuery, queryKeys, staleTimePresets } from '@/modules/cache'
import { getMeetingReports } from '../actions/reports'

/** Список отчётов о созвонах (read-only). Свежесть — через инвалидацию/refetch. */
export const useMeetingReports = createSimpleCacheQuery({
  queryKey: queryKeys.meetings.reports(),
  queryFn: getMeetingReports,
  staleTime: staleTimePresets.fast,
})
