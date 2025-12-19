'use client'

/**
 * DeleteConfirmDialog - Диалог подтверждения удаления
 */

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

// ============================================================================
// Types
// ============================================================================

interface DeleteConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  itemsCount?: number
}

// ============================================================================
// Component
// ============================================================================

export function DeleteConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  itemsCount,
}: DeleteConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description}
            {itemsCount && itemsCount > 1 && (
              <span className="block mt-2 font-medium">
                Будет удалено элементов: {itemsCount}
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Отмена</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Удалить
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
