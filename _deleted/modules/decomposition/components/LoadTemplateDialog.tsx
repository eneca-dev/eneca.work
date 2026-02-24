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
import { ScrollArea } from "@/components/ui/scroll-area"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import type { DecompositionTemplate } from "../types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

interface LoadTemplateDialogProps {
  isOpen: boolean
  onClose: () => void
  onLoad: (templateId: string) => Promise<void>
  templates: DecompositionTemplate[]
  isLoading: boolean
  selectedSectionId: string | null
}

export function LoadTemplateDialog({
  isOpen,
  onClose,
  onLoad,
  templates = [], // Добавляем значение по умолчанию
  isLoading,
  selectedSectionId,
}: LoadTemplateDialogProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleLoad = async () => {
    if (!selectedTemplateId) {
      setError("Выберите шаблон")
      return
    }

    if (!selectedSectionId) {
      setError("Выберите раздел для сохранения")
      return
    }

    try {
      await onLoad(selectedTemplateId)
      setSelectedTemplateId(null)
      setError(null)
      onClose()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  // Функция для безопасного форматирования даты
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "Дата неизвестна"

    try {
      return format(new Date(dateString), "d MMMM yyyy", { locale: ru })
    } catch (error) {
      console.error("Error formatting date:", error)
      return "Дата неизвестна"
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Загрузить из шаблона</DialogTitle>
          <DialogDescription>
            Выберите шаблон декомпозиции для загрузки. Текущие данные будут заменены и автоматически сохранены в базе
            данных.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {!selectedSectionId && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Внимание</AlertTitle>
              <AlertDescription>
                Необходимо выбрать раздел перед загрузкой шаблона. Данные из шаблона будут автоматически сохранены в
                выбранном разделе.
              </AlertDescription>
            </Alert>
          )}

          {!templates || templates.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Нет доступных шаблонов</p>
          ) : (
            <ScrollArea className="h-[300px] rounded-md border">
              <div className="p-4">
                {templates.map((template) => (
                  <div
                    key={template.decomposition_template_id}
                    className={`p-3 mb-2 rounded-md cursor-pointer border ${
                      selectedTemplateId === template.decomposition_template_id
                        ? "border-primary bg-primary/5"
                        : "hover:bg-accent"
                    }`}
                    onClick={() => setSelectedTemplateId(template.decomposition_template_id)}
                  >
                    <div className="font-medium">{template.decomposition_template_name}</div>
                    <div className="text-sm text-muted-foreground mt-1 flex justify-between">
                      <span>Автор: {template.creator_name || "Неизвестно"}</span>
                      <span>{formatDate(template.decomposition_template_created_at)}</span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Элементов: {template.decomposition_template_content?.length || 0}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
          {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleLoad} disabled={isLoading || !selectedTemplateId || !selectedSectionId}>
            {isLoading ? "Загрузка..." : "Загрузить и сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
