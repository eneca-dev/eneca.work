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

import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useLoadingModal, useLoadingMutations } from '../../hooks'
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
  // Хук для управления состоянием модалки
  const {
    // Состояние навигации
    projectMode,
    setProjectMode,
    selectedSectionId,
    selectedSectionName,
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
    initialLoading: mode === 'edit' ? editData?.loading : undefined,
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

  // Сброс формы при открытии/закрытии
  useEffect(() => {
    if (!open) {
      resetForm()
    }
  }, [open, resetForm])

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
  const canSave = selectedSectionId && !isSaving

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
            />
          </div>

          {/* Правая панель: Форма */}
          <div className="w-1/2">
            <LoadingForm
              formData={formData}
              onFieldChange={setFormField}
              errors={errors}
              disabled={isSaving}
              selectedSectionId={selectedSectionId}
              selectedSectionName={selectedSectionName}
            />
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
