"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "@/components/ui/use-toast"
import { Trash2, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { loadTemplatesList, deleteTemplate } from "../api"
import type { TemplateListItem } from "../types"

interface TemplatesDialogProps {
  isOpen: boolean
  onClose: () => void
  onApply: (templateId: string) => Promise<void>
  hasManagePermission: boolean
}

export function TemplatesDialog({
  isOpen,
  onClose,
  onApply,
  hasManagePermission,
}: TemplatesDialogProps) {
  const [templates, setTemplates] = useState<TemplateListItem[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [departmentFilter, setDepartmentFilter] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null)

  // Загрузить список шаблонов при открытии
  useEffect(() => {
    if (isOpen) {
      loadTemplates()
    }
  }, [isOpen])

  const loadTemplates = async () => {
    setIsLoading(true)
    try {
      const data = await loadTemplatesList()
      setTemplates(data)
    } catch (error) {
      console.error('Ошибка загрузки шаблонов:', error)
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить список шаблонов",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Фильтрация по отделам на клиенте
  const filteredTemplates = templates.filter(template =>
    departmentFilter === 'all' || template.departmentId === departmentFilter
  )

  // Уникальные отделы для фильтра
  const departments = Array.from(
    new Map(templates.map(t => [t.departmentId, { id: t.departmentId, name: t.departmentName }]))
      .values()
  )

  const handleApply = async () => {
    if (!selectedTemplateId) return

    setIsApplying(true)
    try {
      await onApply(selectedTemplateId)
      handleClose()
    } catch (error) {
      console.error('Ошибка применения шаблона:', error)
    } finally {
      setIsApplying(false)
    }
  }

  const handleDeleteClick = (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setTemplateToDelete(templateId)
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!templateToDelete) return

    try {
      await deleteTemplate(templateToDelete)
      // Обновить список локально
      setTemplates(templates.filter(t => t.id !== templateToDelete))
      if (selectedTemplateId === templateToDelete) {
        setSelectedTemplateId(null)
      }
      setDeleteConfirmOpen(false)
      setTemplateToDelete(null)
      toast({
        title: "Успешно",
        description: "Шаблон успешно удален"
      })
    } catch (error) {
      console.error('Ошибка удаления шаблона:', error)
      toast({
        title: "Ошибка",
        description: "Не удалось удалить шаблон",
        variant: "destructive"
      })
    }
  }

  const handleClose = () => {
    setSelectedTemplateId(null)
    setDepartmentFilter("all")
    onClose()
  }

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "d MMM yyyy", { locale: ru })
    } catch {
      return dateString
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Шаблоны декомпозиции</DialogTitle>
            <DialogDescription className="text-sm">
              Выберите шаблон для применения к текущему разделу
            </DialogDescription>
          </DialogHeader>

          {/* Фильтр по отделам */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Отдел:</label>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Все отделы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все отделы</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Список шаблонов */}
          {isLoading ? (
            <div className="flex items-center justify-center h-[300px]">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">
              Нет доступных шаблонов
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="p-2 space-y-2">
                {filteredTemplates.map(template => (
                  <div
                    key={template.id}
                    className={`p-3 rounded-md cursor-pointer border transition-colors flex items-center justify-between group ${
                      selectedTemplateId === template.id
                        ? "border-green-500"
                        : "border-border hover:bg-accent"
                    }`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedTemplateId(template.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedTemplateId(template.id)
                      }
                    }}
                  >
                    <div className="flex-1">
                      <div className="font-medium text-sm">{template.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {template.departmentName} • {template.creatorName} • {formatDate(template.createdAt)}
                      </div>
                    </div>

                    {/* Иконка удаления - только для пользователей с правами */}
                    {hasManagePermission && (
                      <Trash2
                        className="h-4 w-4 text-muted-foreground hover:text-destructive cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                        onClick={(e) => handleDeleteClick(template.id, e)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Footer с кнопками */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose} disabled={isApplying}>
              Отмена
            </Button>
            <Button
              onClick={handleApply}
              disabled={!selectedTemplateId || isApplying}
              className={selectedTemplateId ? "bg-green-600 hover:bg-green-700" : ""}
            >
              {isApplying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Применение...
                </>
              ) : (
                "Применить шаблон"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог подтверждения удаления */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="dark:!bg-slate-700 dark:!border-slate-500">
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить шаблон?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить этот шаблон? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
