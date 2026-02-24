import type { KanbanStage } from '../types'
import type { DecompositionStage } from '@/modules/resource-graph/types'

/**
 * Адаптер для конвертации KanbanStage в DecompositionStage (для StageModal)
 */
export function convertToDecompositionStage(stage: KanbanStage): DecompositionStage {
  return {
    id: stage.id,
    name: stage.name,
    startDate: stage.startDate || null,
    finishDate: stage.endDate || null,
    status: {
      id: stage.statusId || null,
      name: stage.status,
      color: null,
    },
    items: stage.tasks.map((task, index) => ({
      id: task.id,
      stageId: stage.id,
      description: task.description,
      plannedHours: task.plannedHours,
      plannedDueDate: task.dueDate || null,
      progress: task.progress,
      progressDelta: null,
      progressHistory: [],
      order: task.order ?? index,
      responsible: {
        id: task.responsible?.userId || null,
        firstName: task.responsible?.firstName || null,
        lastName: task.responsible?.lastName || null,
        name: null,
      },
      status: {
        id: null,
        name: null,
        color: null,
      },
      difficulty: {
        id: null,
        abbr: null,
        name: null,
      },
      workCategoryId: null,
      workCategoryName: task.workCategory || null,
      budget: {
        id: null,
        total: 0,
        spent: 0,
        remaining: 0,
      },
    })),
  }
}
