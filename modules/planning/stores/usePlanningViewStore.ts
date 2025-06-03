import { create } from "zustand"
import { devtools, persist } from "zustand/middleware"

export type TimelineScale = "day" | "week" | "month"

interface PlanningViewState {
  // Настройки отображения
  activeTab: "timeline" | "board" | "calendar"
  currentMonth: string
  nextMonth: string
  showWeekends: boolean
  zoomLevel: number

  // Настройки таймлайна
  startDate: Date
  daysToShow: number
  scale: TimelineScale
  cellWidth: number // Фиксированное значение 22px

  // Действия
  setActiveTab: (tab: "timeline" | "board" | "calendar") => void
  setCurrentMonth: (month: string) => void
  setNextMonth: (month: string) => void
  setZoomLevel: (level: number) => void
  toggleWeekends: () => void
  setStartDate: (date: Date) => void
  setDaysToShow: (days: number) => void
  setScale: (scale: TimelineScale) => void

  // Методы для прокрутки
  scrollForward: () => void
  scrollBackward: () => void
  setCurrentMonthDate: (date: Date) => void
}

// Функция возвращает дату на 30 дней назад от текущей
const getDate30DaysAgo = () => {
  const today = new Date()
  // Отступаем на 30 дней назад от текущей даты
  today.setDate(today.getDate() - 30)
  return today
}

export const usePlanningViewStore = create<PlanningViewState>()(
  devtools(
    persist(
      (set, get) => ({
        // Начальное состояние
        activeTab: "timeline",
        currentMonth: "Март 2025",
        nextMonth: "Апрель 2025",
        showWeekends: true,
        zoomLevel: 1,

        // Настройки таймлайна
        startDate: getDate30DaysAgo(),
        daysToShow: 180,
        scale: "day" as TimelineScale,
        cellWidth: 22, // Фиксированная ширина ячейки в 22px

        // Действия
        setActiveTab: (tab) => set({ activeTab: tab }),
        setCurrentMonth: (month) => set({ currentMonth: month }),
        setNextMonth: (month) => set({ nextMonth: month }),
        setZoomLevel: (level) => set({ zoomLevel: level }),
        toggleWeekends: () => set((state) => ({ showWeekends: !state.showWeekends })),
        setStartDate: (date) => set({ startDate: date }),
        setDaysToShow: (days) => set({ daysToShow: days }),
        setScale: (scale) => set({ scale }),

        // Методы для прокрутки
        scrollForward: () =>
          set((state) => {
            const newStartDate = new Date(state.startDate)
            switch (state.scale) {
              case "day":
                newStartDate.setDate(newStartDate.getDate() + 10)
                break
              case "week":
                newStartDate.setDate(newStartDate.getDate() + 7)
                break
              case "month":
                newStartDate.setMonth(newStartDate.getMonth() + 1)
                break
            }
            return { startDate: newStartDate }
          }),
        scrollBackward: () =>
          set((state) => {
            const newStartDate = new Date(state.startDate)
            switch (state.scale) {
              case "day":
                newStartDate.setDate(newStartDate.getDate() - 10)
                break
              case "week":
                newStartDate.setDate(newStartDate.getDate() - 7)
                break
              case "month":
                newStartDate.setMonth(newStartDate.getMonth() - 1)
                break
            }
            return { startDate: newStartDate }
          }),
        setCurrentMonthDate: (date) => {
          // Валидация: проверяем, что date является валидным объектом Date
          if (!(date instanceof Date) || isNaN(date.getTime())) {
            console.error("Invalid date provided to setCurrentMonthDate:", date)
            return
          }

          // Устанавливаем startDate на первый день выбранного месяца
          const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
          set({ startDate: firstDayOfMonth })

          // Обновляем названия месяцев
          const currentMonthName = date.toLocaleString("ru-RU", { month: "long", year: "numeric" })

          const nextMonthDate = new Date(date)
          nextMonthDate.setMonth(nextMonthDate.getMonth() + 1)
          const nextMonthName = nextMonthDate.toLocaleString("ru-RU", { month: "long", year: "numeric" })

          set({
            currentMonth: currentMonthName,
            nextMonth: nextMonthName,
          })
        },
      }),
      {
        name: "planning-view-storage",
        partialize: (state) => {
          // Проверяем, что startDate является объектом Date перед вызовом toISOString
          const startDateString =
            state.startDate instanceof Date
              ? state.startDate.toISOString()
              : typeof state.startDate === "string"
                ? state.startDate
                : new Date().toISOString()

          return {
            activeTab: state.activeTab,
            showWeekends: state.showWeekends,
            zoomLevel: state.zoomLevel,
            startDate: startDateString,
            daysToShow: state.daysToShow,
            scale: state.scale,
            cellWidth: state.cellWidth,
          }
        },
        merge: (persistedState, currentState) => {
          // Десериализация: преобразуем строку startDate обратно в объект Date
          const parsed = persistedState as any
          if (parsed && typeof parsed.startDate === 'string') {
            parsed.startDate = new Date(parsed.startDate)
          }
          return { ...currentState, ...parsed }
        },
      },
    ),
  ),
)
