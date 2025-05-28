"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
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
  entity?: any
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
  const [formData, setFormData] = useState<Record<string, any>>({})
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
    setLoading(true)

    try {
      const supabase = createClient()

      if (mode === "create") {
        const { error } = await supabase
          .from(table)
          .insert([formData])

        if (error) throw error
        toast.success("Запись успешно создана")
      } else {
        const { error } = await supabase
          .from(table)
          .update(formData)
          .eq(idField, entity[idField])

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
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor={nameField}>Название</Label>
            <Input
              id={nameField}
              value={formData[nameField] || ""}
              onChange={(e) => handleInputChange(nameField, e.target.value)}
              required
            />
          </div>

          {extraFields.map((field) => (
            <div key={field.name}>
              <Label htmlFor={field.name}>{field.label}</Label>
              {field.type === "select" ? (
                <Select
                  value={formData[field.name] || ""}
                  onValueChange={(value) => handleInputChange(field.name, value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={`Выберите ${field.label.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options?.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id={field.name}
                  value={formData[field.name] || ""}
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