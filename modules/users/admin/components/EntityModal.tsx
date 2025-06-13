"use client"

import { useState, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import { validateEntityName, validateCategoryName, validatePositionName, checkDuplicateName, getDuplicateErrorMessage, ValidationResult } from "@/utils/validation"

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
  existingNames?: string[]
  entityType?: string
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
  existingNames = [],
  entityType,
  onSuccess
}: EntityModalProps) {
  const [formData, setFormData] = useState<Record<string, string | number | null>>({})
  const [loading, setLoading] = useState(false)
  const [validation, setValidation] = useState<ValidationResult>({ isValid: true, errors: [], normalizedValue: "" })
  const [duplicateError, setDuplicateError] = useState<string>("")

  useEffect(() => {
    if (mode === "edit" && entity) {
      setFormData(entity)
    } else {
      setFormData({})
    }
    // Сбрасываем валидацию при открытии модала
    setValidation({ isValid: true, errors: [], normalizedValue: "" })
    setDuplicateError("")
  }, [mode, entity, open])

  // Валидация названия в реальном времени
  useEffect(() => {
    const nameValue = formData[nameField]?.toString() || ""
    
    if (nameValue.length === 0) {
      setValidation({ isValid: true, errors: [], normalizedValue: "" })
      setDuplicateError("")
      return
    }

    // Валидация формата (используем специальные валидации для разных типов)
    let validationResult: ValidationResult
    if (table === "categories") {
      validationResult = validateCategoryName(nameValue)
    } else if (table === "positions") {
      validationResult = validatePositionName(nameValue)
    } else {
      validationResult = validateEntityName(nameValue)
    }
    setValidation(validationResult)

    // Проверка дубликатов
    if (validationResult.isValid && existingNames.length > 0) {
      const excludeName = mode === "edit" ? entity?.[nameField]?.toString() : undefined
      const isDuplicate = checkDuplicateName(validationResult.normalizedValue, existingNames, excludeName)
      
      if (isDuplicate && entityType) {
        setDuplicateError(getDuplicateErrorMessage(entityType))
      } else {
        setDuplicateError("")
      }
    } else {
      setDuplicateError("")
    }
  }, [formData, nameField, existingNames, entityType, mode, entity])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Проверка валидации названия
    if (!validation.isValid || duplicateError) {
      return
    }
    
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
        const insertData = { ...formData }
        
        // Используем нормализованное значение для названия
        if (validation.normalizedValue) {
          insertData[nameField] = validation.normalizedValue
        }
        
        // Для некоторых таблиц нужно явно генерировать UUID
        if ((table === "departments" && idField === "department_id") || 
            (table === "positions" && idField === "position_id") ||
            (table === "categories" && idField === "category_id")) {
          // Генерируем UUID для таблиц без default значения
          insertData[idField] = crypto.randomUUID()
        } else {
          // Для других таблиц исключаем поле ID, так как оно генерируется автоматически
          delete insertData[idField]
        }
        
        const { error } = await supabase
          .from(table)
          .insert([insertData])

        if (error) throw error
        toast.success("Запись успешно создана")
      } else {
        if (!entity || entity[idField] === undefined) {
          throw new Error("Не удается найти ID записи для обновления")
        }
        
        const updateData = { ...formData }
        
        // Используем нормализованное значение для названия
        if (validation.normalizedValue) {
          updateData[nameField] = validation.normalizedValue
        }
        
        const { error } = await supabase
          .from(table)
          .update(updateData)
          .eq(idField, entity[idField])

        if (error) throw error
        toast.success("Запись успешно обновлена")
      }

      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error)
      toast.error("Произошла ошибка при сохранении")
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // Определяем, можно ли сохранять
  const canSave = useMemo(() => {
    const nameValue = formData[nameField]?.toString() || ""
    
    // Должно быть название
    if (nameValue.trim().length === 0) return false
    
    // Валидация должна пройти
    if (!validation.isValid) return false
    
    // Не должно быть дубликатов
    if (duplicateError) return false
    
    // Все обязательные поля должны быть заполнены
    for (const field of extraFields) {
      if (field.required && !formData[field.name]) {
        return false
      }
    }
    
    return true
  }, [formData, nameField, validation.isValid, duplicateError, extraFields])

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
              className={!validation.isValid || duplicateError ? "border-red-500" : ""}
            />
            {/* Отображение ошибок валидации */}
            {validation.errors.length > 0 && (
              <p className="text-sm text-red-500 mt-1">{validation.errors[0]}</p>
            )}
            {duplicateError && validation.errors.length === 0 && (
              <p className="text-sm text-red-500 mt-1">{duplicateError}</p>
            )}
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
            <Button type="submit" disabled={loading || !canSave}>
              {loading ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 