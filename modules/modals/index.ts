/**
 * Модуль бизнес-модалок
 *
 * Централизованные модальные окна для бизнес-сущностей,
 * переиспользуемые во всём приложении.
 *
 * @example
 * ```tsx
 * // Локальное использование с хуком
 * import { BudgetCreateModal, useBudgetCreateModal } from '@/modules/modals'
 *
 * const { isOpen, open, close, data } = useBudgetCreateModal()
 * <BudgetCreateModal isOpen={isOpen} onClose={close} sectionId={data?.sectionId} />
 *
 * // Глобальное использование через store
 * import { openBudgetCreate } from '@/modules/modals'
 * openBudgetCreate('section-id')
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export type {
  BaseModalProps,
  CreateModalProps,
  EntityModalProps,
  ModalState,
  ModalType,
  GlobalModalState,
  // Budget
  BudgetCreateData,
  BudgetEditData,
  // WorkLog
  WorkLogCreateData,
  WorkLogEditData,
  // Section
  SectionViewData,
  SectionEditData,
  // Stage
  StageViewData,
  StageEditData,
  // Item
  ItemViewData,
  ItemEditData,
  // Loading
  LoadingCreateData,
  LoadingEditData,
  // Employee
  EmployeeViewData,
  // Progress
  ProgressUpdateData,
  // Checkpoint
  CheckpointCreateData,
} from './types'

// ============================================================================
// Hooks
// ============================================================================

export {
  useModal,
  // Budget
  useBudgetCreateModal,
  useBudgetEditModal,
  // WorkLog
  useWorkLogCreateModal,
  useWorkLogEditModal,
  // Section
  useSectionViewModal,
  useSectionEditModal,
  // Stage
  useStageViewModal,
  useStageEditModal,
  // Item
  useItemViewModal,
  useItemEditModal,
  // Loading
  useLoadingCreateModal,
  useLoadingEditModal,
  // Employee
  useEmployeeViewModal,
  // Progress
  useProgressUpdateModal,
  // Checkpoint
  useCheckpointCreateModal,
} from './hooks'

// ============================================================================
// Store
// ============================================================================

export {
  useModalStore,
  useIsModalOpen,
  useModalData,
  // Helpers
  openBudgetCreate,
  openBudgetEdit,
  openWorkLogCreate,
  openWorkLogEdit,
  openSectionView,
  openSectionEdit,
  openStageView,
  openStageEdit,
  openItemView,
  openItemEdit,
  openLoadingCreate,
  openLoadingEdit,
  openEmployeeView,
  closeModal,
  openCheckpointCreate,
} from './stores/modal-store'

// ============================================================================
// Components
// ============================================================================

// Budget
export { BudgetCreateModal, type BudgetCreateModalProps } from './components/budget'
// export { BudgetEditModal } from './components/budget/BudgetEditModal'

// WorkLog
export { WorkLogCreateModal, type WorkLogCreateModalProps } from './components/worklog'
// export { WorkLogEditModal } from './components/worklog/WorkLogEditModal'

// Progress
export { ProgressUpdateDialog, type ProgressUpdateDialogProps } from './components/progress'

// Section
export { SectionModal, type SectionModalProps } from './components/section'
export { SectionMetrics } from './components/section'

// Stage
export { StageModal, type StageModalProps } from './components/stage'
export { ResponsiblesDropdown } from './components/stage'

// Item / Task
export { TaskSidebar, type TaskSidebarProps } from './components/task'
export { TaskCreateModal, type TaskCreateModalProps } from './components/task'

// Loading
export { LoadingModal, type LoadingModalProps } from './components/loading'

// Employee
// export { EmployeeViewModal } from './components/employee/EmployeeViewModal'

// Checkpoint
export { CheckpointCreateModal, type CheckpointCreateModalProps } from './components/checkpoint'

// Global
// export { GlobalModals } from './components/GlobalModals'
