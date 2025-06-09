"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"

interface EntityModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  mode: "create" | "edit"
  table: string
  idField: string
  nameField: string
  entity?: Record<string, string | number | null>
  extraFields?: Array<{
    name: string
    label: string
    type: "text" | "select"
    options?: Array<{ value: string; label: string }>
    required?: boolean
  }>
  onSuccess: () => void
}

export default function EntityModal({
  open,
  onOpenChange,
  title,
  mode,
  table,
  idField,
  nameField,
  entity,
  extraFields = [],
  onSuccess
}: EntityModalProps) {
  const [formData, setFormData] = useState<Record<string, string | number | null>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (mode === "edit" && entity) {
      setFormData(entity)
    } else {
      setFormData({})
    }
  }, [mode, entity, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Basic validation
    if (!formData[nameField]?.toString().trim()) {
      toast.error("Название обязательно для заполнения")
      return
    }
    
    // Validate required extra fields
    for (const field of extraFields) {
      if (field.required && !formData[field.name]) {
        toast.error(`Поле "${field.label}" обязательно для заполнения`)
        return
      }
    }
    
    setLoading(true)

    try {
      const supabase = createClient()

      if (mode === "create") {
        // При создании исключаем поле ID, так как оно генерируется автоматически
        const insertData = { ...formData }
        delete insertData[idField]
        
        const { error } = await supabase
          .from(table)
          .insert([insertData])

        if (error) throw error
        toast.success("Запись успешно создана")
      } else {
        const { error } = await supabase
          .from(table)
          .update(formData)
          .eq(idField, entity![idField])

        if (error) throw error
        toast.success("Запись успешно обновлена")
      }

      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error("Error:", error)
      toast.error("Произошла ошибка при сохранении")
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {mode === "create" 
              ? table === "departments"
                ? "Введите название нового отдела и нажмите кнопку «Сохранить»"
                : table === "teams"
                  ? "Введите название новой команды и нажмите кнопку «Сохранить»"
                  : table === "positions"
                    ? "Введите название новой должности и нажмите кнопку «Сохранить»"
                    : table === "categories"
                      ? "Введите название новой категории и нажмите кнопку «Сохранить»"
                      : "Заполните необходимые поля для создания новой записи. После заполнения нажмите кнопку «Сохранить»."
              : "Отредактируйте необходимые поля. Изменения вступят в силу после нажатия кнопки «Сохранить»."
            }
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              id={nameField}
              value={formData[nameField]?.toString() || ""}
              onChange={(e) => handleInputChange(nameField, e.target.value)}
              required
            />
          </div>

          {extraFields.map((field) => (
            <div key={field.name}>
              <Label htmlFor={field.name}>{field.label}</Label>
              {field.type === "select" ? (
                field.options && field.options.length > 0 ? (
                  <Select
                    value={formData[field.name]?.toString() || ""}
                    onValueChange={(value) => handleInputChange(field.name, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`Выберите ${field.label.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Нет доступных вариантов для выбора
                  </div>
                )
              ) : (
                <Input
                  id={field.name}
                  value={formData[field.name]?.toString() || ""}
                  onChange={(e) => handleInputChange(field.name, e.target.value)}
                  required={field.required}
                />
              )}
            </div>
          ))}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 