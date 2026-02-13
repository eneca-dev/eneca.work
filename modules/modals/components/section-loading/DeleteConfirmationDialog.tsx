'use client'

/**
 * Loading Modal New - Диалог подтверждения удаления загрузки
 *
 * Показывает предупреждение перед жестким удалением (hard delete) загрузки
 */

import { AlertTriangle, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

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
  /** Название раздела/этапа (для отображения) */
  stageName?: string
  /** Дата начала */
  startDate?: string
  /** Дата окончания */
  endDate?: string
  /** Ставка */
  rate?: number
}

export function DeleteConfirmationDialog({
  open,
  onClose,
  onConfirm,
  loading = false,
  employeeName,
  stageName,
  startDate,
  endDate,
  rate,
}: DeleteConfirmationDialogProps) {
  const handleConfirm = async () => {
    await onConfirm()
    // Не закрываем диалог здесь - onClose будет вызван после успешного удаления
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen && !loading) {
        onClose()
      }
    }}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <DialogTitle>Удалить загрузку?</DialogTitle>
          </div>
          <DialogDescription asChild>
            <div className="space-y-2">
              <p>Вы уверены, что хотите безвозвратно удалить эту загрузку?</p>

              {(employeeName || stageName || startDate || endDate || rate) && (
                <div className="mt-3 p-3 bg-muted rounded-md text-sm space-y-1.5">
                  {employeeName && (
                    <div>
                      <span className="font-medium">Сотрудник:</span> {employeeName}
                    </div>
                  )}
                  {stageName && (
                    <div>
                      <span className="font-medium">Этап:</span> {stageName}
                    </div>
                  )}
                  {(startDate || endDate) && (
                    <div>
                      <span className="font-medium">Период:</span>{' '}
                      {startDate && new Date(startDate).toLocaleDateString('ru-RU')}
                      {startDate && endDate && ' - '}
                      {endDate && new Date(endDate).toLocaleDateString('ru-RU')}
                    </div>
                  )}
                  {rate !== undefined && (
                    <div>
                      <span className="font-medium">Ставка:</span> {rate}
                    </div>
                  )}
                </div>
              )}

              <p className="text-red-600 font-medium mt-3">
                Это действие нельзя отменить. Данные будут удалены навсегда.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Отмена
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Удалить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
