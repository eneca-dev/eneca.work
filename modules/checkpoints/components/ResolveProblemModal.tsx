'use client'

// MOCK DATA - prototype only
// Модальное окно для решения проблемного чекпоинта

import { useState, useEffect } from 'react'
import { AlertTriangle, CheckCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import type { Checkpoint, ProblemResolution } from '../actions/checkpoints'
import { format, parseISO } from 'date-fns'

export interface ResolveProblemModalProps {
  /** Открыта ли модалка */
  open: boolean
  /** Callback при закрытии */
  onClose: () => void
  /** Чекпоинт для решения проблемы */
  checkpoint: Checkpoint | null
  /** Начальное значение для чекбокса "Закрыть проблему" */
  initialCloseProblem?: boolean
}

export function ResolveProblemModal({
  open,
  onClose,
  checkpoint,
  initialCloseProblem = false,
}: ResolveProblemModalProps) {
  const [comment, setComment] = useState('')
  const [deadlineShift, setDeadlineShift] = useState<number>(0)
  const [closeProblem, setCloseProblem] = useState(initialCloseProblem)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Синхронизировать closeProblem с initialCloseProblem при открытии модалки
  useEffect(() => {
    if (open) {
      setCloseProblem(initialCloseProblem)
    }
  }, [open, initialCloseProblem])

  // Сброс формы при закрытии
  const handleClose = () => {
    setComment('')
    setDeadlineShift(0)
    setCloseProblem(false)
    setIsSubmitting(false)
    onClose()
  }

  // MOCK: имитация добавления решения
  const handleResolve = async () => {
    if (!checkpoint) return

    // Валидация: комментарий обязателен
    if (!comment.trim()) {
      alert('Пожалуйста, укажите комментарий')
      return
    }

    setIsSubmitting(true)

    // MOCK: имитация задержки сервера
    await new Promise((resolve) => setTimeout(resolve, 800))

    // MOCK: показать toast (в реальной версии будет вызов Server Action)
    const action = closeProblem ? 'Проблема закрыта' : 'Добавлен комментарий к решению'
    const status = closeProblem ? '✅ Проблема решена и закрыта' : '📝 Комментарий добавлен (проблема остается активной)'
    alert(`${status} (MOCK)\n\nЧекпоинт: ${checkpoint.title}\nКомментарий: ${comment}\nСдвиг сроков: ${deadlineShift} дн.\n\nДействие: ${action}`)

    setIsSubmitting(false)
    handleClose()
  }

  if (!checkpoint) return null

  // История решений (если есть)
  const resolutions = checkpoint.problem_resolutions || []

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen && !isSubmitting) {
        handleClose()
      }
    }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <DialogTitle className="text-red-500">Работа с проблемой</DialogTitle>
            </div>
            {/* Чекбокс закрытия проблемы в верхнем правом углу */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="close-problem-header"
                checked={closeProblem}
                onCheckedChange={(checked) => setCloseProblem(checked === true)}
                disabled={isSubmitting}
              />
              <Label
                htmlFor="close-problem-header"
                className="text-sm font-medium cursor-pointer whitespace-nowrap"
              >
                Закрыть проблему
              </Label>
            </div>
          </div>
          <DialogDescription asChild>
            <div className="space-y-2">
              <p className="text-sm">Чекпоинт: <span className="font-medium">{checkpoint.title}</span></p>
              <p className="text-xs text-muted-foreground">
                Дата: {format(parseISO(checkpoint.checkpoint_date), 'dd.MM.yyyy')}
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Форма решения */}
          <div className="space-y-2">
            <Label htmlFor="comment" className="text-sm font-medium">
              Комментарий <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="comment"
              placeholder="Опишите предпринятые действия, решение проблемы или текущий статус..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              disabled={isSubmitting}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deadline-shift" className="text-sm font-medium">
              Сдвиг сроков (дней)
            </Label>
            <Input
              id="deadline-shift"
              type="number"
              placeholder="0"
              value={deadlineShift}
              onChange={(e) => setDeadlineShift(parseInt(e.target.value) || 0)}
              disabled={isSubmitting}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">
              Положительное число — сдвиг вперёд, отрицательное — назад
            </p>
          </div>

          {/* Кнопка добавления комментария */}
          <div className="pt-2">
            <Button
              onClick={handleResolve}
              disabled={isSubmitting || !comment.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 focus:ring-blue-600"
            >
              {isSubmitting
                ? (closeProblem ? 'Решение...' : 'Добавление...')
                : (closeProblem ? 'Добавить комментарий и закрыть' : 'Добавить комментарий')
              }
            </Button>
          </div>

          {/* История решений */}
          {resolutions.length > 0 && (
            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-green-500" />
                История решений
              </h4>
              <div className="space-y-3 max-h-[200px] overflow-y-auto">
                {resolutions.map((resolution) => {
                  const isClosed = resolution.action_type === 'closed'
                  return (
                    <div
                      key={resolution.resolution_id}
                      className={`p-3 rounded-lg border space-y-1.5 ${
                        isClosed
                          ? 'bg-green-500/10 border-green-500/30'
                          : 'bg-muted/50 border-border/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          {isClosed ? (
                            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <AlertTriangle className="h-3.5 w-3.5 text-blue-500" />
                          )}
                          <span className="text-xs font-medium text-foreground">
                            {resolution.resolved_by_name}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {format(parseISO(resolution.resolved_at), 'dd.MM.yyyy HH:mm')}
                        </span>
                      </div>
                      {isClosed ? (
                        <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                          Проблема закрыта
                        </p>
                      ) : (
                        <p className="text-xs text-foreground leading-relaxed">
                          {resolution.comment}
                        </p>
                      )}
                      {resolution.deadline_shift_days !== 0 && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          Сдвиг сроков: {resolution.deadline_shift_days > 0 ? '+' : ''}
                          {resolution.deadline_shift_days} дн.
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
