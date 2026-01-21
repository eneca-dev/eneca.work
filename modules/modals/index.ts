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
  // Loading Modal 2
  LoadingModal2CreateData,
  LoadingModal2EditData,
  // Employee
  EmployeeViewData,
  // Progress
  ProgressUpdateData,
  // Checkpoint
  CheckpointCreateData,
  CheckpointEditData,
  // Template
  TemplateSelectData,
  TemplateSaveData,
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
  useCheckpointEditModal,
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
  openLoadingModal2Create,
  openLoadingModal2Edit,
  openEmployeeView,
  closeModal,
  openCheckpointCreate,
  openCheckpointEdit,
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
export { DeleteSectionModal, type DeleteSectionModalProps } from './components/section'
export { SectionCreateModal, type SectionCreateModalProps } from './components/section'

// Stage
export { StageModal, type StageModalProps } from './components/stage'
export { StageCreateModal, type StageCreateModalProps } from './components/stage'
export { ResponsiblesDropdown } from './components/stage'

// Item / Task
export { TaskSidebar, type TaskSidebarProps } from './components/task'
export { TaskCreateModal, type TaskCreateModalProps } from './components/task'

// Loading
export { LoadingModal, type LoadingModalProps, LoadingModalContainer } from './components/loading'

// Loading Modal 2
export { LoadingModal2Container, LoadingModal2, type LoadingModal2Props } from './components/loading-modal-2'

// Employee
// export { EmployeeViewModal } from './components/employee/EmployeeViewModal'

// Checkpoint
export {
  CheckpointCreateModal,
  type CheckpointCreateModalProps,
  CheckpointEditModal,
  type CheckpointEditModalProps,
} from './components/checkpoint'

// Template
export {
  TemplateSelectModal,
  TemplateSaveModal,
  type TemplateSelectModalProps,
  type TemplateSaveModalProps,
} from './components/templates'

// Project Report
export { ProjectReportModal, type ProjectReportModalProps } from './components/project-report/ProjectReportModal'

// Object
export {
  DeleteObjectModal,
  type DeleteObjectModalProps,
  ObjectCreateModal,
  type ObjectCreateModalProps,
} from './components/object'

// Project
export {
  ProjectQuickEditModal,
  type ProjectQuickEditModalProps,
} from './components/project'

// Global
// export { GlobalModals } from './components/GlobalModals'
