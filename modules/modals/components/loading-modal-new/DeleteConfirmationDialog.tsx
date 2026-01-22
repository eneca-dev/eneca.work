'use client'

/**
 * Loading Modal New - Диалог подтверждения удаления загрузки
 *
 * Показывает предупреждение перед жестким удалением (hard delete) загрузки
 */

import { AlertTriangle, Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export interface DeleteConfirmationDialogProps {
  /** Открыт ли диалог */
  open: boolean
  /** Callback при закрытии */
  onClose: () => void
  /** Callback при подтверждении удаления */
  onConfirm: () => void | Promise<void>
  /** Состояние загрузки */
  loading?: boolean
  /** Название сотрудника (для отображения) */
  employeeName?: string
  /** Название раздела (для отображения) */
  sectionName?: string
}

export function DeleteConfirmationDialog({
  open,
  onClose,
  onConfirm,
  loading = false,
  employeeName,
  sectionName,
}: DeleteConfirmationDialogProps) {
  const handleConfirm = async () => {
    await onConfirm()
    // Не закрываем диалог здесь - onClose будет вызван после успешного удаления
  }

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && !loading && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <AlertDialogTitle>Удалить загрузку?</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-2">
            <p>Вы уверены, что хотите безвозвратно удалить эту загрузку?</p>

            {(employeeName || sectionName) && (
              <div className="mt-3 p-3 bg-muted rounded-md text-sm">
                {employeeName && (
                  <div>
                    <span className="font-medium">Сотрудник:</span> {employeeName}
                  </div>
                )}
                {sectionName && (
                  <div>
                    <span className="font-medium">Раздел:</span> {sectionName}
                  </div>
                )}
              </div>
            )}

            <p className="text-red-600 font-medium mt-3">
              Это действие нельзя отменить. Данные будут удалены навсегда.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Отмена</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleConfirm()
            }}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Удалить
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
