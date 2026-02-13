/**
 * SectionLoadingModal - Модальное окно создания/редактирования загрузки на раздел
 *
 * Упрощённая модалка (без дерева проектов) для sections-page
 * Раздел уже известен из контекста
 */

'use client'

import { useState, useCallback, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ChevronRight, FolderKanban, Box, CircleDashed, Archive, Trash2 } from 'lucide-react'
import { SectionLoadingForm } from './SectionLoadingForm'
import { StageSelect } from './StageSelect'
import { useCreateSectionLoading, useUpdateSectionLoading, useDeleteSectionLoading } from '@/modules/sections-page/hooks'
import { DeleteWarningDialog } from './DeleteWarningDialog'
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog'
import { ArchiveConfirmationDialog } from './ArchiveConfirmationDialog'
import type { SectionLoadingCreateData, SectionLoadingEditData, SectionLoadingFormData } from './types'

// ============================================================================
// Props
// ============================================================================

export interface SectionLoadingModalProps {
  open: boolean
  onClose: () => void
  mode: 'create' | 'edit'
  createData?: SectionLoadingCreateData
  editData?: SectionLoadingEditData
}

// ============================================================================
// Component
// ============================================================================

export function SectionLoadingModal({
  open,
  onClose,
  mode,
  createData,
  editData,
}: SectionLoadingModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  // State для выбранного этапа (null = без этапа)
  // В режиме edit инициализируем из loading.stage_id
  const [selectedStageId, setSelectedStageId] = useState<string | null>(
    mode === 'edit' && editData?.loading?.stage_id ? editData.loading.stage_id : null
  )

  // Ref для submit формы (будет установлен из SectionLoadingForm)
  const submitFormRef = useRef<(() => void) | null>(null)

  // Состояния для диалогов удаления и архивирования
  const [isDeleteWarningOpen, setIsDeleteWarningOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false)

  // Mutations
  const createMutation = useCreateSectionLoading()
  const updateMutation = useUpdateSectionLoading()
  const deleteLoading = useDeleteSectionLoading()

  // Breadcrumbs data
  const breadcrumbs = mode === 'create'
    ? {
        projectName: createData?.projectName || '',
        objectName: createData?.objectName || '',
        sectionName: createData?.sectionName || '',
      }
    : {
        projectName: editData?.projectName || '',
        objectName: editData?.objectName || '',
        sectionName: editData?.sectionName || '',
      }

  // Initial form data for edit mode
  const initialFormData = mode === 'edit' && editData?.loading
    ? {
        employeeId: editData.loading.employee_id,
        rate: editData.loading.rate,
        startDate: editData.loading.start_date,
        endDate: editData.loading.end_date,
        comment: editData.loading.comment || undefined,
      }
    : {
        employeeId: createData?.employeeId || '',
      }

  // Handle form submission
  const handleSubmit = useCallback(async (formData: SectionLoadingFormData) => {
    setIsSubmitting(true)

    try {
      if (mode === 'create' && createData) {
        // Create new loading
        await createMutation.mutateAsync({
          sectionId: createData.sectionId,
          stageId: selectedStageId ?? undefined, // null если "без этапа", undefined если не выбран
          employeeId: formData.employeeId,
          startDate: formData.startDate,
          endDate: formData.endDate,
          rate: formData.rate,
          comment: formData.comment,
        })
      } else if (mode === 'edit' && editData) {
        // Update existing loading
        await updateMutation.mutateAsync({
          loadingId: editData.loadingId,
          employeeId: formData.employeeId,
          startDate: formData.startDate,
          endDate: formData.endDate,
          rate: formData.rate,
          comment: formData.comment,
          // Явно передаём stageId даже если null
          ...(selectedStageId !== undefined ? { stageId: selectedStageId } : {}),
        })
      }

      // Close modal on success
      onClose()
    } catch (error) {
      console.error('[SectionLoadingModal] Error:', error)
      // Error handling через mutation (toast уже показан)
    } finally {
      setIsSubmitting(false)
    }
  }, [mode, createData, editData, createMutation, updateMutation, onClose, selectedStageId])

  // Trigger form submit from footer button
  const handleSaveClick = useCallback(() => {
    if (submitFormRef.current) {
      submitFormRef.current()
    }
  }, [])

  // Обработчики для диалогов удаления и архивирования
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
    if (mode === 'edit' && editData?.loadingId) {
      await deleteLoading.mutateAsync(editData.loadingId)
      setIsArchiveConfirmOpen(false)
      onClose()
    }
  }

  const handleDeleteConfirm = async () => {
    if (mode === 'edit' && editData?.loadingId) {
      await deleteLoading.mutateAsync(editData.loadingId)
      setIsDeleteConfirmOpen(false)
      onClose()
    }
  }

  // Имя сотрудника для диалогов
  const employeeName = mode === 'edit' && editData?.loading
    ? editData.loading.employee_id // TODO: Get actual employee name
    : ''

  // Stages для левой панели (из createData или editData)
  const stages = mode === 'create' ? (createData?.stages || []) : (editData?.stages || [])

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>
            {mode === 'create' ? 'Создание загрузки' : 'Редактирование загрузки'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {mode === 'create'
              ? 'Форма для создания новой загрузки сотрудника на раздел'
              : 'Форма для редактирования загрузки сотрудника'}
          </DialogDescription>

          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
            <FolderKanban className="w-3.5 h-3.5 text-amber-600" />
            <span className="font-medium">{breadcrumbs.projectName}</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <Box className="w-3.5 h-3.5 text-cyan-600" />
            <span className="font-medium">{breadcrumbs.objectName}</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <CircleDashed className="w-3.5 h-3.5 text-primary" />
            <span className="font-medium text-foreground">{breadcrumbs.sectionName}</span>
          </div>
        </DialogHeader>

        {/* Двухпанельный layout (если есть этапы) */}
        {stages.length > 0 ? (
          <div className="flex-1 flex overflow-hidden">
            {/* Левая панель: Выбор этапа */}
            <div className="w-80 border-r border-border/50 overflow-y-auto">
              <StageSelect
                stages={stages}
                selectedStageId={selectedStageId}
                onChange={setSelectedStageId}
              />
            </div>

            {/* Правая панель: Форма */}
            <div className="flex-1 overflow-y-auto p-6">
              <SectionLoadingForm
                initialData={initialFormData}
                onSubmit={handleSubmit}
                isSubmitting={isSubmitting}
                submitRef={submitFormRef}
              />
            </div>
          </div>
        ) : (
          /* Однопанельный layout (если нет этапов) */
          <div className="flex-1 overflow-y-auto p-6">
            <SectionLoadingForm
              initialData={initialFormData}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              submitRef={submitFormRef}
            />
          </div>
        )}

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t">
          {mode === 'edit' ? (
            <>
              {/* Кнопки удаления и архивирования слева */}
              <div className="flex gap-2 mr-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleArchiveButtonClick}
                  disabled={isSubmitting || deleteLoading.isPending}
                  className="text-orange-600 hover:text-orange-600"
                >
                  <Archive className="mr-2 h-4 w-4" />
                  Архивировать
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDeleteButtonClick}
                  disabled={isSubmitting || deleteLoading.isPending}
                  className="text-red-600 hover:text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Удалить
                </Button>
              </div>
              {/* Основные кнопки справа */}
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Отмена
              </Button>
              <Button
                type="button"
                onClick={handleSaveClick}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Сохранение...' : 'Сохранить'}
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Отмена
              </Button>
              <Button
                type="button"
                onClick={handleSaveClick}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Сохранение...' : 'Создать'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>

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
        loading={deleteLoading.isPending}
        employeeName={employeeName}
        startDate=""
        endDate=""
        stage=""
      />

      <DeleteConfirmationDialog
        open={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleDeleteConfirm}
        loading={deleteLoading.isPending}
        employeeName={employeeName}
        startDate=""
        endDate=""
        stage=""
      />
    </Dialog>
  )
}
