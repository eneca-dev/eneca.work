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
}: FilterSelectProps) {
  const isDisabled = disabled || loading

  return (
    <div className={cn('flex flex-col gap-1 min-w-[160px]', className)}>
      <label
        htmlFor={id}
        className={cn(
          'text-xs font-medium flex items-center gap-1.5',
          'text-muted-foreground',
          !isDisabled && 'group-hover:text-foreground'
        )}
      >
        {label}
        {loading && <Loader2 size={12} className="animate-spin text-primary" />}
      </label>

      <div className="relative">
        <select
          id={id}
          value={value || ''}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={isDisabled}
          className={cn(
            'w-full text-sm rounded-md border px-3 py-2 pr-8',
            'transition-colors duration-200 appearance-none',
            'bg-background border-input text-foreground',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            !isDisabled && 'hover:border-primary/50',
            isDisabled && 'opacity-50 cursor-not-allowed',
            loading && 'cursor-wait'
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
            'absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none',
            isDisabled ? 'opacity-50' : 'opacity-70'
          )}
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <ChevronDown size={14} />
          )}
        </div>
      </div>
    </div>
  )
}
