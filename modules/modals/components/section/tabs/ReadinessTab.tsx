'use client'

/**
 * ReadinessTab - Вкладка с контрольными точками плановой готовности
 */

import { useState, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  Plus,
  Trash2,
  Loader2,
  Target,
  Calendar,
  Percent,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useReadinessCheckpoints,
  useCreateReadinessCheckpoint,
  useUpdateReadinessCheckpoint,
  useDeleteReadinessCheckpoint,
} from '../../../hooks'

// ============================================================================
// Types
// ============================================================================

interface ReadinessTabProps {
  sectionId: string
}

interface CheckpointRowProps {
  checkpoint: {
    id: string
    date: string
    plannedReadiness: number
  }
  onUpdate: (id: string, date: string, value: number) => void
  onDelete: (id: string) => void
  isUpdating: boolean
  isDeleting: boolean
}

// ============================================================================
// CheckpointRow Component
// ============================================================================

function CheckpointRow({
  checkpoint,
  onUpdate,
  onDelete,
  isUpdating,
  isDeleting,
}: CheckpointRowProps) {
  const [editingDate, setEditingDate] = useState(false)
  const [editingValue, setEditingValue] = useState(false)
  const [tempDate, setTempDate] = useState(checkpoint.date)
  const [tempValue, setTempValue] = useState(checkpoint.plannedReadiness.toString())

  const handleDateBlur = useCallback(() => {
    setEditingDate(false)
    if (tempDate !== checkpoint.date) {
      onUpdate(checkpoint.id, tempDate, checkpoint.plannedReadiness)
    }
  }, [tempDate, checkpoint, onUpdate])

  const handleValueBlur = useCallback(() => {
    setEditingValue(false)
    const numValue = Math.min(100, Math.max(0, parseInt(tempValue) || 0))
    if (numValue !== checkpoint.plannedReadiness) {
      onUpdate(checkpoint.id, checkpoint.date, numValue)
    }
    setTempValue(numValue.toString())
  }, [tempValue, checkpoint, onUpdate])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, type: 'date' | 'value') => {
      if (e.key === 'Enter') {
        if (type === 'date') handleDateBlur()
        else handleValueBlur()
      }
      if (e.key === 'Escape') {
        if (type === 'date') {
          setTempDate(checkpoint.date)
          setEditingDate(false)
        } else {
          setTempValue(checkpoint.plannedReadiness.toString())
          setEditingValue(false)
        }
      }
    },
    [checkpoint, handleDateBlur, handleValueBlur]
  )

  const isDisabled = isUpdating || isDeleting

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg',
        'bg-muted/30 border border-border/50',
        'transition-all duration-200',
        isDisabled && 'opacity-60'
      )}
    >
      {/* Date */}
      <div className="flex-1 min-w-0">
        {editingDate ? (
          <input
            type="date"
            value={tempDate}
            onChange={(e) => setTempDate(e.target.value)}
            onBlur={handleDateBlur}
            onKeyDown={(e) => handleKeyDown(e, 'date')}
            autoFocus
            disabled={isDisabled}
            className={cn(
              'w-full px-2 py-1 text-sm',
              'bg-muted border border-primary/50 rounded',
              'text-foreground',
              'focus:outline-none focus:ring-2 focus:ring-primary/20'
            )}
          />
        ) : (
          <button
            onClick={() => !isDisabled && setEditingDate(true)}
            disabled={isDisabled}
            className={cn(
              'flex items-center gap-1.5 text-sm text-foreground',
              'hover:text-foreground transition-colors',
              'disabled:cursor-not-allowed'
            )}
          >
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            {format(parseISO(checkpoint.date), 'd MMMM yyyy', { locale: ru })}
          </button>
        )}
      </div>

      {/* Value */}
      <div className="flex items-center gap-1">
        {editingValue ? (
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              max="100"
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onBlur={handleValueBlur}
              onKeyDown={(e) => handleKeyDown(e, 'value')}
              autoFocus
              disabled={isDisabled}
              className={cn(
                'w-16 px-2 py-1 text-sm text-right',
                'bg-muted border border-primary/50 rounded',
                'text-foreground',
                'focus:outline-none focus:ring-2 focus:ring-primary/20'
              )}
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        ) : (
          <button
            onClick={() => !isDisabled && setEditingValue(true)}
            disabled={isDisabled}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded',
              'text-sm font-medium',
              'bg-amber-500/10 text-amber-400',
              'hover:bg-amber-500/20 transition-colors',
              'disabled:cursor-not-allowed'
            )}
          >
            {checkpoint.plannedReadiness}%
          </button>
        )}
      </div>

      {/* Delete button */}
      <button
        onClick={() => onDelete(checkpoint.id)}
        disabled={isDisabled}
        className={cn(
          'p-1.5 rounded',
          'text-muted-foreground hover:text-red-400',
          'hover:bg-red-500/10 transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
        aria-label="Удалить контрольную точку"
      >
        {isDeleting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Trash2 className="w-4 h-4" />
        )}
      </button>
    </div>
  )
}

// ============================================================================
// AddCheckpointForm Component
// ============================================================================

interface AddCheckpointFormProps {
  onAdd: (date: string, value: number) => void
  isAdding: boolean
  existingDates: string[]
}

function AddCheckpointForm({ onAdd, isAdding, existingDates }: AddCheckpointFormProps) {
  const [date, setDate] = useState('')
  const [value, setValue] = useState('100')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      setError(null)

      if (!date) {
        setError('Выберите дату')
        return
      }

      const numValue = parseInt(value) || 0
      if (numValue < 0 || numValue > 100) {
        setError('Процент должен быть от 0 до 100')
        return
      }

      if (existingDates.includes(date)) {
        setError('Точка на эту дату уже существует')
        return
      }

      onAdd(date, numValue)
      setDate('')
      setValue('100')
    },
    [date, value, existingDates, onAdd]
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-end gap-3">
        {/* Date input */}
        <div className="flex-1">
          <label
            htmlFor="checkpoint-date"
            className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5"
          >
            Дата
          </label>
          <input
            id="checkpoint-date"
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value)
              setError(null)
            }}
            disabled={isAdding}
            className={cn(
              'w-full px-3 py-2 text-sm',
              'bg-muted border border-border rounded-lg',
              'text-foreground placeholder:text-muted-foreground',
              'focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20',
              'disabled:opacity-50'
            )}
          />
        </div>

        {/* Value input */}
        <div className="w-24">
          <label
            htmlFor="checkpoint-value"
            className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5"
          >
            Готовность
          </label>
          <div className="relative">
            <input
              id="checkpoint-value"
              type="number"
              min="0"
              max="100"
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                setError(null)
              }}
              disabled={isAdding}
              className={cn(
                'w-full px-3 py-2 pr-8 text-sm text-right',
                'bg-muted border border-border rounded-lg',
                'text-foreground',
                'focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20',
                'disabled:opacity-50'
              )}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              %
            </span>
          </div>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={isAdding || !date}
          className={cn(
            'flex items-center justify-center gap-1.5',
            'px-4 py-2 rounded-lg',
            'text-sm font-medium',
            'bg-amber-500/20 text-amber-400 border border-amber-500/30',
            'hover:bg-amber-500/30 transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {isAdding ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          Добавить
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-400">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}
    </form>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function ReadinessTab({ sectionId }: ReadinessTabProps) {
  const { data: checkpoints, isLoading, error } = useReadinessCheckpoints(sectionId)
  const createMutation = useCreateReadinessCheckpoint()
  const updateMutation = useUpdateReadinessCheckpoint()
  const deleteMutation = useDeleteReadinessCheckpoint()

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const handleAdd = useCallback(
    async (date: string, value: number) => {
      await createMutation.mutateAsync({
        sectionId,
        date,
        plannedReadiness: value,
      })
    },
    [sectionId, createMutation]
  )

  const handleUpdate = useCallback(
    async (id: string, date: string, value: number) => {
      setUpdatingId(id)
      try {
        await updateMutation.mutateAsync({
          checkpointId: id,
          sectionId,
          date,
          plannedReadiness: value,
        })
      } finally {
        setUpdatingId(null)
      }
    },
    [updateMutation, sectionId]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      setDeletingId(id)
      try {
        await deleteMutation.mutateAsync({ checkpointId: id, sectionId })
      } finally {
        setDeletingId(null)
      }
    },
    [deleteMutation, sectionId]
  )

  // Sort checkpoints by date
  const sortedCheckpoints = [...(checkpoints || [])].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  const existingDates = sortedCheckpoints.map((cp) => cp.date)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-5 py-5">
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          Ошибка загрузки данных
        </div>
      </div>
    )
  }

  return (
    <div className="px-5 py-5 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Target className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Контрольные точки плановой готовности
        </h3>
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground leading-relaxed">
        Задайте контрольные точки с плановым процентом готовности раздела на указанные даты.
        Эти точки используются для построения графика плановой готовности.
      </p>

      {/* Add form */}
      <div className="p-4 rounded-xl bg-muted/20 border border-border/40">
        <AddCheckpointForm
          onAdd={handleAdd}
          isAdding={createMutation.isPending}
          existingDates={existingDates}
        />
      </div>

      {/* Checkpoints list */}
      <div className="space-y-2">
        {sortedCheckpoints.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <Percent className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>Контрольные точки не заданы</p>
            <p className="text-xs mt-1">
              Добавьте точки для определения плановой готовности
            </p>
          </div>
        ) : (
          sortedCheckpoints.map((checkpoint) => (
            <CheckpointRow
              key={checkpoint.id}
              checkpoint={checkpoint}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              isUpdating={updatingId === checkpoint.id}
              isDeleting={deletingId === checkpoint.id}
            />
          ))
        )}
      </div>

      {/* Summary */}
      {sortedCheckpoints.length > 0 && (
        <div className="pt-3 border-t border-border/50">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Всего контрольных точек:</span>
            <span className="font-medium text-foreground">{sortedCheckpoints.length}</span>
          </div>
          {sortedCheckpoints.length >= 2 && (
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-muted-foreground">Период:</span>
              <span className="font-medium text-foreground">
                {format(parseISO(sortedCheckpoints[0].date), 'd MMM', { locale: ru })} -{' '}
                {format(parseISO(sortedCheckpoints[sortedCheckpoints.length - 1].date), 'd MMM yyyy', { locale: ru })}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
