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
import { useEmployeeGrantedDepartmentIds } from '@/modules/users/hooks/use-loading-access-grants'

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
    let cancelled = false
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

      // Старые потребители могут передать загрузку без нового признака.
      // Тогда читаем полную запись, чтобы сохранение формы не сбросило отметку.
      if (data.loading && typeof data.loading.isProspective === 'boolean') {
        setIsLoadingData(false)
        setEditData({
          loadingId: data.loadingId || data.loading.id,
          sectionId: data.sectionId || data.loading.section_id,
          loading: data.loading,
          breadcrumbs: data.breadcrumbs,
          projectId: data.projectId,
        })
        return
      }

      const loadingId = data.loadingId || data.loading?.id
      const sectionId = data.sectionId || data.loading?.section_id
      // Запрашиваем полные данные, в том числе для старых снимков без признака.
      if (loadingId && sectionId) {
        setEditData(null)
        setIsLoadingData(true)
        getLoadingById(loadingId)
          .then((result) => {
            if (cancelled) return
            if (result.success) {
              setEditData({
                loadingId: result.data.id,
                sectionId,
                loading: {
                  id: result.data.id,
                  employee_id: result.data.employeeId,
                  start_date: result.data.startDate,
                  end_date: result.data.endDate,
                  rate: result.data.rate,
                  comment: result.data.comment,
                  isProspective: result.data.isProspective ?? false,
                  // У прямой загрузки loading_stage пуст; сохраняем реальный sectionId.
                  section_id: result.data.stageId || sectionId,
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
            if (cancelled) return
            console.error('⚠️ LoadingModalNewContainer: ошибка при загрузке данных', error)
            closeModal()
          })
          .finally(() => {
            if (!cancelled) setIsLoadingData(false)
          })
      } else {
        setEditData(null)
        setIsLoadingData(false)
      }
    } else {
      // Сбрасываем состояние при закрытии модалки
      setEditData(null)
      setIsLoadingData(false)
    }
    return () => { cancelled = true }
  }, [isEditOpen, modalData])

  // Cross-department grants на сотрудника-исполнителя (для проверки прав НО/ТЛ-получателей)
  const employeeIdForGrants = editData?.loading?.employee_id ?? null
  const { data: employeeGrantedDeptIds = [] } =
    useEmployeeGrantedDepartmentIds(employeeIdForGrants)

  // Permission check для edit-режима — пробрасываем в модалку как isReadOnly
  const editLoadingPermissionContext = useMemo(() => {
    if (!editData?.loading) return null
    return {
      responsibleId: editData.loading.employee_id,
      teamId: editData.loading.employee_team_id ?? null,
      departmentId: editData.loading.employee_department_id ?? null,
      subdivisionId: null,
      projectId: editData.projectId ?? null,
      grantedToDepartmentIds: employeeGrantedDeptIds,
    }
  }, [editData, employeeGrantedDeptIds])

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
    const requested = modalData as LoadingModalNewEditData | null
    const requestedId = requested?.loadingId || requested?.loading?.id
    // Показываем загрузку или модалку с данными
    if (isLoadingData) {
      return null // Можно показать loader если нужно
    }

    // Если нет данных, не рендерим
    if (!editData || !editData.loading || editData.loadingId !== requestedId) {
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
