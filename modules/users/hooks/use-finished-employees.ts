'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/modules/cache/keys/query-keys'
import { formatMinskDate } from '@/lib/timezone-utils'
import { getFinishedEmployees } from '../actions/employment-roster'

/** Current roster is independent of the day/range being viewed in the timeline. */
export function useFinishedEmployees(enabled = true) {
  const [today, setToday] = useState(() => formatMinskDate(new Date()))
  useEffect(() => {
    const syncDay = () => setToday(formatMinskDate(new Date()))
    const interval = window.setInterval(syncDay, 60_000)
    window.addEventListener('focus', syncDay)
    document.addEventListener('visibilitychange', syncDay)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', syncDay)
      document.removeEventListener('visibilitychange', syncDay)
    }
  }, [])
  return useQuery({
    queryKey: queryKeys.users.finishedEmployees(today),
    queryFn: async () => {
      const result = await getFinishedEmployees()
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    enabled,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: 'always',
    retry: 1,
  })
}
