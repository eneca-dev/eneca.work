/**
 * Модуль бизнес-модалок — Типы
 */

// ============================================================================
// Base Modal Props
// ============================================================================

/**
 * Базовые props для всех модалок
 */
export interface BaseModalProps {
  /** Открыта ли модалка */
  isOpen: boolean
  /** Callback закрытия */
  onClose: () => void
  /** Callback успешного действия (создание/редактирование) */
  onSuccess?: () => void
}

/**
 * Props для модалок создания
 * Расширяется контекстом (sectionId, stageId и т.д.)
 */
export interface CreateModalProps extends BaseModalProps {
  /** ID раздела (для создания в контексте раздела) */
  sectionId?: string
  /** ID этапа декомпозиции */
  stageId?: string
  /** ID задачи */
  itemId?: string
}

/**
 * Props для модалок редактирования/просмотра
 */
export interface EntityModalProps extends BaseModalProps {
  /** ID сущности */
  id: string
}

// ============================================================================
// Modal Hook State
// ============================================================================

/**
 * Состояние хука модалки
 */
export interface ModalState<TData = unknown> {
  /** Открыта ли модалка */
  isOpen: boolean
  /** Данные, переданные при открытии */
  data: TData | null
  /** Открыть модалку с данными */
  open: (data?: TData) => void
  /** Закрыть модалку */
  close: () => void
  /** Переключить состояние */
  toggle: () => void
}

// ============================================================================
// Budget Modal Types
// ============================================================================

export interface BudgetCreateData {
  /** Тип сущности (section, object, stage, project) */
  entityType: 'section' | 'object' | 'stage' | 'project'
  /** ID сущности */
  entityId: string
  /** Отображаемое название сущности */
  entityName: string
}

export interface BudgetEditData {
  budgetId: string
}

// ============================================================================
// WorkLog Modal Types
// ============================================================================

export interface WorkLogCreateData {
  /** ID раздела */
  sectionId: string
  /** Название раздела */
  sectionName: string
  /** ID задачи (decomposition_item) — опционально */
  itemId?: string | null
  /** Предзаполненная дата */
  date?: string
}

export interface WorkLogEditData {
  workLogId: string
}

// ============================================================================
// Section Modal Types
// ============================================================================

export interface SectionViewData {
  sectionId: string
}

export interface SectionEditData {
  sectionId: string
}

// ============================================================================
// Stage Modal Types
// ============================================================================

export interface StageViewData {
  stageId: string
}

export interface StageEditData {
  stageId: string
}

// ============================================================================
// Item Modal Types
// ============================================================================

export interface ItemViewData {
  itemId: string
}

export interface ItemEditData {
  itemId: string
}

// ============================================================================
// Loading Modal Types
// ============================================================================

export interface LoadingCreateData {
  /** ID этапа декомпозиции */
  stageId: string
  /** ID сотрудника (если известен) */
  employeeId?: string
}

export interface LoadingEditData {
  loadingId: string
}

// ============================================================================
// Employee Modal Types
// ============================================================================

export interface EmployeeViewData {
  employeeId: string
}

// ============================================================================
// Progress Update Dialog Types
// ============================================================================

export interface ProgressUpdateData {
  /** ID задачи */
  itemId: string
  /** Название задачи (для отображения) */
  itemName: string
  /** Текущий процент готовности */
  currentProgress: number
}

// ============================================================================
// Global Modal Store Types
// ============================================================================

export type ModalType =
  | 'budget-create'
  | 'budget-edit'
  | 'worklog-create'
  | 'worklog-edit'
  | 'section-view'
  | 'section-edit'
  | 'stage-view'
  | 'stage-edit'
  | 'item-view'
  | 'item-edit'
  | 'loading-create'
  | 'loading-edit'
  | 'employee-view'
  | 'progress-update'

export interface GlobalModalState {
  /** Текущая открытая модалка */
  activeModal: ModalType | null
  /** Данные для модалки */
  modalData: Record<string, unknown> | null
  /** Открыть модалку */
  openModal: (type: ModalType, data?: Record<string, unknown>) => void
  /** Закрыть модалку */
  closeModal: () => void
}
