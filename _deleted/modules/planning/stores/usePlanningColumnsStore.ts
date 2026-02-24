import { create } from "zustand" 
import { devtools, persist } from "zustand/middleware"

// Определяем интерфейс для видимости столбцов в планировании
export interface ColumnVisibility {
  project: boolean
  object: boolean
  stage: boolean
  startDate: boolean
  endDate: boolean
  sectionResponsible: boolean
  specialist: boolean
}

interface PlanningColumnsState {
  // Видимость столбцов
  columnVisibility: ColumnVisibility

  // Действия
  toggleColumnVisibility: (columnName: keyof ColumnVisibility) => void
  setColumnVisibility: (columnName: keyof ColumnVisibility, isVisible: boolean) => void
  resetColumnVisibility: () => void
}

// Начальное состояние видимости столбцов
const initialColumnVisibility: ColumnVisibility = {
  project: true,
  object: false, // Скрываем столбец "Объект"
  stage: true,
  startDate: true,
  endDate: true,
  sectionResponsible: true,
  specialist: false
}

export const usePlanningColumnsStore = create<PlanningColumnsState>()(
  devtools(
    persist(
      (set) => ({
        // Начальное состояние
        columnVisibility: initialColumnVisibility,

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
