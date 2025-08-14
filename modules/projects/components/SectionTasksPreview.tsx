"use client"

import { Badge } from "@/components/ui/badge"
import { Calendar, Clock, ExternalLink, User } from "lucide-react"
import { getStatusColor, formatDate } from "@/modules/task-transfer/utils"
import type { AssignmentStatus, Assignment } from "@/modules/task-transfer/types"
import { useEffect, useMemo } from "react"
import { useTaskTransferStore } from "@/modules/task-transfer/store"

type TaskPreviewType = "incoming" | "outgoing"

interface TaskPreviewCardProps {
  type: TaskPreviewType
  status: AssignmentStatus
  fromSection?: string
  toSection?: string
  dueDate?: string
  hasLink?: boolean
}

function TaskPreviewCard({ type, status, fromSection, toSection, dueDate, hasLink }: TaskPreviewCardProps) {
  const bgColor = type === "outgoing" ? "bg-primary/5 border-primary/20" : "bg-secondary/50 border-secondary"
  const hoverColor = type === "outgoing" ? "hover:bg-primary/10" : "hover:bg-secondary/70"

  return (
    <div className={`p-3 rounded border-l-2 cursor-default transition-colors ${bgColor} ${hoverColor} h-[84px] flex flex-col justify-between`}>
      {/* Верхняя строка: статус + срок/ссылка */}
      <div className="flex items-center justify-between">
        <Badge className={`${getStatusColor(status)} whitespace-nowrap text-[10px] h-5 px-2 py-0`}>{status}</Badge>
        <div className="flex items-center gap-3 flex-shrink-0 ml-3 text-[11px] text-muted-foreground">
          {dueDate && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span className="truncate max-w-[120px]">{formatDate(dueDate)}</span>
            </span>
          )}
          {hasLink && <ExternalLink className="h-3 w-3 opacity-70" />}
        </div>
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
  const { assignments, isLoadingAssignments, loadAssignments } = useTaskTransferStore()

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

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      {/* Закреплённые заголовки колонок */}
      <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-border py-2 mb-2">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium text-primary">Исходящие задания</h4>
          </div>
          <div>
            <h4 className="font-medium text-secondary-foreground">Входящие задания</h4>
          </div>
        </div>
      </div>

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
              />
            ))
          ) : (
            <div className="text-xs text-muted-foreground">Нет входящих заданий</div>
          )}
        </div>
      </div>
    </div>
  )
}
