'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, User as UserIcon, Mail } from 'lucide-react'
import type { UserPresentation } from '../lib/types'

interface DeleteUserConfirmProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: Pick<UserPresentation, 'id' | 'name' | 'email'> | null
  onConfirm: () => Promise<boolean>
  mode?: 'delete' | 'finish'
  disabled?: boolean
}

export function DeleteUserConfirm({ open, onOpenChange, user, onConfirm, mode = 'delete', disabled = false }: DeleteUserConfirmProps) {
  const [showSecondConfirm, setShowSecondConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Reset to first step when dialog is closed externally
  useEffect(() => {
    setShowSecondConfirm(false)
  }, [open, mode])

  const handleFirstConfirm = () => {
    setShowSecondConfirm(true)
  }

  const handleSecondConfirm = async () => {
    setIsDeleting(true)
    try {
      if (await onConfirm()) handleClose()
    } finally {
      setIsDeleting(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    onOpenChange(open)
    if (!open) {
      setShowSecondConfirm(false)
    }
  }

  const handleClose = () => {
    handleOpenChange(false)
  }

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md bg-popover border border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <AlertTriangle className="h-5 w-5 text-red-500 dark:text-red-400" />
            {showSecondConfirm ? 'Окончательное подтверждение' : mode === 'finish' ? 'Завершение работы сотрудника' : 'Подтверждение удаления пользователя'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!showSecondConfirm ? (
            <>
              <Alert className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <AlertTriangle className="h-4 w-4 text-red-500 dark:text-red-400" />
                <AlertDescription className="text-red-700 dark:text-red-300">
                  {mode === 'finish'
                    ? 'Сегодня по Минску будет последним рабочим днём сотрудника, включительно. Профиль, история и загрузки сохранятся.'
                    : 'Вы действительно хотите удалить пользователя? Это действие нельзя отменить.'}
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <UserIcon className="h-4 w-4" />
                  <span className="font-medium">{user.name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Mail className="h-4 w-4" />
                  <span>{user.email}</span>
                </div>
              </div>
            </>
          ) : (
            <Alert variant="destructive" className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
              <AlertTriangle className="h-4 w-4 text-red-500 dark:text-red-400" />
              <AlertDescription className="text-red-700 dark:text-red-300">
                {mode === 'finish'
                  ? 'Подтвердите завершение работы. Доступ к приложению автоматически не отключается — его необходимо ограничить отдельно.'
                  : <><strong>Внимание!</strong> Пользователь и его профиль будут удалены безвозвратно.</>}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isDeleting}
            className="border-border text-foreground hover:bg-accent"
          >
            Отмена
          </Button>
          {!showSecondConfirm ? (
            <Button variant="destructive" onClick={handleFirstConfirm} disabled={disabled}>
              {mode === 'finish' ? 'Завершить работу' : 'Удалить пользователя'}
            </Button>
          ) : (
            <Button variant="destructive" onClick={handleSecondConfirm} disabled={isDeleting || disabled}>
              {isDeleting ? 'Сохранение...' : mode === 'finish' ? 'Подтвердить завершение' : 'Подтвердить удаление'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


