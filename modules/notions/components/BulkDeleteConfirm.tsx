'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'
import { getNotionDisplayTitle } from '@/modules/notions/utils'
import type { Notion } from '@/modules/notions/types'

// Reusable DestructiveAlert component
interface DestructiveAlertProps {
  children: React.ReactNode
  className?: string
}

function DestructiveAlert({ children, className }: DestructiveAlertProps) {
  return (
    <Alert className={`bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 ${className || ''}`}>
      <AlertTriangle className="h-4 w-4 text-red-500 dark:text-red-400" />
      <AlertDescription className="text-red-700 dark:text-red-300">
        {children}
      </AlertDescription>
    </Alert>
  )
}

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
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <AlertTriangle className="h-5 w-5 text-red-500 dark:text-red-400" />
            {showSecondConfirm ? 'Окончательное подтверждение' : 'Подтверждение удаления'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!showSecondConfirm ? (
            <>
              <DestructiveAlert>
                Вы действительно хотите удалить {selectedNotions.length} 
                {selectedNotions.length === 1 ? ' заметку' : 
                 selectedNotions.length <= 4 ? ' заметки' : ' заметок'}?
              </DestructiveAlert>

              {selectedNotions.length <= 5 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Выбранные заметки:</p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
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
                  <p className="text-sm font-medium text-foreground">Выбранные заметки:</p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {selectedNotions.slice(0, 3).map((notion) => (
                      <li key={notion.notion_id} className="truncate">
                        • {getNotionDisplayTitle(notion) || 'Пустая заметка'}
                      </li>
                    ))}
                    <li className="text-muted-foreground italic">
                      ... и еще {selectedNotions.length - 3} заметок
                    </li>
                  </ul>
                </div>
              )}
            </>
          ) : (
            <DestructiveAlert>
              <strong>Внимание!</strong> Это действие нельзя отменить. 
              Все выбранные заметки будут удалены навсегда.
            </DestructiveAlert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isDeleting}
            className="border-border text-foreground hover:bg-accent"
            aria-label="Отмена удаления"
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