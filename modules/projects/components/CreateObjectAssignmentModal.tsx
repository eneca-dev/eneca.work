"use client"

import { useState, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Info, SquareStack, Calendar as CalendarIcon } from "lucide-react"
import { DatePicker as ProjectDatePicker } from "@/modules/projects/components/DatePicker"
import { useToast } from "@/hooks/use-toast"
import { useTaskTransferStore } from "@/modules/task-transfer/store"
import type { CreateAssignmentData } from "@/modules/task-transfer/types"
import * as Sentry from "@sentry/nextjs"
import { createClient } from "@/utils/supabase/client"

interface CreateObjectAssignmentModalProps {
  isOpen: boolean
  onClose: () => void
  objectId: string
  objectName: string
  projectId: string
  projectName: string
  stageId: string
  sectionId?: string
}

export function CreateObjectAssignmentModal({ 
  isOpen, 
  onClose, 
  objectId, 
  objectName, 
  projectId,
  projectName,
  stageId,
  sectionId
}: CreateObjectAssignmentModalProps) {
  const [direction, setDirection] = useState<'outgoing' | 'incoming'>('outgoing')
  const [fromSectionId, setFromSectionId] = useState<string>("")
  const [toSectionId, setToSectionId] = useState<string>("")
  const [title, setTitle] = useState<string>("")
  const [description, setDescription] = useState<string>("")
  const [plannedDuration, setPlannedDuration] = useState<string>("7")
  const [link, setLink] = useState<string>("")
  const [isCreating, setIsCreating] = useState(false)
  const [fallbackSections, setFallbackSections] = useState<{ id: string; name: string; projectId?: string }[]>([])
  const [treeSections, setTreeSections] = useState<{ id: string; name: string; projectId?: string }[]>([])
  const [effectiveObjectId, setEffectiveObjectId] = useState<string>(objectId || "")
  const [plannedTransmittedDate, setPlannedTransmittedDate] = useState<string | undefined>(undefined)
  
  const { createNewAssignment } = useTaskTransferStore()
  const { toast } = useToast()
  const supabase = createClient()

  // Разделы из view_project_tree загружаются ниже в эффекте

  // Если objectId не передали (например, запуск из панели раздела),
  // пробуем получить его по sectionId
  useEffect(() => {
    ;(async () => {
      try {
        if (!isOpen) return
        if (objectId) { setEffectiveObjectId(objectId); return }
        if (!objectId && sectionId) {
          const { data, error } = await supabase
            .from('sections')
            .select('section_object_id')
            .eq('section_id', sectionId)
            .single()
          if (!error && data?.section_object_id) {
            setEffectiveObjectId(data.section_object_id as string)
          } else {
            setEffectiveObjectId("")
          }
        }
      } catch (e) {
        setEffectiveObjectId("")
      }
    })()
  }, [isOpen, objectId, sectionId])

  // Фолбэк: если в вьюхе пусто, подгружаем разделы напрямую из таблицы sections по effectiveObjectId
  useEffect(() => {
    ;(async () => {
      try {
        if (!isOpen || !effectiveObjectId) return
        if (treeSections.length > 0) {
          if (fallbackSections.length > 0) setFallbackSections([])
          return
        }
        const { data, error } = await supabase
          .from('sections')
          .select('section_id, section_name, section_project_id')
          .eq('section_object_id', effectiveObjectId)
          .order('section_name')
        if (error) {
          console.error('Ошибка фолбэка загрузки разделов по объекту:', error)
          return
        }
        const mapped = (data || [])
          .filter(s => s.section_id && s.section_name)
          .map(s => ({ id: s.section_id as string, name: s.section_name as string, projectId: (s as any).section_project_id as string | undefined }))
        setFallbackSections(mapped)
        console.log('📥 Фолбэк-разделы из таблицы sections:', mapped)
      } catch (e) {
        console.error('Не удалось выполнить фолбэк загрузки разделов:', e)
      }
    })()
  }, [isOpen, effectiveObjectId, treeSections.length])

  // Основной источник: грузим разделы из view_project_tree по проекту и объекту
  useEffect(() => {
    ;(async () => {
      try {
        if (!isOpen || !projectId || !effectiveObjectId) {
          setTreeSections([])
          return
        }
        const { data, error } = await supabase
          .from('view_project_tree')
          .select('section_id, section_name, project_id, object_id')
          .eq('project_id', projectId)
          .eq('object_id', effectiveObjectId)
          .order('section_name')

        if (error) {
          console.error('Ошибка загрузки разделов из view_project_tree:', error)
          setTreeSections([])
          return
        }

        const mapped = (data || [])
          .filter(row => row.section_id && row.section_name)
          .map(row => ({ id: row.section_id as string, name: row.section_name as string, projectId: row.project_id as string | undefined }))
          .filter((section, index, self) => index === self.findIndex(s => s.id === section.id))

        setTreeSections(mapped)
        console.log('🌳 Разделы из view_project_tree:', mapped)
      } catch (e) {
        console.error('Не удалось загрузить разделы из view_project_tree:', e)
        setTreeSections([])
      }
    })()
  }, [isOpen, projectId, effectiveObjectId])

  // Сброс формы при открытии
  useEffect(() => {
    if (isOpen) {
      setDirection('outgoing')
      setFromSectionId("")
      setToSectionId("")
      setTitle("")
      setDescription("")
      setPlannedDuration("7")
      setLink("")
      setPlannedTransmittedDate("")
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

    const duration = 7
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
            project_id: derivedProjectId,
            from_section_id: fromSectionId,
            to_section_id: toSectionId,
            title: title.trim(),
            description: description.trim(),
            link: link.trim() || undefined,
            planned_duration: duration,
            planned_transmitted_date: plannedTransmittedDate || undefined
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
            const errMsg = (result as any)?.error?.message || (result as any)?.error?.details || "Не удалось создать задание"
            console.error('Ошибка создания задания:', (result as any)?.error)
            toast({
              title: "Ошибка",
              description: errMsg,
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
  const sourceSections = (treeSections.length > 0 ? treeSections : fallbackSections)
  const fromSections = sourceSections.filter(s => s.id !== toSectionId)
  const toSections = sourceSections.filter(s => s.id !== fromSectionId)
  const isFromLocked = !!sectionId && sourceSections.some(s => s.id === sectionId)

  // Автоподстановка "Из раздела" текущего раздела, если модалка открыта из панели раздела
  useEffect(() => {
    if (!isOpen) return
    if (sectionId && !fromSectionId && sourceSections.some(s => s.id === sectionId)) {
      setFromSectionId(sectionId)
    }
  }, [isOpen, sectionId, sourceSections, fromSectionId])

  // Вычисляем проект из выбранного раздела (приоритет: from → to), иначе из пропсов
  const derivedProjectId = useMemo(() => {
    const src = (treeSections.length > 0 ? treeSections : fallbackSections)
    const from = src.find(s => s.id === fromSectionId)
    if (from?.projectId) return from.projectId
    const to = src.find(s => s.id === toSectionId)
    if (to?.projectId) return to.projectId
    return projectId || ""
  }, [treeSections, fallbackSections, fromSectionId, toSectionId, projectId])

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
          {(!derivedProjectId || derivedProjectId === "") && (
            <p className="text-xs text-destructive mt-1">Не удалось определить project_id из выбранных разделов. Выберите корректные разделы этого проекта.</p>
          )}
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Выбор разделов */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="from-section" className="text-sm font-medium">
                Из раздела <span className="text-destructive">*</span>
              </Label>
              <Select value={fromSectionId} onValueChange={setFromSectionId} disabled={isFromLocked}>
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

          {/* Плановая продолжительность: фиксировано 7 дней при создании */}
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label className="text-sm font-medium">
                Плановая продолжительность
              </Label>
              <Info className="h-4 w-4 text-gray-400" />
            </div>
            <div className="relative">
              <Input 
                value={"7"}
                readOnly
                disabled
                className="w-full" 
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">
                дней
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Фиксировано: 7 дней при создании. Изменение возможно после создания в «Редактировать».
            </p>
          </div>

          {/* Удалён блок "Дедлайн задания" по требованиям */}

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

          {/* Плановый срок передачи */}
          <div className="space-y-2">
            <Label htmlFor="planned-transmitted-date" className="text-sm font-medium">
              Плановая дата передачи <span className="text-destructive">*</span>
            </Label>
            <ProjectDatePicker
              value={plannedTransmittedDate ? new Date(plannedTransmittedDate) : null}
              onChange={(d) => {
                const y = d.getFullYear()
                const m = String(d.getMonth() + 1).padStart(2, '0')
                const day = String(d.getDate()).padStart(2, '0')
                setPlannedTransmittedDate(`${y}-${m}-${day}`)
              }}
              placeholder="Выберите дату"
              calendarWidth="260px"
              inputWidth="100%"
              placement="auto-top"
              offsetY={6}
              renderToBody={false}
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

