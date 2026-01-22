'use client'

/**
 * Loading Modal New - Главный контейнер модального окна
 *
 * Двухпанельный layout:
 * - Левая панель: ProjectTree (навигация по проектам, выбор раздела или этапа)
 * - Правая панель: LoadingForm (форма создания/редактирования загрузки)
 *
 * Режимы:
 * - CREATE: создание новой загрузки
 * - EDIT: редактирование существующей загрузки
 */

import { useEffect, useState, useMemo } from 'react'
import { Loader2, Folder, Box, CircleDashed, ListChecks, ChevronRight, Archive, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useLoadingModal, useLoadingMutations, useBreadcrumbs } from '../../hooks'
import { useUsers } from '@/modules/cache'
import { ProjectTree } from './ProjectTree'
import { LoadingForm } from './LoadingForm'
import { DeleteWarningDialog } from './DeleteWarningDialog'
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog'
import { ArchiveConfirmationDialog } from './ArchiveConfirmationDialog'
import type { LoadingModalNewCreateData, LoadingModalNewEditData } from '../../types'

export interface LoadingModalNewProps {
  /** Открыто ли модальное окно */
  open: boolean
  /** Callback при закрытии */
  onClose: () => void
  /** Режим работы */
  mode: 'create' | 'edit'
  /** Данные для режима создания */
  createData?: LoadingModalNewCreateData
  /** Данные для режима редактирования */
  editData?: LoadingModalNewEditData
  /** ID текущего пользователя */
  userId: string
}

export function LoadingModalNew({
  open,
  onClose,
  mode,
  createData,
  editData,
  userId,
}: LoadingModalNewProps) {
  console.log('🔵 [LoadingModalNew] Render, mode:', mode, 'open:', open, 'editData:', editData)
  // Функция получения иконки по типу элемента
  const getIcon = (type: 'project' | 'object' | 'section' | 'decomposition_stage') => {
    switch (type) {
      case 'project':
        return Folder
      case 'object':
        return Box
      case 'section':
        return CircleDashed
      case 'decomposition_stage':
        return ListChecks
      default:
        return Folder
    }
  }

  // Хук для управления состоянием модалки
  const {
    // Состояние навигации
    projectMode,
    setProjectMode,
    selectedSectionId,
    selectedBreadcrumbs,
    selectSection,

    // Состояние формы
    formData,
    setFormField,
    errors,

    // Валидация и сброс
    validateForm,
    resetForm,
    hasChanges,

    // Режим смены этапа
    isChangingStage,
    startChangingStage,
    cancelChangingStage,
  } = useLoadingModal({
    mode,
    initialSectionId: mode === 'create' ? createData?.sectionId : editData?.sectionId,
    initialEmployeeId: mode === 'create' ? createData?.employeeId : undefined,
    initialLoading: mode === 'edit' ? editData?.loading : undefined,
  })

  // Загрузка breadcrumbs для режима редактирования или создания с sectionId
  // Пропускаем загрузку, если breadcrumbs уже переданы (для режима edit)
  const shouldLoadBreadcrumbs =
    (mode === 'edit' && editData?.loading && !editData.breadcrumbs) ||
    (mode === 'create' && createData?.sectionId)

  const breadcrumbsNodeId = mode === 'edit' && editData?.loading
    ? editData.loading.section_id
    : createData?.sectionId ?? null

  const { breadcrumbs: loadedBreadcrumbs, projectId: loadedProjectId } = useBreadcrumbs({
    nodeId: breadcrumbsNodeId,
    enabled: !!(shouldLoadBreadcrumbs && open),
  })

  // Используем переданные breadcrumbs если они есть, иначе загруженные из API
  const effectiveBreadcrumbs = (mode === 'edit' && editData?.breadcrumbs)
    ? editData.breadcrumbs
    : loadedBreadcrumbs

  const effectiveProjectId = (mode === 'edit' && editData?.projectId)
    ? editData.projectId
    : loadedProjectId

  // Хук для мутаций
  const {
    create: createLoading,
    update: updateLoading,
    archive: archiveLoading,
    remove: deleteLoading,
  } = useLoadingMutations({
    onCreateSuccess: () => {
      onClose()
    },
    onUpdateSuccess: () => {
      onClose()
    },
    onArchiveSuccess: () => {
      onClose()
    },
    onDeleteSuccess: () => {
      onClose()
    },
  })

  // Состояние для отображения формы (только для режима создания)
  const [isFormVisible, setIsFormVisible] = useState(mode === 'edit')

  // Состояние для отслеживания, был ли уже выполнен автовыбор в режиме редактирования
  const [hasAutoSelected, setHasAutoSelected] = useState(false)

  // Состояния для диалогов удаления и архивирования
  const [isDeleteWarningOpen, setIsDeleteWarningOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false)

  // Сброс формы при открытии/закрытии
  useEffect(() => {
    if (!open) {
      resetForm()
      setIsFormVisible(mode === 'edit')
      setHasAutoSelected(false)
    }
  }, [open, resetForm, mode])

  // Автоматический выбор раздела и установка breadcrumbs в режиме редактирования или создания с sectionId
  useEffect(() => {
    console.log('🔵 [LoadingModalNew] useEffect автовыбор раздела, effectiveBreadcrumbs:', effectiveBreadcrumbs)

    if (
      open &&
      !hasAutoSelected &&
      effectiveBreadcrumbs &&
      effectiveBreadcrumbs.length > 0
    ) {
      console.log('✅ [LoadingModalNew] Условия для автовыбора выполнены')
      if (mode === 'edit' && editData?.loading) {
        // Режим редактирования
        console.time('⏱️ [LoadingModalNew] Автовыбор раздела (edit)')
        const sectionId = editData.loading.section_id
        const lastBreadcrumb = effectiveBreadcrumbs[effectiveBreadcrumbs.length - 1]
        selectSection(sectionId, lastBreadcrumb.name, effectiveBreadcrumbs)
        setHasAutoSelected(true)
        console.timeEnd('⏱️ [LoadingModalNew] Автовыбор раздела (edit)')
        console.log('✅ [LoadingModalNew] Раздел автоматически выбран (edit)')
      } else if (mode === 'create' && createData?.sectionId) {
        // Режим создания с предзаполненным sectionId
        const sectionId = createData.sectionId
        const lastBreadcrumb = effectiveBreadcrumbs[effectiveBreadcrumbs.length - 1]
        selectSection(sectionId, lastBreadcrumb.name, effectiveBreadcrumbs)
        setHasAutoSelected(true)
        // В режиме создания сразу показываем форму
        setIsFormVisible(true)
        console.log('✅ [LoadingModalNew] Раздел автоматически выбран (create)')
      }
    } else {
      console.log('⏸️ [LoadingModalNew] Условия для автовыбора НЕ выполнены:', {
        open,
        hasAutoSelected,
        hasBreadcrumbs: !!(effectiveBreadcrumbs && effectiveBreadcrumbs.length > 0),
      })
    }
  }, [mode, open, hasAutoSelected, effectiveBreadcrumbs, editData, createData, selectSection])

  // Сброс состояния формы при изменении выбранного раздела (только в режиме создания без предзаполнения)
  useEffect(() => {
    if (mode === 'create' && !createData?.sectionId) {
      setIsFormVisible(false)
    }
  }, [selectedSectionId, mode, createData?.sectionId])

  // Данные для автопереключения режима и фильтрации
  const projectAutoSwitchData = useMemo(() => {
    if (!effectiveProjectId || !effectiveBreadcrumbs || effectiveBreadcrumbs.length === 0) {
      return null
    }

    // Находим имя проекта из breadcrumbs
    const projectBreadcrumb = effectiveBreadcrumbs.find(b => b.type === 'project')

    return {
      projectId: effectiveProjectId,
      projectName: projectBreadcrumb?.name ?? '',
    }
  }, [effectiveProjectId, effectiveBreadcrumbs])

  // Обработчик сохранения
  const handleSave = async () => {
    // Валидация
    if (!validateForm()) {
      return
    }

    // Проверка что раздел/этап выбран
    if (!selectedSectionId) {
      return
    }

    if (mode === 'create') {
      // Создание новой загрузки
      // selectedSectionId может быть как ID раздела, так и ID этапа декомпозиции
      await createLoading.mutateAsync({
        stageId: selectedSectionId,
        employeeId: formData.employeeId,
        rate: formData.rate,
        startDate: formData.startDate,
        endDate: formData.endDate,
        comment: formData.comment,
      })
    } else if (mode === 'edit' && editData?.loading) {
      // Редактирование существующей загрузки
      console.log('🔄 [LoadingModalNew] Вызываем updateLoading.mutateAsync:', {
        loadingId: editData.loading.id,
        stageId: selectedSectionId,
        employeeId: formData.employeeId,
        rate: formData.rate,
        startDate: formData.startDate,
        endDate: formData.endDate,
        comment: formData.comment,
      })
      await updateLoading.mutateAsync({
        loadingId: editData.loading.id,
        stageId: selectedSectionId ?? undefined,
        employeeId: formData.employeeId,
        rate: formData.rate,
        startDate: formData.startDate,
        endDate: formData.endDate,
        comment: formData.comment,
      })
    }
  }

  const isSaving = createLoading.isPending || updateLoading.isPending

  // Состояние для отслеживания optimistic update
  // Показываем индикатор загрузки только для update (для create используем обычный isSaving)
  const isUpdating = mode === 'edit' && updateLoading.isPending

  // Обработчики для диалогов
  const handleDeleteButtonClick = () => {
    setIsDeleteWarningOpen(true)
  }

  const handleArchiveButtonClick = () => {
    setIsArchiveConfirmOpen(true)
  }

  const handleDeleteWarningDelete = () => {
    setIsDeleteWarningOpen(false)
    setIsDeleteConfirmOpen(true)
  }

  const handleDeleteWarningArchive = () => {
    setIsDeleteWarningOpen(false)
    setIsArchiveConfirmOpen(true)
  }

  const handleArchiveConfirm = async () => {
    if (mode === 'edit' && editData?.loading) {
      await archiveLoading.mutateAsync({ loadingId: editData.loading.id })
      setIsArchiveConfirmOpen(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (mode === 'edit' && editData?.loading) {
      await deleteLoading.mutateAsync({ loadingId: editData.loading.id })
      setIsDeleteConfirmOpen(false)
    }
  }

  // Получаем список пользователей для отображения имени сотрудника
  const { data: users = [] } = useUsers()

  // Получаем данные для отображения в диалогах подтверждения
  const employeeId = mode === 'edit' && editData?.loading?.employee_id
    ? editData.loading.employee_id
    : formData.employeeId
  const employeeName = useMemo(() => {
    if (!employeeId) return undefined
    const employee = users.find((u) => u.user_id === employeeId)
    return employee?.full_name || undefined
  }, [users, employeeId])

  const stageName = selectedBreadcrumbs && selectedBreadcrumbs.length > 0
    ? selectedBreadcrumbs[selectedBreadcrumbs.length - 1].name
    : undefined
  const startDate = mode === 'edit' && editData?.loading?.start_date
    ? editData.loading.start_date
    : formData.startDate
  const endDate = mode === 'edit' && editData?.loading?.end_date
    ? editData.loading.end_date
    : formData.endDate
  const rate = mode === 'edit' && editData?.loading?.rate !== undefined
    ? editData.loading.rate
    : formData.rate

  const canSave =
    !!selectedSectionId &&
    !!selectedBreadcrumbs &&
    selectedBreadcrumbs.length > 0 &&
    !!formData.employeeId.trim() &&
    formData.rate >= 0.01 &&
    formData.rate <= 2.0 &&
    !!formData.startDate.trim() &&
    !!formData.endDate.trim() &&
    !isSaving &&
    hasChanges // Кнопка неактивна если нет изменений

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="max-w-6xl h-[80vh] flex flex-col p-0">
        {/* Заголовок */}
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>
            {mode === 'create' ? 'Создание загрузки' : 'Редактирование загрузки'}
          </DialogTitle>
        </DialogHeader>

        {/* Двухпанельный layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Левая панель: Дерево проектов */}
          <div className="w-1/2 border-r">
            <ProjectTree
              mode={projectMode}
              onModeChange={setProjectMode}
              selectedSectionId={selectedSectionId}
              onSectionSelect={selectSection}
              userId={userId}
              initialProjectId={effectiveProjectId}
              initialBreadcrumbs={effectiveBreadcrumbs}
              autoSwitchProject={projectAutoSwitchData}
              disabled={mode === 'edit' && !isChangingStage}
              modalMode={mode}
              onClose={onClose}
            />
          </div>

          {/* Правая панель: Форма */}
          <div className="w-1/2 relative">
            {mode === 'create' && !isFormVisible ? (
              /* Состояние до открытия формы */
              <div className="h-full flex items-center justify-center relative">
                {/* Блюр формы на фоне */}
                <div className="absolute inset-0 blur-sm pointer-events-none opacity-30">
                  <LoadingForm
                    formData={formData}
                    onFieldChange={setFormField}
                    errors={errors}
                    disabled={true}
                    selectedBreadcrumbs={selectedBreadcrumbs}
                    mode={mode}
                  />
                </div>

                {/* Контент по центру */}
                <div className="relative z-10 flex flex-col items-center gap-6 px-8 text-center">
                  {!selectedSectionId || !selectedBreadcrumbs || selectedBreadcrumbs.length === 0 ? (
                    /* Этап не выбран */
                    <div className="flex flex-col items-center gap-4">
                      <div className="text-lg font-medium text-muted-foreground">
                        Выберите этап декомпозиции в дереве слева,
                        <br />
                        чтобы создать загрузку
                      </div>
                    </div>
                  ) : (
                    /* Этап выбран - показываем кнопку */
                    <div className="flex flex-col items-center gap-4">
                      <Button
                        size="lg"
                        onClick={() => setIsFormVisible(true)}
                        className="text-lg px-8 py-6 h-auto"
                      >
                        Создать загрузку
                      </Button>
                      {selectedBreadcrumbs && selectedBreadcrumbs.length > 0 && (
                        <div className="text-sm text-muted-foreground max-w-md">
                          <div className="mb-1">Загрузка будет создана для</div>
                          <div className="font-medium text-foreground flex items-center gap-1 flex-wrap justify-center">
                            {selectedBreadcrumbs.map((item, index) => {
                              const Icon = getIcon(item.type)
                              return (
                                <span key={item.id} className="flex items-center gap-1">
                                  <Icon className="h-3.5 w-3.5 shrink-0" />
                                  <span>{item.name}</span>
                                  {index < selectedBreadcrumbs.length - 1 && (
                                    <ChevronRight className="h-3 w-3 mx-0.5 text-muted-foreground" />
                                  )}
                                </span>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Форма открыта или режим редактирования */
              <LoadingForm
                formData={formData}
                onFieldChange={setFormField}
                errors={errors}
                disabled={isSaving}
                selectedBreadcrumbs={selectedBreadcrumbs}
                mode={mode}
                onChangeStage={startChangingStage}
                isUpdating={isUpdating}
              />
            )}
          </div>
        </div>

        {/* Футер с кнопками */}
        <DialogFooter className="px-6 py-4 border-t">
          <div className="flex items-center justify-between w-full">
            {/* Левая часть - кнопки архивирования и удаления (только в режиме edit) */}
            {mode === 'edit' ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleArchiveButtonClick}
                  disabled={isSaving || archiveLoading.isPending || deleteLoading.isPending}
                  className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                >
                  <Archive className="mr-2 h-4 w-4" />
                  Архивировать
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDeleteButtonClick}
                  disabled={isSaving || archiveLoading.isPending || deleteLoading.isPending}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Удалить
                </Button>
              </div>
            ) : (
              <div />
            )}

            {/* Правая часть - кнопки отмены и сохранения */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} disabled={isSaving}>
                Отмена
              </Button>
              <Button onClick={handleSave} disabled={!canSave}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === 'create' ? 'Создать' : 'Сохранить'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

      {/* Диалоги подтверждения */}
      <DeleteWarningDialog
        open={isDeleteWarningOpen}
        onClose={() => setIsDeleteWarningOpen(false)}
        onDelete={handleDeleteWarningDelete}
        onArchive={handleDeleteWarningArchive}
      />

      <ArchiveConfirmationDialog
        open={isArchiveConfirmOpen}
        onClose={() => setIsArchiveConfirmOpen(false)}
        onConfirm={handleArchiveConfirm}
        loading={archiveLoading.isPending}
        employeeName={employeeName}
        stageName={stageName}
        startDate={startDate}
        endDate={endDate}
        rate={rate}
      />

      <DeleteConfirmationDialog
        open={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleDeleteConfirm}
        loading={deleteLoading.isPending}
        employeeName={employeeName}
        stageName={stageName}
        startDate={startDate}
        endDate={endDate}
        rate={rate}
      />
    </>
  )
}
