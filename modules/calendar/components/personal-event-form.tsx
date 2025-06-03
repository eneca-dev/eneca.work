"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/modules/calendar/components/ui/button"
import { Input } from "@/modules/calendar/components/ui/input"
import { Label } from "@/modules/calendar/components/ui/label"
import { useCalendarEvents } from "@/modules/calendar/hooks/useCalendarEvents"
import { useUserStore } from "@/stores/useUserStore"
import { DatePicker } from "@/modules/calendar/components/mini-calendar"
import { formatDateToString } from "@/modules/calendar/utils"

interface PersonalEventFormProps {
  onClose: () => void
}

export function PersonalEventForm(props: PersonalEventFormProps) {
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
  const [errorMessage, setErrorMessage] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentUserId || !dateRange.from) return

    setIsSubmitting(true)
    setErrorMessage("") // Очищаем предыдущие ошибки

    try {
      await createEvent({
        calendar_event_type: "Событие",
        calendar_event_comment: comment,
        calendar_event_is_global: false,
        calendar_event_is_weekday: null,
        calendar_event_created_by: currentUserId,
        calendar_event_date_start: formatDateToString(dateRange.from),
        calendar_event_date_end: dateRange.to ? formatDateToString(dateRange.to) : undefined,
      }, currentUserId)

      onClose()
    } catch (error) {
      // Ошибка уже обрабатывается в createEvent
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMessage && (
        <div className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
          {errorMessage}
        </div>
      )}

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
          {isSubmitting ? "Добавление..." : "Добавить"}
        </Button>
      </div>
    </form>
  )
}
