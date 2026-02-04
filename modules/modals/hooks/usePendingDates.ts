'use client'

/**
 * usePendingDates - Хук для управления редактированием дат
 *
 * Инкапсулирует логику "edit → modify → save/cancel" для пар дат.
 * Используется в SectionModal и StageModal.
 */

import { useState, useCallback } from 'react'

// ============================================================================
// Types
// ============================================================================

export interface PendingDates {
  start: string | null
  end: string | null
}

export interface UsePendingDatesOptions {
  /** Callback для сохранения дат (вызывается при handleSave) */
  onSave: (dates: PendingDates) => Promise<void>
  /** Callback при успешном сохранении (опционально) */
  onSaveSuccess?: () => void
  /** Callback при ошибке сохранения (опционально) */
  onSaveError?: (error: Error) => void
}

export interface UsePendingDatesReturn {
  /** Флаг режима редактирования */
  isEditing: boolean
  /** Текущие pending даты */
  pendingDates: PendingDates
  /** Флаг сохранения */
  isSaving: boolean
  /** Обработчик изменения start date */
  handleStartDateChange: (value: string) => void
  /** Обработчик изменения end date */
  handleEndDateChange: (value: string) => void
  /** Начать редактирование (копирует текущие даты в pending) */
  handleEdit: (currentStart: string | null, currentEnd: string | null) => void
  /** Отменить редактирование */
  handleCancel: () => void
  /** Сохранить даты */
  handleSave: () => Promise<boolean>
  /** Сбросить состояние (при закрытии модалки) */
  reset: () => void
}

// ============================================================================
// Hook
// ============================================================================

export function usePendingDates(options: UsePendingDatesOptions): UsePendingDatesReturn {
  const { onSave, onSaveSuccess, onSaveError } = options

  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [pendingDates, setPendingDates] = useState<PendingDates>({
    start: null,
    end: null,
  })

  // Локальное изменение start date (БЕЗ сохранения в БД)
  const handleStartDateChange = useCallback((value: string) => {
    const dateValue = value || null
    setPendingDates((prev) => ({ ...prev, start: dateValue }))
  }, [])

  // Локальное изменение end date (БЕЗ сохранения в БД)
  const handleEndDateChange = useCallback((value: string) => {
    const dateValue = value || null
    setPendingDates((prev) => ({ ...prev, end: dateValue }))
  }, [])

  // Начать редактирование (копирует текущие даты в pending)
  const handleEdit = useCallback((currentStart: string | null, currentEnd: string | null) => {
    setPendingDates({
      start: currentStart,
      end: currentEnd,
    })
    setIsEditing(true)
  }, [])

  // Отменить редактирование
  const handleCancel = useCallback(() => {
    setPendingDates({ start: null, end: null })
    setIsEditing(false)
  }, [])

  // Сохранить даты через переданный callback
  const handleSave = useCallback(async (): Promise<boolean> => {
    setIsSaving(true)

    try {
      await onSave(pendingDates)
      setIsEditing(false)
      onSaveSuccess?.()
      return true
    } catch (err) {
      console.error('Save dates error:', err)
      const error = err instanceof Error ? err : new Error('Ошибка сохранения дат')
      onSaveError?.(error)
      return false
    } finally {
      setIsSaving(false)
    }
  }, [onSave, pendingDates, onSaveSuccess, onSaveError])

  // Сбросить состояние (при закрытии модалки)
  const reset = useCallback(() => {
    setIsEditing(false)
    setIsSaving(false)
    setPendingDates({ start: null, end: null })
  }, [])

  return {
    isEditing,
    pendingDates,
    isSaving,
    handleStartDateChange,
    handleEndDateChange,
    handleEdit,
    handleCancel,
    handleSave,
    reset,
  }
}
