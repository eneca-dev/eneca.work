'use client'

/**
 * InlineResponsibleSelect - Компактный инлайн-селект ответственного
 *
 * Используется в SectionRow для быстрого назначения ответственного
 * по клику на аватар, без открытия модалки.
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import { getInitials } from '../../../utils'
import { useUsers, type CachedUser } from '@/modules/cache'
import { useUpdateSection } from '@/modules/modals/hooks/useUpdateSection'

// ============================================================================
// Types
// ============================================================================

interface InlineResponsibleSelectProps {
  sectionId: string
  currentResponsible: {
    id: string | null
    firstName: string | null
    lastName: string | null
    name: string | null
    avatarUrl: string | null
  }
  onSuccess?: () => void
}

// ============================================================================
// Component
// ============================================================================

export function InlineResponsibleSelect({
  sectionId,
  currentResponsible,
  onSuccess,
}: InlineResponsibleSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Load users
  const { data: users = [], isLoading: usersLoading } = useUsers()
  const updateMutation = useUpdateSection()

  // Filter users by search
  const filteredUsers = useMemo(() => {
    if (!search) return users
    const searchLower = search.toLowerCase()
    return users.filter(
      (u) =>
        u.full_name.toLowerCase().includes(searchLower) ||
        u.email.toLowerCase().includes(searchLower)
    )
  }, [users, search])

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setSearch('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        setSearch('')
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen])

  const handleSelect = useCallback(
    async (userId: string | null) => {
      setIsOpen(false)
      setSearch('')

      // Don't save if same value
      if (userId === currentResponsible.id) return

      try {
        await updateMutation.mutateAsync({
          sectionId,
          data: { responsibleId: userId },
        })
        onSuccess?.()
      } catch (error) {
        console.error('[InlineResponsibleSelect] Error:', error)
      }
    },
    [sectionId, currentResponsible.id, updateMutation, onSuccess]
  )

  const handleAvatarClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsOpen(!isOpen)
  }

  const isSaving = updateMutation.isPending

  return (
    <div ref={containerRef} className="relative">
      {/* Avatar trigger */}
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleAvatarClick}
              disabled={isSaving}
              className={cn(
                'shrink-0 focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-full',
                'transition-transform hover:scale-110',
                isSaving && 'opacity-50 cursor-wait'
              )}
            >
              {isSaving ? (
                <div className="w-5 h-5 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Avatar className="w-5 h-5">
                  {currentResponsible.avatarUrl ? (
                    <AvatarImage
                      src={currentResponsible.avatarUrl}
                      alt={currentResponsible.name || 'Ответственный'}
                    />
                  ) : null}
                  <AvatarFallback className="text-[9px] bg-muted">
                    {getInitials(
                      currentResponsible.firstName,
                      currentResponsible.lastName
                    )}
                  </AvatarFallback>
                </Avatar>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <div className="space-y-0.5">
              <div>{currentResponsible.name || 'Ответственный не указан'}</div>
              <div className="text-muted-foreground">Нажмите для изменения</div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={cn(
            'absolute top-full left-0 mt-1 z-50',
            'w-56 bg-popover border border-border rounded-lg shadow-lg',
            'overflow-hidden'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search input */}
          <div className="p-2 border-b border-border/50">
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск..."
              className={cn(
                'w-full px-2.5 py-1.5 text-xs',
                'bg-background border border-border/50',
                'rounded-md placeholder:text-muted-foreground',
                'focus:outline-none focus:border-primary/50'
              )}
            />
          </div>

          {/* Options */}
          <div className="max-h-48 overflow-y-auto py-1">
            {usersLoading ? (
              <div className="px-3 py-4 text-center">
                <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Not assigned option */}
                <button
                  type="button"
                  onClick={() => handleSelect(null)}
                  className={cn(
                    'w-full px-3 py-2 text-left text-xs',
                    'hover:bg-muted flex items-center gap-2 transition-colors',
                    !currentResponsible.id && 'bg-primary/10'
                  )}
                >
                  <Avatar className="w-5 h-5">
                    <AvatarFallback className="text-[9px] bg-muted">?</AvatarFallback>
                  </Avatar>
                  <span className="text-muted-foreground">Не назначен</span>
                </button>

                {/* User options */}
                {filteredUsers.map((user) => (
                  <button
                    key={user.user_id}
                    type="button"
                    onClick={() => handleSelect(user.user_id)}
                    className={cn(
                      'w-full px-3 py-2 text-left text-xs',
                      'hover:bg-muted flex items-center gap-2 transition-colors',
                      currentResponsible.id === user.user_id && 'bg-primary/10'
                    )}
                  >
                    <Avatar className="w-5 h-5">
                      {user.avatar_url && <AvatarImage src={user.avatar_url} />}
                      <AvatarFallback className="text-[9px] bg-muted">
                        {getInitials(user.first_name, user.last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{user.full_name}</div>
                      <div className="text-muted-foreground text-[10px] truncate">
                        {user.email}
                      </div>
                    </div>
                  </button>
                ))}

                {filteredUsers.length === 0 && !usersLoading && (
                  <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                    Ничего не найдено
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
