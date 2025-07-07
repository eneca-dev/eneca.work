import React from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FilterOption } from './types'

interface FilterSelectProps {
  id: string
  label: string
  value: string | null
  onChange: (value: string | null) => void
  disabled?: boolean
  options: FilterOption[]
  placeholder: string
  theme?: 'light' | 'dark'
  loading?: boolean
}

export function FilterSelect({ 
  id, 
  label, 
  value, 
  onChange, 
  disabled = false, 
  options, 
  placeholder, 
  theme = 'light',
  loading = false
}: FilterSelectProps) {
  const isDisabled = disabled || loading;
  
  return (
    <div className="group">
      <label
        htmlFor={id}
        className={cn(
          "block text-xs font-medium mb-1 flex items-center gap-1.5", 
          "text-muted-foreground group-hover:text-primary transition-colors"
        )}
      >
        {label}
        {loading && <Loader2 size={12} className="animate-spin text-primary" />}
      </label>
      
      <div className="relative">
        <select
          id={id}
          value={value || ""}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={isDisabled}
          className={cn(
            "w-full text-sm rounded-lg border px-3 py-2 pr-8 transition-all duration-200 appearance-none",
            "bg-background border-input text-foreground",
            "focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring",
            "hover:border-ring/50",
            loading && "opacity-70 cursor-wait",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
        
        <div className={cn(
          "absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none",
          isDisabled ? "opacity-50" : "opacity-70"
        )}>
          <ChevronDown size={14} />
        </div>
      </div>
    </div>
  )
} 