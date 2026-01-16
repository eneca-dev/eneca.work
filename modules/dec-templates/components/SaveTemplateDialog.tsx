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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import { Loader2 } from "lucide-react"
import { useDepartmentsList } from "../hooks"

interface SaveTemplateDialogProps {
  isOpen: boolean
  onClose: () => void
  onSave: (departmentId: string, name: string) => Promise<void>
  /** ID отдела пользователя для предвыбора */
  defaultDepartmentId?: string
}

export function SaveTemplateDialog({
  isOpen,
  onClose,
  onSave,
  defaultDepartmentId,
}: SaveTemplateDialogProps) {
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("")
  const [templateName, setTemplateName] = useState<string>("")
  const [isSaving, setIsSaving] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  // TanStack Query для загрузки отделов через cache module
  const {
    data: departments = [],
    isLoading,
    error: loadError,
  } = useDepartmentsList({ enabled: isOpen })

  // Показать ошибку загрузки
  useEffect(() => {
    if (loadError) {
      console.error('Ошибка загрузки отделов:', loadError)
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить список отделов",
        variant: "destructive"
      })
    }
  }, [loadError])

  // Предвыбор отдела пользователя при первом открытии
  useEffect(() => {
    if (isOpen && !isInitialized && defaultDepartmentId && departments.length > 0) {
      // Проверяем, что такой отдел существует в списке
      const departmentExists = departments.some(d => d.id === defaultDepartmentId)
      if (departmentExists) {
        setSelectedDepartmentId(defaultDepartmentId)
      }
      setIsInitialized(true)
    }
  }, [isOpen, defaultDepartmentId, departments, isInitialized])

  const handleSave = async (): Promise<void> => {
    if (!selectedDepartmentId || !templateName.trim()) {
      setValidationError('Заполните все обязательные поля')
      return
    }

    setIsSaving(true)
    setValidationError(null)

    try {
      await onSave(selectedDepartmentId, templateName.trim())
      handleClose()
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Ошибка сохранения шаблона')
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = (): void => {
    setSelectedDepartmentId("")
    setTemplateName("")
    setValidationError(null)
    setIsInitialized(false)
    onClose()
  }

  const canSave = Boolean(selectedDepartmentId && templateName.trim())

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md sm:rounded-md">
        <DialogHeader>
          <DialogTitle>Сохранить как шаблон</DialogTitle>
          <DialogDescription className="text-sm">
            Сохраните текущую структуру этапов как шаблон
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Выбор отдела */}
          <div className="space-y-2">
            <Label htmlFor="department">Отдел *</Label>
            {isLoading ? (
              <div className="flex items-center justify-center h-10 border rounded-md">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Select
                value={selectedDepartmentId}
                onValueChange={setSelectedDepartmentId}
                disabled={isSaving}
              >
                <SelectTrigger id="department">
                  <SelectValue placeholder="Выберите отдел" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map(dept => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Название шаблона */}
          <div className="space-y-2">
            <Label htmlFor="template-name">Название шаблона *</Label>
            <Input
              id="template-name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Например: Стандартная задача"
              disabled={isSaving}
            />
          </div>

          {/* Ошибка валидации */}
          {validationError && (
            <p className="text-sm text-destructive">{validationError}</p>
          )}
        </div>

        {/* Footer с кнопками */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            Отмена
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave || isSaving}
            className={canSave ? "bg-green-600 hover:bg-green-700" : ""}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Сохранение...
              </>
            ) : (
              "Сохранить"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
