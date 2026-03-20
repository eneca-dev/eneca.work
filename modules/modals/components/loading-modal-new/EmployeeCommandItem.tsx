'use client'

/**
 * Shared list item for employee selectors (single & multi).
 * Used by both EmployeeSelector and MultiEmployeeSelector.
 */

import { Check } from 'lucide-react'
import { CommandItem } from '@/components/ui/command'
import { cn } from '@/lib/utils'
import type { CachedUser } from '@/modules/cache'
import { Avatar } from '@/modules/projects/components/Avatar'

export interface EmployeeCommandItemProps {
  user: CachedUser
  onSelect: (userId: string) => void
  /** Render slot for the leading indicator (checkmark, checkbox, etc.) */
  indicator: React.ReactNode
}

export function EmployeeCommandItem({ user, onSelect, indicator }: EmployeeCommandItemProps) {
  return (
    <CommandItem
      key={user.user_id}
      value={user.user_id}
      onSelect={onSelect}
      className="px-2 py-2 cursor-pointer"
    >
      <div className="flex items-center gap-2 w-full min-w-0">
        {indicator}
        <Avatar
          name={user.full_name}
          avatarUrl={user.avatar_url}
          size="sm"
          className="shrink-0"
        />
        <div className="flex flex-col min-w-0 flex-1">
          <span className="font-medium truncate">
            {user.full_name || 'Без имени'}
          </span>
          {user.email && (
            <span className="text-xs text-muted-foreground truncate">
              {user.email}
            </span>
          )}
        </div>
      </div>
    </CommandItem>
  )
}
