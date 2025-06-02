"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/modules/calendar/components/ui/button"
import { Label } from "@/modules/calendar/components/ui/label"
import { Textarea } from "@/modules/calendar/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/modules/calendar/components/ui/tabs"
import { useCalendarEvents } from "@/modules/calendar/hooks/useCalendarEvents"
import { useUserStore } from "@/stores/useUserStore"
import { DatePicker } from "@/modules/calendar/components/mini-calendar"
import { formatDateToString } from "@/modules/calendar/utils"

interface WorkScheduleFormProps {
  onClose: () => void
}

export function WorkScheduleForm(props: WorkScheduleFormProps) {
  const onClose = props.onClose

  const { createEvent } = useCalendarEvents()
  const userStore = useUserStore()
  const currentUserId = userStore.id
  const isAuthenticated = userStore.isAuthenticated
  const [activeTab, setActiveTab] = useState("dayoff")
  const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>({
    from: null,
    to: null,
  })
  const [comment, setComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentUserId) return
    if (!dateRange.from) return
    if (["vacation", "sick"].includes(activeTab) && !dateRange.to) {
      // TODO: surface a form error to the user
      return
    }

    setIsSubmitting(true)

    try {
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

      onClose()
    } catch (error) {
      // Ошибка уже обрабатывается в createEvent
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3">
          <TabsTrigger value="dayoff">Отгул</TabsTrigger>
          <TabsTrigger value="vacation">Отпуск</TabsTrigger>
          <TabsTrigger value="sick">Больничный</TabsTrigger>
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
              placeholder="Выберите период больничного"
              calendarWidth="650px"
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
      </Tabs>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Отмена
        </Button>
        <Button type="submit" disabled={isSubmitting || !dateRange.from}>
          {isSubmitting ? "Добавление..." : "Добавить"}
        </Button>
      </div>
    </form>
  )
}
