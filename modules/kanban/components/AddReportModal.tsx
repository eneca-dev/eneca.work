'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon, User } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { KanbanTask, KanbanSection, KanbanStage } from '../types'

interface AddReportModalProps {
  isOpen: boolean
  onClose: () => void
  task: KanbanTask
  section: KanbanSection
  stage: KanbanStage
}

export function AddReportModal({
  isOpen,
  onClose,
  task,
  section,
  stage,
}: AddReportModalProps) {
  const [date, setDate] = useState<Date>(new Date())
  const [hours, setHours] = useState('')
  const [rate, setRate] = useState('25')
  const [description, setDescription] = useState('')

  const handleSubmit = () => {
    // TODO: Implement report submission logic
    console.log({
      taskId: task.id,
      sectionId: section.id,
      stageId: stage.id,
      date,
      hours,
      rate,
      description,
    })
    onClose()
    // Reset form
    setHours('')
    setDescription('')
  }

  const handleClose = () => {
    onClose()
    // Reset form
    setHours('')
    setDescription('')
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Добавить отчёт
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Привяжите отчёт к строке декомпозиции
          </p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Decomposition line info */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">
              Строка декомпозиции
            </Label>
            <div className="text-sm font-medium">
              {stage.name} • {task.description}
            </div>
          </div>

          {/* Executor */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">
              Исполнитель
              <span className="text-destructive ml-0.5">*</span>
            </Label>
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/20 text-primary">
                  {section.responsible
                    ? `${section.responsible.firstName[0]}${section.responsible.lastName[0]}`
                    : 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="text-sm font-medium">
                  {section.responsible
                    ? `${section.responsible.firstName} ${section.responsible.lastName}`
                    : 'Не назначен'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {section.responsible
                    ? `${section.responsible.firstName.toLowerCase()}.${section.responsible.lastName.toLowerCase()}@example.com`
                    : 'user@example.com'}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <User className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Date, Hours, Rate */}
          <div className="grid grid-cols-3 gap-3">
            {/* Date */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">
                Дата
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !date && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? (
                      format(date, 'dd.MM.yyyy', { locale: ru })
                    ) : (
                      <span>Выберите</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    initialFocus
                    locale={ru}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Hours */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">
                Часы
              </Label>
              <Input
                type="number"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="0"
                className="text-center"
                min="0"
                step="0.5"
              />
            </div>

            {/* Rate */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">
                Ставка, BYN/ч
              </Label>
              <Input
                type="number"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="25"
                className="text-center"
                min="0"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 flex items-center justify-between">
              <span>Описание</span>
              <span className="text-muted-foreground/60">обязательно</span>
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Что было сделано"
              className="min-h-[120px] resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={!hours || !description}>
            Сохранить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
