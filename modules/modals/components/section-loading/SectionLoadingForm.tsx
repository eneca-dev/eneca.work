/**
 * SectionLoadingForm - Форма создания/редактирования загрузки
 *
 * Поля: Сотрудник, Ставка, Период, Комментарий
 * Валидация: React Hook Form + Zod
 */

'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useEffect, type MutableRefObject } from 'react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { EmployeeSelect } from './EmployeeSelect'
import { RateInput } from './RateInput'
import { DateRangePicker } from './DateRangePicker'
import type { SectionLoadingFormData } from './types'

// ============================================================================
// Validation Schema
// ============================================================================

const formSchema = z.object({
  employeeId: z.string().uuid({ message: 'Выберите сотрудника' }),
  rate: z
    .number({ required_error: 'Укажите ставку' })
    .min(0.01, 'Минимальная ставка: 0.01')
    .max(2.0, 'Максимальная ставка: 2.0'),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Неверный формат даты'),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Неверный формат даты'),
  comment: z.string().optional(),
}).refine(
  (data) => {
    // Проверка что startDate <= endDate
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate)
    }
    return true
  },
  {
    message: 'Дата начала не может быть позже даты окончания',
    path: ['endDate'],
  }
)

// ============================================================================
// Component
// ============================================================================

interface SectionLoadingFormProps {
  initialData?: Partial<SectionLoadingFormData>
  onSubmit: (data: SectionLoadingFormData) => void
  isSubmitting?: boolean
  submitRef?: MutableRefObject<(() => void) | null>
}

export function SectionLoadingForm({
  initialData,
  onSubmit,
  isSubmitting,
  submitRef,
}: SectionLoadingFormProps) {
  const {
    watch,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<SectionLoadingFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employeeId: initialData?.employeeId || '',
      rate: initialData?.rate || 0.5,
      startDate: initialData?.startDate || '',
      endDate: initialData?.endDate || '',
      comment: initialData?.comment || '',
    },
  })

  // Expose submit function to parent via ref
  useEffect(() => {
    if (submitRef) {
      submitRef.current = () => {
        handleSubmit(onSubmit)()
      }
    }
  }, [submitRef, handleSubmit, onSubmit])

  // Watch form values
  const employeeId = watch('employeeId')
  const rate = watch('rate')
  const startDate = watch('startDate')
  const endDate = watch('endDate')
  const comment = watch('comment')

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Сотрудник */}
      <div>
        <EmployeeSelect
          value={employeeId}
          onChange={(value) => setValue('employeeId', value)}
          error={errors.employeeId?.message}
          disabled={isSubmitting}
          aria-invalid={!!errors.employeeId}
        />
      </div>

      {/* Ставка */}
      <div>
        <RateInput
          value={rate}
          onChange={(value) => setValue('rate', value)}
          error={errors.rate?.message}
          disabled={isSubmitting}
          aria-invalid={!!errors.rate}
        />
      </div>

      {/* Период */}
      <div>
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={(value) => setValue('startDate', value)}
          onEndDateChange={(value) => setValue('endDate', value)}
          startDateError={errors.startDate?.message}
          endDateError={errors.endDate?.message}
          disabled={isSubmitting}
        />
      </div>

      {/* Комментарий */}
      <div className="space-y-2">
        <Label htmlFor="comment">Комментарий</Label>
        <Textarea
          id="comment"
          placeholder="Дополнительная информация о загрузке..."
          value={comment}
          onChange={(e) => setValue('comment', e.target.value)}
          rows={3}
          disabled={isSubmitting}
        />
      </div>
    </form>
  )
}
