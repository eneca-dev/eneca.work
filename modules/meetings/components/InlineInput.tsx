'use client'

import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface InlineInputProps {
  value: string
  onChange: (value: string) => void
  onCommit: () => void
  onCancel: () => void
  placeholder?: string
  ariaLabel?: string
}

/** Инлайн-поле «создать/переименовать» с подтверждением/отменой и горячими клавишами. */
export function InlineInput({
  value,
  onChange,
  onCommit,
  onCancel,
  placeholder,
  ariaLabel,
}: InlineInputProps) {
  return (
    <div className="flex items-center gap-1">
      <Input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onCommit()
          if (e.key === 'Escape') onCancel()
        }}
        placeholder={placeholder}
        className="h-9"
        aria-label={ariaLabel}
      />
      <Button size="icon" className="h-9 w-9 flex-shrink-0" onClick={onCommit} aria-label="Сохранить">
        <Check className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 flex-shrink-0"
        onClick={onCancel}
        aria-label="Отмена"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
