'use client'

/**
 * Loading Modal 2 - Главный контейнер модального окна
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
import { Loader2, Folder, Box, CircleDashed, ListChecks, ChevronRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useLoadingModal, useLoadingMutations, useBreadcrumbs } from '../../hooks'
import { ProjectTree } from './ProjectTree'
import { LoadingForm } from './LoadingForm'
import type { LoadingModal2CreateData, LoadingModal2EditData } from '../../types'

export interface LoadingModal2Props {
  /** Открыто ли модальное окно */
  open: boolean
  /** Callback при закрытии */
  onClose: () => void
  /** Режим работы */
  mode: 'create' | 'edit'
  /** Данные для режима создания */
  createData?: LoadingModal2CreateData
  /** Данные для режима редактирования */
  editData?: LoadingModal2EditData
  /** ID текущего пользователя */
  userId: string
}

export function LoadingModal2({
  open,
  onClose,
  mode,
  createData,
  editData,
  userId,
}: LoadingModal2Props) {
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
  } = useLoadingModal({
    mode,
    initialSectionId: mode === 'create' ? createData?.sectionId : editData?.sectionId,
    initialEmployeeId: mode === 'create' ? createData?.employeeId : undefined,
    initialLoading: mode === 'edit' ? editData?.loading : undefined,
  })

  // Загрузка breadcrumbs для режима редактирования или создания с sectionId
  const shouldLoadBreadcrumbs =
    (mode === 'edit' && editData?.loading) ||
    (mode === 'create' && createData?.sectionId)

  const breadcrumbsNodeId = mode === 'edit' && editData?.loading
    ? editData.loading.section_id
    : createData?.sectionId ?? null

  const { breadcrumbs: loadedBreadcrumbs, projectId: loadedProjectId } = useBreadcrumbs({
    nodeId: breadcrumbsNodeId,
    enabled: !!(shouldLoadBreadcrumbs && open),
  })

  // Хук для мутаций
  const { create: createLoading, update: updateLoading } = useLoadingMutations({
    onCreateSuccess: () => {
      onClose()
    },
    onUpdateSuccess: () => {
      onClose()
    },
  })

  // Состояние для отображения формы (только для режима создания)
  const [isFormVisible, setIsFormVisible] = useState(mode === 'edit')

  // Состояние для отслеживания, был ли уже выполнен автовыбор в режиме редактирования
  const [hasAutoSelected, setHasAutoSelected] = useState(false)

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
    if (
      open &&
      !hasAutoSelected &&
      loadedBreadcrumbs &&
      loadedBreadcrumbs.length > 0
    ) {
      if (mode === 'edit' && editData?.loading) {
        // Режим редактирования
        const sectionId = editData.loading.section_id
        const lastBreadcrumb = loadedBreadcrumbs[loadedBreadcrumbs.length - 1]
        selectSection(sectionId, lastBreadcrumb.name, loadedBreadcrumbs)
        setHasAutoSelected(true)
      } else if (mode === 'create' && createData?.sectionId) {
        // Режим создания с предзаполненным sectionId
        const sectionId = createData.sectionId
        const lastBreadcrumb = loadedBreadcrumbs[loadedBreadcrumbs.length - 1]
        selectSection(sectionId, lastBreadcrumb.name, loadedBreadcrumbs)
        setHasAutoSelected(true)
        // В режиме создания сразу показываем форму
        setIsFormVisible(true)
      }
    }
  }, [mode, open, hasAutoSelected, loadedBreadcrumbs, editData, createData, selectSection])

  // Сброс состояния формы при изменении выбранного раздела (только в режиме создания без предзаполнения)
  useEffect(() => {
    if (mode === 'create' && !createData?.sectionId) {
      setIsFormVisible(false)
    }
  }, [selectedSectionId, mode, createData?.sectionId])

  // Данные для автопереключения режима и фильтрации
  const projectAutoSwitchData = useMemo(() => {
    if (!loadedProjectId || !loadedBreadcrumbs || loadedBreadcrumbs.length === 0) {
      return null
    }

    // Находим имя проекта из breadcrumbs
    const projectBreadcrumb = loadedBreadcrumbs.find(b => b.type === 'project')

    return {
      projectId: loadedProjectId,
      projectName: projectBreadcrumb?.name ?? '',
    }
  }, [loadedProjectId, loadedBreadcrumbs])

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
      console.log('🔄 [LoadingModal2] Вызываем updateLoading.mutateAsync:', {
        loadingId: editData.loading.id,
        employeeId: formData.employeeId,
        rate: formData.rate,
        startDate: formData.startDate,
        endDate: formData.endDate,
        comment: formData.comment,
      })
      await updateLoading.mutateAsync({
        loadingId: editData.loading.id,
        employeeId: formData.employeeId,
        rate: formData.rate,
        startDate: formData.startDate,
        endDate: formData.endDate,
        comment: formData.comment,
      })
    }
  }

  const isSaving = createLoading.isPending || updateLoading.isPending
  const canSave =
    !!selectedSectionId &&
    !!selectedBreadcrumbs &&
    selectedBreadcrumbs.length > 0 &&
    !!formData.employeeId.trim() &&
    formData.rate >= 0.01 &&
    formData.rate <= 2.0 &&
    !!formData.startDate.trim() &&
    !!formData.endDate.trim() &&
    !isSaving

  return (
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
              initialProjectId={loadedProjectId}
              initialBreadcrumbs={loadedBreadcrumbs}
              autoSwitchProject={projectAutoSwitchData}
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
                  />
                </div>

                {/* Контент по центру */}
                <div className="relative z-10 flex flex-col items-center gap-6 px-8 text-center">
                  {!selectedSectionId || !selectedBreadcrumbs || selectedBreadcrumbs.length === 0 ? (
                    /* Этап не выбран */
                    <div className="flex flex-col items-center gap-4">
                      <div className="text-lg font-medium text-muted-foreground">
                        Выберите этап в дереве слева,
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
              />
            )}
          </div>
        </div>

        {/* Футер с кнопками */}
        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'create' ? 'Создать' : 'Сохранить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
