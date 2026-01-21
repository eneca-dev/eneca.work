'use client'

/**
 * Loading Modal 2 Container - Интеграция с modal store
 *
 * Слушает modal store и рендерит LoadingModal2 когда открыты модалки:
 * - 'loading2-create'
 * - 'loading2-edit'
 */

import { useEffect, useState } from 'react'
import { useUserStore } from '@/stores/useUserStore'
import { useIsModalOpen, useModalStore, closeModal } from '../../stores/modal-store'
import { LoadingModal2 } from './LoadingModal2'
import { getLoadingById } from '../../actions/loadings'
import type { LoadingModal2CreateData, LoadingModal2EditData } from '../../types'

export function LoadingModal2Container() {
  const userId = useUserStore((s) => s.id)

  // Проверяем какая модалка открыта
  const isCreateOpen = useIsModalOpen('loading2-create')
  const isEditOpen = useIsModalOpen('loading2-edit')

  // Получаем данные из store (без типизации, чтобы избежать constraint ошибок)
  const modalData = useModalStore((s) => s.modalData)

  // Состояние для загрузки данных в режиме редактирования
  const [editData, setEditData] = useState<LoadingModal2EditData | null>(null)
  const [isLoadingData, setIsLoadingData] = useState(false)

  // Загружаем данные загрузки при открытии в режиме редактирования
  useEffect(() => {
    if (isEditOpen && modalData) {
      console.time('⏱️ [LoadingModal2Container] useEffect обработка')
      console.log('🔵 [LoadingModal2Container] useEffect triggered, modalData:', modalData)

      const data = modalData as {
        loadingId?: string
        sectionId?: string
        loading?: any
        breadcrumbs?: Array<{
          id: string
          name: string
          type: 'project' | 'object' | 'section' | 'decomposition_stage'
        }>
        projectId?: string
      }

      // Если loading уже передан, используем его
      if (data.loading) {
        console.log('✅ [LoadingModal2Container] loading уже передан, используем его')
        setEditData({
          loadingId: data.loadingId || data.loading.id,
          sectionId: data.sectionId || data.loading.section_id,
          loading: data.loading,
          breadcrumbs: data.breadcrumbs,
          projectId: data.projectId,
        })
        console.timeEnd('⏱️ [LoadingModal2Container] useEffect обработка')
        return
      }

      // Если есть только loadingId, загружаем данные
      if (data.loadingId && data.sectionId) {
        console.log('🔄 [LoadingModal2Container] Загружаем loading по ID:', data.loadingId)
        setIsLoadingData(true)
        getLoadingById(data.loadingId)
          .then((result) => {
            if (result.success && result.data) {
              console.log('✅ [LoadingModal2Container] Loading загружен из API')
              setEditData({
                loadingId: result.data.id,
                sectionId: data.sectionId!,
                loading: {
                  id: result.data.id,
                  employee_id: result.data.employeeId,
                  start_date: result.data.startDate,
                  end_date: result.data.endDate,
                  rate: result.data.rate,
                  comment: result.data.comment,
                  section_id: result.data.stageId, // loading_stage в БД
                },
                breadcrumbs: data.breadcrumbs,
                projectId: data.projectId,
              })
            } else {
              console.error('⚠️ LoadingModal2Container: не удалось загрузить данные загрузки', result.error)
              closeModal()
            }
          })
          .catch((error) => {
            console.error('⚠️ LoadingModal2Container: ошибка при загрузке данных', error)
            closeModal()
          })
          .finally(() => {
            setIsLoadingData(false)
            console.timeEnd('⏱️ [LoadingModal2Container] useEffect обработка')
          })
      }
    } else {
      // Сбрасываем состояние при закрытии модалки
      setEditData(null)
      setIsLoadingData(false)
    }
  }, [isEditOpen, modalData])

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
    // Показываем загрузку или модалку с данными
    if (isLoadingData) {
      return null // Можно показать loader если нужно
    }

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
