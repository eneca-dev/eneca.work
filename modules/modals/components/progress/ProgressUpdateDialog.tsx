'use client'

import { useState, useCallback, useEffect } from 'react'
import { X, TrendingUp, SkipForward, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUpdateItemProgress } from '@/modules/resource-graph/hooks'

// ============================================================================
// Types
// ============================================================================

export interface ProgressUpdateDialogProps {
  /** Открыт ли диалог */
  isOpen: boolean
  /** Callback закрытия */
  onClose: () => void
  /** ID задачи */
  itemId: string
  /** Название задачи (для отображения) */
  itemName: string
  /** Текущий процент готовности */
  currentProgress: number
  /** Callback после успешного обновления */
  onSuccess?: () => void
}

// ============================================================================
// Component
// ============================================================================

export function ProgressUpdateDialog({
  isOpen,
  onClose,
  itemId,
  itemName,
  currentProgress,
  onSuccess,
}: ProgressUpdateDialogProps) {
  const [progress, setProgress] = useState(currentProgress)

  // Мутация с optimistic update
  const mutation = useUpdateItemProgress()

  // Сбрасываем при открытии
  useEffect(() => {
    if (isOpen) {
      setProgress(currentProgress)
    }
  }, [isOpen, currentProgress])

  const handleSkip = useCallback(() => {
    onClose()
  }, [onClose])

  const handleUpdate = useCallback(() => {
    if (mutation.isPending) return

    mutation.mutate(
      { itemId, progress },
      {
        onSuccess: () => {
          onSuccess?.()
          onClose()
        },
        onError: (error) => {
          console.error('[ProgressUpdateDialog] Error:', error)
        },
      }
    )
  }, [itemId, progress, mutation, onSuccess, onClose])

  // Быстрые кнопки для установки значения
  const quickValues = [25, 50, 75, 100]

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
        onClick={handleSkip}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className={cn(
            'pointer-events-auto w-full max-w-sm',
            'bg-background/95 dark:bg-background/90',
            'backdrop-blur-xl',
            'border border-border/50 dark:border-border/30',
            'rounded-xl shadow-2xl',
            'overflow-hidden'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <h3 className="text-sm font-semibold">Обновить готовность?</h3>
            </div>
            <button
              onClick={handleSkip}
              className="p-1 rounded-md hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Task name */}
            <p className="text-sm text-muted-foreground line-clamp-2">
              {itemName}
            </p>

            {/* Progress display */}
            <div className="text-center">
              <div className="text-4xl font-bold tabular-nums">
                {progress}
                <span className="text-xl text-muted-foreground ml-1">%</span>
              </div>
              {currentProgress !== progress && (
                <p className="text-xs text-muted-foreground mt-1">
                  было: {currentProgress}%
                </p>
              )}
            </div>

            {/* Slider */}
            <div className="space-y-2">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={progress}
                onChange={(e) => setProgress(Number(e.target.value))}
                className={cn(
                  'w-full h-2 rounded-full appearance-none cursor-pointer',
                  'bg-muted',
                  '[&::-webkit-slider-thumb]:appearance-none',
                  '[&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5',
                  '[&::-webkit-slider-thumb]:rounded-full',
                  '[&::-webkit-slider-thumb]:bg-primary',
                  '[&::-webkit-slider-thumb]:shadow-md',
                  '[&::-webkit-slider-thumb]:cursor-pointer',
                  '[&::-webkit-slider-thumb]:transition-transform',
                  '[&::-webkit-slider-thumb]:hover:scale-110'
                )}
              />

              {/* Quick values */}
              <div className="flex justify-between gap-2">
                {quickValues.map((val) => (
                  <button
                    key={val}
                    onClick={() => setProgress(val)}
                    className={cn(
                      'flex-1 py-1.5 text-xs font-medium rounded-md transition-colors',
                      progress === val
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                    )}
                  >
                    {val}%
                  </button>
                ))}
              </div>
            </div>

            {/* Error message */}
            {mutation.error && (
              <p className="text-xs text-destructive text-center">
                {mutation.error.message || 'Ошибка при обновлении готовности'}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-2 px-4 py-3 border-t border-border/50 bg-muted/30">
            <button
              onClick={handleSkip}
              disabled={mutation.isPending}
              className={cn(
                'flex-1 flex items-center justify-center gap-2',
                'px-4 py-2 text-sm font-medium rounded-lg',
                'bg-muted hover:bg-muted/80 text-muted-foreground',
                'transition-colors',
                'disabled:opacity-50'
              )}
            >
              <SkipForward className="w-4 h-4" />
              Пропустить
            </button>
            <button
              onClick={handleUpdate}
              disabled={mutation.isPending || progress === currentProgress}
              className={cn(
                'flex-1 flex items-center justify-center gap-2',
                'px-4 py-2 text-sm font-medium rounded-lg',
                'bg-primary hover:bg-primary/90 text-primary-foreground',
                'transition-colors',
                'disabled:opacity-50'
              )}
            >
              {mutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {mutation.isPending ? 'Сохранение...' : 'Обновить'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
