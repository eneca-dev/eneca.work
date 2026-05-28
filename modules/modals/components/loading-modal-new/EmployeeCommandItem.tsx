'use client'

/**
 * Shared list item for employee selectors (single & multi).
 * Used by both EmployeeSelector and MultiEmployeeSelector.
 */

import { ArrowLeftRight } from 'lucide-react'
import { CommandItem } from '@/components/ui/command'
import { cn } from '@/lib/utils'
import type { CachedUser } from '@/modules/cache'
import { Avatar } from '@/modules/projects/components/Avatar'

export interface EmployeeCommandItemProps {
  user: CachedUser
  onSelect: (userId: string) => void
  /** Render slot for the leading indicator (checkmark, checkbox, etc.) */
  indicator: React.ReactNode
  /**
   * "Гостевой" сотрудник: принадлежит другому отделу, виден через
   * cross-department grant. Если задано — отрисовываем бейдж с названием
   * родного отдела рядом с именем.
   */
  guestBadgeLabel?: string | null
}

export function EmployeeCommandItem({
  user,
  onSelect,
  indicator,
  guestBadgeLabel,
}: EmployeeCommandItemProps) {
  return (
    <CommandItem
      key={user.user_id}
      value={user.user_id}
      onSelect={onSelect}
      className={cn(
        'px-2 py-2 cursor-pointer',
        guestBadgeLabel &&
          'bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/40'
      )}
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
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-medium truncate">
              {user.full_name || 'Без имени'}
            </span>
            {guestBadgeLabel && (
              <span
                className="inline-flex items-center gap-0.5 shrink-0 rounded border border-amber-200 bg-amber-100 dark:bg-amber-900/40 dark:border-amber-800 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-200"
                title={`Сотрудник отдела «${guestBadgeLabel}». Доступ открыт через cross-department grant.`}
              >
                <ArrowLeftRight className="h-2.5 w-2.5" />
                {guestBadgeLabel}
              </span>
            )}
          </div>
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
