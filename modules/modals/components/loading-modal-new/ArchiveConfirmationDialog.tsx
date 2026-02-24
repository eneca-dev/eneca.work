'use client'

/**
 * Loading Modal New - Диалог подтверждения архивирования загрузки
 *
 * Показывает предупреждение перед архивированием (soft delete) загрузки
 */

import { Archive, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

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
  /** Название этапа декомпозиции (для отображения, опционально) */
  stageName?: string
  /** Дата начала */
  startDate?: string
  /** Дата окончания */
  endDate?: string
  /** Ставка */
  rate?: number
}

export function ArchiveConfirmationDialog({
  open,
  onClose,
  onConfirm,
  loading = false,
  employeeName,
  sectionName,
  stageName,
  startDate,
  endDate,
  rate,
}: ArchiveConfirmationDialogProps) {
  const handleConfirm = async () => {
    await onConfirm()
    // Не закрываем диалог здесь - onClose будет вызван после успешного архивирования
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
            <Archive className="h-5 w-5 text-orange-600" />
            <DialogTitle>Архивировать загрузку?</DialogTitle>
          </div>
          <DialogDescription asChild>
            <div className="space-y-2">
              <p>Вы уверены, что хотите архивировать эту загрузку?</p>

              {(employeeName || sectionName || stageName || startDate || endDate || rate) && (
                <div className="mt-3 p-3 bg-muted rounded-md text-sm space-y-1.5">
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

              {/* <p className="text-muted-foreground mt-3">
                Архивированная загрузка не будет отображаться в основном списке, но её можно будет
                восстановить при необходимости.
              </p> */}
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
            className="bg-orange-600 hover:bg-orange-700 focus:ring-orange-600"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Архивировать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
