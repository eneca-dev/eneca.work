'use client'

import { create } from 'zustand'
import type { ModalType, GlobalModalState } from '../types'

/**
 * Глобальный store для управления модалками
 *
 * Позволяет открывать модалки из любого места приложения
 * без необходимости пробрасывать состояние через props.
 *
 * @example
 * ```tsx
 * // Открытие модалки из любого компонента
 * const openModal = useModalStore(s => s.openModal)
 * openModal('budget-create', { sectionId: '123' })
 *
 * // Компонент GlobalModals в layout рендерит активную модалку
 * ```
 */
export const useModalStore = create<GlobalModalState>((set) => ({
  activeModal: null,
  modalData: null,

  openModal: (type: ModalType, data?: Record<string, unknown>) => {
    set({
      activeModal: type,
      modalData: data ?? null,
    })
  },

  closeModal: () => {
    set({
      activeModal: null,
      modalData: null,
    })
  },
}))

// ============================================================================
// Селекторы для удобства
// ============================================================================

/**
 * Проверяет, открыта ли конкретная модалка
 */
export const useIsModalOpen = (type: ModalType) =>
  useModalStore((s) => s.activeModal === type)

/**
 * Получает данные модалки с типизацией
 */
export function useModalData<T extends Record<string, unknown>>(): T | null {
  return useModalStore((s) => s.modalData as T | null)
}

// ============================================================================
// Хелперы для открытия конкретных модалок
// ============================================================================

/**
 * Открыть модалку создания бюджета
 */
export const openBudgetCreate = (
  entityType: 'section' | 'object' | 'stage' | 'project',
  entityId: string,
  entityName: string
) => useModalStore.getState().openModal('budget-create', { entityType, entityId, entityName })

/**
 * Открыть модалку редактирования бюджета
 */
export const openBudgetEdit = (budgetId: string) =>
  useModalStore.getState().openModal('budget-edit', { budgetId })

/**
 * Открыть модалку создания отчёта
 */
export const openWorkLogCreate = (itemId: string, date?: string) =>
  useModalStore.getState().openModal('worklog-create', { itemId, date })

/**
 * Открыть модалку редактирования отчёта
 */
export const openWorkLogEdit = (workLogId: string) =>
  useModalStore.getState().openModal('worklog-edit', { workLogId })

/**
 * Открыть модалку просмотра раздела
 */
export const openSectionView = (sectionId: string) =>
  useModalStore.getState().openModal('section-view', { sectionId })

/**
 * Открыть модалку редактирования раздела
 */
export const openSectionEdit = (sectionId: string) =>
  useModalStore.getState().openModal('section-edit', { sectionId })

/**
 * Открыть модалку просмотра этапа
 */
export const openStageView = (stageId: string) =>
  useModalStore.getState().openModal('stage-view', { stageId })

/**
 * Открыть модалку редактирования этапа
 */
export const openStageEdit = (stageId: string) =>
  useModalStore.getState().openModal('stage-edit', { stageId })

/**
 * Открыть модалку просмотра задачи
 */
export const openItemView = (itemId: string) =>
  useModalStore.getState().openModal('item-view', { itemId })

/**
 * Открыть модалку редактирования задачи
 */
export const openItemEdit = (itemId: string) =>
  useModalStore.getState().openModal('item-edit', { itemId })

/**
 * Открыть модалку создания загрузки
 */
export const openLoadingCreate = (
  stageId: string,
  sectionId: string,
  defaultStartDate?: string,
  defaultEndDate?: string,
  employeeId?: string
) =>
  useModalStore.getState().openModal('loading-create', {
    stageId,
    sectionId,
    defaultStartDate,
    defaultEndDate,
    employeeId,
  })

/**
 * Открыть модалку редактирования загрузки
 */
export const openLoadingEdit = (loadingId: string, sectionId: string, loading: {
  id: string
  employee: { id: string; name: string; avatarUrl?: string }
  startDate: string
  finishDate: string
  rate: number
  comment?: string
}) =>
  useModalStore.getState().openModal('loading-edit', { loadingId, sectionId, loading })

/**
 * Открыть модалку просмотра сотрудника
 */
export const openEmployeeView = (employeeId: string) =>
  useModalStore.getState().openModal('employee-view', { employeeId })

/**
 * Закрыть любую открытую модалку
 */
export const closeModal = () => useModalStore.getState().closeModal()

/**
 * Открыть модалку создания чекпоинта
 */
export const openCheckpointCreate = (sectionId: string, sectionName: string) =>
  useModalStore.getState().openModal('checkpoint-create', { sectionId, sectionName })

/**
 * Открыть модалку редактирования чекпоинта
 */
export const openCheckpointEdit = (checkpointId: string) =>
  useModalStore.getState().openModal('checkpoint-edit', { checkpointId })

/**
 * Открыть модалку создания загрузки (Loading Modal New)
 */
export const openLoadingModalNewCreate = (data?: {
  sectionId?: string // ID раздела или этапа декомпозиции
  employeeId?: string
  projectId?: string
}) => useModalStore.getState().openModal('loading-new-create', data)

/**
 * Открыть модалку редактирования загрузки (Loading Modal New)
 */
export const openLoadingModalNewEdit = (
  loadingId: string,
  sectionId: string,
  options?: {
    /** Объект загрузки (если передан, не будет выполнен запрос к API) */
    loading?: {
      id: string
      employee_id: string
      start_date: string
      end_date: string
      rate: number
      comment: string | null
      section_id: string
    }
    breadcrumbs?: Array<{
      id: string
      name: string
      type: 'project' | 'object' | 'section' | 'decomposition_stage'
    }>
    projectId?: string
  }
) =>
  useModalStore.getState().openModal('loading-new-edit', {
    loadingId,
    sectionId,
    ...options,
  })

