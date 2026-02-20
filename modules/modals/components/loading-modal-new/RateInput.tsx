'use client'

/**
 * Loading Modal New - Ввод ставки загрузки
 *
 * Компонент с быстрыми кнопками (0.2, 0.25, 0.5, 0.75, 1)
 * и возможностью ввести кастомное значение
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface RateInputProps {
  /** Текущее значение ставки (0.01 - 2.0) */
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
  const [customValue, setCustomValue] = useState(() => {
    const isQuickRate = QUICK_RATES.some((rate) => Math.abs(value - rate) < 0.001)
    return isQuickRate ? '' : String(value)
  })

  const handleQuickSelect = (rate: number) => {
    onChange(rate)
    setCustomValue('')
  }

  const handleCustomInput = (inputValue: string) => {
    // Валидация: только цифры, точка и запятая
    // Первый символ должен быть цифрой
    // Максимум 2 знака после точки

    let processedValue = inputValue

    // Если пустая строка - разрешаем
    if (processedValue === '') {
      setCustomValue('')
      return
    }

    // Первый символ должен быть цифрой
    if (!/^\d/.test(processedValue)) {
      return
    }

    // Заменяем запятую на точку
    processedValue = processedValue.replace(',', '.')

    // Проверяем паттерн: цифра, опционально точка и до 2 цифр после
    const validPattern = /^\d(\.\d{0,2})?$/
    if (!validPattern.test(processedValue)) {
      return
    }

    // Обновляем отображаемое значение
    setCustomValue(processedValue)

    // Парсим и валидируем
    const parsed = parseFloat(processedValue)
    if (!isNaN(parsed)) {
      onChange(parsed)
    }
  }

  // Проверка валидности значения для отображения ошибки
  const isInvalidRange = Boolean(customValue && (value < 0.01 || value > 2.0))

  const isQuickRateSelected = (rate: number) => {
    return Math.abs(value - rate) < 0.001
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
            className="flex-1"
          >
            {rate}
          </Button>
        ))}
      </div>

      {/* Кастомный ввод */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Или введите своё значение от 0.01 до 2.0:</label>
        <Input
          type="text"
          placeholder="1.25"
          value={customValue}
          onChange={(e) => handleCustomInput(e.target.value)}
          disabled={disabled}
          className={cn(
            'placeholder:text-muted-foreground/70',
            (error || isInvalidRange) && 'border-red-500'
          )}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!error && isInvalidRange && (
          <p className="text-sm text-red-500">
            Ставка должна быть от 0.01 до 2.0
          </p>
        )}
        {/* {!error && !isInvalidRange && (
          <p className="text-xs text-muted-foreground">
            Введите значение от 0.01 до 2.0
          </p>
        )} */}
      </div>
    </div>
  )
}
