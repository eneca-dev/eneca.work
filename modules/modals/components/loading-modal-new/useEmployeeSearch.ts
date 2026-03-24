import { useMemo } from 'react'
import type { CachedUser } from '@/modules/cache'

/** Shared filter logic for employee selectors — filters by name or email. */
export function useEmployeeSearch(users: CachedUser[], search: string): CachedUser[] {
  return useMemo(() => {
    if (!search.trim()) return users

    const query = search.toLowerCase()
    return users.filter(
      (user) =>
        user.full_name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query)
    )
  }, [users, search])
}
