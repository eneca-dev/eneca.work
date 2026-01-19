'use client'

/**
 * Loading Modal 2 - Форма загрузки (правая панель)
 *
 * Правая панель модального окна с формой для создания/редактирования загрузки
 * Включает:
 * - Селектор сотрудника (EmployeeSelector)
 * - Ввод ставки (RateInput)
 * - Выбор диапазона дат (DateRangePicker)
 * - Комментарий (Textarea)
 * - Информация о выбранном разделе
 */

import { AlertCircle } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { EmployeeSelector } from './EmployeeSelector'
import { RateInput } from './RateInput'
import { DateRangePicker } from './DateRangePicker'
import type { LoadingFormData } from '../../hooks/useLoadingModal'

export interface LoadingFormProps {
  /** Данные формы */
  formData: LoadingFormData
  /** Callback при изменении поля */
  onFieldChange: <K extends keyof LoadingFormData>(field: K, value: LoadingFormData[K]) => void
  /** Ошибки валидации */
  errors: Partial<Record<keyof LoadingFormData, string>>
  /** Disabled состояние */
  disabled?: boolean
  /** Название выбранного раздела */
  selectedSectionName?: string
  /** Класс для кастомизации */
  className?: string
}

export function LoadingForm({
  formData,
  onFieldChange,
  errors,
  disabled = false,
  selectedSectionName,
  className,
}: LoadingFormProps) {
  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Информация о выбранном разделе */}
      {selectedSectionName && (
        <div className="p-4 border-b bg-muted/30">
          <div className="text-xs text-muted-foreground mb-1">Раздел для загрузки:</div>
          <div className="text-sm font-medium">{selectedSectionName}</div>
        </div>
      )}

      {/* Предупреждение если раздел не выбран */}
      {!selectedSectionName && (
        <div className="p-4 border-b bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs text-amber-700 dark:text-amber-400">
              Выберите раздел в дереве проектов слева, чтобы создать загрузку
            </div>
          </div>
        </div>
      )}

      {/* Форма */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Сотрудник */}
        <div>
          <label className="block text-sm font-medium mb-2">Сотрудник</label>
          <EmployeeSelector
            value={formData.employeeId}
            onChange={(value) => onFieldChange('employeeId', value)}
            error={errors.employeeId}
            disabled={disabled}
            placeholder="Выберите сотрудника"
          />
        </div>

        {/* Ставка загрузки */}
        <div>
          <label className="block text-sm font-medium mb-2">Ставка загрузки</label>
          <RateInput
            value={formData.rate}
            onChange={(value) => onFieldChange('rate', value)}
            error={errors.rate}
            disabled={disabled}
          />
        </div>

        {/* Даты */}
        <div>
          <label className="block text-sm font-medium mb-2">Период загрузки</label>
          <DateRangePicker
            startDate={formData.startDate}
            endDate={formData.endDate}
            onChange={(start, end) => {
              onFieldChange('startDate', start)
              onFieldChange('endDate', end)
            }}
            error={errors.startDate || errors.endDate}
            disabled={disabled}
            rate={formData.rate}
          />
        </div>

        {/* Комментарий */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Комментарий <span className="text-muted-foreground font-normal">(необязательно)</span>
          </label>
          <Textarea
            value={formData.comment}
            onChange={(e) => onFieldChange('comment', e.target.value)}
            placeholder="Добавьте комментарий к загрузке..."
            rows={4}
            disabled={disabled}
            className={cn(errors.comment && 'border-red-500')}
          />
          {errors.comment && <p className="text-sm text-red-500 mt-1">{errors.comment}</p>}
        </div>
      </div>
    </div>
  )
}
