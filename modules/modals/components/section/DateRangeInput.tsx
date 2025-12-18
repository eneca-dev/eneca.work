'use client'

import { CalendarDays, ArrowRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

interface DateRangeInputProps {
  /** Start date (ISO string or null) */
  startDate: string | null
  /** End date (ISO string or null) */
  endDate: string | null
  /** Callback for start date change */
  onStartDateChange: (date: string) => void
  /** Callback for end date change */
  onEndDateChange: (date: string) => void
  /** Loading field name (startDate or endDate) */
  savingField?: 'startDate' | 'endDate' | null
  /** Disabled state */
  disabled?: boolean
  /** ID prefix for accessibility */
  idPrefix?: string
}

// ============================================================================
// Helpers
// ============================================================================

function formatDateForInput(dateStr: string | null): string {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toISOString().split('T')[0]
  } catch {
    return ''
  }
}

// ============================================================================
// Styles
// ============================================================================

const dateInputClasses = cn(
  'w-[110px] px-2 py-1 text-xs',
  'bg-slate-800/60 border border-slate-700/50',
  'rounded-md text-slate-300',
  'focus:outline-none focus:border-amber-500/50',
  'transition-colors',
  '[&::-webkit-calendar-picker-indicator]:invert',
  '[&::-webkit-calendar-picker-indicator]:opacity-40',
  '[&::-webkit-calendar-picker-indicator]:hover:opacity-70'
)

// ============================================================================
// Component
// ============================================================================

export function DateRangeInput({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  savingField,
  disabled = false,
  idPrefix = 'date',
}: DateRangeInputProps) {
  const isStartSaving = savingField === 'startDate'
  const isEndSaving = savingField === 'endDate'
  const isSaving = isStartSaving || isEndSaving

  return (
    <div className="flex items-center gap-2 text-sm">
      <CalendarDays className="w-4 h-4 text-slate-500" aria-hidden="true" />

      <div className="flex items-center gap-1.5">
        {/* Start date */}
        <label htmlFor={`${idPrefix}-start`} className="sr-only">
          Дата начала
        </label>
        <input
          id={`${idPrefix}-start`}
          type="date"
          value={formatDateForInput(startDate)}
          onChange={(e) => onStartDateChange(e.target.value)}
          disabled={disabled || isStartSaving}
          aria-label="Дата начала"
          className={cn(
            dateInputClasses,
            isStartSaving && 'opacity-60'
          )}
        />

        <ArrowRight className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />

        {/* End date */}
        <label htmlFor={`${idPrefix}-end`} className="sr-only">
          Дата окончания
        </label>
        <input
          id={`${idPrefix}-end`}
          type="date"
          value={formatDateForInput(endDate)}
          onChange={(e) => onEndDateChange(e.target.value)}
          disabled={disabled || isEndSaving}
          aria-label="Дата окончания"
          className={cn(
            dateInputClasses,
            isEndSaving && 'opacity-60'
          )}
        />
      </div>

      {/* Loading indicator */}
      {isSaving && (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" aria-label="Сохранение..." />
      )}
    </div>
  )
}
