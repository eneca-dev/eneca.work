/**
 * SectionLoadingModalContainer - Интеграция с modal store
 *
 * Слушает modal store и рендерит SectionLoadingModal
 */

'use client'

import { useIsModalOpen, useModalStore, closeModal } from '../../stores/modal-store'
import { SectionLoadingModal } from './SectionLoadingModal'
import type { SectionLoadingCreateData, SectionLoadingEditData } from './types'

export function SectionLoadingModalContainer() {
  // Проверяем какая модалка открыта
  const isCreateOpen = useIsModalOpen('section-loading-create')
  const isEditOpen = useIsModalOpen('section-loading-edit')

  // Получаем данные из store
  const modalData = useModalStore((s) => s.modalData)

  // Режим создания
  if (isCreateOpen) {
    const createData = modalData as SectionLoadingCreateData | null

    // Если нет необходимых данных - не рендерим
    if (!createData || !createData.sectionId) {
      return null
    }

    return (
      <SectionLoadingModal
        open={true}
        onClose={closeModal}
        mode="create"
        createData={createData}
      />
    )
  }

  // Режим редактирования
  if (isEditOpen) {
    const editData = modalData as SectionLoadingEditData | null

    // Если нет необходимых данных - не рендерим
    if (!editData || !editData.loading) {
      return null
    }

    return (
      <SectionLoadingModal
        open={true}
        onClose={closeModal}
        mode="edit"
        editData={editData}
      />
    )
  }

  return null
}
