'use client'

import { useState } from 'react'
import { MessageSquareText, Pencil, Trash2, Plus, User } from 'lucide-react'
import { useStageReports, useSaveStageReport, useDeleteStageReport } from '../../hooks'
import { useHasPermission } from '@/modules/permissions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface StageReportMarkersProps {
  stageId: string
  enabled?: boolean
}

/**
 * Компонент отображения отчетов руководителя проекта к стадии
 * Использует lazy loading через enabled флаг
 */
export function StageReportMarkers({ stageId, enabled = false }: StageReportMarkersProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [editingReport, setEditingReport] = useState<{ id: string; comment: string } | null>(null)
  const [comment, setComment] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Permissions
  const canCreate = useHasPermission('project_reports.create')
  const canEdit = useHasPermission('project_reports.edit')

  // Data fetching
  const { data: reports, isLoading } = useStageReports(stageId, { enabled })
  const saveMutation = useSaveStageReport()
  const deleteMutation = useDeleteStageReport()

  const handleCreate = () => {
    setEditingReport(null)
    setComment('')
    setIsOpen(true)
  }

  const handleEdit = (reportId: string, existingComment: string) => {
    setEditingReport({ id: reportId, comment: existingComment })
    setComment(existingComment)
    setIsOpen(true)
  }

  const handleSave = async () => {
    if (!comment.trim()) {
      toast.error('Комментарий не может быть пустым')
      return
    }

    try {
      const result = await saveMutation.mutateAsync({
        stageId,
        comment: comment.trim(),
        reportId: editingReport?.id,
      })

      if (result.success) {
        toast.success(editingReport ? 'Отчет обновлен' : 'Отчет создан')
        setIsOpen(false)
        setComment('')
        setEditingReport(null)
      } else {
        toast.error(result.error || 'Ошибка при сохранении отчета')
      }
    } catch (error) {
      toast.error('Произошла ошибка')
    }
  }

  const handleDelete = async (reportId: string) => {
    try {
      const result = await deleteMutation.mutateAsync({ reportId, stageId })

      if (result.success) {
        toast.success('Отчет удален')
        setDeleteConfirm(null)
      } else {
        toast.error(result.error || 'Ошибка при удалении отчета')
      }
    } catch (error) {
      toast.error('Произошла ошибка')
    }
  }

  if (!enabled || isLoading) {
    return null
  }

  const hasReports = reports && reports.length > 0

  return (
    <>
      <div className="relative w-full">
        {/* Reports Container */}
        <div className="space-y-3 py-2">
          {hasReports ? (
            reports.map((report) => (
              <div
                key={report.id}
                className="group relative animate-in fade-in slide-in-from-bottom-4 duration-500"
              >
                {/* Glass-morphic Report Card */}
                <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.03] backdrop-blur-md transition-all duration-500 hover:border-white/20 hover:from-white/[0.09] hover:to-white/[0.05] hover:shadow-lg hover:shadow-primary/5">
                  {/* Decorative gradient accent */}
                  <div className="absolute -right-12 -top-12 h-24 w-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 blur-2xl transition-all duration-700 group-hover:from-primary/30 group-hover:to-primary/10" />

                  <div className="relative p-4">
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="transition-transform duration-300 hover:scale-105 hover:rotate-2">
                        <Avatar className="h-10 w-10 border-2 border-white/10 shadow-lg">
                          <AvatarImage src={report.createdBy.avatarUrl || undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-primary/90 to-primary/70 text-xs font-semibold text-white">
                            {report.createdBy.firstName?.[0] || report.createdBy.lastName?.[0] || (
                              <User className="h-4 w-4" />
                            )}
                          </AvatarFallback>
                        </Avatar>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Header */}
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold tracking-tight text-foreground">
                              {report.createdBy.name || 'Неизвестный пользователь'}
                            </p>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <MessageSquareText className="h-3 w-3" />
                              <span className="font-medium">
                                {formatDistanceToNow(new Date(report.createdAt), {
                                  addSuffix: true,
                                  locale: ru,
                                })}
                              </span>
                            </div>
                          </div>

                          {/* Action buttons */}
                          {canEdit && (
                            <div className="flex items-center gap-1 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 hover:bg-white/10"
                                onClick={() => handleEdit(report.id, report.comment)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                onClick={() => setDeleteConfirm(report.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Comment */}
                        <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                          {report.comment}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            canCreate && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <button
                  onClick={handleCreate}
                  className="group relative w-full overflow-hidden rounded-xl border-2 border-dashed border-white/10 bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-4 transition-all duration-500 hover:border-primary/30 hover:from-primary/[0.05] hover:to-primary/[0.02]"
                >
                  <div className="flex items-center justify-center gap-3">
                    <Plus className="h-5 w-5 text-muted-foreground transition-all duration-500 group-hover:rotate-180 group-hover:scale-110 group-hover:text-primary" />
                    <span className="font-semibold text-sm text-muted-foreground transition-colors duration-300 group-hover:text-primary">
                      Добавить отчет к стадии
                    </span>
                  </div>
                </button>
              </div>
            )
          )}

          {/* Create button when reports exist */}
          {hasReports && canCreate && (
            <div className="animate-in fade-in duration-300" style={{ animationDelay: '300ms' }}>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCreate}
                className="w-full border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
              >
                <Plus className="mr-2 h-4 w-4" />
                Добавить отчет
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight">
              {editingReport ? 'Редактировать отчет' : 'Создать отчет'}
            </DialogTitle>
            <DialogDescription>
              {editingReport
                ? 'Внесите изменения в комментарий руководителя проекта'
                : 'Добавьте комментарий руководителя проекта к данной стадии'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">
                Комментарий
              </label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Введите комментарий руководителя проекта..."
                className="min-h-[200px] resize-none"
                autoFocus
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending || !comment.trim()}
            >
              {saveMutation.isPending
                ? 'Сохранение...'
                : editingReport
                  ? 'Сохранить'
                  : 'Создать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить отчет?</DialogTitle>
            <DialogDescription>
              Это действие нельзя отменить. Отчет будет удален безвозвратно.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Удаление...' : 'Удалить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
