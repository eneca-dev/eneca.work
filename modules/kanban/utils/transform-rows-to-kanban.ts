/**
 * Kanban Module - Row Transformation
 *
 * Трансформация плоских строк из v_resource_graph в структуру KanbanSection[]
 */

import type { Database } from '@/types/db'
import type {
  KanbanSection,
  KanbanStage,
  KanbanTask,
  SectionStatus,
  StageStatus,
} from '../types'

type ResourceGraphRow = Database['public']['Views']['v_resource_graph']['Row']

// ============================================================================
// Status Mapping
// ============================================================================

/**
 * Маппинг статусов разделов из БД в типы канбан
 */
const SECTION_STATUS_MAP: Record<string, SectionStatus> = {
  'Запланирован': 'planned',
  'В работе': 'in_progress',
  'Приостановлен': 'paused',
  'Заморожен': 'suspended',
  'Завершен': 'done',
  'Завершён': 'done',
  // Fallbacks
  'planned': 'planned',
  'in_progress': 'in_progress',
  'paused': 'paused',
  'suspended': 'suspended',
  'done': 'done',
}

/**
 * Маппинг статусов этапов из БД (stage_statuses) в типы канбан
 */
const STAGE_STATUS_MAP: Record<string, StageStatus> = {
  'Бэклог': 'backlog',
  'План': 'planned',
  'В работе': 'in_progress',
  'Пауза': 'paused',
  'Проверка': 'review',
  'Готово': 'done',
  // Fallbacks для обратной совместимости
  'backlog': 'backlog',
  'planned': 'planned',
  'in_progress': 'in_progress',
  'paused': 'paused',
  'review': 'review',
  'done': 'done',
}

function mapSectionStatus(statusName: string | null): SectionStatus {
  if (!statusName) return 'planned'
  return SECTION_STATUS_MAP[statusName] || 'planned'
}

function mapStageStatus(statusName: string | null): StageStatus {
  if (!statusName) return 'backlog'
  return STAGE_STATUS_MAP[statusName] || 'backlog'
}

// ============================================================================
// Transformation
// ============================================================================

/**
 * Трансформирует плоские строки из v_resource_graph в KanbanSection[]
 *
 * Иерархия канбан-доски:
 * Section (swimlane) → DecompositionStage (карточка) → DecompositionItem (задача)
 *
 * @param rows - Строки из view v_resource_graph
 * @returns Массив разделов для канбан-доски
 */
export function transformRowsToKanbanSections(
  rows: ResourceGraphRow[]
): KanbanSection[] {
  const sectionsMap = new Map<string, KanbanSection>()

  for (const row of rows) {
    // Skip rows without section
    if (!row.section_id) continue

    // Get or create section
    let section = sectionsMap.get(row.section_id)
    if (!section) {
      section = {
        id: row.section_id,
        name: row.section_name || '',
        description: row.section_description || null,
        status: mapSectionStatus(row.section_status_name),
        responsible: row.section_responsible_id
          ? {
              userId: row.section_responsible_id,
              firstName: row.section_responsible_first_name || '',
              lastName: row.section_responsible_last_name || '',
            }
          : null,
        // Context from parent hierarchy
        projectId: row.project_id || '',
        projectName: row.project_name || '',
        stageId: row.stage_id || '',
        stageName: row.stage_name || '',
        objectId: row.object_id || '',
        objectName: row.object_name || '',
        // Stages will be added below
        stages: [],
        // Calculated fields (will be computed after all data is loaded)
        totalPlannedHours: 0,
        totalActualHours: 0,
        overallProgress: 0,
      }
      sectionsMap.set(row.section_id, section)
    }

    // Skip if no decomposition stage
    if (!row.decomposition_stage_id) continue

    // Get or create decomposition stage (= kanban card)
    let stage = section.stages.find((s) => s.id === row.decomposition_stage_id)
    if (!stage) {
      stage = {
        id: row.decomposition_stage_id,
        name: row.decomposition_stage_name || '',
        description: null,
        status: mapStageStatus(row.decomposition_stage_status_name),
        sectionId: row.section_id,
        startDate: row.decomposition_stage_start || null,
        endDate: row.decomposition_stage_finish || null,
        order: 0, // Will be sorted later
        tasks: [],
        // Calculated fields
        plannedHours: 0,
        actualHours: 0,
        progress: 0,
      }
      section.stages.push(stage)
    }

    // Skip if no decomposition item
    if (!row.decomposition_item_id) continue

    // Check if task already exists
    const existingTask = stage.tasks.find(
      (t) => t.id === row.decomposition_item_id
    )
    if (existingTask) continue

    // Create task (= decomposition item)
    const task: KanbanTask = {
      id: row.decomposition_item_id,
      description: row.decomposition_item_description || '',
      responsible: row.item_responsible_id
        ? {
            userId: row.item_responsible_id,
            firstName: row.item_responsible_first_name || '',
            lastName: row.item_responsible_last_name || '',
          }
        : null,
      plannedHours: row.decomposition_item_planned_hours || 0,
      actualHours: row.decomposition_item_actual_hours || 0,
      progress: row.decomposition_item_progress || 0,
      cpi: row.decomposition_item_cpi || null,
      dueDate: row.decomposition_item_planned_due_date || null,
      order: row.decomposition_item_order || 0,
      workCategory: row.work_category_name || null,
    }
    stage.tasks.push(task)
  }

  // Post-process: calculate aggregated values and sort
  const sections = Array.from(sectionsMap.values())

  for (const section of sections) {
    // Sort tasks by order
    for (const stage of section.stages) {
      stage.tasks.sort((a, b) => a.order - b.order)

      // Calculate stage metrics
      stage.plannedHours = stage.tasks.reduce(
        (sum, t) => sum + t.plannedHours,
        0
      )
      stage.actualHours = stage.tasks.reduce(
        (sum, t) => sum + t.actualHours,
        0
      )

      // Calculate weighted progress
      if (stage.plannedHours > 0) {
        const weightedProgress = stage.tasks.reduce(
          (sum, t) => sum + (t.plannedHours * t.progress) / 100,
          0
        )
        stage.progress = Math.round((weightedProgress / stage.plannedHours) * 100)
      }

      // Calculate stage CPI (EV / Actual)
      if (stage.actualHours > 0) {
        const earnedValue = stage.tasks.reduce(
          (sum, t) => sum + (t.plannedHours * t.progress) / 100,
          0
        )
        stage.cpi = Math.round((earnedValue / stage.actualHours) * 1000) / 1000 // Round to 3 decimals
      } else {
        stage.cpi = null
      }
    }

    // Calculate section metrics
    section.totalPlannedHours = section.stages.reduce(
      (sum, s) => sum + s.plannedHours,
      0
    )
    section.totalActualHours = section.stages.reduce(
      (sum, s) => sum + s.actualHours,
      0
    )

    // Calculate weighted section progress
    if (section.totalPlannedHours > 0) {
      const weightedProgress = section.stages.reduce(
        (sum, s) => sum + (s.plannedHours * s.progress) / 100,
        0
      )
      section.overallProgress = Math.round(
        (weightedProgress / section.totalPlannedHours) * 100
      )
    }
  }

  // Sort sections by project name, then by section name
  sections.sort((a, b) => {
    const projectCompare = a.projectName.localeCompare(b.projectName)
    if (projectCompare !== 0) return projectCompare
    return a.name.localeCompare(b.name)
  })

  return sections
}
