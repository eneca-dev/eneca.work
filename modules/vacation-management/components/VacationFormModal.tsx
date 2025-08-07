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
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { VacationEvent, VacationFormData, Employee } from '../types'

// Схема валидации
const vacationFormSchema = z.object({
  startDate: z.string().min(1, 'Выберите дату начала отпуска'),
  endDate: z.string().min(1, 'Выберите дату окончания отпуска'),
  type: z.enum(['Отпуск запрошен', 'Отпуск одобрен', 'Отпуск отклонен']),
  comment: z.string().optional()
}).refine(data => {
  if (data.startDate && data.endDate) {
    return new Date(data.startDate) <= new Date(data.endDate)
  }
  return true
}, {
  message: 'Дата окончания должна быть больше или равна дате начала',
  path: ['endDate']
})

type FormData = z.infer<typeof vacationFormSchema>

interface VacationFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: VacationFormData) => Promise<void>
  employee?: Employee
  vacation?: VacationEvent
  mode: 'create' | 'edit'
}

export function VacationFormModal({
  isOpen,
  onClose,
  onSubmit,
  employee,
  vacation,
  mode
}: VacationFormModalProps) {
  const [loading, setLoading] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(vacationFormSchema),
    defaultValues: {
      startDate: '',
      endDate: '',
      type: 'Отпуск запрошен',
      comment: ''
    }
  })

  // Заполняем форму при редактировании
  useEffect(() => {
    if (mode === 'edit' && vacation) {
      form.reset({
        startDate: vacation.calendar_event_date_start.split('T')[0],
        endDate: vacation.calendar_event_date_end?.split('T')[0] || vacation.calendar_event_date_start.split('T')[0],
        type: vacation.calendar_event_type,
        comment: vacation.calendar_event_comment || ''
      })
    } else if (mode === 'create') {
      form.reset({
        startDate: '',
        endDate: '',
        type: 'Отпуск запрошен',
        comment: ''
      })
    }
  }, [mode, vacation, form])

  const handleSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      await onSubmit({
        startDate: data.startDate,
        endDate: data.endDate,
        type: data.type,
        comment: data.comment
      })
      onClose()
    } catch (error) {
      console.error('Ошибка при сохранении отпуска:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    form.reset()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <Modal.Header 
        title={mode === 'create' ? 'Создать отпуск' : 'Редактировать отпуск'}
        subtitle={employee ? `${employee.first_name} ${employee.last_name}` : undefined}
        onClose={handleClose}
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <Modal.Body className="space-y-4">
            {/* Тип отпуска */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Тип отпуска</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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

            {/* Даты */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Дата начала</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(new Date(field.value), "dd.MM.yyyy", { locale: ru })
                            ) : (
                              <span>Выберите дату</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ? new Date(field.value) : undefined}
                          onSelect={(date) => {
                            if (date) {
                              field.onChange(format(date, 'yyyy-MM-dd'))
                            }
                          }}
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Дата окончания</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(new Date(field.value), "dd.MM.yyyy", { locale: ru })
                            ) : (
                              <span>Выберите дату</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ? new Date(field.value) : undefined}
                          onSelect={(date) => {
                            if (date) {
                              field.onChange(format(date, 'yyyy-MM-dd'))
                            }
                          }}
                          disabled={(date) => {
                            const startDate = form.getValues('startDate')
                            if (startDate) {
                              return date < new Date(startDate)
                            }
                            return date < new Date(new Date().setHours(0, 0, 0, 0))
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
              loading={loading}
            >
              {mode === 'create' ? 'Создать' : 'Сохранить'}
            </ModalButton>
          </Modal.Footer>
        </form>
      </Form>
    </Modal>
  )
} 