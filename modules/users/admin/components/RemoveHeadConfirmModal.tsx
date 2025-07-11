"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import { Modal, ModalButton } from '@/components/modals'
import { UserMinus, AlertTriangle } from 'lucide-react'

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
    <Modal isOpen={open} onClose={() => onOpenChange(false)} size="sm">
      <Modal.Header 
        title={
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Убрать руководителя {type === "department" ? "отдела" : "команды"}
          </div>
        }
      />
      
      <Modal.Body>
        <p className="text-gray-600 dark:text-slate-400">
          Вы уверены, что хотите убрать руководителя {type === "department" ? "отдела" : "команды"} <strong>"{entityName}"</strong>? 
          Это действие нельзя отменить.
        </p>
      </Modal.Body>

      <Modal.Footer>
        <ModalButton 
          variant="cancel"
          onClick={() => onOpenChange(false)}
        >
          Отменить
        </ModalButton>
        <ModalButton 
          variant="danger"
          onClick={handleRemoveHead} 
          loading={isRemoving}
          icon={<UserMinus />}
        >
          {isRemoving ? 'Удаление...' : 'Убрать'}
        </ModalButton>
      </Modal.Footer>
    </Modal>
  )
} 