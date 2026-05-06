'use client'

/**
 * Loading Modal New Container - Интеграция с modal store
 *
 * Слушает modal store и рендерит LoadingModalNew когда открыты модалки:
 * - 'loading-new-create'
 * - 'loading-new-edit'
 */

import { useEffect, useMemo, useState } from 'react'
import { useUserStore } from '@/stores/useUserStore'
import { useIsModalOpen, useModalStore, closeModal } from '../../stores/modal-store'
import { LoadingModalNew } from './LoadingModalNew'
import { getLoadingById } from '../../actions/loadings'
import type { LoadingModalNewCreateData, LoadingModalNewEditData } from '../../types'
import { useCanEditLoading } from '@/modules/permissions'

export function LoadingModalNewContainer() {
  const userId = useUserStore((s) => s.id)

  // Проверяем какая модалка открыта
  const isCreateOpen = useIsModalOpen('loading-new-create')
  const isEditOpen = useIsModalOpen('loading-new-edit')

  // Получаем данные из store (без типизации, чтобы избежать constraint ошибок)
  const modalData = useModalStore((s) => s.modalData)

  // Состояние для загрузки данных в режиме редактирования
  const [editData, setEditData] = useState<LoadingModalNewEditData | null>(null)
  const [isLoadingData, setIsLoadingData] = useState(false)

  // Загружаем данные загрузки при открытии в режиме редактирования
  useEffect(() => {
    if (isEditOpen && modalData) {
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
        setEditData({
          loadingId: data.loadingId || data.loading.id,
          sectionId: data.sectionId || data.loading.section_id,
          loading: data.loading,
          breadcrumbs: data.breadcrumbs,
          projectId: data.projectId,
        })
        return
      }

      // Если есть только loadingId, загружаем данные
      if (data.loadingId && data.sectionId) {
        setIsLoadingData(true)
        getLoadingById(data.loadingId)
          .then((result) => {
            if (result.success) {
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
                  employee_team_id: result.data.employeeTeamId ?? null,
                  employee_department_id: result.data.employeeDepartmentId ?? null,
                },
                breadcrumbs: data.breadcrumbs,
                projectId: data.projectId,
              })
            } else {
              console.error('⚠️ LoadingModalNewContainer: не удалось загрузить данные загрузки', result.error)
              closeModal()
            }
          })
          .catch((error) => {
            console.error('⚠️ LoadingModalNewContainer: ошибка при загрузке данных', error)
            closeModal()
          })
          .finally(() => {
            setIsLoadingData(false)
          })
      }
    } else {
      // Сбрасываем состояние при закрытии модалки
      setEditData(null)
      setIsLoadingData(false)
    }
  }, [isEditOpen, modalData])

  // Permission check для edit-режима — пробрасываем в модалку как isReadOnly
  const editLoadingPermissionContext = useMemo(() => {
    if (!editData?.loading) return null
    return {
      responsibleId: editData.loading.employee_id,
      teamId: editData.loading.employee_team_id ?? null,
      departmentId: editData.loading.employee_department_id ?? null,
      subdivisionId: null,
      projectId: editData.projectId ?? null,
    }
  }, [editData])

  const canEditExisting = useCanEditLoading(editLoadingPermissionContext)

  // Если нет userId, не рендерим
  if (!userId) {
    return null
  }

  // Режим создания
  if (isCreateOpen) {
    const createData = modalData as LoadingModalNewCreateData | null
    return (
      <LoadingModalNew
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
      <LoadingModalNew
        open={true}
        onClose={closeModal}
        mode="edit"
        editData={editData}
        userId={userId}
        isReadOnly={!canEditExisting}
      />
    )
  }

  return null
}
