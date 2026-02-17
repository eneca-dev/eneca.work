'use client'

/**
 * Loading Modal New - Форма загрузки (правая панель)
 *
 * Правая панель модального окна с формой для создания/редактирования загрузки
 * Включает:
 * - Информация о выбранном разделе
 * - Опциональный селектор этапа декомпозиции (DecompositionStageSelector)
 * - Селектор сотрудника (EmployeeSelector)
 * - Ввод ставки (RateInput)
 * - Выбор диапазона дат (DateRangePicker)
 * - Комментарий (Textarea)
 */

import { AlertCircle, ChevronRight, Folder, Box, CircleDashed } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { differenceInBusinessDays } from 'date-fns'
import { EmployeeSelector } from './EmployeeSelector'
import { RateInput } from './RateInput'
import { DateRangePicker } from './DateRangePicker'
import { DecompositionStageSelector } from './DecompositionStageSelector'
import type { LoadingFormData, BreadcrumbItem } from '../../hooks/useLoadingModal'

export interface LoadingFormProps {
  /** Данные формы */
  formData: LoadingFormData
  /** Callback при изменении поля */
  onFieldChange: <K extends keyof LoadingFormData>(field: K, value: LoadingFormData[K]) => void
  /** Ошибки валидации */
  errors: Partial<Record<keyof LoadingFormData, string>>
  /** Disabled состояние */
  disabled?: boolean
  /** Breadcrumbs выбранного раздела */
  selectedBreadcrumbs?: BreadcrumbItem[] | null
  /** Класс для кастомизации */
  className?: string
  /** Режим модалки (для отображения кнопки смены этапа в режиме edit) */
  mode?: 'create' | 'edit'
  /** Callback для смены этапа (только в режиме edit) */
  onChangeStage?: () => void
  /** Флаг optimistic update (показывает индикатор загрузки в селекторе сотрудника) */
  isUpdating?: boolean
}

export function LoadingForm({
  formData,
  onFieldChange,
  errors,
  disabled = false,
  selectedBreadcrumbs,
  className,
  mode = 'create',
  onChangeStage,
  isUpdating = false,
}: LoadingFormProps) {
  // Функция получения иконки по типу элемента
  const getIcon = (type: 'project' | 'object' | 'section') => {
    switch (type) {
      case 'project':
        return Folder
      case 'object':
        return Box
      case 'section':
        return CircleDashed
      default:
        return Folder
    }
  }

  // Извлекаем sectionId из breadcrumbs для загрузки этапов декомпозиции
  const sectionId = selectedBreadcrumbs?.find(b => b.type === 'section')?.id ?? null

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Breadcrumbs с полным путем */}
      {selectedBreadcrumbs && selectedBreadcrumbs.length > 0 && (
        <div className="p-4 border-b bg-muted/30">
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground mb-2">Выбрано для загрузки:</div>
              <div className="flex items-center gap-1 flex-wrap">
                {selectedBreadcrumbs
                  .filter(item => item.type !== 'decomposition_stage')
                  .map((item, index, filteredArray) => {
                    const Icon = getIcon(item.type as 'project' | 'object' | 'section')
                    return (
                      <div key={`${item.id}-${index}`} className="flex items-center gap-1">
                        <Icon className="h-3 w-3 shrink-0 text-foreground/60" />
                        <span className="text-xs font-medium text-foreground/80">{item.name}</span>
                        {index < filteredArray.length - 1 && (
                          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        )}
                      </div>
                    )
                  })}
              </div>
            </div>
            {mode === 'edit' && onChangeStage && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onChangeStage}
                disabled={disabled}
                className="h-auto text-xs px-3 py-1.5 leading-tight w-20 shrink-0"
              >
                <span className="text-center">
                  Сменить<br />раздел
                </span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Предупреждение если раздел не выбран */}
      {(!selectedBreadcrumbs || selectedBreadcrumbs.length === 0) && (
        <div className="p-4 border-b bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs text-amber-700 dark:text-amber-400">
              Выберите раздел в дереве проектов слева
            </div>
          </div>
        </div>
      )}

      {/* Форма */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Сотрудник */}
        <div>
          <label className="block text-sm font-medium mb-2">Сотрудник <span className="text-muted-foreground">*</span></label>
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
          <label className="block text-sm font-medium mb-2">Ставка загрузки <span className="text-muted-foreground">*</span></label>
          <RateInput
            value={formData.rate}
            onChange={(value) => onFieldChange('rate', value)}
            error={errors.rate}
            disabled={disabled}
          />
        </div>

        {/* Даты */}
        <div>
          <label className="block text-sm font-medium mb-2">Период загрузки <span className="text-muted-foreground">*</span></label>
          <div className="space-y-2">
            <DateRangePicker
              value={{
                from: formData.startDate ? new Date(formData.startDate) : null,
                to: formData.endDate ? new Date(formData.endDate) : null,
              }}
              onChange={(range) => {
                // Форматируем даты в локальный формат YYYY-MM-DD без учёта часового пояса
                const formatDate = (date: Date | null) => {
                  if (!date) return ''
                  const year = date.getFullYear()
                  const month = String(date.getMonth() + 1).padStart(2, '0')
                  const day = String(date.getDate()).padStart(2, '0')
                  return `${year}-${month}-${day}`
                }

                const start = formatDate(range?.from ?? null)
                const end = formatDate(range?.to ?? null)
                onFieldChange('startDate', start)
                onFieldChange('endDate', end)
              }}
              placeholder="дд.мм.гггг - дд.мм.гггг"
              hideSingleDateActions={true}
            />

            {/* Информация о периоде */}
            {(() => {
              const start = formData.startDate ? new Date(formData.startDate) : undefined
              const end = formData.endDate ? new Date(formData.endDate) : undefined
              const businessDays =
                start && end && !isNaN(start.getTime()) && !isNaN(end.getTime())
                  ? differenceInBusinessDays(end, start) + 1
                  : 0
              const totalHours = businessDays > 0 ? Math.round(businessDays * 8 * formData.rate) : 0

              return businessDays > 0 ? (
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Количество рабочих дней: {businessDays}</p>
                  <p>Количество рабочих часов с учётом ставки: {totalHours} ч</p>
                </div>
              ) : null
            })()}

            {(errors.startDate || errors.endDate) && (
              <p className="text-sm text-red-500">{errors.startDate || errors.endDate}</p>
            )}
          </div>
        </div>

        {/* Этап декомпозиции (опционально) */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Этап декомпозиции
          </label>
          <DecompositionStageSelector
            sectionId={sectionId}
            value={formData.decompositionStageId}
            onChange={(value) => onFieldChange('decompositionStageId', value)}
            disabled={disabled}
            placeholder="Выберите этап"
          />
        </div>

        {/* Комментарий */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Комментарий
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
