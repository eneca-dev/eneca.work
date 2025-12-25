'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Users, ChevronDown, Loader2, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getInitials } from '@/modules/resource-graph/utils'
import type { CachedUser } from '@/modules/cache'

// ============================================================================
// Types
// ============================================================================

interface ResponsiblesDropdownProps {
  /** Currently selected users */
  value: CachedUser[]
  /** Available users */
  users: CachedUser[]
  /** Callback when responsibles change */
  onChange: (userIds: string[]) => void
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

export function ResponsiblesDropdown({
  value,
  users,
  onChange,
  isLoading = false,
  disabled = false,
  id,
}: ResponsiblesDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 288 })
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
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

  // Selected user IDs for quick lookup
  const selectedIds = useMemo(
    () => new Set(value.map((u) => u.user_id)),
    [value]
  )

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      // Check if click is outside both container and dropdown portal
      const isOutsideContainer = containerRef.current && !containerRef.current.contains(target)
      const isOutsideDropdown = dropdownRef.current && !dropdownRef.current.contains(target)

      if (isOutsideContainer && isOutsideDropdown) {
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

  // Calculate dropdown position when opened
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: Math.max(288, rect.width),
      })
    }
  }, [isOpen])

  const handleToggle = (userId: string) => {
    const newIds = selectedIds.has(userId)
      ? value.filter((u) => u.user_id !== userId).map((u) => u.user_id)
      : [...value.map((u) => u.user_id), userId]
    onChange(newIds)
  }

  const handleRemove = (userId: string) => {
    onChange(value.filter((u) => u.user_id !== userId).map((u) => u.user_id))
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled || isLoading}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Ответственные: ${value.length > 0 ? value.map((u) => u.full_name).join(', ') : 'не назначены'}`}
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
          <Users className="w-3.5 h-3.5" />
        )}
        <span>
          {value.length === 0
            ? 'Ответственные не назначены'
            : `Ответственные (${value.length})`}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-600" />
      </button>

      {/* Selected users chips */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {value.map((user) => (
            <div
              key={user.user_id}
              className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/60 rounded-full text-xs"
            >
              <Avatar className="h-4 w-4">
                {user.avatar_url && <AvatarImage src={user.avatar_url} />}
                <AvatarFallback className="text-[8px] bg-slate-700">
                  {getInitials(user.first_name, user.last_name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-slate-300 max-w-[100px] truncate">
                {user.full_name}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemove(user.user_id)
                }}
                disabled={isLoading}
                className="text-slate-500 hover:text-slate-300 transition-colors"
                aria-label={`Удалить ${user.full_name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Dropdown - rendered in portal to escape overflow:hidden */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          role="listbox"
          aria-label="Выберите ответственных"
          aria-multiselectable="true"
          className="fixed z-[9999] bg-slate-800/95 backdrop-blur-sm border border-slate-700 rounded-xl shadow-2xl shadow-black/40 overflow-hidden"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
          }}
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
            {filteredUsers.map((user) => {
              const isSelected = selectedIds.has(user.user_id)
              return (
                <button
                  key={user.user_id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleToggle(user.user_id)}
                  className={cn(
                    'w-full px-3 py-2.5 text-left text-sm',
                    'hover:bg-slate-700/50 flex items-center gap-2.5 transition-colors',
                    isSelected && 'bg-amber-500/10'
                  )}
                >
                  <div
                    className={cn(
                      'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                      isSelected
                        ? 'bg-amber-500 border-amber-500'
                        : 'border-slate-600'
                    )}
                  >
                    {isSelected && (
                      <Check className="w-3 h-3 text-slate-900" />
                    )}
                  </div>
                  <Avatar className="h-6 w-6">
                    {user.avatar_url && <AvatarImage src={user.avatar_url} />}
                    <AvatarFallback className="text-[10px] bg-slate-700">
                      {getInitials(user.first_name, user.last_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="text-slate-200 truncate">
                      {user.full_name}
                    </div>
                    <div className="text-slate-500 text-xs truncate">
                      {user.email}
                    </div>
                  </div>
                </button>
              )
            })}

            {filteredUsers.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-slate-500">
                Ничего не найдено
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
