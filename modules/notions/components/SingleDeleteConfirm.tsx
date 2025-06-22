'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'
import { getNotionDisplayTitle } from '../utils'
import type { Notion } from '../types'

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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            {showSecondConfirm ? 'Окончательное подтверждение' : 'Подтверждение удаления'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!showSecondConfirm ? (
            <>
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Вы действительно хотите удалить эту заметку?
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <p className="text-sm font-medium">Заметка:</p>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded text-sm">
                  {getNotionDisplayTitle(notion) || 'Пустая заметка'}
                </div>
              </div>
            </>
          ) : (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
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