"use client"

import { useState, useEffect, useMemo } from "react"
import { Search, ArrowUpDown, Trash2 } from "lucide-react"
import { Button } from "@/modules/calendar/components/ui/button"
import { Input } from "@/modules/calendar/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/modules/calendar/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/calendar/components/ui/table"
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
import { useCalendarStore } from "@/modules/calendar/store"
import { type CalendarEvent } from "@/modules/calendar/types"
import { useCalendarEvents } from "@/modules/calendar/hooks/useCalendarEvents"
import { useUserStore } from "@/stores/useUserStore"
import { formatDate, getEventColor } from "@/modules/calendar/utils"
import { parseDateFromString } from "@/modules/calendar/utils"
import { cn } from "@/lib/utils"

interface EventsListProps {
  isOpen: boolean
  onClose: () => void
  isGlobal?: boolean
}

export function EventsList(props: EventsListProps) {
  const isOpen = props.isOpen
  const onClose = props.onClose
  const isGlobal = props.isGlobal || false

  const calendarStore = useCalendarStore()
  const setSelectedDate = calendarStore.setSelectedDate
  
  const { events, removeEvent } = useCalendarEvents()

  const userStore = useUserStore()
  const currentUserId = userStore.id
  const isAuthenticated = userStore.isAuthenticated
  const canManageGlobalEvents = useMemo(() => 
    userStore.permissions.includes("calendar.create.global") || 
    userStore.permissions.includes("calendar.edit.global")
  , [userStore.permissions])

  const [searchTerm, setSearchTerm] = useState("")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [eventToDelete, setEventToDelete] = useState<string | null>(null)

  // Calculate filtered events based on current state
  const filteredEvents = useMemo(() => {
    if (!isAuthenticated || !currentUserId) return []

    let filtered = [...events]

    // Filter by global flag
    filtered = filtered.filter((event) => event.calendar_event_is_global === isGlobal)

    // If not global, only show user's events
    if (!isGlobal) {
      filtered = filtered.filter((event) => event.calendar_event_created_by === currentUserId)
    }

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (event) =>
          event.calendar_event_comment?.toLowerCase().includes(term) ||
          event.calendar_event_type.toLowerCase().includes(term) ||
          formatDate(parseDateFromString(event.calendar_event_date_start)).includes(term),
      )
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const dateA = parseDateFromString(a.calendar_event_date_start).getTime()
      const dateB = parseDateFromString(b.calendar_event_date_start).getTime()
      return sortDirection === "asc" ? dateA - dateB : dateB - dateA
    })

    return filtered
  }, [events, currentUserId, isGlobal, isAuthenticated, searchTerm, sortDirection])

  const handleSort = () => {
    setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
  }

  const handleDelete = async () => {
    if (!eventToDelete || !currentUserId) return

    try {
      await removeEvent(eventToDelete, currentUserId)
      setEventToDelete(null)
    } catch (error) {
      // Ошибка уже обрабатывается в removeEvent
    }
  }

  const handleShowOnCalendar = (event: CalendarEvent) => {
    setSelectedDate(parseDateFromString(event.calendar_event_date_start))
    onClose()
  }

  // Check if user can delete an event
  const canDeleteEvent = (event: CalendarEvent) => {
    // Admin can delete any event
    if (canManageGlobalEvents) return true

    // Regular user can only delete their own events
    return event.calendar_event_created_by === currentUserId
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isGlobal ? "Общие события и изменения" : "Мои события и изменения"}</DialogTitle>
          <DialogDescription>
            Просмотр и управление {isGlobal ? "общими" : "личными"} событиями календаря
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center space-x-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по названию, типу или дате"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button variant="outline" size="icon" onClick={handleSort}>
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Тип</TableHead>
              <TableHead>Название/Комментарий</TableHead>
              <TableHead>Дата начала</TableHead>
              <TableHead>Дата окончания</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEvents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-4">
                  Нет событий для отображения
                </TableCell>
              </TableRow>
            ) : (
              filteredEvents.map((event) => (
                <TableRow key={event.calendar_event_id}>
                  <TableCell>
                    <span
                      className={cn("px-2 py-1 rounded text-xs font-medium", getEventColor(event.calendar_event_type))}
                    >
                      {event.calendar_event_type}
                    </span>
                  </TableCell>
                  <TableCell>{event.calendar_event_comment || "-"}</TableCell>
                  <TableCell>{formatDate(parseDateFromString(event.calendar_event_date_start))}</TableCell>
                  <TableCell>
                    {event.calendar_event_date_end ? formatDate(parseDateFromString(event.calendar_event_date_end)) : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleShowOnCalendar(event)}>
                        Показать
                      </Button>
                      {canDeleteEvent(event) && (
                        <Button variant="ghost" size="sm" onClick={() => setEventToDelete(event.calendar_event_id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={!!eventToDelete} onOpenChange={() => setEventToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Подтверждение удаления</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить это событие? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
