/**
 * Inline Delete Button Component
 *
 * Общий компонент для инлайн удаления сущностей.
 * Показывает кнопку удаления, при клике - подтверждение.
 */

'use client'

import { useState, useCallback } from 'react'
import { Trash2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

interface InlineDeleteButtonProps {
  /** Название сущности (для title) */
  entityName: string
  /** Callback для удаления (возвращает Promise) */
  onDelete: () => Promise<void>
  /** Размер иконки */
  iconSize?: 'sm' | 'md'
  /** Callback при успехе */
  onSuccess?: () => void
}

// ============================================================================
// Component
// ============================================================================

export function InlineDeleteButton({
  entityName,
  onDelete,
  iconSize = 'md',
  onSuccess,
}: InlineDeleteButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = useCallback(async () => {
    setIsDeleting(true)
    setError(null)

    try {
      await onDelete()
      onSuccess?.()
    } catch (err) {
      console.error('[InlineDelete] Error:', err)
      setError(err instanceof Error ? err.message : 'Ошибка удаления')
      setIsDeleting(false)
      setShowConfirm(false)
    }
  }, [onDelete, onSuccess])

  if (isDeleting) {
    return (
      <div className="p-1">
        <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
      </div>
    )
  }

  if (showConfirm) {
    return (
      <div className="flex items-center gap-1">
        {error && (
          <span className="text-[10px] text-destructive mr-1" title={error}>
            Ошибка
          </span>
        )}
        <button
          onClick={handleDelete}
          className="px-1.5 py-0.5 rounded text-[10px] bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors"
        >
          Да
        </button>
        <button
          onClick={() => {
            setShowConfirm(false)
            setError(null)
          }}
          className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
        >
          Нет
        </button>
      </div>
    )
  }

  const iconClass = iconSize === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        setShowConfirm(true)
      }}
      className={cn(
        'p-1 rounded transition-all',
        'hover:bg-destructive/20 text-muted-foreground hover:text-destructive'
      )}
      title={`Удалить "${entityName}"`}
    >
      <Trash2 className={iconClass} />
    </button>
  )
}
