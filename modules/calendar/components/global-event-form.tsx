"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/modules/calendar/components/ui/button"
import { Input } from "@/modules/calendar/components/ui/input"
import { Label } from "@/modules/calendar/components/ui/label"
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

interface GlobalEventFormProps {
  onClose: () => void
}

export function GlobalEventForm(props: GlobalEventFormProps) {
  const onClose = props.onClose

  const { createEvent } = useCalendarEvents()
  const userStore = useUserStore()
  const currentUserId = userStore.id
  const isAuthenticated = userStore.isAuthenticated
  const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>({
    from: null,
    to: null,
  })
  const [comment, setComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setShowConfirmation(true)
  }

  const handleConfirm = async () => {
    if (!currentUserId || !dateRange.from) return

    setIsSubmitting(true)

    try {
      await createEvent({
        calendar_event_type: "Событие",
        calendar_event_comment: comment,
        calendar_event_is_global: true,
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

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={isSubmitting || !dateRange.from || !comment}>
            Добавить
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
