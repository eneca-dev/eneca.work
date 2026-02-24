'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

export interface StatusOption {
  id: string
  name: string
  color: string
}

interface StatusDropdownProps {
  /** Currently selected status */
  value: StatusOption | null
  /** Available status options */
  options: StatusOption[]
  /** Callback when status changes */
  onChange: (statusId: string | null) => void
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

export function StatusDropdown({
  value,
  options,
  onChange,
  isLoading = false,
  disabled = false,
  id,
}: StatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
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
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const handleSelect = (statusId: string | null) => {
    onChange(statusId)
    setIsOpen(false)
  }

  const displayColor = value?.color || '#6b7280'
  const displayName = value?.name || 'Без статуса'

  return (
    <div ref={containerRef} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled || isLoading}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Статус: ${displayName}`}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-full',
          'text-xs font-medium',
          'border transition-all duration-200',
          'hover:scale-105 active:scale-100',
          (disabled || isLoading) && 'opacity-60 cursor-not-allowed'
        )}
        style={{
          backgroundColor: `${displayColor}20`,
          borderColor: `${displayColor}40`,
          color: displayColor,
        }}
      >
        {isLoading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: displayColor }}
          />
        )}
        <span>{displayName}</span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Выберите статус"
          className="absolute top-full right-0 mt-2 z-20 w-48 bg-card/95 backdrop-blur-sm border border-border rounded-xl shadow-2xl overflow-hidden"
        >
          <div className="py-1">
            {/* No status option */}
            <button
              type="button"
              role="option"
              aria-selected={!value}
              onClick={() => handleSelect(null)}
              className={cn(
                'w-full px-3 py-2.5 text-left text-sm text-muted-foreground',
                'hover:bg-muted flex items-center gap-2.5 transition-colors',
                !value && 'bg-amber-500/10'
              )}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-muted" />
              Без статуса
            </button>

            {/* Status options */}
            {options.map((status) => (
              <button
                key={status.id}
                type="button"
                role="option"
                aria-selected={value?.id === status.id}
                onClick={() => handleSelect(status.id)}
                className={cn(
                  'w-full px-3 py-2.5 text-left text-sm text-foreground',
                  'hover:bg-muted flex items-center gap-2.5 transition-colors',
                  value?.id === status.id && 'bg-amber-500/10'
                )}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: status.color }}
                />
                {status.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
