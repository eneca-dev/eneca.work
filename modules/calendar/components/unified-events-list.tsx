"use client"

import { useState, useEffect, useMemo } from "react"
import { Search, ArrowUpDown, Trash2 } from "lucide-react"
import { Button } from "@/modules/calendar/components/ui/button"
import { Input } from "@/modules/calendar/components/ui/input"
import { Switch } from "@/modules/calendar/components/ui/switch"
import { Label } from "@/modules/calendar/components/ui/label"
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

interface UnifiedEventsListProps {
  isOpen: boolean
  onClose: () => void
}

export function UnifiedEventsList(props: UnifiedEventsListProps) {
  const isOpen = props.isOpen
  const onClose = props.onClose

  const calendarStore = useCalendarStore()
  const setSelectedDate = calendarStore.setSelectedDate
  
  const { events, removeEvent } = useCalendarEvents()

  const userStore = useUserStore()
  const currentUserId = userStore.id
  const isAuthenticated = userStore.isAuthenticated
  
  // Проверяем права на создание и удаление глобальных событий - ОПТИМИЗИРОВАННО
  const canManageGlobalEvents = useMemo(() => {
    // Кэшируем результат, чтобы не делать повторные проверки
    const hasCalendarAdmin = userStore.permissions.includes("calendar.admin")
    const hasGlobalEventsPermission = userStore.permissions.includes("calendar_can_create_and_edit_global_events")
    const result = hasCalendarAdmin || hasGlobalEventsPermission

    console.log('🔐 ПРОВЕРКА РАЗРЕШЕНИЙ В СПИСКЕ СОБЫТИЙ (useMemo CACHED):', {
      userId: userStore.id,
      userRole: userStore.role,
      userPermissions: userStore.permissions,
      hasCalendarAdmin,
      hasGlobalEventsPermission,
      canManageGlobalEvents: result,
      profile: userStore.profile
    })
    
    return result
  }, [userStore.id, userStore.role, userStore.permissions])

  const [filteredEvents, setFilteredEvents] = useState<CalendarEvent[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [eventToDelete, setEventToDelete] = useState<string | null>(null)
  const [showPersonalEvents, setShowPersonalEvents] = useState(true)
  const [showGlobalEvents, setShowGlobalEvents] = useState(true)

  // Filter events based on toggles and current user
  useEffect(() => {
    if (!isAuthenticated || !currentUserId) return

    let filtered = [...events]

    // Filter by personal/global toggles
    filtered = filtered.filter((event) => {
      if (event.calendar_event_is_global) {
        return showGlobalEvents
      } else {
        return showPersonalEvents && event.calendar_event_created_by === currentUserId
      }
    })

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

    setFilteredEvents(filtered)
  }, [events, currentUserId, isAuthenticated, searchTerm, sortDirection, showPersonalEvents, showGlobalEvents])

  const handleSort = () => {
    setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
  }

  const handleDelete = async () => {
    if (!eventToDelete || !currentUserId) return

    try {
      await removeEvent(eventToDelete, currentUserId)
      setEventToDelete(null)
    } catch (error) {
      console.error("Error deleting event:", error)
    }
  }

  const handleShowOnCalendar = (event: CalendarEvent) => {
    setSelectedDate(parseDateFromString(event.calendar_event_date_start))
    onClose()
  }

  // Check if user can delete an event
  const canDeleteEvent = (event: CalendarEvent) => {
    // User with global events permission can delete any event
    if (canManageGlobalEvents) return true

    // Regular user can only delete their own events
    return event.calendar_event_created_by === currentUserId
  }

  if (!isAuthenticated || !currentUserId) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="!max-w-4xl sm:!max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Авторизация</DialogTitle>
          </DialogHeader>
          <div className="p-4 text-center">
            <p>Для просмотра событий необходимо быть авторизованным</p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="!max-w-4xl sm:!max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Просмотреть все события и график</DialogTitle>
          <DialogDescription>Просмотр и управление событиями календаря</DialogDescription>
        </DialogHeader>

        {/* Filter toggles */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <Switch id="show-personal" checked={showPersonalEvents} onCheckedChange={setShowPersonalEvents} />
              <Label htmlFor="show-personal">Свои события и график</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch id="show-global" checked={showGlobalEvents} onCheckedChange={setShowGlobalEvents} />
              <Label htmlFor="show-global">Общие события и график</Label>
            </div>
          </div>
        </div>

        {/* Search and sort */}
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
              <TableHead>Область</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEvents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-4">
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
                  <TableCell>
                    <span
                      className={cn(
                        "px-2 py-1 rounded text-xs",
                        event.calendar_event_is_global ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800",
                      )}
                    >
                      {event.calendar_event_is_global ? "Общее" : "Личное"}
                    </span>
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
