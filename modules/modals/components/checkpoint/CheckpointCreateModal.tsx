'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { X, Flag, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useHasPermission } from '@/modules/permissions'
import { DatePicker } from '@/modules/projects/components/DatePicker'
import { useCheckpointTypes, useCreateCheckpoint } from '@/modules/checkpoints/hooks'
import type { BaseModalProps } from '../../types'

// ============================================================================
// Types
// ============================================================================

export interface CheckpointCreateModalProps extends BaseModalProps {
  /** ID раздела */
  sectionId: string
  /** Название раздела (для отображения в header) */
  sectionName: string
}

// ============================================================================
// Component
// ============================================================================

export function CheckpointCreateModal({
  isOpen,
  onClose,
  onSuccess,
  sectionId,
  sectionName,
}: CheckpointCreateModalProps) {
  // State
  const [selectedTypeId, setSelectedTypeId] = useState<string>('')
  const [name, setName] = useState<string>('')
  const [deadlineDate, setDeadlineDate] = useState<string>('')
  const [description, setDescription] = useState<string>('')

  // Hooks
  const { data: checkpointTypes = [], isLoading: typesLoading } = useCheckpointTypes()
  const createCheckpoint = useCreateCheckpoint()
  const canManageTypes = useHasPermission('checkpoints.types.manage')

  // Выбранный тип (для проверки is_custom и placeholder)
  const selectedType = useMemo(() => {
    return checkpointTypes.find(t => t.type_id === selectedTypeId)
  }, [checkpointTypes, selectedTypeId])

  // Reset при открытии
  useEffect(() => {
    if (isOpen) {
      setSelectedTypeId('')
      setName('')
      setDeadlineDate('')
      setDescription('')
    }
  }, [isOpen])

  // Валидация
  const canSave = useMemo(() => {
    const hasType = !!selectedTypeId
    const hasDate = !!deadlineDate
    // Для custom типа — название обязательно
    const hasName = selectedType?.is_custom ? name.trim().length > 0 : true
    return hasType && hasDate && hasName && !createCheckpoint.isPending
  }, [selectedTypeId, deadlineDate, name, selectedType, createCheckpoint.isPending])

  // Сохранение
  const handleSave = async () => {
    if (!canSave) return

    const payload = {
      sectionId: sectionId,
      typeId: selectedTypeId,
      title: name.trim() || '',
      checkpointDate: deadlineDate,
      description: description.trim() || null,
    }

    console.log('[CheckpointCreateModal] Creating checkpoint:', {
      payload,
      selectedType: selectedType?.name,
      sectionName,
    })

    createCheckpoint.mutate(payload, {
      onSuccess: (result) => {
        console.log('[CheckpointCreateModal] Checkpoint created successfully:', result)
        onSuccess?.()
        onClose()
      },
      onError: (error) => {
        console.error('[CheckpointCreateModal] Failed to create checkpoint:', error)
      },
    })
  }

  // Форматирование даты
  const formatDateLocal = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className={cn(
            'pointer-events-auto w-full max-w-md',
            'bg-white/95 dark:bg-slate-900/95 backdrop-blur-md',
            'border border-slate-200 dark:border-slate-700/50',
            'rounded-lg shadow-2xl shadow-black/20 dark:shadow-black/50',
            'transform transition-all duration-200',
            isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/50">
            <div className="flex items-center gap-2">
              <Flag className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Добавить чекпоинт
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">·</span>
              <span
                className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[180px]"
                title={sectionName}
              >
                {sectionName}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-4 py-3">
            {typesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : (
              <div className="space-y-3">
                {/* Тип чекпоинта */}
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                    Тип <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedTypeId}
                    onChange={(e) => setSelectedTypeId(e.target.value)}
                    className={cn(
                      'w-full px-2.5 py-1.5 text-xs',
                      'bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700',
                      'rounded text-slate-700 dark:text-slate-200',
                      'focus:outline-none focus:border-slate-300 dark:focus:border-slate-600 focus:ring-1 focus:ring-slate-300/50 dark:focus:ring-slate-600/50',
                      'transition-colors'
                    )}
                  >
                    <option value="">Выберите тип...</option>
                    {checkpointTypes.map((type) => (
                      <option key={type.type_id} value={type.type_id}>
                        {type.icon} {type.name}
                      </option>
                    ))}
                  </select>
                  {/* Кнопка создания нового типа (только для админов) */}
                  {canManageTypes && (
                    <button
                      type="button"
                      className="mt-1.5 text-[10px] text-primary hover:underline"
                      onClick={() => {
                        // TODO: открыть модалку создания типа или перейти на /admin/checkpoints/types
                      }}
                    >
                      + Создать новый тип
                    </button>
                  )}
                </div>

                {/* Название */}
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                    Название {selectedType?.is_custom && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={selectedType?.is_custom ? 'Введите название' : 'По умолчанию — название типа'}
                    className={cn(
                      'w-full px-2.5 py-1.5 text-xs',
                      'bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700',
                      'rounded text-slate-700 dark:text-slate-200',
                      'placeholder:text-slate-400 dark:placeholder:text-slate-600',
                      'focus:outline-none focus:border-slate-300 dark:focus:border-slate-600 focus:ring-1 focus:ring-slate-300/50 dark:focus:ring-slate-600/50',
                      'transition-colors'
                    )}
                  />
                </div>

                {/* Дата дедлайна */}
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                    Дата дедлайна <span className="text-red-500">*</span>
                  </label>
                  <DatePicker
                    value={deadlineDate ? new Date(deadlineDate) : null}
                    onChange={(d) => setDeadlineDate(formatDateLocal(d))}
                    placeholder="Выберите дату"
                    calendarWidth="260px"
                    inputClassName={cn(
                      'w-full px-2.5 py-1.5 text-xs',
                      'bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700',
                      'rounded text-slate-700 dark:text-slate-200',
                      'focus:outline-none focus:border-slate-300 dark:focus:border-slate-600 focus:ring-1 focus:ring-slate-300/50 dark:focus:ring-slate-600/50',
                      'transition-colors cursor-pointer'
                    )}
                  />
                </div>

                {/* Описание */}
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                    Описание
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    placeholder="Опционально"
                    className={cn(
                      'w-full px-2.5 py-1.5 text-xs resize-none',
                      'bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700',
                      'rounded text-slate-700 dark:text-slate-200',
                      'placeholder:text-slate-400 dark:placeholder:text-slate-600',
                      'focus:outline-none focus:border-slate-300 dark:focus:border-slate-600 focus:ring-1 focus:ring-slate-300/50 dark:focus:ring-slate-600/50',
                      'transition-colors'
                    )}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-slate-200 dark:border-slate-700/50">
            <button
              onClick={onClose}
              disabled={createCheckpoint.isPending}
              className={cn(
                'px-3 py-1.5 text-[11px] font-medium rounded',
                'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300',
                'border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600',
                'bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800',
                'transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded',
                'text-white bg-green-500 hover:bg-green-400',
                'transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500'
              )}
            >
              {createCheckpoint.isPending ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Создание...
                </>
              ) : (
                <>
                  <Flag className="w-3 h-3" />
                  Создать
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default CheckpointCreateModal
