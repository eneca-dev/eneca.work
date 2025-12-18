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
          'text-slate-400 hover:text-slate-200',
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
        <ChevronDown className="w-3.5 h-3.5 text-slate-600" />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Выберите ответственного"
          className="absolute top-full left-0 mt-2 z-20 w-64 bg-slate-800/95 backdrop-blur-sm border border-slate-700 rounded-xl shadow-2xl overflow-hidden"
        >
          {/* Search input */}
          <div className="p-2 border-b border-slate-700/50">
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск..."
              aria-label="Поиск пользователей"
              className={cn(
                'w-full px-3 py-2 text-sm',
                'bg-slate-900/50 border border-slate-600/50',
                'rounded-lg text-slate-200 placeholder:text-slate-500',
                'focus:outline-none focus:border-amber-500/50'
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
                'w-full px-3 py-2.5 text-left text-sm text-slate-400',
                'hover:bg-slate-700/50 flex items-center gap-2.5 transition-colors',
                !value && 'bg-amber-500/10'
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
                  'hover:bg-slate-700/50 flex items-center gap-2.5 transition-colors',
                  value?.user_id === user.user_id && 'bg-amber-500/10'
                )}
              >
                <Avatar className="h-6 w-6">
                  {user.avatar_url && <AvatarImage src={user.avatar_url} />}
                  <AvatarFallback className="text-[10px] bg-slate-700">
                    {getInitials(user.first_name, user.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="text-slate-200 truncate">{user.full_name}</div>
                  <div className="text-slate-500 text-xs truncate">{user.email}</div>
                </div>
              </button>
            ))}

            {filteredUsers.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-slate-500">
                Ничего не найдено
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
