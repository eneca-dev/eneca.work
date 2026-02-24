import React from 'react'
import { Lock, ChevronDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FilterOption } from './types'

interface FilterSelectProps {
  id: string
  label: string
  value: string | null
  onChange: (value: string | null) => void
  disabled?: boolean
  locked?: boolean
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
  locked = false, 
  options, 
  placeholder, 
  theme = 'light',
  loading = false
}: FilterSelectProps) {
  const isDisabled = disabled || locked || loading;
  
  return (
    <div className="group">
      <label
        htmlFor={id}
        className={cn(
          "block text-xs font-medium mb-1 flex items-center gap-1.5", 
          theme === "dark" ? "text-slate-300" : "text-slate-700",
          "group-hover:text-teal-600 dark:group-hover:text-teal-400"
        )}
      >
        {label}
        {locked && <Lock size={12} className="text-amber-500" />}
        {loading && <Loader2 size={12} className="animate-spin text-teal-500" />}
      </label>
      
      <div className="relative">
        <select
          id={id}
          value={value || ""}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={isDisabled}
          className={cn(
            "w-full text-sm rounded-lg border px-3 py-2 pr-8 transition-all duration-200 appearance-none",
            "focus:outline-none focus:ring-1 focus:ring-teal-500",
            
            theme === "dark"
              ? "bg-slate-800/50 border-slate-600 text-slate-200"
              : "bg-white border-slate-200 text-slate-800",
            
            !isDisabled && theme === "dark"
              ? "hover:border-slate-500"
              : "hover:border-slate-300",
            
            locked && [
              "cursor-not-allowed",
              theme === "dark" 
                ? "bg-amber-900/20 border-amber-500/40" 
                : "bg-amber-50 border-amber-300/60"
            ],
            
            loading && "opacity-70 cursor-wait",
            disabled && !locked && "opacity-50 cursor-not-allowed"
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