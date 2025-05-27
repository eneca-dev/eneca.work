"use client"
import { useCallback, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { createClient } from "@/utils/supabase/client"
import { AlertTriangle, Check, Loader2, X } from "lucide-react"
import { useNotification } from "@/lib/notification-context"

interface DeleteConfirmModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  entityName: string
  table: string
  idField: string
  entityId: string
  onSuccess: () => void
}

type ErrorWithDetails = {
  message?: string
  code?: string
  details?: string
  hint?: string
}

export default function DeleteConfirmModal({
  open,
  onOpenChange,
  title,
  entityName,
  table,
  idField,
  entityId,
  onSuccess,
}: DeleteConfirmModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const notification = useNotification()

  // Мемоизируем функцию удаления
  const handleDelete = useCallback(async () => {
    if (!entityId) {
      console.error("ID для удаления не указан")
      return
    }
    
    try {
      setIsLoading(true)
      const supabase = createClient()
      
      // Выполняем запрос на удаление
      const { error } = await supabase
        .from(table)
        .delete()
        .eq(idField, entityId)
      
      if (error) {
        notification.error(`Не удалось удалить запись из таблицы ${table}`, error);
        throw error
      }
      
      // Отображаем уведомление об успешном удалении
      notification.success(
        "Запись успешно удалена", 
        `Запись "${entityName}" была удалена из таблицы ${table}`
      );
      
      // Вызываем колбэк успешного завершения
      onSuccess()
      
      // Закрываем модальное окно
      onOpenChange(false)
    } catch (error) {
      const err = error as ErrorWithDetails
      console.error(`Ошибка при удалении из таблицы ${table}:`, err)
      
      // Отображаем сообщение об ошибке
      notification.error(
        "Не удалось удалить запись", 
        err.message || "Неизвестная ошибка при удалении"
      )
    } finally {
      setIsLoading(false)
    }
  }, [entityId, table, idField, entityName, notification, onSuccess, onOpenChange])

  // Стабильная функция для закрытия модального окна
  const handleClose = useCallback(() => {
    if (!isLoading) {
      onOpenChange(false)
    }
  }, [isLoading, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-destructive mr-2" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Вы уверены, что хотите удалить <strong>{entityName}</strong>? Это действие нельзя отменить.
          </DialogDescription>
        </DialogHeader>
        
        <DialogFooter className="mt-6">
          <div className="flex gap-2 justify-end w-full">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose}
              disabled={isLoading}
            >
              <X className="mr-2 h-4 w-4" /> Отмена
            </Button>
            <Button 
              type="button" 
              variant="destructive" 
              onClick={handleDelete}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Удаление...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" /> Подтвердить
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 