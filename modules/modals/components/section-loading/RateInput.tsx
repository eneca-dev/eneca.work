/**
 * RateInput - Компонент выбора ставки
 *
 * Quick buttons (0.2, 0.25, 0.5, 0.75, 1.0) + custom input
 * Валидация: 0.01 - 2.0, до 2 знаков после запятой
 * Автозамена запятой на точку
 */

'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface RateInputProps {
  value: number
  onChange: (value: number) => void
  error?: string
  disabled?: boolean
  'aria-invalid'?: boolean
}

const QUICK_RATES = [0.2, 0.25, 0.5, 0.75, 1.0]

export function RateInput({ value, onChange, error, disabled, 'aria-invalid': ariaInvalid }: RateInputProps) {
  const [customInput, setCustomInput] = useState('')

  const handleQuickRate = useCallback((rate: number) => {
    onChange(rate)
    setCustomInput('') // Очищаем custom input при выборе quick button
  }, [onChange])

  const handleCustomInput = useCallback((inputValue: string) => {
    // Автозамена запятой на точку
    const normalized = inputValue.replace(',', '.')
    setCustomInput(normalized)

    // Парсим и валидируем
    const parsed = parseFloat(normalized)
    if (!isNaN(parsed) && parsed >= 0.01 && parsed <= 2.0) {
      // Округляем до 2 знаков после запятой
      const rounded = Math.round(parsed * 100) / 100
      onChange(rounded)
    }
  }, [onChange])

  return (
    <div className="space-y-2">
      <Label>Ставка *</Label>

      {/* Quick buttons */}
      <div className="flex gap-2 flex-wrap">
        {QUICK_RATES.map((rate) => (
          <Button
            key={rate}
            type="button"
            variant={value === rate && !customInput ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleQuickRate(rate)}
            disabled={disabled}
            className="min-w-[60px]"
          >
            {rate}
          </Button>
        ))}
      </div>

      {/* Custom input */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Или введите свою:</Label>
        <Input
          type="text"
          placeholder="Например: 0.3 или 1.5"
          value={customInput}
          onChange={(e) => handleCustomInput(e.target.value)}
          disabled={disabled}
          aria-invalid={ariaInvalid}
          className={cn(
            'w-full',
            error && 'border-destructive focus-visible:ring-destructive'
          )}
        />
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Диапазон: 0.01 - 2.0 (до 2 знаков после запятой)
        </p>
      </div>

      {/* Current value display */}
      {value > 0 && (
        <div className="text-sm text-muted-foreground">
          Выбрано: <span className="font-semibold text-foreground">{value}</span>
        </div>
      )}
    </div>
  )
}
