"use client"

import { Mail, AlertCircle } from "lucide-react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface ConfirmSendDialogProps {
  open: boolean
  userEmail: string
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmSendDialog = ({ open, userEmail, onConfirm, onCancel }: ConfirmSendDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Mail className="w-5 h-5 text-blue-600" />
            <span>Подтверждение отправки</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-start space-x-2 py-2">
          <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="space-y-2">
            <div className="text-sm">
              Действительно ли вы хотите отправить на почту <strong className="text-gray-900">"{userEmail}"</strong>{" "}
              исправленную версию файла?
            </div>
            <div className="text-sm text-gray-500">
              После отправки вы получите ссылку для скачивания обработанного PDF-файла.
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onCancel} className="w-full sm:w-auto">
            Нет, отменить
          </Button>
          <Button onClick={onConfirm} className="w-full sm:w-auto">
            Да, отправить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
