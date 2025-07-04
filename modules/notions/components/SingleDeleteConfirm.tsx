'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'
import { getNotionDisplayTitle } from '@/modules/notions/utils'
import type { Notion } from '@/modules/notions/types'

interface SingleDeleteConfirmProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  notion: Notion | null
  onConfirm: () => Promise<void>
}

export function SingleDeleteConfirm({ 
  open, 
  onOpenChange, 
  notion, 
  onConfirm 
}: SingleDeleteConfirmProps) {
  const [showSecondConfirm, setShowSecondConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleFirstConfirm = () => {
    setShowSecondConfirm(true)
  }

  const handleSecondConfirm = async () => {
    setIsDeleting(true)
    try {
      await onConfirm()
      handleClose()
    } finally {
      setIsDeleting(false)
    }
  }

  const handleClose = () => {
    setShowSecondConfirm(false)
    onOpenChange(false)
  }

  if (!notion) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md bg-white dark:bg-gray-800 borderborder-gray-200 dark:border-gray-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <AlertTriangle className="h-5 w-5 text-red-500 dark:text-red-400" />
            {showSecondConfirm ? 'Окончательное подтверждение' : 'Подтверждение удаления'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!showSecondConfirm ? (
            <>
              <Alert className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <AlertTriangle className="h-4 w-4 text-red-500 dark:text-red-400" />
                <AlertDescription className="text-red-700 dark:text-red-300">
                  Вы действительно хотите удалить эту заметку?
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Заметка:</p>
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                  {getNotionDisplayTitle(notion) || 'Пустая заметка'}
                </div>
              </div>
            </>
          ) : (
            <Alert variant="destructive" className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
              <AlertTriangle className="h-4 w-4 text-red-500 dark:text-red-400" />
              <AlertDescription className="text-red-700 dark:text-red-300">
                <strong>Внимание!</strong> Это действие нельзя отменить. 
                Заметка будет удалена навсегда.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isDeleting}
            className="border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Отмена
          </Button>
          {!showSecondConfirm ? (
            <Button
              variant="destructive"
              onClick={handleFirstConfirm}
            >
              Удалить заметку
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={handleSecondConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? 'Удаление...' : 'Подтвердить удаление'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 