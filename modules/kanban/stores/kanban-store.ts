import { create } from 'zustand'
import type {
  KanbanBoard,
  KanbanSection,
  KanbanStage,
  KanbanTask,
  StageStatus,
  KanbanViewSettings,
} from '../types'
import { transformMockDataToKanbanBoard } from '../utils/transform-data'

interface KanbanState {
  // Данные доски
  board: KanbanBoard | null
  isLoading: boolean
  error: string | null

  // Выбранный этап для детального просмотра
  selectedStage: KanbanStage | null
  selectedSection: KanbanSection | null

  // Настройки отображения
  viewSettings: KanbanViewSettings

  // Действия
  loadBoard: () => void
  moveStage: (stageId: string, sectionId: string, newStatus: StageStatus) => void
  updateTaskProgress: (
    sectionId: string,
    stageId: string,
    taskId: string,
    progress: number
  ) => void
  updateTaskPlannedHours: (
    sectionId: string,
    stageId: string,
    taskId: string,
    plannedHours: number
  ) => void
  selectStage: (stage: KanbanStage | null, section: KanbanSection | null) => void
  toggleSectionCollapse: (sectionId: string) => void
  toggleCollapseAll: () => void
  setShowEmptySwimlanes: (show: boolean) => void
}

// Пересчёт прогресса этапа
function recalculateStageProgress(stage: KanbanStage): KanbanStage {
  const totalHours = stage.tasks.reduce((sum, t) => sum + t.plannedHours, 0)
  if (totalHours === 0) return { ...stage, progress: 0 }
  const completedHours = stage.tasks.reduce(
    (sum, t) => sum + (t.plannedHours * t.progress) / 100,
    0
  )
  return { ...stage, progress: Math.round((completedHours / totalHours) * 100) }
}

// Пересчёт прогресса раздела
function recalculateSectionProgress(section: KanbanSection): KanbanSection {
  const totalHours = section.stages.reduce((sum, s) => sum + s.plannedHours, 0)
  if (totalHours === 0) return { ...section, overallProgress: 0 }
  const completedHours = section.stages.reduce(
    (sum, s) => sum + (s.plannedHours * s.progress) / 100,
    0
  )
  return {
    ...section,
    overallProgress: Math.round((completedHours / totalHours) * 100),
  }
}

export const useKanbanStore = create<KanbanState>((set, get) => ({
  board: null,
  isLoading: false,
  error: null,
  selectedStage: null,
  selectedSection: null,
  viewSettings: {
    showEmptySwimlanes: true,
    collapsedSections: [],
    filterByResponsible: undefined,
  },

  loadBoard: () => {
    set({ isLoading: true, error: null })
    try {
      const board = transformMockDataToKanbanBoard()
      set({ board, isLoading: false })
    } catch (e) {
      set({ error: 'Ошибка загрузки данных', isLoading: false })
    }
  },

  moveStage: (stageId: string, sectionId: string, newStatus: StageStatus) => {
    const { board } = get()
    if (!board) return

    const updatedSections = board.sections.map((section) => {
      if (section.id !== sectionId) return section

      const updatedStages = section.stages.map((stage) => {
        if (stage.id !== stageId) return stage
        return { ...stage, status: newStatus }
      })

      return recalculateSectionProgress({ ...section, stages: updatedStages })
    })

    set({ board: { ...board, sections: updatedSections } })
  },

  updateTaskProgress: (
    sectionId: string,
    stageId: string,
    taskId: string,
    progress: number
  ) => {
    const { board, selectedStage, selectedSection } = get()
    if (!board) return

    const updatedSections = board.sections.map((section) => {
      if (section.id !== sectionId) return section

      const updatedStages = section.stages.map((stage) => {
        if (stage.id !== stageId) return stage

        const updatedTasks = stage.tasks.map((task) => {
          if (task.id !== taskId) return task
          return { ...task, progress: Math.min(100, Math.max(0, progress)) }
        })

        return recalculateStageProgress({ ...stage, tasks: updatedTasks })
      })

      return recalculateSectionProgress({ ...section, stages: updatedStages })
    })

    const newBoard = { ...board, sections: updatedSections }

    // Обновляем также выбранный этап, если он открыт
    let newSelectedStage = selectedStage
    let newSelectedSection = selectedSection

    if (selectedStage && selectedSection) {
      const updatedSection = updatedSections.find(s => s.id === selectedSection.id)
      const updatedStage = updatedSection?.stages.find(s => s.id === selectedStage.id)
      if (updatedSection && updatedStage) {
        newSelectedStage = updatedStage
        newSelectedSection = updatedSection
      }
    }

    set({
      board: newBoard,
      selectedStage: newSelectedStage,
      selectedSection: newSelectedSection,
    })
  },

  updateTaskPlannedHours: (
    sectionId: string,
    stageId: string,
    taskId: string,
    plannedHours: number
  ) => {
    const { board } = get()
    if (!board) return

    const updatedSections = board.sections.map((section) => {
      if (section.id !== sectionId) return section

      const updatedStages = section.stages.map((stage) => {
        if (stage.id !== stageId) return stage

        const updatedTasks = stage.tasks.map((task) => {
          if (task.id !== taskId) return task
          return { ...task, plannedHours: Math.max(0, plannedHours) }
        })

        // Пересчитываем общие плановые часы этапа
        const totalPlannedHours = updatedTasks.reduce((sum, t) => sum + t.plannedHours, 0)
        const totalActualHours = updatedTasks.reduce((sum, t) => sum + t.actualHours, 0)

        return recalculateStageProgress({
          ...stage,
          tasks: updatedTasks,
          plannedHours: totalPlannedHours,
          actualHours: totalActualHours,
        })
      })

      // Пересчитываем общие плановые часы раздела
      const totalPlannedHours = updatedStages.reduce((sum, s) => sum + s.plannedHours, 0)
      const totalActualHours = updatedStages.reduce((sum, s) => sum + s.actualHours, 0)

      return recalculateSectionProgress({
        ...section,
        stages: updatedStages,
        totalPlannedHours,
        totalActualHours,
      })
    })

    set({ board: { ...board, sections: updatedSections } })
  },

  selectStage: (stage: KanbanStage | null, section: KanbanSection | null) => {
    set({ selectedStage: stage, selectedSection: section })
  },

  toggleSectionCollapse: (sectionId: string) => {
    const { viewSettings } = get()
    const collapsed = viewSettings.collapsedSections.includes(sectionId)
    set({
      viewSettings: {
        ...viewSettings,
        collapsedSections: collapsed
          ? viewSettings.collapsedSections.filter((id) => id !== sectionId)
          : [...viewSettings.collapsedSections, sectionId],
      },
    })
  },

  toggleCollapseAll: () => {
    const { board, viewSettings } = get()
    if (!board) return

    const allSectionIds = board.sections.map((s) => s.id)
    const allCollapsed = allSectionIds.every((id) =>
      viewSettings.collapsedSections.includes(id)
    )

    set({
      viewSettings: {
        ...viewSettings,
        collapsedSections: allCollapsed ? [] : allSectionIds,
      },
    })
  },

  setShowEmptySwimlanes: (show: boolean) => {
    const { viewSettings } = get()
    set({ viewSettings: { ...viewSettings, showEmptySwimlanes: show } })
  },
}))
