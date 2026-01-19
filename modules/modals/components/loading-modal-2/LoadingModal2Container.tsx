'use client'

/**
 * Loading Modal 2 Container - Интеграция с modal store
 *
 * Слушает modal store и рендерит LoadingModal2 когда открыты модалки:
 * - 'loading2-create'
 * - 'loading2-edit'
 */

import { useUserStore } from '@/stores/useUserStore'
import { useIsModalOpen, useModalStore, closeModal } from '../../stores/modal-store'
import { LoadingModal2 } from './LoadingModal2'
import type { LoadingModal2CreateData, LoadingModal2EditData } from '../../types'

export function LoadingModal2Container() {
  const userId = useUserStore((s) => s.id)

  // Проверяем какая модалка открыта
  const isCreateOpen = useIsModalOpen('loading2-create')
  const isEditOpen = useIsModalOpen('loading2-edit')

  // Получаем данные из store (без типизации, чтобы избежать constraint ошибок)
  const modalData = useModalStore((s) => s.modalData)

  // Отладочные логи
  console.log('🔍 LoadingModal2Container debug:', {
    userId,
    isCreateOpen,
    isEditOpen,
    hasModalData: !!modalData,
  })

  // Если нет userId, не рендерим
  if (!userId) {
    console.warn('⚠️ LoadingModal2Container: нет userId, модалка не отображается')
    return null
  }

  // Режим создания
  if (isCreateOpen) {
    const createData = modalData as LoadingModal2CreateData | null
    return (
      <LoadingModal2
        open={true}
        onClose={closeModal}
        mode="create"
        createData={createData ?? undefined}
        userId={userId}
      />
    )
  }

  // Режим редактирования
  if (isEditOpen) {
    const editData = modalData as LoadingModal2EditData | null

    // Если нет данных, не рендерим
    if (!editData || !editData.loading) {
      return null
    }

    return (
      <LoadingModal2
        open={true}
        onClose={closeModal}
        mode="edit"
        editData={editData}
        userId={userId}
      />
    )
  }

  return null
}
