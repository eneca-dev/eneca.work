"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import { Modal, ModalButton } from '@/components/modals'
import { UserMinus, AlertTriangle } from 'lucide-react'
import * as Sentry from "@sentry/nextjs"

interface RemoveHeadConfirmModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: "department" | "team" | "subdivision"
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

      if (type === "subdivision") {
        // Убираем руководителя подразделения
        const { error } = await supabase
          .from("subdivisions")
          .update({ subdivision_head_id: null })
          .eq("subdivision_id", entityId)

        if (error) {
          console.error("Ошибка при удалении руководителя подразделения:", error)
          Sentry.captureException(error, { tags: { module: 'users', component: 'RemoveHeadConfirmModal', action: 'remove_subdivision_head', error_type: 'db_error' }, extra: { entity_id: entityId } })
          toast.error("Не удалось убрать руководителя подразделения")
          return
        }

        toast.success("Руководитель подразделения убран")
      } else if (type === "department") {
        // Убираем руководителя отдела через новую систему
        const { error } = await supabase
          .from("departments")
          .update({ department_head_id: null })
          .eq("department_id", entityId)

        if (error) {
          console.error("Ошибка при удалении руководителя отдела:", error)
          Sentry.captureException(error, { tags: { module: 'users', component: 'RemoveHeadConfirmModal', action: 'remove_department_head', error_type: 'db_error' }, extra: { entity_id: entityId } })
          toast.error("Не удалось убрать руководителя отдела")
          return
        }

        toast.success("Руководитель отдела убран")
      } else {
        // Убираем тимлида команды через новую систему
        const { error } = await supabase
          .from("teams")
          .update({ team_lead_id: null })
          .eq("team_id", entityId)

        if (error) {
          console.error("Ошибка при удалении руководителя команды:", error)
          Sentry.captureException(error, { tags: { module: 'users', component: 'RemoveHeadConfirmModal', action: 'remove_team_head', error_type: 'db_error' }, extra: { entity_id: entityId } })
          toast.error("Не удалось убрать руководителя команды")
          return
        }

        toast.success("Руководитель команды убран")
      }

      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error("Ошибка при удалении руководителя:", error)
      Sentry.captureException(error, { tags: { module: 'users', component: 'RemoveHeadConfirmModal', action: 'remove_head_unexpected', error_type: 'unexpected' }, extra: { entity_id: entityId, type } })
      toast.error("Произошла ошибка")
    } finally {
      setIsRemoving(false)
    }
  }

  const getEntityLabel = () => {
    if (type === "subdivision") return "подразделения"
    if (type === "department") return "отдела"
    return "команды"
  }

  return (
    <Modal isOpen={open} onClose={() => onOpenChange(false)} size="sm">
      <Modal.Header
        title={
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Убрать руководителя {getEntityLabel()}
          </div>
        }
      />

      <Modal.Body>
        <p className="text-muted-foreground">
          Вы уверены, что хотите убрать руководителя {getEntityLabel()} <strong>"{entityName}"</strong>?
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