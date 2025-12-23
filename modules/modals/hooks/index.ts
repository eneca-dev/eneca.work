/**
 * Модуль бизнес-модалок — Хуки
 */

export { useModal } from './useModal'
export { useUpdateSection } from './useUpdateSection'

// ============================================================================
// Reference Data Hooks
// ============================================================================

export { useWorkCategories } from './useWorkCategories'
export { useDifficultyLevels } from './useDifficultyLevels'
export { useStageStatuses } from './useStageStatuses'

// ============================================================================
// Decomposition Query Hooks
// ============================================================================

export {
  useDecompositionBootstrap,
  useEmployees,
  useWorkLogsAggregate,
} from './useDecompositionStage'

// Unified hook с кешированием из resourceGraph
export { useDecompositionData } from './useDecompositionData'
export type { DecompositionDataResult } from './useDecompositionData'

// ============================================================================
// Decomposition Stage Mutation Hooks
// ============================================================================

export {
  useCreateDecompositionStage,
  useUpdateDecompositionStage,
  useDeleteDecompositionStage,
  useReorderDecompositionStages,
} from './useUpdateDecompositionStage'

// ============================================================================
// Decomposition Item Mutation Hooks
// ============================================================================

export {
  useCreateDecompositionItem,
  useUpdateDecompositionItem,
  useDeleteDecompositionItem,
  useMoveDecompositionItems,
  useReorderDecompositionItems,
  useBulkCreateDecompositionItems,
  useBulkDeleteDecompositionItems,
} from './useUpdateDecompositionItem'

// ============================================================================
// Readiness Checkpoints Hooks
// ============================================================================

export {
  useReadinessCheckpoints,
  useCreateReadinessCheckpoint,
  useUpdateReadinessCheckpoint,
  useDeleteReadinessCheckpoint,
} from './useReadinessCheckpoints'

// ============================================================================
// Типизированные хуки для конкретных модалок
// ============================================================================

import { useModal } from './useModal'
import type {
  BudgetCreateData,
  BudgetEditData,
  WorkLogCreateData,
  WorkLogEditData,
  SectionViewData,
  SectionEditData,
  StageViewData,
  StageEditData,
  ItemViewData,
  ItemEditData,
  LoadingCreateData,
  LoadingEditData,
  EmployeeViewData,
  ProgressUpdateData,
  CheckpointCreateData,
  CheckpointEditData,
} from '../types'

/**
 * Хук для модалки создания бюджета
 */
export function useBudgetCreateModal() {
  return useModal<BudgetCreateData>()
}

/**
 * Хук для модалки редактирования бюджета
 */
export function useBudgetEditModal() {
  return useModal<BudgetEditData>()
}

/**
 * Хук для модалки создания отчёта о работе
 */
export function useWorkLogCreateModal() {
  return useModal<WorkLogCreateData>()
}

/**
 * Хук для модалки редактирования отчёта о работе
 */
export function useWorkLogEditModal() {
  return useModal<WorkLogEditData>()
}

/**
 * Хук для модалки просмотра раздела
 */
export function useSectionViewModal() {
  return useModal<SectionViewData>()
}

/**
 * Хук для модалки редактирования раздела
 */
export function useSectionEditModal() {
  return useModal<SectionEditData>()
}

/**
 * Хук для модалки просмотра этапа
 */
export function useStageViewModal() {
  return useModal<StageViewData>()
}

/**
 * Хук для модалки редактирования этапа
 */
export function useStageEditModal() {
  return useModal<StageEditData>()
}

/**
 * Хук для модалки просмотра задачи
 */
export function useItemViewModal() {
  return useModal<ItemViewData>()
}

/**
 * Хук для модалки редактирования задачи
 */
export function useItemEditModal() {
  return useModal<ItemEditData>()
}

/**
 * Хук для модалки создания загрузки
 */
export function useLoadingCreateModal() {
  return useModal<LoadingCreateData>()
}

/**
 * Хук для модалки редактирования загрузки
 */
export function useLoadingEditModal() {
  return useModal<LoadingEditData>()
}

/**
 * Хук для модалки просмотра сотрудника
 */
export function useEmployeeViewModal() {
  return useModal<EmployeeViewData>()
}

/**
 * Хук для диалога обновления готовности
 */
export function useProgressUpdateModal() {
  return useModal<ProgressUpdateData>()
}

/**
 * Хук для модалки создания чекпоинта
 */
export function useCheckpointCreateModal() {
  return useModal<CheckpointCreateData>()
}

/**
 * Хук для модалки редактирования чекпоинта
 */
export function useCheckpointEditModal() {
  return useModal<CheckpointEditData>()
}
