'use client'

/**
 * Loading Modal 2 - Диалог подтверждения архивирования загрузки
 *
 * Показывает предупреждение перед архивированием (soft delete) загрузки
 */

import { Archive, Loader2 } from 'lucide-react'
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

export interface ArchiveConfirmationDialogProps {
  /** Открыт ли диалог */
  open: boolean
  /** Callback при закрытии */
  onClose: () => void
  /** Callback при подтверждении архивирования */
  onConfirm: () => void | Promise<void>
  /** Состояние загрузки */
  loading?: boolean
  /** Название сотрудника (для отображения) */
  employeeName?: string
  /** Название раздела (для отображения) */
  sectionName?: string
}

export function ArchiveConfirmationDialog({
  open,
  onClose,
  onConfirm,
  loading = false,
  employeeName,
  sectionName,
}: ArchiveConfirmationDialogProps) {
  const handleConfirm = async () => {
    await onConfirm()
    // Не закрываем диалог здесь - onClose будет вызван после успешного архивирования
  }

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && !loading && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-orange-600" />
            <AlertDialogTitle>Архивировать загрузку?</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-2">
            <p>Вы уверены, что хотите архивировать эту загрузку?</p>

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

            <p className="text-muted-foreground mt-3">
              Архивированная загрузка не будет отображаться в основном списке, но её можно будет
              восстановить при необходимости.
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
            className="bg-orange-600 hover:bg-orange-700 focus:ring-orange-600"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Архивировать
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
