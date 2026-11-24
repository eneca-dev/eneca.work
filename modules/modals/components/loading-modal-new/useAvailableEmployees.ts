'use client'

import { useQuery } from '@tanstack/react-query'
import { getUsers, queryKeys } from '@/modules/cache'

/** A dated candidate cache; the global user list remains available for historical labels. */
export function useAvailableEmployees(startDate: string, endDate: string) {
  return useQuery({
    queryKey: [...queryKeys.users.lists(), 'employment', startDate, endDate],
    queryFn: async () => {
      const result = await getUsers({ startDate, endDate })
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    staleTime: 0,
    refetchInterval: 60_000,
    placeholderData: undefined,
  })
}
