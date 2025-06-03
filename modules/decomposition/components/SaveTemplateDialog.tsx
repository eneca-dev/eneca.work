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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface SaveTemplateDialogProps {
  isOpen: boolean
  onClose: () => void
  onSave: (templateName: string) => Promise<void>
  isLoading: boolean
}

export function SaveTemplateDialog({ isOpen, onClose, onSave, isLoading }: SaveTemplateDialogProps) {
  const [templateName, setTemplateName] = useState("")
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!templateName.trim()) {
      setError("Введите название шаблона")
      return
    }

    try {
      await onSave(templateName)
      setTemplateName("")
      setError(null)
      onClose()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Сохранить как шаблон</DialogTitle>
          <DialogDescription>
            Введите название для шаблона декомпозиции. Шаблон будет доступен всем сотрудникам вашего отдела.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="template-name" className="text-right">
              Название
            </Label>
            <Input
              id="template-name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="col-span-3"
              placeholder="Например: Стандартная декомпозиция ОВ"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
