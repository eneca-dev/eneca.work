/**
 * Resource Graph Filters - Filter Select Component
 *
 * Переиспользуемый компонент выбора фильтра
 */

'use client'

import { ChevronDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

interface FilterOption {
  id: string
  name: string
}

interface FilterSelectProps {
  id: string
  label: string
  value: string | null
  onChange: (value: string | null) => void
  options: FilterOption[]
  placeholder: string
  disabled?: boolean
  loading?: boolean
  className?: string
  /** Компактный режим для inline размещения */
  compact?: boolean
}

// ============================================================================
// Component
// ============================================================================

export function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  loading = false,
  className,
  compact = false,
}: FilterSelectProps) {
  const isDisabled = disabled || loading

  return (
    <div
      className={cn(
        'flex gap-1',
        compact ? 'flex-row items-center min-w-[140px]' : 'flex-col min-w-[160px]',
        className
      )}
    >
      <label
        htmlFor={id}
        className={cn(
          'font-medium flex items-center gap-1.5 whitespace-nowrap',
          'text-muted-foreground',
          compact ? 'text-[11px]' : 'text-xs',
          !isDisabled && 'group-hover:text-foreground'
        )}
      >
        {label}
        {loading && !compact && <Loader2 size={12} className="animate-spin text-primary" />}
      </label>

      <div className="relative flex-1">
        <select
          id={id}
          value={value || ''}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={isDisabled}
          className={cn(
            'w-full rounded-md border appearance-none',
            'transition-colors duration-200',
            'bg-background border-input text-foreground',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
            !isDisabled && 'hover:border-primary/50',
            isDisabled && 'opacity-50 cursor-not-allowed',
            loading && 'cursor-wait',
            compact ? 'text-xs px-2 py-1 pr-6' : 'text-sm px-3 py-2 pr-8'
          )}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>

        <div
          className={cn(
            'absolute inset-y-0 right-0 flex items-center pointer-events-none',
            compact ? 'pr-1.5' : 'pr-2',
            isDisabled ? 'opacity-50' : 'opacity-70'
          )}
        >
          {loading ? (
            <Loader2 size={compact ? 12 : 14} className="animate-spin" />
          ) : (
            <ChevronDown size={compact ? 12 : 14} />
          )}
        </div>
      </div>
    </div>
  )
}
