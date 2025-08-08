"use client"

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal, useModalState } from '@/components/modals'
import { ModalButton } from '@/components/modals/base/ModalButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { DatePicker } from '@/modules/calendar/components/mini-calendar'
import { cn } from '@/lib/utils'
import type { VacationEvent, VacationFormData, Employee } from '../types'

// Схема валидации
const vacationFormSchema = z.object({
  dateRange: z.object({
    from: z.date().nullable(),
    to: z.date().nullable()
  }).refine(data => {
    return data.from !== null
  }, {
    message: 'Выберите дату начала отпуска',
    path: ['from']
  }).refine(data => {
    if (data.from && data.to) {
      return data.from <= data.to
    }
    return true
  }, {
    message: 'Дата окончания должна быть больше или равна дате начала',
    path: ['to']
  }),
  type: z.enum(['Отпуск запрошен', 'Отпуск одобрен', 'Отпуск отклонен']),
  comment: z.string().optional()
})

type FormData = z.infer<typeof vacationFormSchema>

interface VacationFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: VacationFormData) => Promise<void>
  employee?: Employee
  vacation?: VacationEvent
  mode: 'create' | 'edit'
  isSubmitting?: boolean
}

export function VacationFormModal({
  isOpen,
  onClose,
  onSubmit,
  employee,
  vacation,
  mode,
  isSubmitting = false
}: VacationFormModalProps) {

  const form = useForm<FormData>({
    resolver: zodResolver(vacationFormSchema),
    defaultValues: {
      dateRange: { from: null, to: null },
      type: 'Отпуск запрошен',
      comment: ''
    }
  })

  // Заполняем форму при редактировании
  useEffect(() => {
    if (mode === 'edit' && vacation) {
      const startDate = new Date(vacation.calendar_event_date_start)
      const endDate = vacation.calendar_event_date_end 
        ? new Date(vacation.calendar_event_date_end) 
        : startDate
      
      form.reset({
        dateRange: { from: startDate, to: endDate },
        type: vacation.calendar_event_type,
        comment: vacation.calendar_event_comment || ''
      })
    } else if (mode === 'create') {
      form.reset({
        dateRange: { from: null, to: null },
        type: 'Отпуск запрошен',
        comment: ''
      })
    }
  }, [mode, vacation, form])

  const handleSubmit = async (data: FormData) => {
    try {
      if (!data.dateRange.from) {
        throw new Error('Выберите дату начала отпуска')
      }
      
      const startDate = format(data.dateRange.from, 'yyyy-MM-dd')
      const endDate = data.dateRange.to 
        ? format(data.dateRange.to, 'yyyy-MM-dd')
        : startDate

      await onSubmit({
        startDate,
        endDate,
        type: data.type,
        comment: data.comment
      })
    } catch (error) {
      console.error('Ошибка при сохранении отпуска:', error)
    }
  }

  const handleClose = () => {
    form.reset()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="xl">
      <Modal.Header 
        title={mode === 'create' ? 'Создать отпуск' : 'Редактировать отпуск'}
        subtitle={employee ? `${employee.first_name} ${employee.last_name}` : undefined}
        onClose={handleClose}
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <Modal.Body className="space-y-4 min-h-[500px]">
            {/* Тип отпуска */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Тип отпуска</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите тип отпуска" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Отпуск запрошен">Отпуск запрошен</SelectItem>
                      <SelectItem value="Отпуск одобрен">Отпуск одобрен</SelectItem>
                      <SelectItem value="Отпуск отклонен">Отпуск отклонен</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Выбор диапазона дат */}
            <FormField
              control={form.control}
              name="dateRange"
              render={({ field }) => (
                <FormItem className="flex flex-col mb-8">
                  <FormLabel>Период отпуска</FormLabel>
                  <FormControl>
                    <DatePicker
                      value={field.value}
                      onChange={field.onChange}
                      mode="range"
                      placeholder="Выберите даты отпуска..."
                      calendarWidth="450px"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Комментарий */}
            <FormField
              control={form.control}
              name="comment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Комментарий (необязательно)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Дополнительная информация об отпуске..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Modal.Body>

          <Modal.Footer>
            <ModalButton variant="cancel" onClick={handleClose}>
              Отмена
            </ModalButton>
            <ModalButton
              type="submit"
              variant="success"
              loading={isSubmitting}
            >
              {mode === 'create' ? 'Создать' : 'Сохранить'}
            </ModalButton>
          </Modal.Footer>
        </form>
      </Form>
    </Modal>
  )
} 