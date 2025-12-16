/**
 * Модуль бизнес-модалок — Хуки
 */

export { useModal } from './useModal'

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
