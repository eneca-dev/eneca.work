'use client'

/**
 * Loading Modal 2 - Ввод ставки загрузки
 *
 * Компонент с быстрыми кнопками (0.2, 0.25, 0.5, 0.75, 1)
 * и возможностью ввести кастомное значение
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface RateInputProps {
  /** Текущее значение ставки (0.01 - 1.0) */
  value: number
  /** Callback при изменении */
  onChange: (rate: number) => void
  /** Показывать ошибку */
  error?: string
  /** Disabled состояние */
  disabled?: boolean
}

const QUICK_RATES = [0.2, 0.25, 0.5, 0.75, 1.0]

export function RateInput({ value, onChange, error, disabled = false }: RateInputProps) {
  const [customValue, setCustomValue] = useState('')

  const handleQuickSelect = (rate: number) => {
    onChange(rate)
    setCustomValue('')
  }

  const handleCustomInput = (inputValue: string) => {
    setCustomValue(inputValue)

    // Парсинг и валидация
    const parsed = parseFloat(inputValue.replace(',', '.'))
    if (!isNaN(parsed) && parsed >= 0.01 && parsed <= 1.0) {
      onChange(parsed)
    }
  }

  const isQuickRateSelected = (rate: number) => {
    return !customValue && Math.abs(value - rate) < 0.001
  }

  return (
    <div className="space-y-3">
      {/* Быстрые кнопки */}
      <div className="flex gap-2">
        {QUICK_RATES.map((rate) => (
          <Button
            key={rate}
            type="button"
            variant={isQuickRateSelected(rate) ? 'default' : 'outline'}
            size="sm"
            disabled={disabled}
            onClick={() => handleQuickSelect(rate)}
            className={cn(
              'flex-1',
              isQuickRateSelected(rate) &&
                'bg-teal-500 text-white hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-700'
            )}
          >
            {rate}
          </Button>
        ))}
      </div>

      {/* Кастомный ввод */}
      <div className="space-y-1">
        <label className="text-sm text-muted-foreground">Или введите своё значение:</label>
        <Input
          type="text"
          placeholder="1.25"
          value={customValue}
          onChange={(e) => handleCustomInput(e.target.value)}
          disabled={disabled}
          className={cn(error && 'border-red-500')}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!error && (
          <p className="text-xs text-muted-foreground">
            Введите значение от 0.01 до 1.0
          </p>
        )}
      </div>
    </div>
  )
}
