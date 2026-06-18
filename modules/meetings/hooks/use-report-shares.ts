'use client'

import {
  createDetailCacheQuery,
  createCacheMutation,
  queryKeys,
  staleTimePresets,
} from '@/modules/cache'
import { getReportShares, shareReport, unshareReport } from '../actions/reports'

/** user_id пользователей, которым расшарен созвон. */
export const useReportShares = createDetailCacheQuery({
  queryKey: (reportId: string) => queryKeys.meetings.shares(reportId),
  queryFn: (reportId: string) => getReportShares(reportId),
  staleTime: staleTimePresets.fast,
})

export const useShareReport = createCacheMutation({
  mutationFn: shareReport,
  invalidateKeys: [queryKeys.meetings.all],
})

export const useUnshareReport = createCacheMutation({
  mutationFn: unshareReport,
  invalidateKeys: [queryKeys.meetings.all],
})
