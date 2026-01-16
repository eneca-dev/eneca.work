import { create } from "zustand" 
import { devtools, persist } from "zustand/middleware"

interface TimelineUiState {
  // null = смешанное/неопределённое состояние; true = все загрузки свернуты; false = все развернуты
  stageLoadingsCollapsed: boolean | null
  setStageLoadingsCollapsed: (value: boolean | null) => void
}

export const useTimelineUiStore = create<TimelineUiState>()(
  devtools(
    persist(
      (set) => ({
        stageLoadingsCollapsed: null,
        setStageLoadingsCollapsed: (value) => set({ stageLoadingsCollapsed: value }),
      }),
      {
        name: "planning-timeline-ui",
        partialize: (state) => ({
          stageLoadingsCollapsed: state.stageLoadingsCollapsed,
        }),
      },
    ),
  ),
)


