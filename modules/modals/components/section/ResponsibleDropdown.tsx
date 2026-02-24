'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { User, ChevronDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getInitials } from '@/modules/resource-graph/utils'
import type { CachedUser } from '@/modules/cache'

// ============================================================================
// Types
// ============================================================================

interface ResponsibleDropdownProps {
  /** Currently selected user */
  value: CachedUser | null
  /** Available users */
  users: CachedUser[]
  /** Callback when responsible changes */
  onChange: (userId: string | null) => void
  /** Loading state during save */
  isLoading?: boolean
  /** Disabled state */
  disabled?: boolean
  /** ID for accessibility */
  id?: string
}

// ============================================================================
// Component
// ============================================================================

export function ResponsibleDropdown({
  value,
  users,
  onChange,
  isLoading = false,
  disabled = false,
  id,
}: ResponsibleDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

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

  const handleSelect = (userId: string | null) => {
    onChange(userId)
    setIsOpen(false)
    setSearch('')
  }

  const displayName = value?.full_name || 'Не назначен'

  return (
    <div ref={containerRef} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled || isLoading}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Ответственный: ${displayName}`}
        className={cn(
          'flex items-center gap-2 text-sm',
          'text-muted-foreground hover:text-foreground',
          'transition-colors',
          (disabled || isLoading) && 'opacity-60 cursor-not-allowed'
        )}
      >
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <User className="w-3.5 h-3.5" />
        )}
        <span>{displayName}</span>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Выберите ответственного"
          className="absolute top-full left-0 mt-2 z-20 w-64 bg-popover backdrop-blur-sm border border-border rounded-xl shadow-2xl overflow-hidden"
        >
          {/* Search input */}
          <div className="p-2 border-b border-border">
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск..."
              aria-label="Поиск пользователей"
              className={cn(
                'w-full px-3 py-2 text-sm',
                'bg-background border border-input',
                'rounded-lg text-popover-foreground placeholder:text-muted-foreground',
                'focus:outline-none focus:border-primary/50'
              )}
            />
          </div>

          {/* Options */}
          <div className="max-h-56 overflow-y-auto py-1">
            {/* Not assigned option */}
            <button
              type="button"
              role="option"
              aria-selected={!value}
              onClick={() => handleSelect(null)}
              className={cn(
                'w-full px-3 py-2.5 text-left text-sm text-muted-foreground',
                'hover:bg-accent flex items-center gap-2.5 transition-colors',
                !value && 'bg-primary/10'
              )}
            >
              <User className="w-4 h-4" />
              Не назначен
            </button>

            {/* User options */}
            {filteredUsers.map((user) => (
              <button
                key={user.user_id}
                type="button"
                role="option"
                aria-selected={value?.user_id === user.user_id}
                onClick={() => handleSelect(user.user_id)}
                className={cn(
                  'w-full px-3 py-2.5 text-left text-sm',
                  'hover:bg-accent flex items-center gap-2.5 transition-colors',
                  value?.user_id === user.user_id && 'bg-primary/10'
                )}
              >
                <Avatar className="h-6 w-6">
                  {user.avatar_url && <AvatarImage src={user.avatar_url} />}
                  <AvatarFallback className="text-[10px] bg-muted">
                    {getInitials(user.first_name, user.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="text-popover-foreground truncate">{user.full_name}</div>
                  <div className="text-muted-foreground text-xs truncate">{user.email}</div>
                </div>
              </button>
            ))}

            {filteredUsers.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                Ничего не найдено
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
