/**
 * Hierarchy Update Utilities
 *
 * Generic функции для обновления данных в иерархии проектов
 */

import type {
  Project,
  Stage,
  ProjectObject,
  Section,
  DecompositionStage,
  DecompositionItem,
} from '../types'

// ============================================================================
// Types
// ============================================================================

/**
 * Уровни иерархии проекта
 */
export type HierarchyLevel =
  | 'project'
  | 'stage'
  | 'object'
  | 'section'
  | 'decompositionStage'
  | 'item'

/**
 * Тип entity на каждом уровне иерархии
 */
type EntityAtLevel = {
  project: Project
  stage: Stage
  object: ProjectObject
  section: Section
  decompositionStage: DecompositionStage
  item: DecompositionItem
}

// ============================================================================
// Generic Update Function
// ============================================================================

/**
 * Рекурсивно обновляет entity на заданном уровне иерархии проектов
 *
 * @param projects - массив проектов для обновления
 * @param level - уровень иерархии на котором нужно найти entity
 * @param predicate - функция для поиска нужного entity (обычно по id)
 * @param updater - функция для обновления найденного entity
 * @returns новый массив проектов с обновлённым entity
 *
 * @example
 * // Обновление прогресса задачи
 * updateInHierarchy(
 *   projects,
 *   'item',
 *   (item) => item.id === itemId,
 *   (item) => ({ ...item, progress: 50 })
 * )
 *
 * @example
 * // Обновление дат раздела
 * updateInHierarchy(
 *   projects,
 *   'section',
 *   (section) => section.id === sectionId,
 *   (section) => ({ ...section, startDate, endDate })
 * )
 */
export function updateInHierarchy<L extends HierarchyLevel>(
  projects: Project[] | undefined,
  level: L,
  predicate: (entity: EntityAtLevel[L]) => boolean,
  updater: (entity: EntityAtLevel[L]) => EntityAtLevel[L]
): Project[] {
  if (!projects || !Array.isArray(projects)) return projects || []

  return projects.map((project) => {
    if (!project?.stages || !Array.isArray(project.stages)) {
      return project
    }

    // Уровень project - обновляем сам проект
    if (level === 'project') {
      if (predicate(project as EntityAtLevel[L])) {
        return updater(project as EntityAtLevel[L]) as Project
      }
      return project
    }

    return {
      ...project,
      stages: project.stages.map((stage) => {
        if (!stage?.objects || !Array.isArray(stage.objects)) {
          return stage
        }

        // Уровень stage - это стадия проекта (не decompositionStage!)
        if (level === 'stage') {
          if (predicate(stage as EntityAtLevel[L])) {
            return updater(stage as EntityAtLevel[L]) as Stage
          }
          return stage
        }

        return {
          ...stage,
          objects: stage.objects.map((obj) => {
            if (!obj?.sections || !Array.isArray(obj.sections)) {
              return obj
            }

            // Уровень object
            if (level === 'object') {
              if (predicate(obj as EntityAtLevel[L])) {
                return updater(obj as EntityAtLevel[L]) as ProjectObject
              }
              return obj
            }

            return {
              ...obj,
              sections: obj.sections.map((section) => {
                if (!section?.decompositionStages || !Array.isArray(section.decompositionStages)) {
                  return section
                }

                // Уровень section
                if (level === 'section') {
                  if (predicate(section as EntityAtLevel[L])) {
                    return updater(section as EntityAtLevel[L]) as Section
                  }
                  return section
                }

                return {
                  ...section,
                  decompositionStages: section.decompositionStages.map((dStage) => {
                    // Уровень decompositionStage
                    if (level === 'decompositionStage') {
                      if (predicate(dStage as EntityAtLevel[L])) {
                        return updater(dStage as EntityAtLevel[L]) as DecompositionStage
                      }
                      return dStage
                    }

                    if (!dStage?.items || !Array.isArray(dStage.items)) {
                      return dStage
                    }

                    // Уровень item
                    return {
                      ...dStage,
                      items: dStage.items.map((item) =>
                        predicate(item as EntityAtLevel[L])
                          ? (updater(item as EntityAtLevel[L]) as DecompositionItem)
                          : item
                      ),
                    }
                  }),
                }
              }),
            }
          }),
        }
      }),
    }
  })
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Обновляет entity по id на заданном уровне
 */
export function updateByIdInHierarchy<L extends HierarchyLevel>(
  projects: Project[] | undefined,
  level: L,
  id: string,
  updater: (entity: EntityAtLevel[L]) => EntityAtLevel[L]
): Project[] {
  return updateInHierarchy(
    projects,
    level,
    (entity) => (entity as { id: string }).id === id,
    updater
  )
}

/**
 * Обновляет прогресс задачи по id
 */
export function updateItemProgress(
  projects: Project[] | undefined,
  itemId: string,
  progress: number
): Project[] {
  return updateByIdInHierarchy(projects, 'item', itemId, (item) => ({
    ...item,
    progress,
  }))
}

/**
 * Обновляет даты этапа декомпозиции по id
 */
export function updateDecompositionStageDates(
  projects: Project[] | undefined,
  stageId: string,
  startDate: string,
  finishDate: string
): Project[] {
  return updateByIdInHierarchy(projects, 'decompositionStage', stageId, (stage) => ({
    ...stage,
    startDate,
    finishDate,
  }))
}

/**
 * Обновляет даты раздела по id
 */
export function updateSectionDates(
  projects: Project[] | undefined,
  sectionId: string,
  startDate: string,
  endDate: string
): Project[] {
  return updateByIdInHierarchy(projects, 'section', sectionId, (section) => ({
    ...section,
    startDate,
    endDate,
  }))
}
