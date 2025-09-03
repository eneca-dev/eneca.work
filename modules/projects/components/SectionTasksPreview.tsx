"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Calendar, Clock, ExternalLink, User, Edit3, ArrowRight, RotateCcw, Trash2, SquareStack } from "lucide-react"
import { getStatusColor, formatDate } from "@/modules/task-transfer/utils"
import type { AssignmentStatus, Assignment } from "@/modules/task-transfer/types"
import { useEffect, useMemo, useState, useRef } from "react"
import { useTaskTransferStore } from "@/modules/task-transfer/store"
import { EditAssignmentModal } from "@/modules/task-transfer/components/EditAssignmentModal"
import { AssignmentAuditHistory } from "@/modules/task-transfer/components/AssignmentAuditHistory"
import { CompactTaskSchedule } from "./CompactTaskSchedule"
import { CreateObjectAssignmentModal } from "./CreateObjectAssignmentModal"
import { useToast } from "@/hooks/use-toast"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { TaskTransferGuide } from "./TaskTransferGuide"


type TaskPreviewType = "incoming" | "outgoing"

interface TaskPreviewCardProps {
  type: TaskPreviewType
  status: AssignmentStatus
  fromSection?: string
  toSection?: string
  dueDate?: string
  hasLink?: boolean
  assignment: Assignment
  onClick: (assignment: Assignment) => void
}

function TaskPreviewCard({ type, status, fromSection, toSection, dueDate, hasLink, assignment, onClick }: TaskPreviewCardProps) {
  const bgColor = type === "outgoing" ? "bg-primary/5 border-primary/20" : "bg-secondary/50 border-secondary"
  const hoverColor = type === "outgoing" ? "hover:bg-primary/10" : "hover:bg-secondary/70"

  return (
    <div 
      className={`p-3 rounded border-l-2 cursor-pointer transition-colors ${bgColor} ${hoverColor} min-h-[100px] flex flex-col justify-between`}
      onClick={() => onClick(assignment)}
    >
      {/* Верхняя строка: статус + срок/ссылка */}
      <div className="flex items-center justify-between mb-2">
        <Badge className={`${getStatusColor(status)} whitespace-nowrap text-[10px] h-5 px-2 py-0`}>{status}</Badge>
        <div className="flex items-center gap-3 flex-shrink-0 ml-3 text-[11px] text-muted-foreground">
          {assignment.planned_transmitted_date && (
            <span className="inline-flex items-center gap-1 text-foreground font-semibold">
              <Calendar className="h-3 w-3" />
              <span className="truncate max-w-[140px]">{formatDate(assignment.planned_transmitted_date)}</span>
            </span>
          )}
          {dueDate && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span className="truncate max-w-[120px]">{formatDate(dueDate)}</span>
            </span>
          )}
          {hasLink && <ExternalLink className="h-3 w-3 opacity-70" />}
        </div>
      </div>

      {/* Название задания */}
      <div className="text-sm font-medium text-foreground mb-2 line-clamp-2 leading-tight flex-1">
        {assignment.title}
      </div>
      
      {/* Нижняя строка: кому/от */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <User className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">
            {type === "outgoing" ? `Кому: ${toSection ?? "—"}` : `От: ${fromSection ?? "—"}`}
          </span>
        </div>
      </div>
    </div>
  )
}

interface SectionTasksPreviewProps {
  sectionId: string
}

export default function SectionTasksPreview({ sectionId }: SectionTasksPreviewProps) {
  const { 
    assignments, 
    isLoadingAssignments, 
    loadAssignments,
    advanceStatus,
    advanceStatusWithDuration,
    revertStatus,
    sectionHierarchy,
    projects
  } = useTaskTransferStore()
  
  // Состояние для модальных окон
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null)
  const [activeTab, setActiveTab] = useState<"details" | "history" | "audit">("details")
  const [showEditModal, setShowEditModal] = useState(false)

  const [showDurationDialog, setShowDurationDialog] = useState(false)
  const [durationDays, setDurationDays] = useState<string>("7")
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  // Состояние для переключения между заданиями и графиком
  const [currentView, setCurrentView] = useState<"tasks" | "schedule">("tasks")
  const [showCreateAssignmentModal, setShowCreateAssignmentModal] = useState(false)
  
  const { toast } = useToast()

  // Автообновление selectedAssignment при изменении данных
  useEffect(() => {
    if (selectedAssignment) {
      const updatedAssignment = assignments.find(a => a.assignment_id === selectedAssignment.assignment_id)
      if (updatedAssignment) {
        setSelectedAssignment(updatedAssignment)
      }
    }
  }, [assignments, selectedAssignment])

  // Получаем информацию о разделе и проекте
  const sectionInfo = useMemo(() => {
    const section = sectionHierarchy.find(sh => sh.section_id === sectionId)
    return {
      sectionName: section?.section_name || 'Неизвестный раздел',
      projectId: section?.project_id || '',
      projectName: section?.project_name || 'Неизвестный проект',
      objectId: section?.object_id || '',
      objectName: section?.object_name || 'Неизвестный объект',
      stageId: section?.stage_id || ''
    }
  }, [sectionHierarchy, sectionId])

  useEffect(() => {
    if (!assignments || assignments.length === 0) {
      loadAssignments().catch(() => {})
    }
  }, [assignments?.length, loadAssignments])

  const [outgoing, incoming] = useMemo(() => {
    const out = (assignments || []).filter((a: Assignment) => a.from_section_id === sectionId)
    const inc = (assignments || []).filter((a: Assignment) => a.to_section_id === sectionId)
    return [out, inc]
  }, [assignments, sectionId])



  // Обработчик клика по карточке задания
  const handleAssignmentClick = (assignment: Assignment) => {
    setSelectedAssignment(assignment)
    setActiveTab("details")
  }

  // Обработчик продвижения статуса
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
        // selectedAssignment обновится автоматически через useEffect при изменении assignments
      } else {
        toast({
          title: "Ошибка",
          description: "Не удалось обновить статус задания",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Произошла неожиданная ошибка",
        variant: "destructive",
      })
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  // Обработчик подтверждения продолжительности
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
        // selectedAssignment обновится автоматически через useEffect при изменении assignments
      } else {
        toast({
          title: "Ошибка",
          description: "Не удалось обновить статус задания",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Произошла неожиданная ошибка",
        variant: "destructive",
      })
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  // Обработчик отката статуса
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
        // selectedAssignment обновится автоматически через useEffect при изменении assignments
      } else {
        toast({
          title: "Ошибка",
          description: "Не удалось отменить статус задания",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Произошла неожиданная ошибка",
        variant: "destructive",
      })
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedAssignment) return
    try {
      const result = await useTaskTransferStore.getState().deleteAssignment(selectedAssignment.assignment_id)
      if (result.success) {
        setSelectedAssignment(null)
        toast({ title: "Удалено", description: "Задание удалено" })
      } else {
        toast({ title: "Ошибка", description: "Не удалось удалить задание", variant: "destructive" })
      }
    } catch (e) {
      toast({ title: "Ошибка", description: "Не удалось удалить задание", variant: "destructive" })
    }
  }

  // При переключении вкладок/открытии модалки прокручиваем содержимое к верху
  const dialogContentRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (dialogContentRef.current) {
      dialogContentRef.current.scrollTop = 0
    }
  }, [activeTab, selectedAssignment])

  // Функции проверки возможности изменения статуса
  const canAdvanceStatus = (status: AssignmentStatus): boolean => {
    return status !== 'Согласовано'
  }

  const canRevertStatus = (status: AssignmentStatus): boolean => {
    return status !== 'Создано'
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      {/* Переключатель между заданиями и графиком */}
      <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-border py-2 mb-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex bg-muted rounded-lg p-1 w-fit">
            <button
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                currentView === "tasks" 
                  ? "bg-card text-foreground shadow-sm border border-border" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
              onClick={() => setCurrentView("tasks")}
            >
              Задания
            </button>
            <button
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                currentView === "schedule" 
                  ? "bg-card text-foreground shadow-sm border border-border" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
              onClick={() => setCurrentView("schedule")}
            >
              График передачи
            </button>
          </div>
          {currentView === "tasks" && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => setShowCreateAssignmentModal(true)}
                className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <SquareStack className="h-4 w-4" />
                Создать задание
              </Button>
              <TaskTransferGuide />
            </div>
          )}
        </div>
        
        {/* Заголовки колонок только для вида заданий */}
        {currentView === "tasks" && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-primary">Исходящие задания</h4>
            </div>
            <div>
              <h4 className="font-medium text-secondary-foreground">Входящие задания</h4>
            </div>
          </div>
        )}
      </div>

      {/* Контент в зависимости от выбранной вкладки */}
      {currentView === "tasks" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            {isLoadingAssignments && outgoing.length === 0 ? (
              <div className="text-xs text-muted-foreground">Загрузка…</div>
            ) : outgoing.length > 0 ? (
              outgoing.map((a) => (
                <TaskPreviewCard
                  key={a.assignment_id}
                  type="outgoing"
                  status={a.status}
                  toSection={a.to_section_name}
                  dueDate={a.due_date}
                  hasLink={!!a.link}
                  assignment={a}
                  onClick={handleAssignmentClick}
                />
              ))
            ) : (
              <div className="text-xs text-muted-foreground">Нет исходящих заданий</div>
            )}
          </div>
          <div className="space-y-2">
            {isLoadingAssignments && incoming.length === 0 ? (
              <div className="text-xs text-muted-foreground">Загрузка…</div>
            ) : incoming.length > 0 ? (
              incoming.map((a) => (
                <TaskPreviewCard
                  key={a.assignment_id}
                  type="incoming"
                  status={a.status}
                  fromSection={a.from_section_name}
                  dueDate={a.due_date}
                  hasLink={!!a.link}
                  assignment={a}
                  onClick={handleAssignmentClick}
                />
              ))
            ) : (
              <div className="text-xs text-muted-foreground">Нет входящих заданий</div>
            )}
          </div>
        </div>
      ) : (
        <CompactTaskSchedule
          sectionId={sectionId}
        />
      )}

      {/* Модальное окно деталей задания */}
      <Dialog
        open={!!selectedAssignment}
        onOpenChange={() => {
          setSelectedAssignment(null)
          setActiveTab("details")
        }}
      >
        <DialogContent ref={dialogContentRef} className="sm:max-w-[600px] h-[80vh] overflow-y-auto items-start content-start">
          <DialogHeader>
            <DialogTitle className="sr-only">Детали задания</DialogTitle>
            <div className="flex items-center justify-between border-b mt-2">
              <div className="flex">
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
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowEditModal(true)}
                  className="h-8 w-8"
                >
                  <Edit3 className="h-4 w-4" />
                </Button>
                <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="icon" className="h-8 w-8">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Удалить задание?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Это действие необратимо. Задание и история изменений будут удалены.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Отмена</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete}>Удалить</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
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

      {/* Модальное окно создания задания для текущего раздела */}
      {showCreateAssignmentModal && (
        <CreateObjectAssignmentModal
          isOpen={showCreateAssignmentModal}
          onClose={() => setShowCreateAssignmentModal(false)}
          objectId={sectionInfo.objectId}
          objectName={sectionInfo.objectName}
          projectId={sectionInfo.projectId}
          projectName={sectionInfo.projectName}
          stageId={sectionInfo.stageId}
          sectionId={sectionId}
        />
      )}

      {/* Модальное окно редактирования */}
      <EditAssignmentModal
        assignment={selectedAssignment}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onUpdate={(updatedAssignment) => {
          // Обновляем selectedAssignment мгновенно после редактирования
          setSelectedAssignment(updatedAssignment)
        }}
      />



      {/* Диалог для указания продолжительности */}
      <Dialog open={showDurationDialog} onOpenChange={setShowDurationDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Укажите плановую продолжительность</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-2 block">
                Количество дней для выполнения задания
              </Label>
              <Input
                type="number"
                min="1"
                max="365"
                value={durationDays}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDurationDays(e.target.value)}
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
    </div>
  )
}

// Компонент деталей задания (адаптирован из TaskList.tsx)
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
              {assignment.from_section_name || 'Неизвестный раздел'}
            </p>
          </div>
          <div className="p-4 bg-secondary/50 border border-secondary rounded-lg">
            <h4 className="font-medium text-sm text-muted-foreground mb-2">Раздел-получатель</h4>
            <p className="text-sm font-medium text-foreground">
              {assignment.to_section_name || 'Неизвестный раздел'}
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
            {assignment.planned_transmitted_date && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Плановая дата передачи</p>
                <p className="text-sm font-medium text-foreground">{formatDate(assignment.planned_transmitted_date)}</p>
              </div>
            )}
            {assignment.due_date && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Срок выполнения</p>
                <p className="text-sm font-medium text-destructive">{formatDate(assignment.due_date)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Плановая продолжительность */}
        {assignment.planned_duration && (
          <div className="p-4 bg-accent/50 rounded-lg border border-accent">
            <h4 className="font-medium text-sm text-muted-foreground mb-2">Плановая продолжительность</h4>
            <p className="text-sm font-medium text-foreground">
              {assignment.planned_duration} дней
            </p>
          </div>
        )}

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
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-foreground">История статусов</h3>
          
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
          {/* Временная линия статусов */}
          <div className="absolute left-7 top-4 bottom-4 w-0.5 bg-gradient-to-b from-border to-border/50"></div>
          
          <div className="space-y-6">
            {/* Создано */}
            <div className="relative flex items-start">
              <div className="absolute left-5 w-6 h-6 bg-gray-700 rounded-full border-2 border-white shadow-lg flex items-center justify-center z-10">
                <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
              </div>
              <div className="ml-16 bg-card border border-border rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="text-base font-semibold text-foreground mb-1">Создано</h4>
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
              </div>
            </div>

            {/* Передано */}
            {(assignment.status === 'Передано' || assignment.actual_transmitted_date || 
              ['Принято', 'Выполнено', 'Согласовано'].includes(assignment.status)) && (
              <div className="relative flex items-start">
                <div className="absolute left-5 w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center z-10">
                  <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
                </div>
                <div className="ml-16 bg-card border border-primary/20 rounded-xl p-4 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="text-base font-semibold text-primary mb-1">Передано</h4>
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
                <div className="ml-16 bg-card border border-secondary rounded-xl p-4 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="text-base font-semibold text-secondary-foreground mb-1">Принято</h4>
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
                <div className="ml-16 bg-card border border-accent rounded-xl p-4 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="text-base font-semibold text-accent-foreground mb-1">Выполнено</h4>
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
                <div className="ml-16 bg-card border border-primary rounded-xl p-4 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="text-base font-semibold text-primary mb-1">Согласовано</h4>
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
  if (activeTab === 'audit') {
    return <AssignmentAuditHistory assignment={assignment} />
  }

  return null
}
