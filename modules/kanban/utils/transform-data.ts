import type {
  KanbanBoard,
  KanbanSection,
  KanbanStage,
  KanbanTask,
  StageStatus,
  SectionStatus,
} from '../types'
import { kronoshanProjectData } from '../kronospan-mock-data'

// Преобразование задачи из моковых данных
function transformTask(item: (typeof kronoshanProjectData.project.stages[0]['objects'][0]['sections'][0]['decomposition_stages'][0]['decomposition_items'])[0], index: number): KanbanTask {
  return {
    id: item.decomposition_item_id,
    description: item.decomposition_item_description,
    responsible: null,
    plannedHours: item.decomposition_item_planned_hours,
    actualHours: 0,
    progress: item.decomposition_item_progress,
    dueDate: item.decomposition_item_planned_due_date,
    order: item.decomposition_item_order ?? index,
    workCategory: item.work_category_name ?? null,
  }
}

// Расчёт прогресса этапа на основе задач
function calculateStageProgress(tasks: KanbanTask[]): number {
  if (tasks.length === 0) return 0
  const totalHours = tasks.reduce((sum, t) => sum + t.plannedHours, 0)
  if (totalHours === 0) return 0
  const completedHours = tasks.reduce(
    (sum, t) => sum + (t.plannedHours * t.progress) / 100,
    0
  )
  return Math.round((completedHours / totalHours) * 100)
}

// Определение статуса этапа на основе прогресса
function determineStageStatus(
  progress: number,
  index: number,
  total: number
): StageStatus {
  if (progress === 100) return 'done'
  if (progress > 0) return 'in_progress'
  if (index === 0) return 'planned'
  return 'backlog'
}

// Преобразование decomposition_stage в KanbanStage
function transformStage(
  stage: (typeof kronoshanProjectData.project.stages[0]['objects'][0]['sections'][0]['decomposition_stages'])[0],
  sectionId: string,
  index: number,
  total: number
): KanbanStage {
  const tasks = (stage.decomposition_items || []).map((item, i) =>
    transformTask(item, i)
  )

  const plannedHours = tasks.reduce((sum, t) => sum + t.plannedHours, 0)
  const actualHours = tasks.reduce((sum, t) => sum + t.actualHours, 0)
  const progress = calculateStageProgress(tasks)
  const status = determineStageStatus(progress, index, total)

  return {
    id: stage.decomposition_stage_id,
    name: stage.decomposition_stage_name,
    description: stage.decomposition_stage_description ?? null,
    status,
    sectionId,
    startDate: stage.decomposition_stage_start ?? null,
    endDate: stage.decomposition_stage_finish ?? null,
    order: stage.decomposition_stage_order ?? index,
    tasks,
    plannedHours,
    actualHours,
    progress,
  }
}

// Определение статуса раздела на основе этапов
function determineSectionStatus(stages: KanbanStage[]): SectionStatus {
  if (stages.length === 0) return 'planned'
  const allDone = stages.every((s) => s.status === 'done')
  if (allDone) return 'done'
  const anyInProgress = stages.some(
    (s) => s.status === 'in_progress' || s.status === 'review'
  )
  if (anyInProgress) return 'in_progress'
  const anyPaused = stages.some((s) => s.status === 'paused')
  if (anyPaused) return 'paused'
  return 'planned'
}

// Преобразование section в KanbanSection
function transformSection(
  section: (typeof kronoshanProjectData.project.stages[0]['objects'][0]['sections'])[0],
  projectId: string,
  projectName: string,
  stageId: string,
  stageName: string,
  objectId: string,
  objectName: string
): KanbanSection {
  const decompositionStages = section.decomposition_stages || []
  const stages = decompositionStages.map((ds, i) =>
    transformStage(ds, section.section_id, i, decompositionStages.length)
  )

  const totalPlannedHours = stages.reduce((sum, s) => sum + s.plannedHours, 0)
  const totalActualHours = stages.reduce((sum, s) => sum + s.actualHours, 0)
  const overallProgress =
    totalPlannedHours > 0
      ? Math.round(
          stages.reduce(
            (sum, s) => sum + (s.plannedHours * s.progress) / 100,
            0
          ) / totalPlannedHours * 100
        )
      : 0

  return {
    id: section.section_id,
    name: section.section_name,
    description: section.section_description ?? null,
    status: determineSectionStatus(stages),
    responsible: section.responsible
      ? {
          userId: section.responsible.user_id,
          firstName: section.responsible.first_name,
          lastName: section.responsible.last_name,
        }
      : null,
    projectId,
    projectName,
    stageId,
    stageName,
    objectId,
    objectName,
    stages,
    totalPlannedHours,
    totalActualHours,
    overallProgress,
  }
}

// Главная функция преобразования моковых данных в KanbanBoard
export function transformMockDataToKanbanBoard(): KanbanBoard {
  const { project } = kronoshanProjectData

  const sections: KanbanSection[] = []

  for (const stage of project.stages) {
    for (const obj of stage.objects) {
      for (const section of obj.sections) {
        sections.push(
          transformSection(
            section,
            project.project_id,
            project.project_name,
            stage.stage_id,
            stage.stage_name,
            obj.object_id,
            obj.object_name
          )
        )
      }
    }
  }

  return {
    projectId: project.project_id,
    projectName: project.project_name,
    sections,
  }
}
