"use client"

import { useState, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Info, SquareStack } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useTaskTransferStore } from "@/modules/task-transfer/store"
import type { CreateAssignmentData } from "@/modules/task-transfer/types"
import * as Sentry from "@sentry/nextjs"

interface CreateObjectAssignmentModalProps {
  isOpen: boolean
  onClose: () => void
  objectId: string
  objectName: string
  projectId: string
  projectName: string
  stageId: string
}

export function CreateObjectAssignmentModal({ 
  isOpen, 
  onClose, 
  objectId, 
  objectName, 
  projectId,
  projectName,
  stageId
}: CreateObjectAssignmentModalProps) {
  const [direction, setDirection] = useState<'outgoing' | 'incoming'>('outgoing')
  const [fromSectionId, setFromSectionId] = useState<string>("")
  const [toSectionId, setToSectionId] = useState<string>("")
  const [title, setTitle] = useState<string>("")
  const [description, setDescription] = useState<string>("")
  const [plannedDuration, setPlannedDuration] = useState<string>("7")
  const [dueDate, setDueDate] = useState<string>("")
  const [link, setLink] = useState<string>("")
  const [isCreating, setIsCreating] = useState(false)
  
  const { sectionHierarchy, createNewAssignment } = useTaskTransferStore()
  const { toast } = useToast()

  // Получаем разделы для выбранного объекта
  const availableSections = useMemo(() => {
    console.log('🔍 Фильтрация разделов для объекта:', {
      objectId,
      projectId,
      sectionHierarchyLength: sectionHierarchy.length,
      sampleHierarchy: sectionHierarchy.slice(0, 3)
    })
    
    const filtered = sectionHierarchy
      .filter(item => 
        item.project_id === projectId && 
        item.object_id === objectId && 
        item.section_id && 
        item.section_name
      )
      .map(item => ({
        id: item.section_id!,
        name: item.section_name!
      }))
      .filter((section, index, self) => 
        index === self.findIndex(s => s.id === section.id)
      )
    
    console.log('📋 Доступные разделы для объекта:', filtered)
    return filtered
  }, [projectId, objectId, sectionHierarchy])

  // Сброс формы при открытии
  useEffect(() => {
    if (isOpen) {
      setDirection('outgoing')
      setFromSectionId("")
      setToSectionId("")
      setTitle("")
      setDescription("")
      setPlannedDuration("7")
      setDueDate("")
      setLink("")
    }
  }, [isOpen])

  const handleSubmit = async () => {
    // Валидация
    if (!fromSectionId || !toSectionId) {
      toast({
        title: "Ошибка",
        description: "Выберите оба раздела для передачи задания",
        variant: "destructive",
      })
      return
    }

    if (fromSectionId === toSectionId) {
      toast({
        title: "Ошибка",
        description: "Нельзя передать задание в тот же раздел",
        variant: "destructive",
      })
      return
    }

    if (!title.trim()) {
      toast({
        title: "Ошибка",
        description: "Название задания не может быть пустым",
        variant: "destructive",
      })
      return
    }

    if (!description.trim()) {
      toast({
        title: "Ошибка",
        description: "Описание задания не может быть пустым",
        variant: "destructive",
      })
      return
    }

    const duration = parseInt(plannedDuration)
    if (isNaN(duration) || duration <= 0 || duration > 365) {
      toast({
        title: "Ошибка",
        description: "Плановая продолжительность должна быть от 1 до 365 дней",
        variant: "destructive",
      })
      return
    }

    setIsCreating(true)

    await Sentry.startSpan(
      {
        op: "ui.action",
        name: "Создание задания для объекта в модуле проектов",
      },
      async (span) => {
        try {
          span.setAttribute("component", "CreateObjectAssignmentModal")
          span.setAttribute("object_id", objectId)
          span.setAttribute("project_id", projectId)
          span.setAttribute("from_section", fromSectionId)
          span.setAttribute("to_section", toSectionId)
          
          const assignmentData: CreateAssignmentData = {
            project_id: projectId,
            from_section_id: fromSectionId,
            to_section_id: toSectionId,
            title: title.trim(),
            description: description.trim(),
            due_date: dueDate || undefined,
            link: link.trim() || undefined,
            planned_duration: duration,
            planned_transmitted_date: undefined
          }

          const result = await createNewAssignment(assignmentData)

          if (result.success) {
            span.setAttribute("creation.success", true)
            toast({
              title: "Успех",
              description: `Задание для объекта "${objectName}" успешно создано`,
            })
            onClose()
          } else {
            span.setAttribute("creation.success", false)
            toast({
              title: "Ошибка",
              description: "Не удалось создать задание",
              variant: "destructive",
            })
          }
        } catch (error) {
          span.setAttribute("error", true)
          span.setAttribute("error.message", (error as Error).message)
          
          Sentry.captureException(error, {
            tags: {
              module: 'projects',
              component: 'CreateObjectAssignmentModal',
              action: 'create_assignment'
            },
            extra: {
              object_id: objectId,
              project_id: projectId,
              object_name: objectName,
              project_name: projectName,
              title: title,
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
          setIsCreating(false)
        }
      }
    )
  }

  const handleClose = () => {
    if (!isCreating) {
      onClose()
    }
  }

  // Получаем доступные разделы в зависимости от направления
  const fromSections = availableSections.filter(s => s.id !== toSectionId)
  const toSections = availableSections.filter(s => s.id !== fromSectionId)

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <SquareStack className="h-5 w-5 text-blue-600" />
            <DialogTitle className="text-xl font-semibold">Создать задание для объекта</DialogTitle>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Объект: <span className="font-medium">{objectName}</span> | 
            Проект: <span className="font-medium">{projectName}</span>
          </p>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Выбор разделов */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="from-section" className="text-sm font-medium">
                Из раздела <span className="text-destructive">*</span>
              </Label>
              <Select value={fromSectionId} onValueChange={setFromSectionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите раздел" />
                </SelectTrigger>
                <SelectContent>
                  {fromSections.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="to-section" className="text-sm font-medium">
                В раздел <span className="text-destructive">*</span>
              </Label>
              <Select value={toSectionId} onValueChange={setToSectionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите раздел" />
                </SelectTrigger>
                <SelectContent>
                  {toSections.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Название */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium">
              Название задания <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Введите название задания"
              disabled={isCreating}
              className="w-full"
            />
          </div>

          {/* Описание */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Описание <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Введите подробное описание задания"
              disabled={isCreating}
              className="min-h-[100px] resize-none"
            />
          </div>

          {/* Плановая продолжительность */}
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="duration" className="text-sm font-medium">
                Плановая продолжительность
              </Label>
              <Info className="h-4 w-4 text-gray-400" />
            </div>
            <div className="relative">
              <Input 
                id="duration" 
                type="number" 
                min="1"
                max="365"
                value={plannedDuration}
                onChange={(e) => setPlannedDuration(e.target.value)}
                placeholder="Количество дней"
                disabled={isCreating}
                className="w-full" 
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">
                дней
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              По умолчанию: 7 дней
            </p>
          </div>

          {/* Дедлайн */}
          <div className="space-y-2">
            <Label htmlFor="due-date" className="text-sm font-medium">
              Дедлайн задания
            </Label>
            <div className="relative">
              <Input 
                id="due-date" 
                type="date" 
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={isCreating}
                className="w-full pr-10" 
              />
              <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* Ссылка */}
          <div className="space-y-2">
            <Label htmlFor="link" className="text-sm font-medium">
              Ссылка
            </Label>
            <Input 
              id="link" 
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://..."
              disabled={isCreating}
              className="w-full" 
            />
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={isCreating}
          >
            Отмена
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={isCreating}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isCreating ? "Создание..." : "Создать задание"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

