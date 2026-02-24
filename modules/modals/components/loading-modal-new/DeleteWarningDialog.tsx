'use client'

/**
 * Loading Modal New - Диалог предупреждения перед удалением загрузки
 *
 * Показывает предупреждение что загрузки нужно архивировать,
 * и предлагает выбор между "Удалить", "Архивировать" и "Отменить"
 */

import { AlertTriangle, Archive, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export interface DeleteWarningDialogProps {
  /** Открыт ли диалог */
  open: boolean
  /** Callback при закрытии */
  onClose: () => void
  /** Callback при выборе "Удалить" */
  onDelete: () => void
  /** Callback при выборе "Архивировать" */
  onArchive: () => void
}

export function DeleteWarningDialog({
  open,
  onClose,
  onDelete,
  onArchive,
}: DeleteWarningDialogProps) {
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <DialogTitle>Удаление загрузки</DialogTitle>
          </div>
          <DialogDescription asChild>
            <div className="space-y-3">
              <p className="text-base font-medium text-amber-600">
                Загрузки необходимо архивировать. Удалению подлежат только ошибочно созданные загрузки.
              </p>

              <p className="text-sm text-muted-foreground">
                Архивирование сохранит данные для истории и аналитики, а удаление необратимо удалит загрузку.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button variant="outline" onClick={onClose}>
            Отменить
          </Button>
          <div className="flex gap-2">
          <Button
              onClick={onDelete}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Удалить
            </Button>
            <Button
              onClick={onArchive}
              className="bg-orange-600 hover:bg-orange-700 focus:ring-orange-600"
            >
              <Archive className="mr-2 h-4 w-4" />
              Архивировать
            </Button>

          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
