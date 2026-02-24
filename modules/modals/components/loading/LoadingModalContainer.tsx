'use client'

/**
 * Loading Modal Container - Интеграция с modal store
 *
 * Слушает modal store и рендерит LoadingModal когда открыты модалки:
 * - 'loading-create'
 * - 'loading-edit'
 */

import { getTodayMinsk } from '@/lib/timezone-utils'
import { format } from 'date-fns'
import { useIsModalOpen, useModalStore, closeModal } from '../../stores/modal-store'
import { LoadingModal } from './LoadingModal'
import type { LoadingCreateData, LoadingEditData } from '../../types'

export function LoadingModalContainer() {
  // Проверяем какая модалка открыта
  const isCreateOpen = useIsModalOpen('loading-create')
  const isEditOpen = useIsModalOpen('loading-edit')

  // Получаем данные из store
  const modalData = useModalStore((s) => s.modalData)

  // Режим создания
  if (isCreateOpen) {
    const createData = modalData as LoadingCreateData | null

    if (!createData || !createData.stageId || !createData.sectionId) {
      return null
    }

    // Используем переданные даты или сегодняшнюю дату
    const today = getTodayMinsk()
    const defaultStartDate = createData.defaultStartDate || format(today, 'yyyy-MM-dd')
    const defaultEndDate = createData.defaultEndDate || format(today, 'yyyy-MM-dd')

    return (
      <LoadingModal
        isOpen={true}
        onClose={closeModal}
        mode="create"
        stageId={createData.stageId}
        sectionId={createData.sectionId}
        defaultStartDate={defaultStartDate}
        defaultEndDate={defaultEndDate}
      />
    )
  }

  // Режим редактирования
  if (isEditOpen) {
    const editData = modalData as LoadingEditData | null

    // Если нет данных, не рендерим
    if (!editData || !editData.loading || !editData.sectionId) {
      return null
    }

    // Преобразуем данные в формат Loading
    const loading = {
      id: editData.loading.id,
      employee: {
        id: editData.loading.employee.id,
        name: editData.loading.employee.name,
        avatarUrl: editData.loading.employee.avatarUrl,
      },
      startDate: editData.loading.startDate,
      finishDate: editData.loading.finishDate,
      rate: editData.loading.rate,
      comment: editData.loading.comment,
      // Поля, необходимые для типа Loading, но не используемые в модалке
      stageId: editData.loadingId,
      status: 'active' as const,
      isShortage: false,
    }

    return (
      <LoadingModal
        isOpen={true}
        onClose={closeModal}
        mode="edit"
        sectionId={editData.sectionId}
        loading={loading}
      />
    )
  }

  return null
}
