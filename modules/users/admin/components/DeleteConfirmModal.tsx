"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"

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

export default function DeleteConfirmModal({
  open,
  onOpenChange,
  title,
  entityName,
  table,
  idField,
  entityId,
  onSuccess
}: DeleteConfirmModalProps) {
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    setLoading(true)

    try {
      const supabase = createClient()
      
      const { error } = await supabase
        .from(table)
        .delete()
        .eq(idField, entityId)

      if (error) throw error

      toast.success("Запись успешно удалена")
      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error("Error deleting:", error)
      toast.error("Произошла ошибка при удалении")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-destructive mr-2" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Вы уверены, что хотите удалить "{entityName}"? 
            Это действие нельзя отменить.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Отмена
          </Button>
          <Button 
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? "Удаление..." : "Удалить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 