"use client"

import { useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Clock, User, Edit3, RotateCcw } from "lucide-react"
import { useTaskTransferStore } from "../store"
import { formatDate } from "../utils"
import { FIELD_LABELS } from "../types"
import type { Assignment, AssignmentAuditRecord } from "../types"

interface AssignmentAuditHistoryProps {
  assignment: Assignment
}

export function AssignmentAuditHistory({ assignment }: AssignmentAuditHistoryProps) {
  const { 
    assignmentHistory, 
    isLoadingHistory, 
    loadAssignmentHistory 
  } = useTaskTransferStore()

  // Загружаем историю при открытии и принудительно обновляем каждый раз
  useEffect(() => {
    console.log('🔄 Компонент истории изменений загружен для задания:', assignment.assignment_id)
    loadAssignmentHistory(assignment.assignment_id)
  }, [assignment.assignment_id, loadAssignmentHistory])

  const history = assignmentHistory[assignment.assignment_id] || []

  // Группируем изменения по времени (в рамках одной сессии редактирования)
  const groupedHistory = history.reduce((groups: Record<string, AssignmentAuditRecord[]>, record) => {
    const timeKey = record.changed_at.split('T')[0] + '_' + record.changed_at.split('T')[1].split(':').slice(0, 2).join(':')
    
    if (!groups[timeKey]) {
      groups[timeKey] = []
    }
    
    groups[timeKey].push(record)
    return groups
  }, {})

  if (isLoadingHistory) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-8">
        <Edit3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">История изменений пуста</p>
        <p className="text-sm text-muted-foreground mt-1">
          Изменения будут отображаться после редактирования задания
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Edit3 className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">История изменений</h3>
          <Badge variant="secondary" className="ml-2">
            {history.length} записей
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadAssignmentHistory(assignment.assignment_id)}
          disabled={isLoadingHistory}
          className="flex items-center gap-2"
        >
          <RotateCcw className={`h-4 w-4 ${isLoadingHistory ? 'animate-spin' : ''}`} />
          Обновить
        </Button>
      </div>

      <ScrollArea className="h-[calc(100vh-400px)] lg:h-[calc(100vh-350px)] xl:h-[calc(100vh-300px)] min-h-[300px] border rounded-md">
        <div className="space-y-4 p-4">
          {Object.entries(groupedHistory)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([timeKey, records]) => {
              const firstRecord = records[0]
              
              return (
                <div key={timeKey} className="bg-card border border-border rounded-lg p-4">
                  {/* Заголовок группы изменений */}
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={firstRecord.changed_by_avatar} />
                        <AvatarFallback>
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {firstRecord.changed_by_name && firstRecord.changed_by_name !== 'Неизвестный пользователь' 
                            ? firstRecord.changed_by_name 
                            : 'Неизвестный пользователь'}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDate(firstRecord.changed_at)}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {records.length} изменений
                    </Badge>
                  </div>

                  {/* Список изменений */}
                  <div className="space-y-2">
                    {records.map((record) => (
                      <div 
                        key={record.audit_id}
                        className="flex items-start gap-3 p-3 bg-muted/50 rounded-md"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-foreground">
                              {FIELD_LABELS[record.field_name] || record.field_name}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              изменено
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Было:</span>
                              <div className="mt-1 p-2 bg-destructive/10 text-destructive rounded border border-destructive/20">
                                {record.old_value || <em className="text-muted-foreground">пусто</em>}
                              </div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Стало:</span>
                              <div className="mt-1 p-2 bg-green-500/10 text-green-700 rounded border border-green-500/20">
                                {record.new_value || <em className="text-muted-foreground">пусто</em>}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
        </div>
      </ScrollArea>

      {/* Индикатор внизу */}
      {history.length > 5 && (
        <div className="text-center mt-4 p-2 bg-muted/50 rounded-md">
          <p className="text-xs text-muted-foreground">
            📜 Прокрутите вверх для просмотра всех {history.length} записей
          </p>
        </div>
      )}
    </div>
  )
} 