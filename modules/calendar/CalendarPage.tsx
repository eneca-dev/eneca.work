"use client"

import { useState, useEffect, useMemo } from "react"
import { CalendarHeader } from "@/modules/calendar/components/calendar-header"
import { CalendarGrid } from "@/modules/calendar/components/calendar-grid"
import { Button } from "@/modules/calendar/components/ui/button"
import { Switch } from "@/modules/calendar/components/ui/switch"
import { Label } from "@/modules/calendar/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/modules/calendar/components/ui/dialog"
import { UnifiedEventForm } from "@/modules/calendar/components/unified-event-form"
import { UnifiedWorkScheduleForm } from "@/modules/calendar/components/unified-work-schedule-form"
import { UnifiedEventsList } from "@/modules/calendar/components/unified-events-list"
import { useUserStore } from "@/stores/useUserStore"
import { useUiStore } from "@/stores/useUiStore"
import { useCalendarEvents } from "@/modules/calendar/hooks/useCalendarEvents"
import { useWorkSchedule } from "@/modules/calendar/hooks/useWorkSchedule"

export default function CalendarPage() {
  const userStore = useUserStore()
  const uiStore = useUiStore()
  const { fetchEvents } = useCalendarEvents()
  const { fetchWorkSchedules } = useWorkSchedule()

  const [activeDialog, setActiveDialog] = useState<string | null>(null)
  const [showEventsList, setShowEventsList] = useState(false)

  // Загружаем события когда пользователь определен
  useEffect(() => {
    const currentUserId = userStore.id
    if (currentUserId && userStore.isAuthenticated) {
      fetchEvents(currentUserId)
      fetchWorkSchedules(currentUserId)
    }
  }, [userStore.id, userStore.isAuthenticated, fetchEvents, fetchWorkSchedules])

  // Проверяем права на создание глобальных событий (календарь) - ОПТИМИЗИРОВАННО
  const canCreateGlobalEvents = useMemo(() => {
    const result = userStore.hasPermission("calendar.admin") || 
                   userStore.hasPermission("calendar_can_create_and_edit_global_events")
    
    return result
  }, [userStore.id, userStore.role, userStore.permissions])

  const currentUser = userStore

  const handleCloseDialog = () => {
    setActiveDialog(null)
  }

  if (!userStore.isAuthenticated || !userStore.id) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Пожалуйста, войдите в систему</h2>
          <p>Для доступа к календарю необходимо быть авторизованным</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <h1 className="text-6xl font-bold mb-6" style={{ fontSize: '4rem !important', lineHeight: '1.1' }}>Календарь</h1>

      <div className="mb-6 space-y-4">
        {/* Toggles and action buttons in the same line */}
        <div className="flex items-center justify-between">
          {/* Toggles on the left */}
          <div className="flex items-center gap-6">


            <div className="flex items-center space-x-2">
              <Switch
                id="show-personal-events"
                checked={uiStore.showPersonalEvents}
                onCheckedChange={uiStore.togglePersonalEvents}
              />
              <Label htmlFor="show-personal-events">Свои события и график</Label>
            </div>
          </div>

          {/* Action buttons on the right */}
          <div className="flex flex-wrap gap-4">
            <Button onClick={() => setActiveDialog("event")}>Добавить событие</Button>
            <Button onClick={() => setActiveDialog("work-schedule")}>Изменить рабочий график</Button>
          </div>
        </div>

        {/* Underlined link moved to the right */}
        <div className="flex justify-end">
          <Button
            variant="link"
            className="p-0 h-auto underline decoration-solid"
            onClick={() => setShowEventsList(true)}
          >
            Просмотреть все события и график
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4">
        <CalendarHeader />
        <CalendarGrid />
      </div>

      {/* Dialogs */}
      <Dialog open={activeDialog === "event"} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить событие</DialogTitle>
          </DialogHeader>
          <UnifiedEventForm onClose={handleCloseDialog} />
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === "work-schedule"} onOpenChange={handleCloseDialog}>
        <DialogContent className="!max-w-4xl sm:!max-w-4xl">
          <DialogHeader>
            <DialogTitle>Изменить рабочий график</DialogTitle>
          </DialogHeader>
          <UnifiedWorkScheduleForm onClose={handleCloseDialog} />
        </DialogContent>
      </Dialog>

      {/* Unified Events List */}
      <UnifiedEventsList isOpen={showEventsList} onClose={() => setShowEventsList(false)} />
    </div>
  )
} 