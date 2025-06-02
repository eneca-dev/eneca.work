"use client"

import type React from "react"

import { useState, useMemo } from "react"
import { Button } from "@/modules/calendar/components/ui/button"
import { Input } from "@/modules/calendar/components/ui/input"
import { Label } from "@/modules/calendar/components/ui/label"
import { Checkbox } from "@/modules/calendar/components/ui/checkbox"
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
import { DatePicker } from "@/modules/calendar/components/mini-calendar"
import { formatDateToString } from "@/modules/calendar/utils"

interface UnifiedEventFormProps {
  onClose: () => void
}

export function UnifiedEventForm(props: UnifiedEventFormProps) {
  const onClose = props.onClose

  const { createEvent } = useCalendarEvents()
  const userStore = useUserStore()
  const currentUserId = userStore.id
  const isAuthenticated = userStore.isAuthenticated
  
  // Проверяем права на создание глобальных событий - ОПТИМИЗИРОВАННО
  const canCreateGlobalEvents = useMemo(() => {
    // Кэшируем результат, чтобы не делать повторные проверки
    const permissions = userStore.permissions || []
    const hasCalendarAdmin = permissions.includes("calendar.admin")
    const hasGlobalEventsPermission = permissions.includes("calendar_can_create_and_edit_global_events")
    const result = hasCalendarAdmin || hasGlobalEventsPermission

    console.log('🔐 ПРОВЕРКА РАЗРЕШЕНИЙ В ФОРМЕ СОБЫТИЙ (useMemo CACHED):', {
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

  const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>({
    from: null,
    to: null,
  })
  const [comment, setComment] = useState("")
  const [isGlobal, setIsGlobal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isGlobal && canCreateGlobalEvents) {
      setShowConfirmation(true)
    } else {
      await submitEvent()
    }
  }

  const submitEvent = async () => {
    if (!isAuthenticated || !currentUserId || !dateRange.from) return

    setIsSubmitting(true)

    try {
      await createEvent({
        calendar_event_type: "Событие",
        calendar_event_comment: comment,
        calendar_event_is_global: canCreateGlobalEvents ? isGlobal : false,
        calendar_event_is_weekday: null,
        calendar_event_created_by: currentUserId,
        calendar_event_date_start: formatDateToString(dateRange.from),
        calendar_event_date_end: dateRange.to ? formatDateToString(dateRange.to) : undefined,
      }, currentUserId)

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

  if (!isAuthenticated || !currentUserId) {
    return (
      <div className="p-4 text-center">
        <p>Для создания событий необходимо быть авторизованным</p>
      </div>
    )
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="date-range">Период события</Label>
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
          <Label htmlFor="comment">Название события</Label>
          <Input
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Введите название события"
            required
          />
        </div>

        {canCreateGlobalEvents && (
          <div className="flex items-center space-x-2">
            <Checkbox id="is-global" checked={isGlobal} onCheckedChange={(checked) => setIsGlobal(!!checked)} />
            <Label htmlFor="is-global">Сделать событие общим</Label>
          </div>
        )}

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={isSubmitting || !dateRange.from || !comment}>
            {isSubmitting ? "Добавление..." : "Добавить"}
          </Button>
        </div>
      </form>

      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Подтверждение</AlertDialogTitle>
            <AlertDialogDescription>
              Вы добавляете событие в общий календарь компании. Вы уверены?
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
