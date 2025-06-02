"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/modules/calendar/components/ui/button"
import { Input } from "@/modules/calendar/components/ui/input"
import { Label } from "@/modules/calendar/components/ui/label"
import { Textarea } from "@/modules/calendar/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/modules/calendar/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/modules/calendar/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { useCalendarStore } from "@/stores/useCalendarStore"
import { useUserStore } from "@/stores/useUserStore"
import { isWeekend } from "@/modules/calendar/utils"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { DatePicker } from "@/modules/calendar/components/mini-calendar"
import { useCalendarEvents } from "@/modules/calendar/hooks/useCalendarEvents"

interface GlobalScheduleFormProps {
  onClose: () => void
}

export function GlobalScheduleForm(props: GlobalScheduleFormProps) {
  const onClose = props.onClose

  const { createEvent } = useCalendarEvents()
  const userStore = useUserStore()
  const currentUserId = userStore.id
  const isAuthenticated = userStore.isAuthenticated
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("transfer")

  // Состояние для выбранных дат в режиме "Перенос"
  const [workdayRange, setWorkdayRange] = useState<{ from: Date | null; to: Date | null }>({
    from: null,
    to: null,
  })
  const [weekendRange, setWeekendRange] = useState<{ from: Date | null; to: Date | null }>({
    from: null,
    to: null,
  })

  // Состояние для выбранных дат в режиме "Добавить праздники"
  const [holidayRange, setHolidayRange] = useState<{ from: Date | null; to: Date | null }>({
    from: null,
    to: null,
  })

  const [comment, setComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  // Получаем массивы выбранных дат
  const workdayDates = workdayRange.from ? [workdayRange.from] : []
  const weekendDates = weekendRange.from ? [weekendRange.from] : []
  const holidayDates = holidayRange.from ? [holidayRange.from] : []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setShowConfirmation(true)
  }

  const handleConfirm = async () => {
    if (!currentUserId || !isAuthenticated) return

    setIsSubmitting(true)

    try {
      if (activeTab === "transfer") {
        // Validate that we have equal number of workdays and weekends
        if (workdayDates.length !== weekendDates.length || workdayDates.length === 0) {
          toast({
            title: "Ошибка валидации",
            description: "Необходимо выбрать и рабочий день, и выходной день для переноса",
            variant: "destructive",
          })
          setIsSubmitting(false)
          setShowConfirmation(false)
          return
        }

        // Проверяем, что выбранный рабочий день действительно рабочий
        if (workdayRange.from && isWeekend(workdayRange.from)) {
          toast({
            title: "Ошибка валидации",
            description: "Для переноса необходимо выбрать рабочий день (пн-пт)",
            variant: "destructive",
          })
          setIsSubmitting(false)
          setShowConfirmation(false)
          return
        }

        // Проверяем, что выбранный выходной день действительно выходной
        if (weekendRange.from && !isWeekend(weekendRange.from)) {
          toast({
            title: "Ошибка валидации",
            description: "Для переноса необходимо выбрать выходной день (сб-вс)",
            variant: "destructive",
          })
          setIsSubmitting(false)
          setShowConfirmation(false)
          return
        }

        // Create transfer events for workdays (making them non-working)
        const workdayPromises = workdayDates.map(date => 
          createEvent({
            calendar_event_type: "Перенос",
            calendar_event_comment: comment,
            calendar_event_is_global: true,
            calendar_event_is_weekday: false,
            calendar_event_created_by: currentUserId,
            calendar_event_date_start: date.toISOString().split('T')[0],
            calendar_event_date_end: undefined,
          }, currentUserId)
        )

        // Create transfer events for weekends (making them working days)
        const weekendPromises = weekendDates.map(date => 
          createEvent({
            calendar_event_type: "Перенос",
            calendar_event_comment: comment,
            calendar_event_is_global: true,
            calendar_event_is_weekday: true,
            calendar_event_created_by: currentUserId,
            calendar_event_date_start: date.toISOString().split('T')[0],
            calendar_event_date_end: undefined,
          }, currentUserId)
        )

        // Execute all promises in parallel
        await Promise.all([...workdayPromises, ...weekendPromises])
      } else if (activeTab === "holiday") {
        // Проверяем, что выбран хотя бы один праздничный день
        if (holidayDates.length === 0) {
          toast({
            title: "Ошибка валидации",
            description: "Необходимо выбрать хотя бы один праздничный день",
            variant: "destructive",
          })
          setIsSubmitting(false)
          setShowConfirmation(false)
          return
        }

        // Create holiday events
        const holidayPromises = holidayDates.map(date => 
          createEvent({
            calendar_event_type: "Праздник",
            calendar_event_comment: comment,
            calendar_event_is_global: true,
            calendar_event_is_weekday: false,
            calendar_event_created_by: currentUserId,
            calendar_event_date_start: date.toISOString().split('T')[0],
            calendar_event_date_end: undefined,
          }, currentUserId)
        )

        // Execute all promises in parallel
        await Promise.all(holidayPromises)
      }

      toast({
        title: "Успешно",
        description: activeTab === "transfer" 
          ? "Перенос рабочих дней успешно добавлен в календарь"
          : "Праздничные дни успешно добавлены в календарь",
      })
      
      onClose()
    } catch (error) {
      // Ошибка уже обрабатывается в createEvent
      setIsSubmitting(false)
    }
  }

  const formatDateSafely = (date: Date) => {
    try {
      return format(date, "dd.MM.yyyy", { locale: ru })
    } catch (error) {
      return "Invalid date"
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="transfer">Перенос</TabsTrigger>
            <TabsTrigger value="holiday">Добавить праздники</TabsTrigger>
          </TabsList>

          <TabsContent value="transfer" className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Выберите рабочий день для переноса</Label>
                <DatePicker
                  value={workdayRange}
                  onChange={setWorkdayRange}
                  mode="single"
                  placeholder="Выберите рабочий день"
                  calendarWidth="500px"
                />
                {workdayRange.from && isWeekend(workdayRange.from) && (
                  <p className="text-sm text-red-500">
                    Выбран выходной день. Пожалуйста, выберите рабочий день (пн-пт).
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Выберите выходной день для переноса</Label>
                <DatePicker
                  value={weekendRange}
                  onChange={setWeekendRange}
                  mode="single"
                  placeholder="Выберите выходной день"
                  calendarWidth="500px"
                />
                {weekendRange.from && !isWeekend(weekendRange.from) && (
                  <p className="text-sm text-red-500">
                    Выбран рабочий день. Пожалуйста, выберите выходной день (сб-вс).
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="comment">Комментарий (необязательно)</Label>
              <Textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Введите комментарий"
                rows={3}
              />
            </div>
          </TabsContent>

          <TabsContent value="holiday" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Выберите праздничный день</Label>
              <DatePicker
                value={holidayRange}
                onChange={setHolidayRange}
                mode="single"
                placeholder="Выберите праздничный день"
                calendarWidth="650px"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="comment">Название праздника</Label>
              <Input
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Введите название праздника"
                required={activeTab === "holiday"}
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button
            type="submit"
            disabled={
              isSubmitting ||
              (activeTab === "transfer" && (!workdayRange.from || !weekendRange.from)) ||
              (activeTab === "holiday" && (!holidayRange.from || !comment))
            }
          >
            Добавить
          </Button>
        </div>
      </form>

      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Подтверждение</AlertDialogTitle>
            <AlertDialogDescription>
              Вы изменяете график работы в общем календаре компании. Вы уверены?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isSubmitting}>
              Уверен, добавить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
