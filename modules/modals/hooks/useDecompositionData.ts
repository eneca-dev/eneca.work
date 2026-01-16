'use client'

/**
 * useDecompositionData - Unified hook для получения данных декомпозиции
 *
 * Стратегия оптимизации B+C:
 * 1. Справочники (categories, difficulties, statuses) - загружены при старте (prefetch)
 * 2. Данные раздела - сначала проверяем кеш resourceGraph, потом fallback на bootstrap RPC
 *
 * Это уменьшает количество HTTP запросов когда модалка открывается для раздела,
 * который уже был загружен в Resource Graph.
 */

import { useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys, staleTimePresets } from '@/modules/cache'

// Hooks
import { useDecompositionBootstrap, useEmployees } from './useDecompositionStage'
import { useWorkCategories } from './useWorkCategories'
import { useDifficultyLevels } from './useDifficultyLevels'
import { useStageStatuses } from './useStageStatuses'

// Types
import type { Stage, Decomposition } from '../components/section/decomposition/types'
import type { WorkCategory } from '../actions/getWorkCategories'
import type { DifficultyLevel } from '../actions/getDifficultyLevels'
import type { StageStatus } from '../actions/getStageStatuses'
import type { Employee, Profile } from '../actions/getDecompositionStage'
import type {
  Project,
  Section,
  DecompositionStage as RGDecompositionStage,
  DecompositionItem as RGDecompositionItem,
  StageResponsible,
} from '@/modules/resource-graph/types'

// ============================================================================
// Types
// ============================================================================

export interface DecompositionDataResult {
  /** Этапы с задачами */
  stages: Stage[]
  /** Справочник категорий работ */
  workCategories: WorkCategory[]
  /** Справочник уровней сложности */
  difficultyLevels: DifficultyLevel[]
  /** Справочник статусов этапов */
  stageStatuses: StageStatus[]
  /** Профили для ответственных */
  profiles: Profile[]
  /** Сотрудники для выбора ответственных (с avatarUrl, position) */
  employees: Employee[]
  /** Загрузка данных */
  isLoading: boolean
  /** Ошибка загрузки */
  error: Error | null
  /** Источник данных */
  dataSource: 'cache' | 'bootstrap' | 'none'
}

// ============================================================================
// Helpers - Transform resourceGraph data to modal format
// ============================================================================

/**
 * Ищет раздел в кешированных данных Resource Graph
 */
function findSectionInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  sectionId: string
): Section | null {
  // Получаем все закешированные запросы resourceGraph
  const queries = queryClient.getQueriesData<Project[]>({
    queryKey: queryKeys.resourceGraph.lists(),
  })

  // Ищем раздел во всех закешированных проектах
  for (const [, projects] of queries) {
    if (!projects) continue

    for (const project of projects) {
      for (const obj of project.objects) {
        for (const section of obj.sections) {
          if (section.id === sectionId) {
            return section
          }
        }
      }
    }
  }

  return null
}

/**
 * Получает ответственных этапов из кеша resourceGraph
 */
function getStageResponsiblesFromCache(
  queryClient: ReturnType<typeof useQueryClient>,
  sectionId: string
): Record<string, string[]> | null {
  const data = queryClient.getQueryData<Record<string, StageResponsible[]>>(
    queryKeys.resourceGraph.stageResponsibles(sectionId)
  )

  if (!data) return null

  // Преобразуем StageResponsible[] в string[] (только ID)
  const result: Record<string, string[]> = {}
  for (const [stageId, responsibles] of Object.entries(data)) {
    result[stageId] = responsibles.map((r) => r.id)
  }
  return result
}

/**
 * Преобразует DecompositionItem из Resource Graph в Decomposition модалки
 */
function transformItem(item: RGDecompositionItem): Decomposition {
  return {
    id: item.id,
    description: item.description,
    typeOfWork: item.workCategoryName || '',
    difficulty: item.difficulty?.abbr || '',
    plannedHours: item.plannedHours,
    progress: item.progress ?? 0,
  }
}

/**
 * Преобразует DecompositionStage из Resource Graph в Stage модалки
 */
function transformStage(
  stage: RGDecompositionStage,
  responsibles: string[]
): Stage {
  return {
    id: stage.id,
    name: stage.name,
    startDate: stage.startDate,
    endDate: stage.finishDate,
    description: null, // RG не хранит description
    statusId: stage.status?.id || null,
    responsibles,
    decompositions: stage.items.map(transformItem),
  }
}

/**
 * Преобразует Section из Resource Graph в массив Stage модалки
 */
function transformSectionToStages(
  section: Section,
  stageResponsibles: Record<string, string[]> | null
): Stage[] {
  return section.decompositionStages.map((stage) => {
    const responsibles = stageResponsibles?.[stage.id] || []
    return transformStage(stage, responsibles)
  })
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Unified хук для получения данных декомпозиции
 *
 * Сначала проверяет кеш resourceGraph, потом fallback на bootstrap RPC.
 * Справочники загружаются из prefetch кеша (быстро).
 *
 * @example
 * const {
 *   stages,
 *   workCategories,
 *   difficultyLevels,
 *   stageStatuses,
 *   employees,
 *   isLoading,
 *   dataSource,
 * } = useDecompositionData(sectionId)
 */
export function useDecompositionData(sectionId: string): DecompositionDataResult {
  const queryClient = useQueryClient()

  // -------------------------------------------------------------------------
  // Проверяем кеш Resource Graph
  // -------------------------------------------------------------------------

  const cachedSection = useMemo(
    () => findSectionInCache(queryClient, sectionId),
    [queryClient, sectionId]
  )

  const cachedResponsibles = useMemo(
    () => (cachedSection ? getStageResponsiblesFromCache(queryClient, sectionId) : null),
    [queryClient, sectionId, cachedSection]
  )

  const hasCachedData = cachedSection !== null

  // -------------------------------------------------------------------------
  // Загружаем справочники (prefetched, должны быть в кеше)
  // -------------------------------------------------------------------------

  const { data: workCategories = [], isLoading: categoriesLoading } = useWorkCategories()
  const { data: difficultyLevels = [], isLoading: difficultiesLoading } = useDifficultyLevels()
  const { data: stageStatuses = [], isLoading: statusesLoading } = useStageStatuses()
  const { data: employees = [], isLoading: employeesLoading } = useEmployees()

  // -------------------------------------------------------------------------
  // Bootstrap RPC - fallback если нет данных в кеше
  // -------------------------------------------------------------------------

  const {
    data: bootstrapData,
    isLoading: bootstrapLoading,
    error: bootstrapError,
  } = useDecompositionBootstrap(sectionId, {
    // Отключаем если есть данные в кеше
    enabled: !hasCachedData,
  })

  // -------------------------------------------------------------------------
  // Собираем результат
  // -------------------------------------------------------------------------

  const result = useMemo((): DecompositionDataResult => {
    const isLoading =
      categoriesLoading ||
      difficultiesLoading ||
      statusesLoading ||
      employeesLoading ||
      (!hasCachedData && bootstrapLoading)

    // Если есть кешированные данные из Resource Graph
    if (hasCachedData && cachedSection) {
      const stages = transformSectionToStages(cachedSection, cachedResponsibles)

      return {
        stages,
        workCategories,
        difficultyLevels,
        stageStatuses,
        profiles: [], // Не нужны, используем employees
        employees,
        isLoading,
        error: null,
        dataSource: 'cache',
      }
    }

    // Если есть данные из bootstrap
    if (bootstrapData) {
      return {
        stages: bootstrapData.stages,
        workCategories: bootstrapData.categories.length > 0 ? bootstrapData.categories : workCategories,
        difficultyLevels: bootstrapData.difficulties.length > 0 ? bootstrapData.difficulties : difficultyLevels,
        stageStatuses: bootstrapData.statuses.length > 0 ? bootstrapData.statuses : stageStatuses,
        profiles: bootstrapData.profiles,
        employees,
        isLoading,
        error: null,
        dataSource: 'bootstrap',
      }
    }

    // Нет данных (загрузка или ошибка)
    return {
      stages: [],
      workCategories,
      difficultyLevels,
      stageStatuses,
      profiles: [],
      employees,
      isLoading,
      error: bootstrapError instanceof Error ? bootstrapError : null,
      dataSource: 'none',
    }
  }, [
    hasCachedData,
    cachedSection,
    cachedResponsibles,
    bootstrapData,
    bootstrapLoading,
    bootstrapError,
    workCategories,
    difficultyLevels,
    stageStatuses,
    employees,
    categoriesLoading,
    difficultiesLoading,
    statusesLoading,
    employeesLoading,
  ])

  return result
}
