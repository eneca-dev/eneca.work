import { create } from "zustand"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"

export interface CalendarEvent {
  calendar_event_id: string
  calendar_event_type: "Отгул" | "Больничный" | "Перенос" | "Отпуск запрошен" | "Отпуск одобрен" | "Отпуск отклонен" | "Праздник" | "Событие"
  calendar_event_comment?: string
  calendar_event_is_global: boolean
  calendar_event_is_weekday: boolean | null
  calendar_event_created_by: string
  calendar_event_date_start: string
  calendar_event_date_end?: string
}

interface CalendarState {
  currentDate: Date
  selectedDate: Date | null
  events: CalendarEvent[]
  isLoading: boolean
  error: string | null
}

interface CalendarActions {
  setCurrentDate: (date: Date) => void
  setSelectedDate: (date: Date | null) => void
  clearError: () => void
  fetchEvents: () => Promise<void>
  addEvent: (event: Omit<CalendarEvent, "calendar_event_id">) => Promise<void>
  deleteEvent: (eventId: string) => Promise<void>
}

type CalendarStore = CalendarState & CalendarActions

export const useCalendarStore = create<CalendarStore>((set, get) => {
  return {
    // State
    currentDate: new Date(),
    selectedDate: null,
    events: [],
    isLoading: false,
    error: null,

    // Actions
    setCurrentDate: (date: Date) => {
      set({ currentDate: date })
    },

    setSelectedDate: (date: Date | null) => {
      set({ selectedDate: date })
    },

    clearError: () => {
      set({ error: null })
    },

    fetchEvents: async () => {
      console.log("fetchEvents: Starting to fetch events...")
      set({ isLoading: true, error: null })
      try {
        const supabase = createClient()
        const response = await supabase.from("calendar_events").select("*")
        console.log("fetchEvents: Response received:", response)

        if (response.error) throw response.error

        set({
          events: response.data || [],
          isLoading: false,
        })
        console.log("fetchEvents: Events set successfully, count:", (response.data || []).length)
      } catch (error) {
        console.error("Error fetching events:", error)
        const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка"
        
        set({ 
          isLoading: false,
          error: errorMessage
        })
        
        toast.error("Ошибка загрузки событий", {
          description: errorMessage,
          duration: 5000,
        })
      }
    },

    addEvent: async (event) => {
      set({ isLoading: true, error: null })
      try {
        const supabase = createClient()
        const response = await supabase.from("calendar_events").insert([event]).select()

        if (response.error) throw response.error

        toast.success("Событие добавлено", {
          description: "Событие успешно добавлено в календарь",
          duration: 4000,
        })

        // Refresh events after adding
        const state = get()
        await state.fetchEvents()
      } catch (error) {
        console.error("Error adding event:", error)
        const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка"
        
        set({ 
          isLoading: false,
          error: errorMessage
        })
        
        toast.error("Ошибка добавления события", {
          description: errorMessage,
          duration: 5000,
        })
      }
    },

    deleteEvent: async (eventId: string) => {
      set({ isLoading: true, error: null })
      try {
        const supabase = createClient()
        const response = await supabase.from("calendar_events").delete().eq("calendar_event_id", eventId)

        if (response.error) throw response.error

        toast.success("Событие удалено", {
          description: "Событие успешно удалено из календаря",
          duration: 4000,
        })

        // Refresh events after deleting
        const state = get()
        await state.fetchEvents()
      } catch (error) {
        console.error("Error deleting event:", error)
        const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка"
        
        set({ 
          isLoading: false,
          error: errorMessage
        })
        
        toast.error("Ошибка удаления события", {
          description: errorMessage,
          duration: 5000,
        })
      }
    },
  }
})
