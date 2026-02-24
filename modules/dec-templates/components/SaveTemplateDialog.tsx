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
import { createClient } from "@/utils/supabase/client"

interface SaveTemplateDialogProps {
  isOpen: boolean
  onClose: () => void
  onSave: (departmentId: string, name: string) => Promise<void>
}

type Department = {
  id: string
  name: string
}

type DepartmentRow = {
  department_id: string
  department_name: string
}

export function SaveTemplateDialog({
  isOpen,
  onClose,
  onSave,
}: SaveTemplateDialogProps) {
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("")
  const [templateName, setTemplateName] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Загрузить список отделов при открытии
  useEffect(() => {
    if (isOpen) {
      loadDepartments()
    }
  }, [isOpen])

  const loadDepartments = async () => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('departments')
        .select('department_id, department_name')
        .order('department_name')

      if (error) throw error

      setDepartments((data || []).map((d: DepartmentRow) => ({
        id: d.department_id,
        name: d.department_name
      })))
    } catch (err) {
      console.error('Ошибка загрузки отделов:', err)
      setError('Не удалось загрузить список отделов')
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить список отделов",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!selectedDepartmentId || !templateName.trim()) {
      setError('Заполните все обязательные поля')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await onSave(selectedDepartmentId, templateName.trim())
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения шаблона')
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    setSelectedDepartmentId("")
    setTemplateName("")
    setError(null)
    onClose()
  }

  const canSave = selectedDepartmentId && templateName.trim()

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md sm:rounded-md">
        <DialogHeader>
          <DialogTitle>Сохранить шаблон</DialogTitle>
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

          {/* Ошибка */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
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
