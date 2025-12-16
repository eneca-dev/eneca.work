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
// export { SectionViewModal } from './components/section/SectionViewModal'
// export { SectionEditModal } from './components/section/SectionEditModal'

// Stage
// export { StageViewModal } from './components/stage/StageViewModal'
// export { StageEditModal } from './components/stage/StageEditModal'

// Item
// export { ItemViewModal } from './components/item/ItemViewModal'
// export { ItemEditModal } from './components/item/ItemEditModal'

// Loading
// export { LoadingCreateModal } from './components/loading/LoadingCreateModal'
// export { LoadingEditModal } from './components/loading/LoadingEditModal'

// Employee
// export { EmployeeViewModal } from './components/employee/EmployeeViewModal'

// Global
// export { GlobalModals } from './components/GlobalModals'
