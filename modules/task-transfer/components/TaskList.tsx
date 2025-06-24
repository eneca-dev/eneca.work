"use client"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { useTaskTransferStore } from "../store"
import { getFilteredAssignments, getSectionName, getStatusColor, formatDate } from "../utils"
import { ChevronDown, ChevronRight, ExternalLink, User, Calendar, Clock, ChevronUp, ChevronDown as ChevronDownIcon, ArrowRight, RotateCcw, Edit3 } from "lucide-react"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { EditAssignmentModal } from "./EditAssignmentModal"
import { AssignmentAuditHistory } from "./AssignmentAuditHistory"
import type { Assignment, TaskFilters, AssignmentDirection, AssignmentStatus } from "../types"

interface TaskListProps {
  filters?: TaskFilters
  direction: AssignmentDirection
  currentUserSectionId?: string
}

export function TaskList({ filters = {}, direction, currentUserSectionId }: TaskListProps) {
  const { assignments, sections, projects, advanceStatus, advanceStatusWithDuration, revertStatus } = useTaskTransferStore()
  const [expandedSections, setExpandedSections] = useState<string[]>([])
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null)
  const [activeTab, setActiveTab] = useState<"details" | "history" | "audit">("details")
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [showDurationDialog, setShowDurationDialog] = useState(false)
  const [durationDays, setDurationDays] = useState<string>("7")
  const [showEditModal, setShowEditModal] = useState(false)
  const { toast } = useToast()

  // Получаем отфильтрованные задания
  const filteredAssignments = getFilteredAssignments(filters)

  // Автоматически обновляем selectedAssignment при изменении assignments
  useEffect(() => {
    if (selectedAssignment) {
      const updatedAssignment = assignments.find(a => a.assignment_id === selectedAssignment.assignment_id)
      if (updatedAssignment && JSON.stringify(updatedAssignment) !== JSON.stringify(selectedAssignment)) {
        setSelectedAssignment(updatedAssignment)
      }
    }
  }, [assignments, selectedAssignment])

  const toggleSection = (sectionName: string) => {
    setExpandedSections((prev) => {
      if (prev.includes(sectionName)) {
        return prev.filter((name) => name !== sectionName)
      } else {
        return [...prev, sectionName]
      }
    })
  }

  const handleAssignmentClick = (assignment: Assignment) => {
    setSelectedAssignment(assignment)
  }

  const handleAdvanceStatus = async () => {
    if (!selectedAssignment || isUpdatingStatus) return

    // Если переходим от "Передано" к "Принято", показываем диалог для указания продолжительности
    if (selectedAssignment.status === 'Передано') {
      setDurationDays(selectedAssignment.planned_duration?.toString() || "7")
      setShowDurationDialog(true)
      return
    }

    setIsUpdatingStatus(true)
    try {
      const result = await advanceStatus(selectedAssignment.assignment_id, selectedAssignment.status)
      
      if (result.success) {
        toast({
          title: "Успех",
          description: "Статус задания успешно обновлен",
        })
      } else {
        toast({
          title: "Ошибка",
          description: "Не удалось обновить статус задания",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Ошибка обновления статуса:', error)
      toast({
        title: "Ошибка",
        description: "Произошла неожиданная ошибка",
        variant: "destructive",
      })
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const handleConfirmDuration = async () => {
    if (!selectedAssignment || isUpdatingStatus) return

    const duration = parseInt(durationDays)
    if (isNaN(duration) || duration <= 0) {
      toast({
        title: "Ошибка",
        description: "Укажите корректное количество дней",
        variant: "destructive",
      })
      return
    }

    setIsUpdatingStatus(true)
    setShowDurationDialog(false)
    
    try {
      const result = await advanceStatusWithDuration(selectedAssignment.assignment_id, selectedAssignment.status, duration)
      
      if (result.success) {
        toast({
          title: "Успех",
          description: "Статус задания успешно обновлен",
        })
      } else {
        toast({
          title: "Ошибка",
          description: "Не удалось обновить статус задания",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Ошибка обновления статуса:', error)
      toast({
        title: "Ошибка",
        description: "Произошла неожиданная ошибка",
        variant: "destructive",
      })
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const handleRevertStatus = async () => {
    if (!selectedAssignment || isUpdatingStatus) return

    setIsUpdatingStatus(true)
    try {
      const result = await revertStatus(selectedAssignment.assignment_id, selectedAssignment.status)
      
      if (result.success) {
        toast({
          title: "Успех",
          description: "Статус задания успешно отменен",
        })
      } else {
        toast({
          title: "Ошибка",
          description: "Не удалось отменить статус задания",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Ошибка отмены статуса:', error)
      toast({
        title: "Ошибка",
        description: "Произошла неожиданная ошибка",
        variant: "destructive",
      })
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  // Определяем возможность изменения статуса
  const canAdvanceStatus = (status: AssignmentStatus): boolean => {
    return status !== 'Согласовано'
  }

  const canRevertStatus = (status: AssignmentStatus): boolean => {
    return status !== 'Создано'
  }

  if (filteredAssignments.length === 0) {
    return (
      <div className="bg-card p-8 rounded-lg border text-center">
        <p className="text-muted-foreground">
          {direction === 'outgoing' && 'Нет исходящих заданий.'}
          {direction === 'incoming' && 'Нет входящих заданий.'}
          {direction === 'all' && 'Нет заданий, соответствующих выбранным фильтрам.'}
        </p>
      </div>
    )
  }

        // Группируем задания по разделам
  const assignmentsBySection = (() => {
    if (direction === 'all') {
      // Для режима 'all' собираем все уникальные разделы и группируем задания правильно
      const sectionsMap = new Map<string, {
        sectionId: string
        sectionName: string
        outgoingAssignments: Assignment[]
        incomingAssignments: Assignment[]
      }>()

      // Проходим по всем заданиям и собираем уникальные разделы
      filteredAssignments.forEach(assignment => {
        // Добавляем раздел-отправитель
        if (assignment.from_section_id && !sectionsMap.has(assignment.from_section_id)) {
          sectionsMap.set(assignment.from_section_id, {
            sectionId: assignment.from_section_id,
            sectionName: assignment.from_section_name || getSectionName(assignment.from_section_id),
            outgoingAssignments: [],
            incomingAssignments: []
          })
        }

        // Добавляем раздел-получатель
        if (assignment.to_section_id && !sectionsMap.has(assignment.to_section_id)) {
          sectionsMap.set(assignment.to_section_id, {
            sectionId: assignment.to_section_id,
            sectionName: assignment.to_section_name || getSectionName(assignment.to_section_id),
            outgoingAssignments: [],
            incomingAssignments: []
          })
        }
      })

      // Теперь распределяем задания по разделам
      filteredAssignments.forEach(assignment => {
        // Исходящее задание для раздела-отправителя
        if (assignment.from_section_id && sectionsMap.has(assignment.from_section_id)) {
          sectionsMap.get(assignment.from_section_id)!.outgoingAssignments.push(assignment)
        }

        // Входящее задание для раздела-получателя
        if (assignment.to_section_id && sectionsMap.has(assignment.to_section_id)) {
          sectionsMap.get(assignment.to_section_id)!.incomingAssignments.push(assignment)
        }
      })

      const result: Record<string, {
        sectionId: string
        sectionName: string
        outgoingAssignments: Assignment[]
        incomingAssignments: Assignment[]
      }> = {}
      
      sectionsMap.forEach((value, key) => {
        result[key] = value
      })
      
      return result
    } else {
      // Для режимов 'outgoing' и 'incoming' используем простую группировку
      return filteredAssignments.reduce((acc, assignment) => {
        let sectionId: string
        let sectionName: string
        let assignmentType: 'outgoing' | 'incoming'

        if (direction === 'outgoing') {
          sectionId = assignment.from_section_id
          sectionName = assignment.from_section_name || getSectionName(assignment.from_section_id)
          assignmentType = 'outgoing'
        } else {
          sectionId = assignment.to_section_id
          sectionName = assignment.to_section_name || getSectionName(assignment.to_section_id)
          assignmentType = 'incoming'
        }

        if (!acc[sectionId]) {
          acc[sectionId] = {
            sectionId,
            sectionName,
            outgoingAssignments: [],
            incomingAssignments: []
          }
        }

        if (assignmentType === 'outgoing') {
          acc[sectionId].outgoingAssignments.push(assignment)
        } else {
          acc[sectionId].incomingAssignments.push(assignment)
            }

            return acc
      }, {} as Record<string, {
        sectionId: string
        sectionName: string
        outgoingAssignments: Assignment[]
        incomingAssignments: Assignment[]
      }>)
    }
  })()

  return (
    <div className="space-y-6">
      {Object.values(assignmentsBySection).map(({ sectionId, sectionName, outgoingAssignments, incomingAssignments }) => {
        const totalAssignments = outgoingAssignments.length + incomingAssignments.length
        const isExpanded = expandedSections.includes(sectionId)

        return (
          <div key={sectionId} className="space-y-4">
            {/* Заголовок раздела */}
            <div
              className="bg-muted p-3 rounded-lg border-l-4 border-primary cursor-pointer hover:bg-muted/80 transition-colors"
              onClick={() => toggleSection(sectionId)}
            >
              <div className="flex items-center justify-between">
                                  <div className="flex items-center">
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 mr-2 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 mr-2 text-muted-foreground" />
                  )}
                  <h2 className="text-xl font-semibold text-foreground">{sectionName}</h2>
                </div>
                <div className="flex items-center gap-4">
                  {direction === 'all' && (
                    <>
                      {outgoingAssignments.length > 0 && (
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                          Исходящих: {outgoingAssignments.length}
                        </Badge>
                      )}
                      {incomingAssignments.length > 0 && (
                        <Badge variant="outline" className="bg-secondary text-secondary-foreground border-secondary">
                          Входящих: {incomingAssignments.length}
                        </Badge>
                      )}
                    </>
                  )}
                  <p className="text-sm text-muted-foreground">{totalAssignments} заданий</p>
                </div>
              </div>
            </div>

            {/* Задания в разделе */}
            {isExpanded && (
              <div className="space-y-3 pl-4">
                <Card className="overflow-hidden">
                  <div className="p-4">
                    {/* Заголовки колонок */}
                    {direction === 'all' && (
                    <div className="mb-4">
                        <div className="grid grid-cols-2 gap-4 border-b border-border pb-2">
                          <div>
                          <h4 className="font-medium text-primary">Исходящие задания</h4>
                            <p className="text-xs text-muted-foreground">Переданы от этого раздела</p>
                        </div>
                          <div>
                          <h4 className="font-medium text-secondary-foreground">Входящие задания</h4>
                            <p className="text-xs text-muted-foreground">Получены в этот раздел</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Отображение заданий */}
                    {direction === 'all' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Исходящие задания */}
                      <div className="space-y-2">
                          {outgoingAssignments.length > 0 ? (
                            outgoingAssignments.map((assignment) => (
                              <AssignmentCard
                                key={assignment.assignment_id}
                                assignment={assignment}
                                type="outgoing"
                                onClick={handleAssignmentClick}
                              />
                            ))
                          ) : (
                            <div className="p-3 text-center text-muted-foreground text-sm">
                              Нет исходящих заданий
                            </div>
                        )}
                      </div>

                      {/* Входящие задания */}
                      <div className="space-y-2">
                          {incomingAssignments.length > 0 ? (
                            incomingAssignments.map((assignment) => (
                              <AssignmentCard
                                key={assignment.assignment_id}
                                assignment={assignment}
                                type="incoming"
                                onClick={handleAssignmentClick}
                              />
                            ))
                          ) : (
                            <div className="p-3 text-center text-muted-foreground text-sm">
                              Нет входящих заданий
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Отображение для конкретного направления */
                      <div className="space-y-2">
                        {(direction === 'outgoing' ? outgoingAssignments : incomingAssignments).map((assignment) => (
                          <AssignmentCard
                            key={assignment.assignment_id}
                            assignment={assignment}
                            type={direction === 'outgoing' ? 'outgoing' : 'incoming'}
                            onClick={handleAssignmentClick}
                            fullWidth
                          />
                        ))}
                    </div>
                    )}
                  </div>
                </Card>
              </div>
            )}
          </div>
        )
      })}

      {/* Диалог деталей задания */}
      <Dialog
        open={!!selectedAssignment}
        onOpenChange={() => {
          setSelectedAssignment(null)
          setActiveTab("details")
        }}
      >
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Детали задания</DialogTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEditModal(true)}
                className="flex items-center gap-2 text-sm"
              >
                <Edit3 className="h-4 w-4" />
                Редактировать
              </Button>
            </div>
            {/* Tab switcher */}
            <div className="flex border-b mt-4">
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "details"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setActiveTab("details")}
              >
                Детали задания
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "history"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setActiveTab("history")}
              >
                История статусов
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "audit"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setActiveTab("audit")}
              >
                История изменений
              </button>
            </div>
          </DialogHeader>
          
          {selectedAssignment && (
            <AssignmentDetails 
              assignment={selectedAssignment} 
              activeTab={activeTab}
              onAdvanceStatus={handleAdvanceStatus}
              onRevertStatus={handleRevertStatus}
              canAdvance={canAdvanceStatus(selectedAssignment.status)}
              canRevert={canRevertStatus(selectedAssignment.status)}
              isUpdating={isUpdatingStatus}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Диалог для указания продолжительности */}
      <Dialog open={showDurationDialog} onOpenChange={setShowDurationDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Укажите плановую продолжительность</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Количество дней для выполнения задания
              </label>
              <Input
                type="number"
                min="1"
                max="365"
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                placeholder="Введите количество дней"
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                По умолчанию: 7 дней
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowDurationDialog(false)}
                disabled={isUpdatingStatus}
              >
                Отмена
              </Button>
              <Button 
                onClick={handleConfirmDuration}
                disabled={isUpdatingStatus}
              >
                {isUpdatingStatus ? "Обновление..." : "Подтвердить"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Модальное окно редактирования */}
      <EditAssignmentModal
        assignment={selectedAssignment}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
      />
    </div>
  )
}

// Компонент карточки задания
interface AssignmentCardProps {
  assignment: Assignment
  type: 'outgoing' | 'incoming'
  onClick: (assignment: Assignment) => void
  fullWidth?: boolean
}

function AssignmentCard({ assignment, type, onClick, fullWidth = false }: AssignmentCardProps) {
  const bgColor = type === 'outgoing' ? 'bg-primary/5 border-primary/20' : 'bg-secondary/50 border-secondary'
  const hoverColor = type === 'outgoing' ? 'hover:bg-primary/10' : 'hover:bg-secondary/70'

  return (
    <div
      className={`p-3 rounded border-l-2 cursor-pointer transition-colors ${bgColor} ${hoverColor}`}
      onClick={() => onClick(assignment)}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h5 className="font-medium text-sm line-clamp-2">{assignment.title}</h5>
                      </div>
        <Badge className={getStatusColor(assignment.status)}>
          {assignment.status}
                      </Badge>
                    </div>
      
      <div className="text-xs text-muted-foreground space-y-1">
        <div className="flex items-center gap-1">
          <User className="h-3 w-3" />
          <span>
            {type === 'outgoing' 
              ? `Кому: ${assignment.to_section_name || getSectionName(assignment.to_section_id)}`
              : `От: ${assignment.from_section_name || getSectionName(assignment.from_section_id)}`
            }
          </span>
                  </div>

        {assignment.due_date && (
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>Срок: {formatDate(assignment.due_date)}</span>
          </div>
        )}
        
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>Создано: {formatDate(assignment.created_at)}</span>
                  </div>

        {assignment.link && (
          <div className="flex items-center gap-1">
            <ExternalLink className="h-3 w-3" />
            <span>Есть ссылка</span>
                        </div>
        )}
                        </div>
                      </div>
  )
}

// Компонент деталей задания
interface AssignmentDetailsProps {
  assignment: Assignment
  activeTab: 'details' | 'history' | 'audit'
  onAdvanceStatus?: () => void
  onRevertStatus?: () => void
  canAdvance?: boolean
  canRevert?: boolean
  isUpdating?: boolean
}

function AssignmentDetails({ 
  assignment, 
  activeTab, 
  onAdvanceStatus, 
  onRevertStatus, 
  canAdvance = false, 
  canRevert = false, 
  isUpdating = false 
}: AssignmentDetailsProps) {
  if (activeTab === 'details') {
    return (
      <div className="space-y-4">
        {/* Основная информация */}
        <div className="p-4 bg-muted/50 rounded-lg">
          <h4 className="font-medium text-sm text-muted-foreground mb-2">Заголовок задания</h4>
          <p className="text-sm font-medium leading-relaxed text-foreground">{assignment.title}</p>
          {assignment.description && (
            <>
              <h4 className="font-medium text-sm text-muted-foreground mb-2 mt-4">Описание</h4>
              <p className="text-sm leading-relaxed text-foreground">{assignment.description}</p>
            </>
          )}
        </div>

        {/* Информация о разделах */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <h4 className="font-medium text-sm text-muted-foreground mb-2">Раздел-отправитель</h4>
            <p className="text-sm font-medium text-foreground">
              {assignment.from_section_name || getSectionName(assignment.from_section_id)}
            </p>
                        </div>
          <div className="p-4 bg-secondary/50 border border-secondary rounded-lg">
            <h4 className="font-medium text-sm text-muted-foreground mb-2">Раздел-получатель</h4>
            <p className="text-sm font-medium text-foreground">
              {assignment.to_section_name || getSectionName(assignment.to_section_id)}
            </p>
                        </div>
                      </div>

        {/* Статус и проект */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium text-sm text-muted-foreground mb-2">Текущий статус</h4>
            <Badge className={getStatusColor(assignment.status)}>
              {assignment.status}
            </Badge>
          </div>
          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium text-sm text-muted-foreground mb-2">Проект</h4>
            <p className="text-sm font-medium text-foreground">
              {assignment.project_name || 'Не указан'}
            </p>
                    </div>
                  </div>

        {/* Даты */}
        <div className="p-4 bg-muted/50 rounded-lg">
          <h4 className="font-medium text-sm text-muted-foreground mb-3">Временные рамки</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Дата создания</p>
              <p className="text-sm font-medium text-foreground">{formatDate(assignment.created_at)}</p>
            </div>
            {assignment.due_date && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Срок выполнения</p>
                <p className="text-sm font-medium text-destructive">{formatDate(assignment.due_date)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Плановая продолжительность */}
        <div className="p-4 bg-accent/50 rounded-lg border border-accent">
          <h4 className="font-medium text-sm text-muted-foreground mb-2">Плановая продолжительность</h4>
          <p className="text-sm font-medium text-foreground">
            {assignment.planned_duration ? `${assignment.planned_duration} дней` : 'Не указана'}
          </p>
        </div>

        {/* Ссылка */}
        {assignment.link && (
                  <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium text-sm text-muted-foreground mb-2">Ссылка</h4>
            <a 
              href={assignment.link} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 text-sm break-all transition-colors"
            >
              {assignment.link}
            </a>
                      </div>
        )}
                        </div>
    )
  }

  // История статусов
  if (activeTab === 'history') {
    return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-foreground">История статусов</h3>
        
        {/* Кнопки управления статусами */}
        <div className="flex gap-3">
          {canRevert && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRevertStatus}
              disabled={isUpdating}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium border-destructive/20 text-destructive hover:bg-destructive/10 hover:border-destructive/30 transition-all duration-200"
            >
              <RotateCcw className="w-4 h-4" />
              Откатить статус
            </Button>
          )}
          {canAdvance && (
            <Button
              size="sm"
              onClick={onAdvanceStatus}
              disabled={isUpdating}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200"
            >
              <ArrowRight className="w-4 h-4" />
              Продвинуть статус
            </Button>
          )}
                        </div>
                      </div>
      
      <div className="relative">
        {/* Временная линия */}
        <div className="absolute left-7 top-4 bottom-4 w-0.5 bg-gradient-to-b from-border to-border/50"></div>
        
        <div className="space-y-8">
          {/* Создано */}
          <div className="relative flex items-start">
            <div className="absolute left-5 w-6 h-6 bg-gray-700 rounded-full border-2 border-white shadow-lg flex items-center justify-center z-10">
              <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
            </div>
            <div className="ml-16 bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className="flex flex-col space-y-3">
                <div className="flex justify-between items-start">
                                      <div className="flex-1">
                    <h4 className="text-lg font-semibold text-foreground mb-1">Создано</h4>
                    <p className="text-sm text-muted-foreground">
                      Задание создано и готово к передаче
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-sm font-medium text-foreground">
                      {formatDate(assignment.created_at)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Дата создания
                    </div>
                  </div>
                </div>
                {assignment.planned_transmitted_date && (
                  <div className="pt-2 border-t border-border">
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <Calendar className="w-4 h-4" />
                      <span>Плановая дата выдачи: {formatDate(assignment.planned_transmitted_date)}</span>
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>

          {/* Передано */}
          {(assignment.status === 'Передано' || assignment.actual_transmitted_date || 
            ['Принято', 'Выполнено', 'Согласовано'].includes(assignment.status)) && (
            <div className="relative flex items-start">
              <div className="absolute left-5 w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center z-10">
                <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
              </div>
              <div className="ml-16 bg-card border border-primary/20 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
                <div className="flex flex-col space-y-3">
                  <div className="flex justify-between items-start">
                      <div className="flex-1">
                      <h4 className="text-lg font-semibold text-primary mb-1">Передано</h4>
                      <p className="text-sm text-primary/80">
                        Задание передано получателю
                      </p>
                          </div>
                    <div className="text-right ml-4">
                      <div className="text-sm font-medium text-foreground">
                        {assignment.actual_transmitted_date ? formatDate(assignment.actual_transmitted_date) : formatDate(assignment.updated_at)}
                        </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Дата передачи
                      </div>
                    </div>
                  </div>
                  {assignment.planned_duration && (
                    <div className="pt-2 border-t border-border">
                      <div className="flex items-center gap-2 text-sm text-primary">
                        <Clock className="w-4 h-4" />
                        <span>Плановая продолжительность: {assignment.planned_duration} дней</span>
                      </div>
                    </div>
                  )}
                          </div>
                        </div>
                      </div>
                    )}

          {/* Принято */}
          {(assignment.status === 'Принято' || assignment.actual_accepted_date || 
            ['Выполнено', 'Согласовано'].includes(assignment.status)) && (
            <div className="relative flex items-start">
              <div className="absolute left-5 w-6 h-6 bg-green-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center z-10">
                <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
              </div>
              <div className="ml-16 bg-card border border-secondary rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
                <div className="flex justify-between items-start">
                        <div className="flex-1">
                    <h4 className="text-lg font-semibold text-secondary-foreground mb-1">Принято</h4>
                    <p className="text-sm text-muted-foreground">
                      Задание принято к выполнению
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-sm font-medium text-foreground">
                      {assignment.actual_accepted_date ? formatDate(assignment.actual_accepted_date) : 'Ожидается'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Дата принятия
                    </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

          {/* Выполнено */}
          {(assignment.status === 'Выполнено' || assignment.actual_worked_out_date || 
            assignment.status === 'Согласовано') && (
            <div className="relative flex items-start">
              <div className="absolute left-5 w-6 h-6 bg-orange-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center z-10">
                <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
              </div>
              <div className="ml-16 bg-card border border-accent rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
                <div className="flex justify-between items-start">
                        <div className="flex-1">
                    <h4 className="text-lg font-semibold text-accent-foreground mb-1">Выполнено</h4>
                    <p className="text-sm text-muted-foreground">
                      Задание выполнено и готово к согласованию
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-sm font-medium text-foreground">
                      {assignment.actual_worked_out_date ? formatDate(assignment.actual_worked_out_date) : 'Ожидается'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Дата выполнения
                    </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

          {/* Согласовано */}
          {(assignment.status === 'Согласовано' || assignment.actual_agreed_date) && (
            <div className="relative flex items-start">
              <div className="absolute left-5 w-6 h-6 bg-purple-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center z-10">
                <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
              </div>
              <div className="ml-16 bg-card border border-primary rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
                <div className="flex justify-between items-start">
                        <div className="flex-1">
                    <h4 className="text-lg font-semibold text-primary mb-1">Согласовано</h4>
                    <p className="text-sm text-muted-foreground">
                      Задание полностью завершено
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-sm font-medium text-foreground">
                      {assignment.actual_agreed_date ? formatDate(assignment.actual_agreed_date) : 'Ожидается'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Дата согласования
                    </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
    </div>
  )
}

// История изменений задания
return <AssignmentAuditHistory assignment={assignment} />
}
