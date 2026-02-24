'use client'

import { useState, useCallback, useEffect } from 'react'
import { X, TrendingUp, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUpdateItemProgress } from '@/modules/resource-graph/hooks'
import type { BaseModalProps } from '../../types'

// ============================================================================
// Types
// ============================================================================

export interface ProgressUpdateDialogProps extends BaseModalProps {
  /** ID задачи */
  itemId: string
  /** Название задачи (для отображения) */
  itemName: string
  /** Текущий процент готовности */
  currentProgress: number
  /**
   * Внешний callback для обновления прогресса.
   * Если передан, используется вместо встроенной мутации.
   */
  onUpdate?: (itemId: string, progress: number) => Promise<void>
}

// ============================================================================
// Component
// ============================================================================

export function ProgressUpdateDialog({
  isOpen,
  onClose,
  onSuccess,
  itemId,
  itemName,
  currentProgress,
  onUpdate,
}: ProgressUpdateDialogProps) {
  const [progress, setProgress] = useState(currentProgress)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Встроенная мутация (используется если onUpdate не передан)
  const mutation = useUpdateItemProgress()

  // Сбрасываем при открытии
  useEffect(() => {
    if (isOpen) {
      setProgress(currentProgress)
      setError(null)
    }
  }, [isOpen, currentProgress])

  const handleSkip = useCallback(() => {
    onClose()
  }, [onClose])

  const handleUpdate = useCallback(async () => {
    if (isUpdating || progress === currentProgress) return

    setIsUpdating(true)
    setError(null)

    try {
      if (onUpdate) {
        // Используем внешний callback
        await onUpdate(itemId, progress)
        onSuccess?.()
        onClose()
      } else {
        // Используем встроенную мутацию
        mutation.mutate(
          { itemId, progress },
          {
            onSuccess: () => {
              onSuccess?.()
              onClose()
            },
            onError: (err) => {
              console.error('[ProgressUpdateDialog] Error:', err)
              setError(err.message || 'Ошибка при обновлении готовности')
            },
            onSettled: () => {
              setIsUpdating(false)
            },
          }
        )
        return // mutation handles setIsUpdating in onSettled
      }
    } catch (err) {
      console.error('[ProgressUpdateDialog] Error:', err)
      setError(err instanceof Error ? err.message : 'Ошибка при обновлении готовности')
    } finally {
      if (onUpdate) {
        setIsUpdating(false)
      }
    }
  }, [itemId, progress, currentProgress, isUpdating, onUpdate, mutation, onSuccess, onClose])

  // Быстрые кнопки для установки значения
  const quickValues = [25, 50, 75, 100]

  const isPending = isUpdating || mutation.isPending
  const hasError = error || mutation.error

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
            'pointer-events-auto w-full max-w-xs',
            'bg-card/95 backdrop-blur-md',
            'border border-border/50',
            'rounded-lg shadow-2xl shadow-black/20 dark:shadow-black/50',
            'transform transition-all duration-200',
            isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-xs font-medium text-foreground">
                Обновить готовность?
              </span>
            </div>
            <button
              onClick={handleSkip}
              className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-3 py-3 space-y-3">
            {/* Task name */}
            <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
              {itemName}
            </p>

            {/* Progress display - editable */}
            <div className="text-center py-1">
              <div className="inline-flex items-baseline justify-center">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={progress}
                  onChange={(e) => {
                    const val = Math.min(100, Math.max(0, Number(e.target.value) || 0))
                    setProgress(val)
                  }}
                  className={cn(
                    'w-14 text-2xl font-bold tabular-nums text-center',
                    'text-foreground',
                    'bg-transparent border-b-2 border-transparent',
                    'hover:border-border',
                    'focus:border-emerald-500 dark:focus:border-emerald-500',
                    'focus:outline-none transition-colors',
                    '[appearance:textfield]',
                    '[&::-webkit-outer-spin-button]:appearance-none',
                    '[&::-webkit-inner-spin-button]:appearance-none'
                  )}
                />
                <span className="text-sm text-muted-foreground ml-0.5">%</span>
              </div>
              {/* Фиксированная высота чтобы не скакало */}
              <p className={cn(
                'text-[10px] mt-0.5 h-4',
                currentProgress !== progress
                  ? 'text-muted-foreground'
                  : 'text-transparent'
              )}>
                было: {currentProgress}%
              </p>
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
                  'w-full h-1.5 rounded-full appearance-none cursor-pointer',
                  'bg-muted',
                  '[&::-webkit-slider-thumb]:appearance-none',
                  '[&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4',
                  '[&::-webkit-slider-thumb]:rounded-full',
                  '[&::-webkit-slider-thumb]:bg-emerald-500',
                  '[&::-webkit-slider-thumb]:shadow-md',
                  '[&::-webkit-slider-thumb]:cursor-pointer',
                  '[&::-webkit-slider-thumb]:transition-transform',
                  '[&::-webkit-slider-thumb]:hover:scale-110',
                  '[&::-webkit-slider-thumb]:border-2',
                  '[&::-webkit-slider-thumb]:border-white',
                  '[&::-webkit-slider-thumb]:dark:border-card'
                )}
              />

              {/* Quick values */}
              <div className="flex gap-1.5">
                {quickValues.map((val) => (
                  <button
                    key={val}
                    onClick={() => setProgress(val)}
                    className={cn(
                      'flex-1 py-1 text-[10px] font-medium rounded transition-colors',
                      progress === val
                        ? 'bg-emerald-500 text-white'
                        : 'bg-muted hover:bg-accent text-muted-foreground'
                    )}
                  >
                    {val}%
                  </button>
                ))}
              </div>
            </div>

            {/* Error message */}
            {hasError && (
              <p className="text-[10px] text-red-500 text-center">
                {error || mutation.error?.message || 'Ошибка при обновлении'}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-border/50">
            <button
              onClick={handleSkip}
              disabled={isPending}
              className={cn(
                'px-2.5 py-1 text-[10px] font-medium rounded',
                'text-muted-foreground hover:text-foreground',
                'border border-border hover:border-border',
                'bg-card hover:bg-muted',
                'transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              Пропустить
            </button>
            <button
              onClick={handleUpdate}
              disabled={isPending || progress === currentProgress}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium rounded',
                'text-white bg-emerald-500 hover:bg-emerald-400',
                'transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground'
              )}
            >
              {isPending ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Сохранение...</span>
                </>
              ) : (
                <span>Обновить</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
