"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Trash2 } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import { Modal, ModalButton } from '@/components/modals'

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
      console.error("Error deleting:", error instanceof Error ? error.message : error)
      toast.error("Произошла ошибка при удалении")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={open} onClose={() => onOpenChange(false)} size="sm">
      <Modal.Header 
        title={
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
            {title}
          </div>
        }
        onClose={() => onOpenChange(false)}
      />
      
      <Modal.Body>
        <p className="text-gray-600 dark:text-slate-400">
          Вы уверены, что хотите удалить "{entityName}"? 
          Это действие нельзя отменить.
        </p>
      </Modal.Body>
      
      <Modal.Footer>
        <ModalButton 
          variant="cancel"
          onClick={() => onOpenChange(false)}
          disabled={loading}
        >
          Отмена
        </ModalButton>
        <ModalButton 
          variant="danger"
          onClick={handleDelete}
          loading={loading}
          icon={<Trash2 />}
        >
          {loading ? 'Удаление...' : 'Удалить'}
        </ModalButton>
      </Modal.Footer>
    </Modal>
  )
} 