"use client"

import { TaskTransferFilters } from "./filters/TaskTransferFilters"
import { Separator } from "@/components/ui/separator"
import { Plus, Info, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useState, useCallback, useEffect, useMemo } from "react"
import { TaskSchedule } from "./components/TaskSchedule"
import { TaskList } from "./components/TaskList"
import { useTaskTransferStore } from "./store"
import type { AssignmentDirection, TaskFilters, CreateAssignmentData } from "./types"
import { toast } from "@/components/ui/use-toast"
import { DatePicker as ProjectDatePicker } from "@/modules/projects/components/DatePicker"

export default function TaskTransferPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [currentView, setCurrentView] = useState<"tasks" | "schedule">("tasks")
  const [direction, setDirection] = useState<AssignmentDirection>('outgoing')
  const [selectedProjectId, setSelectedProjectId] = useState<string>("")
  const [fromSectionId, setFromSectionId] = useState<string>("")
  const [toSectionId, setToSectionId] = useState<string>("")
  const [shortTitle, setShortTitle] = useState<string>("")
  const [description, setDescription] = useState<string>("")
  const [plannedDuration, setPlannedDuration] = useState<string>("7")
  const [deadline, setDeadline] = useState<string>("")
  const [plannedTransmittedDate, setPlannedTransmittedDate] = useState<string>("")
  const [link, setLink] = useState<string>("")
  const [isCreating, setIsCreating] = useState(false)
  const [filters, setFilters] = useState<TaskFilters>({
    direction: 'outgoing',
    projectId: null,
    stageId: null,
    objectId: null,
    departmentId: null,
    teamId: null,
    specialistId: null,
    status: null
  })

  // Получаем функции из store
  const { 
    loadInitialData, 
    isLoading, 
    loadAssignments, 
    assignments,
    getAssignmentsByDirection,
    sectionHierarchy,
    projects,
    createNewAssignment
  } = useTaskTransferStore()

  // Получаем разделы для выбранного проекта
  const availableSections = useMemo(() => {
    if (!selectedProjectId) return []
    
    return sectionHierarchy
      .filter(item => item.project_id === selectedProjectId && item.section_id && item.section_name)
      .map(item => ({
        id: item.section_id!,
        name: item.section_name!
      }))
      .filter((section, index, self) => 
        index === self.findIndex(s => s.id === section.id)
      )
  }, [selectedProjectId, sectionHierarchy])

  // Инициализация данных при загрузке компонента
  useEffect(() => {
    console.log('🚀 Инициализация TaskTransferPage...')
    loadInitialData()
  }, [loadInitialData])

  const handleFiltersChange = useCallback((newFilters: TaskFilters) => {
    setFilters(newFilters)
    // Перезагружаем задания с новыми фильтрами
    loadAssignments(newFilters)
  }, [loadAssignments])

  const handleDirectionChange = useCallback((newDirection: AssignmentDirection) => {
    setDirection(newDirection)
    const updatedFilters = { ...filters, direction: newDirection }
    setFilters(updatedFilters)
    handleFiltersChange(updatedFilters)
  }, [filters, handleFiltersChange])

  // Функция для сброса формы
  const resetForm = useCallback(() => {
    setSelectedProjectId("")
    setFromSectionId("")
    setToSectionId("")
    setShortTitle("")
    setDescription("")
    setPlannedDuration("7")
    setDeadline("")
    setPlannedTransmittedDate("")
    setLink("")
  }, [])

  // Обработчик изменения раздела "Из"
  const handleFromSectionChange = useCallback((value: string) => {
    setFromSectionId(value)
    // Если выбранный раздел "В" совпадает с новым разделом "Из", очищаем его
    if (toSectionId === value) {
      setToSectionId("")
    }
  }, [toSectionId])

  // Обработчик изменения раздела "В"
  const handleToSectionChange = useCallback((value: string) => {
    // Не позволяем выбрать тот же раздел, что и "Из"
    if (value !== fromSectionId) {
      setToSectionId(value)
    }
  }, [fromSectionId])

  // Функция для создания задания
  const handleCreateAssignment = useCallback(async () => {
    if (!selectedProjectId || !fromSectionId || !toSectionId || !shortTitle || !description) {
      toast({
        title: "Ошибка",
        description: "Пожалуйста, заполните все обязательные поля",
        variant: "destructive",
      })
      return
    }

    // Проверяем что выбраны разные разделы
    if (fromSectionId === toSectionId) {
      toast({
        title: "Ошибка",
        description: "Нельзя передать задание в тот же раздел. Выберите разные разделы для передачи.",
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

    try {
      const assignmentData: CreateAssignmentData = {
        project_id: selectedProjectId,
        from_section_id: fromSectionId,
        to_section_id: toSectionId,
        title: shortTitle,
        description: description,
        due_date: deadline || undefined,
        link: link || undefined,
        planned_duration: duration,
        planned_transmitted_date: plannedTransmittedDate || undefined
      }

      const result = await createNewAssignment(assignmentData)

      if (result.success) {
        toast({
          title: "Успех",
          description: "Задание успешно создано",
        })
        resetForm()
        setIsDialogOpen(false)
      } else {
        toast({
          title: "Ошибка",
          description: "Не удалось создать задание",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Ошибка создания задания:', error)
      toast({
        title: "Ошибка",
        description: "Произошла неожиданная ошибка",
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }, [selectedProjectId, fromSectionId, toSectionId, shortTitle, description, deadline, link, plannedDuration, createNewAssignment, resetForm])

  // Получаем статистику заданий
  const outgoingAssignments = getAssignmentsByDirection('outgoing')
  const incomingAssignments = getAssignmentsByDirection('incoming')

  // Показываем индикатор загрузки при инициализации
  if (isLoading) {
    return (
      <div className="w-full py-6 px-6">
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Загрузка данных модуля передачи заданий...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full py-6 px-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-foreground">Модуль передачи заданий между разделами</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Plus className="h-4 w-4 mr-2" />
              Создать задание
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">Создать новое задание</DialogTitle>
              <p className="text-sm text-gray-500 mt-1">Заполните информацию о новом задании</p>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {/* Проект */}
              <div className="space-y-2">
                <Label htmlFor="project" className="text-sm font-medium">
                  Проект
                </Label>
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите проект" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fromDepartment" className="text-sm font-medium">
                    Из раздела
                  </Label>
                  <Select disabled={!selectedProjectId} value={fromSectionId} onValueChange={handleFromSectionChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={selectedProjectId ? "Выберите раздел" : "Сначала выберите проект"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSections.map((section) => (
                        <SelectItem key={section.id} value={section.id}>
                          {section.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="toDepartment" className="text-sm font-medium">
                    В раздел
                  </Label>
                  <Select disabled={!selectedProjectId} value={toSectionId} onValueChange={handleToSectionChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={selectedProjectId ? "Выберите раздел" : "Сначала выберите проект"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSections.map((section) => (
                        <SelectItem 
                          key={section.id} 
                          value={section.id}
                          disabled={section.id === fromSectionId}
                        >
                          {section.name}
                          {section.id === fromSectionId && (
                            <span className="text-muted-foreground ml-2">(уже выбран как исходный)</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Краткое название */}
              <div className="space-y-2">
                <Label htmlFor="shortTitle" className="text-sm font-medium">
                  Краткое название
                </Label>
                <Input
                  id="shortTitle"
                  value={shortTitle}
                  onChange={(e) => setShortTitle(e.target.value)}
                  placeholder="Введите краткое название задачи (одно слово)"
                  className="w-full"
                />
              </div>

              {/* Описание */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium">
                  Описание
                </Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Введите подробное описание задачи"
                  className="min-h-[100px] resize-none"
                />
              </div>

              {/* Плановая продолжительность */}
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="plannedDuration" className="text-sm font-medium">
                    Плановая продолжительность
                  </Label>
                  <Info className="h-4 w-4 text-gray-400" />
                </div>
                <div className="relative">
                  <Input 
                    id="plannedDuration" 
                    type="number" 
                    min="1"
                    max="365"
                    value={plannedDuration}
                    onChange={(e) => setPlannedDuration(e.target.value)}
                    placeholder="Введите количество дней" 
                    className="w-full" 
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-500">
                    дней
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  По умолчанию: 7 дней
                </p>
              </div>

              {/* Дедлайн задания */}
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="deadline" className="text-sm font-medium">
                    Дедлайн задания
                  </Label>
                  <Info className="h-4 w-4 text-gray-400" />
                </div>
                <div>
                  <ProjectDatePicker
                    value={deadline ? new Date(deadline) : null}
                    onChange={(d) => {
                      const y = d.getFullYear()
                      const m = String(d.getMonth() + 1).padStart(2, '0')
                      const day = String(d.getDate()).padStart(2, '0')
                      setDeadline(`${y}-${m}-${day}`)
                    }}
                    placeholder="Выберите дату"
                    calendarWidth="260px"
                    inputWidth="100%"
                  />
                </div>
              </div>

              {/* Плановая дата передачи */}
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label className="text-sm font-medium">
                    Плановая дата передачи
                  </Label>
                  <Info className="h-4 w-4 text-gray-400" />
                </div>
                <div>
                  <ProjectDatePicker
                    value={plannedTransmittedDate ? new Date(plannedTransmittedDate) : null}
                    onChange={(d) => {
                      const y = d.getFullYear()
                      const m = String(d.getMonth() + 1).padStart(2, '0')
                      const day = String(d.getDate()).padStart(2, '0')
                      setPlannedTransmittedDate(`${y}-${m}-${day}`)
                    }}
                    placeholder="Выберите дату передачи"
                    calendarWidth="260px"
                    inputWidth="100%"
                  />
                </div>
              </div>

              {/* Ссылка */}
              <div className="space-y-2">
                <Label htmlFor="link" className="text-sm font-medium">
                  Ссылка (Опционально)
                </Label>
                <Input 
                  id="link" 
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://..." 
                  className="w-full" 
                />
              </div>
            </div>

            <DialogFooter className="flex justify-between">
              <Button 
                variant="outline" 
                onClick={() => {
                  resetForm()
                  setIsDialogOpen(false)
                }}
                disabled={isCreating}
              >
                Отмена
              </Button>
              <Button 
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={handleCreateAssignment}
                disabled={isCreating}
              >
                {isCreating ? "Создание..." : "Создать"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Переключатель направления заданий */}
      <div className="mb-6">
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
          <button
            onClick={() => handleDirectionChange('outgoing')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
              direction === 'outgoing'
                ? 'bg-card text-foreground shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            Исходящие задания
            {outgoingAssignments.length > 0 && (
              <Badge variant="secondary" className="ml-1 bg-primary/10 text-primary border-primary/20">
                {outgoingAssignments.length}
              </Badge>
            )}
          </button>
          <button
            onClick={() => handleDirectionChange('incoming')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
              direction === 'incoming'
                ? 'bg-card text-foreground shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            Входящие задания
            {incomingAssignments.length > 0 && (
              <Badge variant="secondary" className="ml-1 bg-secondary text-secondary-foreground border-secondary">
                {incomingAssignments.length}
              </Badge>
            )}
          </button>
          <button
            onClick={() => handleDirectionChange('all')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
              direction === 'all'
                ? 'bg-card text-foreground shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            Все задания
            {assignments.length > 0 && (
              <Badge variant="secondary" className="ml-1 bg-accent text-accent-foreground border-accent">
                {assignments.length}
              </Badge>
            )}
          </button>
        </div>
      </div>

      {/* Компонент фильтров */}
      <TaskTransferFilters 
        onFiltersChange={handleFiltersChange}
        direction={direction}
      />
      
      <div className="my-4">
        <Separator />
      </div>
      
      {/* View Toggle */}
      <div className="mb-6">
        <div className="flex bg-muted rounded-lg p-1 w-fit">
          <button
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              currentView === "tasks" ? "bg-card text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
            onClick={() => setCurrentView("tasks")}
          >
            Разделы с заданиями
          </button>
          <button
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              currentView === "schedule" ? "bg-card text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
            onClick={() => setCurrentView("schedule")}
          >
            График передачи
          </button>
        </div>
      </div>
      
      {currentView === "tasks" ? (
        <TaskList 
          filters={filters} 
          direction={direction}
          currentUserSectionId={undefined}
        />
      ) : (
        <TaskSchedule 
          filters={filters} 
          direction={direction}
          currentUserSectionId={undefined}
        />
      )}
    </div>
  )
}
