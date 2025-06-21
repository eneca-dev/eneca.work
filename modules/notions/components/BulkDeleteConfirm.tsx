'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'
import { getNotionDisplayTitle } from '../utils'
import type { Notion } from '../types'

interface BulkDeleteConfirmProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedNotions: Notion[]
  onConfirm: () => Promise<void>
}

export function BulkDeleteConfirm({ 
  open, 
  onOpenChange, 
  selectedNotions, 
  onConfirm 
}: BulkDeleteConfirmProps) {
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
                  Вы действительно хотите удалить {selectedNotions.length} 
                  {selectedNotions.length === 1 ? ' заметку' : 
                   selectedNotions.length <= 4 ? ' заметки' : ' заметок'}?
                </AlertDescription>
              </Alert>

              {selectedNotions.length <= 5 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Выбранные заметки:</p>
                  <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                    {selectedNotions.map((notion) => (
                      <li key={notion.notion_id} className="truncate">
                        • {getNotionDisplayTitle(notion) || 'Пустая заметка'}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedNotions.length > 5 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Выбранные заметки:</p>
                  <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                    {selectedNotions.slice(0, 3).map((notion) => (
                      <li key={notion.notion_id} className="truncate">
                        • {getNotionDisplayTitle(notion) || 'Пустая заметка'}
                      </li>
                    ))}
                    <li className="text-gray-500 italic">
                      ... и еще {selectedNotions.length - 3} заметок
                    </li>
                  </ul>
                </div>
              )}
            </>
          ) : (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Внимание!</strong> Это действие нельзя отменить. 
                Все выбранные заметки будут удалены навсегда.
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
              Удалить заметки
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