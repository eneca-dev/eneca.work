"use client"

import type React from "react"

import { useState, useMemo } from "react"
import { Button } from "@/modules/calendar/components/ui/button"
import { Label } from "@/modules/calendar/components/ui/label"
import { Input } from "@/modules/calendar/components/ui/input"
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
import { useCalendarEvents } from "@/modules/calendar/hooks/useCalendarEvents"
import { useUserStore } from "@/stores/useUserStore"
import { isWeekend } from "@/modules/calendar/utils"
import { DatePicker } from "@/modules/calendar/components/mini-calendar"
import { formatDateToString } from "@/modules/calendar/utils"

interface UnifiedWorkScheduleFormProps {
  onClose: () => void
}

export function UnifiedWorkScheduleForm(props: UnifiedWorkScheduleFormProps) {
  const onClose = props.onClose

  const { createEvent } = useCalendarEvents()
  const userStore = useUserStore()
  const currentUserId = userStore.id
  const isAuthenticated = userStore.isAuthenticated
  
  // Проверяем права на создание глобальных событий (для праздников и переносов) - ОПТИМИЗИРОВАННО
  const canCreateGlobalEvents = useMemo(() => {
    // Кэшируем результат, чтобы не делать повторные проверки
    const hasCalendarAdmin = userStore.permissions.includes("calendar.admin")
    const hasGlobalEventsPermission = userStore.permissions.includes("calendar_can_create_and_edit_global_events")
    const result = hasCalendarAdmin || hasGlobalEventsPermission

    console.log('🔐 ПРОВЕРКА РАЗРЕШЕНИЙ В ФОРМЕ РАБОЧЕГО ГРАФИКА (useMemo CACHED):', {
      userId: userStore.id,
      userRole: userStore.role,
      userPermissions: userStore.permissions,
      hasCalendarAdmin,
      hasGlobalEventsPermission,
      canCreateGlobalEvents: result,
      profile: userStore.profile
    })
    
    return result
  }, [userStore.id, userStore.role, userStore.permissions])

  const [activeTab, setActiveTab] = useState("dayoff")
  const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>({
    from: null,
    to: null,
  })
  const [workdayDate, setWorkdayDate] = useState<{ from: Date | null; to: Date | null }>({
    from: null,
    to: null,
  })
  const [weekendDate, setWeekendDate] = useState<{ from: Date | null; to: Date | null }>({
    from: null,
    to: null,
  })
  const [holidayDate, setHolidayDate] = useState<{ from: Date | null; to: Date | null }>({
    from: null,
    to: null,
  })
  const [comment, setComment] = useState("")
  const [holidayName, setHolidayName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Для глобальных изменений (переносы и праздники) требуется подтверждение
    if ((activeTab === "transfer" || activeTab === "holiday") && canCreateGlobalEvents) {
      setShowConfirmation(true)
    } else {
      await submitEvent()
    }
  }

  // Функция для создания личных событий (отгул, отпуск, больничный)
  const submitPersonalEvent = async () => {
    if (!dateRange.from || !currentUserId) return

    let eventType: "Отгул" | "Отпуск" | "Больничный"

    switch (activeTab) {
      case "dayoff":
        eventType = "Отгул"
        break
      case "vacation":
        eventType = "Отпуск"
        break
      case "sick":
        eventType = "Больничный"
        break
      default:
        eventType = "Отгул"
    }

    await createEvent({
      calendar_event_type: eventType,
      calendar_event_comment: comment,
      calendar_event_is_global: false,
      calendar_event_is_weekday: null,
      calendar_event_created_by: currentUserId,
      calendar_event_date_start: formatDateToString(dateRange.from),
      calendar_event_date_end: dateRange.to ? formatDateToString(dateRange.to) : undefined,
    }, currentUserId)
  }

  // Функция для создания событий переноса рабочих дней
  const submitTransferEvent = async () => {
    if (!currentUserId) return

    // Перенос рабочего дня (делаем его выходным)
    if (workdayDate.from) {
      await createEvent({
        calendar_event_type: "Перенос",
        calendar_event_comment: comment,
        calendar_event_is_global: true,
        calendar_event_is_weekday: false,
        calendar_event_created_by: currentUserId,
        calendar_event_date_start: formatDateToString(workdayDate.from),
        calendar_event_date_end: undefined,
      }, currentUserId)
    }

    // Перенос выходного дня (делаем его рабочим)
    if (weekendDate.from) {
      await createEvent({
        calendar_event_type: "Перенос",
        calendar_event_comment: comment,
        calendar_event_is_global: true,
        calendar_event_is_weekday: true,
        calendar_event_created_by: currentUserId,
        calendar_event_date_start: formatDateToString(weekendDate.from),
        calendar_event_date_end: undefined,
      }, currentUserId)
    }
  }

  // Функция для создания праздничных событий
  const submitHolidayEvent = async () => {
    if (!holidayDate.from || !currentUserId) return

    await createEvent({
      calendar_event_type: "Праздник",
      calendar_event_comment: holidayName,
      calendar_event_is_global: true,
      calendar_event_is_weekday: false,
      calendar_event_created_by: currentUserId,
      calendar_event_date_start: formatDateToString(holidayDate.from),
      calendar_event_date_end: undefined,
    }, currentUserId)
  }

  const submitEvent = async () => {
    if (!isAuthenticated || !currentUserId) return

    setIsSubmitting(true)

    try {
      // Определяем тип события и вызываем соответствующую функцию
      if (activeTab === "transfer" && canCreateGlobalEvents) {
        await submitTransferEvent()
      } else if (activeTab === "holiday" && canCreateGlobalEvents) {
        await submitHolidayEvent()
      } else {
        await submitPersonalEvent()
      }

      onClose()
    } catch (error) {
      console.error("Error adding event:", error)
    } finally {
      setIsSubmitting(false)
      setShowConfirmation(false)
    }
  }

  const handleConfirm = async () => {
    await submitEvent()
  }

  const isFormValid = () => {
    if (activeTab === "transfer") {
      return workdayDate.from || weekendDate.from
    }
    if (activeTab === "holiday") {
      return holidayDate.from && holidayName
    }
    return dateRange.from
  }

  if (!isAuthenticated || !currentUserId) {
    return (
      <div className="p-4 text-center">
        <p>Для изменения рабочего графика необходимо быть авторизованным</p>
      </div>
    )
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="dayoff">Отгул</TabsTrigger>
            <TabsTrigger value="vacation">Отпуск</TabsTrigger>
            <TabsTrigger value="sick">Больничный</TabsTrigger>
            {canCreateGlobalEvents && <TabsTrigger value="transfer">Перенос</TabsTrigger>}
            {canCreateGlobalEvents && <TabsTrigger value="holiday">Праздник</TabsTrigger>}
          </TabsList>

          <TabsContent value="dayoff" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="date-range">Даты отгула</Label>
              <DatePicker
                value={dateRange}
                onChange={setDateRange}
                mode="range"
                placeholder="Выберите дату или период"
                calendarWidth="650px"
                inputWidth="210px"
              />
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

          <TabsContent value="vacation" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="date-range">Период отпуска</Label>
              <DatePicker
                value={dateRange}
                onChange={setDateRange}
                mode="range"
                placeholder="Выберите период отпуска"
                calendarWidth="650px"
                inputWidth="210px"
              />
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

          <TabsContent value="sick" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="date-range">Период больничного</Label>
              <DatePicker
                value={dateRange}
                onChange={setDateRange}
                mode="range"
                placeholder="Выберите период"
                calendarWidth="650px"
                inputWidth="210px"
              />
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

          {canCreateGlobalEvents && (
            <>
              <TabsContent value="transfer" className="space-y-4 pt-4">
                <div className="bg-blue-50 p-3 rounded-md mb-4">
                  <p className="text-sm text-blue-800 font-medium">Общее изменение рабочего графика</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="workday-date">Выберите рабочий день для переноса</Label>
                  <DatePicker
                    value={workdayDate}
                    onChange={setWorkdayDate}
                    mode="single"
                    placeholder="Выберите рабочий день"
                    calendarWidth="650px"
                    inputWidth="210px"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="weekend-date">Выберите выходной день для переноса</Label>
                  <DatePicker
                    value={weekendDate}
                    onChange={setWeekendDate}
                    mode="single"
                    placeholder="Выберите выходной день"
                    calendarWidth="650px"
                    inputWidth="210px"
                  />
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
                <div className="bg-blue-50 p-3 rounded-md mb-4">
                  <p className="text-sm text-blue-800 font-medium">Общее изменение рабочего графика</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="holiday-date">Выберите праздничный день</Label>
                  <DatePicker
                    value={holidayDate}
                    onChange={setHolidayDate}
                    mode="single"
                    placeholder="Выберите праздничный день"
                    calendarWidth="650px"
                    inputWidth="210px"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="holiday-name">Название праздника</Label>
                  <Input
                    id="holiday-name"
                    value={holidayName}
                    onChange={(e) => setHolidayName(e.target.value)}
                    placeholder="Введите название праздника"
                    required
                  />
                </div>
              </TabsContent>
            </>
          )}
        </Tabs>

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={isSubmitting || !isFormValid()}>
            {isSubmitting ? "Добавление..." : "Добавить"}
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
