"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Calendar } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useTaskTransferStore } from "../store"
import type { Assignment, UpdateAssignmentData } from "../types"
import * as Sentry from "@sentry/nextjs"

interface EditAssignmentModalProps {
  assignment: Assignment | null
  isOpen: boolean
  onClose: () => void
  onUpdate?: (assignment: Assignment) => void
}

export function EditAssignmentModal({ assignment, isOpen, onClose, onUpdate }: EditAssignmentModalProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [plannedDuration, setPlannedDuration] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [link, setLink] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)
  
  const { updateAssignment } = useTaskTransferStore()
  const { toast } = useToast()

  // Заполняем форму данными задания при открытии
  useEffect(() => {
    if (assignment && isOpen) {
      setTitle(assignment.title || "")
      setDescription(assignment.description || "")
      setPlannedDuration(assignment.planned_duration?.toString() || "")
      setDueDate(assignment.due_date || "")
      setLink(assignment.link || "")
    }
  }, [assignment, isOpen])

  const handleSubmit = async () => {
    if (!assignment) return

    // Валидация
    if (!title.trim()) {
      toast({
        title: "Ошибка",
        description: "Название задания не может быть пустым",
        variant: "destructive",
      })
      return
    }

    const duration = plannedDuration ? parseInt(plannedDuration) : undefined
    if (duration !== undefined && (isNaN(duration) || duration <= 0 || duration > 365)) {
      toast({
        title: "Ошибка",
        description: "Плановая продолжительность должна быть от 1 до 365 дней",
        variant: "destructive",
      })
      return
    }

    setIsUpdating(true)

    await Sentry.startSpan(
      {
        op: "ui.action",
        name: "Редактирование задания в модальном окне",
      },
      async (span) => {
        try {
          span.setAttribute("component", "EditAssignmentModal")
          span.setAttribute("assignment_id", assignment.assignment_id)
          span.setAttribute("fields_changed", [
            title !== assignment.title ? "title" : null,
            description !== assignment.description ? "description" : null,
            duration !== assignment.planned_duration ? "planned_duration" : null,
            dueDate !== assignment.due_date ? "due_date" : null,
            link !== assignment.link ? "link" : null
          ].filter(Boolean).join(", "))
          
          const updateData: UpdateAssignmentData = {
            title: title.trim(),
            description: description.trim() || undefined,
            planned_duration: duration,
            due_date: dueDate || undefined,
            link: link.trim() || undefined
          }

          const result = await updateAssignment(assignment.assignment_id, updateData)

          if (result.success) {
            span.setAttribute("update.success", true)
            toast({
              title: "Успех", 
              description: "Задание успешно обновлено",
            })
            
            // Если есть колбек onUpdate, обновляем данные без закрытия модального окна
            if (onUpdate && result.data) {
              onUpdate(result.data)
            } else {
              // Закрываем только если нет колбека onUpdate (обратная совместимость)
              onClose()
            }
          } else {
            span.setAttribute("update.success", false)
            toast({
              title: "Ошибка",
              description: "Не удалось обновить задание",
              variant: "destructive",
            })
          }
        } catch (error) {
          span.setAttribute("error", true)
          span.setAttribute("error.message", (error as Error).message)
          
          Sentry.captureException(error, {
            tags: {
              module: 'task_transfer',
              component: 'EditAssignmentModal',
              action: 'update_assignment',
              assignment_id: assignment.assignment_id
            },
            extra: {
              assignment_id: assignment.assignment_id,
              original_title: assignment.title,
              new_title: title,
              update_data: JSON.stringify({
                title: title.trim(),
                description: description.trim() || undefined,
                planned_duration: duration,
                due_date: dueDate || undefined,
                link: link.trim() || undefined
              }),
              error_message: (error as Error).message,
              timestamp: new Date().toISOString()
            }
          })
          
          toast({
            title: "Ошибка",
            description: "Произошла неожиданная ошибка",
            variant: "destructive",
          })
        } finally {
          setIsUpdating(false)
        }
      }
    )
  }

  const handleClose = () => {
    if (!isUpdating) {
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Редактировать задание</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Измените необходимые поля задания
          </p>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Название */}
          <div className="space-y-2">
            <Label htmlFor="edit-title" className="text-sm font-medium">
              Название задания <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Введите название задания"
              disabled={isUpdating}
              className="w-full"
            />
          </div>

          {/* Описание */}
          <div className="space-y-2">
            <Label htmlFor="edit-description" className="text-sm font-medium">
              Описание
            </Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Введите описание задания"
              disabled={isUpdating}
              className="min-h-[100px] resize-none"
            />
          </div>

          {/* Плановая продолжительность */}
          <div className="space-y-2">
            <Label htmlFor="edit-duration" className="text-sm font-medium">
              Плановая продолжительность
            </Label>
            <div className="relative">
              <Input 
                id="edit-duration" 
                type="number" 
                min="1"
                max="365"
                value={plannedDuration}
                onChange={(e) => setPlannedDuration(e.target.value)}
                placeholder="Количество дней"
                disabled={isUpdating}
                className="w-full" 
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">
                дней
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Оставьте пустым, если не требуется
            </p>
          </div>

          {/* Дедлайн */}
          <div className="space-y-2">
            <Label htmlFor="edit-due-date" className="text-sm font-medium">
              Дедлайн задания
            </Label>
            <div className="relative">
              <Input 
                id="edit-due-date" 
                type="date" 
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={isUpdating}
                className="w-full pr-10" 
              />
              <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* Ссылка */}
          <div className="space-y-2">
            <Label htmlFor="edit-link" className="text-sm font-medium">
              Ссылка
            </Label>
            <Input 
              id="edit-link" 
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://..."
              disabled={isUpdating}
              className="w-full" 
            />
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={isUpdating}
          >
            Отмена
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={isUpdating}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isUpdating ? "Сохранение..." : "Сохранить изменения"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 