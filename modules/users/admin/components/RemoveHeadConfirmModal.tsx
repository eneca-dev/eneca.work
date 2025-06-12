"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"

interface RemoveHeadConfirmModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: "department" | "team"
  entityName: string
  entityId: string
  onSuccess: () => void
}

export default function RemoveHeadConfirmModal({
  open,
  onOpenChange,
  type,
  entityName,
  entityId,
  onSuccess
}: RemoveHeadConfirmModalProps) {
  const [isRemoving, setIsRemoving] = useState(false)

  const handleRemoveHead = async () => {
    try {
      setIsRemoving(true)
      const supabase = createClient()

      if (type === "department") {
        // Удаляем руководителя отдела
        const { error } = await supabase
          .from("department_heads")
          .delete()
          .eq("department_id", entityId)

        if (error) {
          console.error("Ошибка при удалении руководителя отдела:", error)
          toast.error("Не удалось убрать руководителя отдела")
          return
        }

        toast.success("Руководитель отдела убран")
      } else {
        // Удаляем руководителя команды
        const { error } = await supabase
          .from("team_leads")
          .delete()
          .eq("team_id", entityId)
          .eq("is_active", true)

        if (error) {
          console.error("Ошибка при удалении руководителя команды:", error)
          toast.error("Не удалось убрать руководителя команды")
          return
        }

        toast.success("Руководитель команды убран")
      }

      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error("Ошибка при удалении руководителя:", error)
      toast.error("Произошла ошибка")
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Убрать руководителя {type === "department" ? "отдела" : "команды"}
          </DialogTitle>
          <DialogDescription>
            Вы уверены, что хотите убрать руководителя {type === "department" ? "отдела" : "команды"} <strong>"{entityName}"</strong>? 
            Это действие нельзя отменить.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отменить
          </Button>
          <Button 
            variant="destructive"
            onClick={handleRemoveHead} 
            disabled={isRemoving}
          >
            {isRemoving ? "Удаление..." : "Убрать"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 