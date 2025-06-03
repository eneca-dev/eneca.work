import { create } from "zustand"
import { devtools, persist } from "zustand/middleware"

// Обновляем интерфейс для столбцов, добавляя новые столбцы
export interface ColumnVisibility {
  project: boolean
  object: boolean
  stage: boolean
  startDate: boolean
  endDate: boolean
  sectionResponsible: boolean
  specialist: boolean // Оставляем для совместимости, но не используем
}

// Поскольку мы теперь используем фиксированные значения, можно упростить интерфейс ColumnWidths
// Оставляем его для обратной совместимости, но он больше не будет использоваться для расчета ширины
export interface ColumnWidths {
  project: number
  object: number
  stage: number
  section: number
  startDate: number
  endDate: number
  sectionResponsible: number
  specialist: number
}

interface PlanningColumnsState {
  // Видимость столбцов
  columnVisibility: ColumnVisibility

  // Ширина столбцов (множитель относительно базовой ширины)
  columnWidths: ColumnWidths

  // Действия
  toggleColumnVisibility: (columnName: keyof ColumnVisibility) => void
  setColumnVisibility: (columnName: keyof ColumnVisibility, isVisible: boolean) => void
  resetColumnVisibility: () => void
}

// Обновляем начальное состояние видимости столбцов
const initialColumnVisibility: ColumnVisibility = {
  project: true,
  object: true,
  stage: true,
  startDate: true,
  endDate: true,
  sectionResponsible: true,
  specialist: false, // Скрываем столбец specialist по умолчанию
}

// Начальное состояние ширины столбцов (множители) - оставляем для обратной совместимости
const initialColumnWidths: ColumnWidths = {
  project: 1,
  object: 0.8,
  stage: 0.4,
  section: 1.5,
  startDate: 0.6,
  endDate: 0.6,
  sectionResponsible: 0.8,
  specialist: 0.8,
}

export const usePlanningColumnsStore = create<PlanningColumnsState>()(
  devtools(
    persist(
      (set) => ({
        // Начальное состояние
        columnVisibility: initialColumnVisibility,
        columnWidths: initialColumnWidths,

        // Переключение видимости столбца
        toggleColumnVisibility: (columnName) => {
          set((state) => ({
            columnVisibility: {
              ...state.columnVisibility,
              [columnName]: !state.columnVisibility[columnName],
            },
          }))
        },

        // Установка видимости столбца
        setColumnVisibility: (columnName, isVisible) => {
          set((state) => ({
            columnVisibility: {
              ...state.columnVisibility,
              [columnName]: isVisible,
            },
          }))
        },

        // Сброс видимости столбцов к начальному состоянию
        resetColumnVisibility: () => {
          set({
            columnVisibility: initialColumnVisibility,
          })
        },
      }),
      {
        name: "planning-columns-storage",
      },
    ),
  ),
)
