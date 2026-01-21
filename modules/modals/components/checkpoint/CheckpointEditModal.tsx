'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { X, Flag, Loader2, Check, Trash2, CircleCheckBig, Plus, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getIcon } from '@/modules/checkpoints/constants/icon-map'
import { DatePicker } from '@/modules/projects/components/DatePicker'
import {
  useCheckpoint,
  useCheckpointTypes,
  useUpdateCheckpoint,
  useDeleteCheckpoint,
  useCompleteCheckpoint,
  useProjectSections,
  usePrefetchCheckpoints,
} from '@/modules/checkpoints/hooks'
import { IconColorPicker } from '@/modules/checkpoints/components/shared'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { BaseModalProps } from '../../types'

// ============================================================================
// Types
// ============================================================================

export interface CheckpointEditModalProps extends BaseModalProps {
  /** ID чекпоинта для редактирования */
  checkpointId: string
}

// ============================================================================
// Component
// ============================================================================

export function CheckpointEditModal({
  isOpen,
  onClose,
  onSuccess,
  checkpointId,
}: CheckpointEditModalProps) {
  // State
  const [selectedTypeId, setSelectedTypeId] = useState<string>('')
  const [name, setName] = useState<string>('')
  const [deadlineDate, setDeadlineDate] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [linkedSectionIds, setLinkedSectionIds] = useState<string[]>([])

  // Custom type state
  const [customIcon, setCustomIcon] = useState<string>('Flag')
  const [customColor, setCustomColor] = useState<string>('#6b7280')

  // Delete confirmation state (inline)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Prefetch utilities - для получения данных из кеша
  const { getCheckpointFromCache } = usePrefetchCheckpoints()

  // Пытаемся получить checkpoint из кеша списка (мгновенно)
  const cachedCheckpoint = useMemo(
    () => getCheckpointFromCache(checkpointId),
    [getCheckpointFromCache, checkpointId]
  )

  // Hooks - useCheckpoint используется как fallback если нет в кеше
  // Типы чекпоинтов и project sections загружаются параллельно
  const { data: fetchedCheckpoint, isLoading: checkpointLoading } = useCheckpoint(checkpointId, {
    // Если есть в кеше - не делаем лишний запрос
    enabled: !cachedCheckpoint,
  })

  // Используем кешированный или загруженный checkpoint
  const checkpoint = cachedCheckpoint || fetchedCheckpoint

  // Типы чекпоинтов - обычно уже предзагружены в ReferencePrefetch
  const { data: checkpointTypes = [], isLoading: typesLoading } = useCheckpointTypes()

  // Project sections - загружаем сразу если знаем section_id (из кеша или после загрузки)
  const sectionIdForProjectSections = cachedCheckpoint?.section_id || fetchedCheckpoint?.section_id
  const { data: projectSections = [], isLoading: sectionsLoading } = useProjectSections(
    sectionIdForProjectSections || '',
    { enabled: !!sectionIdForProjectSections }
  )

  const updateCheckpoint = useUpdateCheckpoint()
  const deleteCheckpoint = useDeleteCheckpoint()
  const completeCheckpoint = useCompleteCheckpoint()

  const selectedType = useMemo(() => {
    if (!selectedTypeId) return null
    return checkpointTypes.find((t) => t.type_id === selectedTypeId)
  }, [checkpointTypes, selectedTypeId])

  // Инициализация данных из чекпоинта
  useEffect(() => {
    if (checkpoint && checkpointTypes.length > 0) {
      setSelectedTypeId(checkpoint.type_id)
      setName(checkpoint.title || '')
      setDeadlineDate(checkpoint.checkpoint_date || '')
      setDescription(checkpoint.description || '')
      setLinkedSectionIds(checkpoint.linked_sections?.map(s => s.section_id) || [])
      setCustomIcon(checkpoint.icon || 'Flag')
      setCustomColor(checkpoint.color || '#6b7280')
    }
  }, [checkpoint, checkpointTypes, checkpointId])

  // Reset delete confirm при закрытии
  useEffect(() => {
    if (!isOpen) {
      setShowDeleteConfirm(false)
    }
  }, [isOpen])

  // При выборе типа - предзаполняем поля (тип = шаблон)
  const handleTypeSelect = useCallback((typeId: string) => {
    setSelectedTypeId(typeId)

    const type = checkpointTypes.find((t) => t.type_id === typeId)
    if (type && !type.is_custom) {
      setName(type.name)
      setCustomIcon(type.icon)
      setCustomColor(type.color)
    }
  }, [checkpointTypes])

  // Валидация - название и описание обязательны
  const canSave = useMemo(() => {
    const hasDate = !!deadlineDate
    const hasName = name.trim().length > 0
    const hasDescription = description.trim().length > 0

    const hasChanges =
      selectedTypeId !== checkpoint?.type_id ||
      name !== (checkpoint?.title || '') ||
      deadlineDate !== (checkpoint?.checkpoint_date || '') ||
      description !== (checkpoint?.description || '') ||
      JSON.stringify(linkedSectionIds.sort()) !== JSON.stringify(checkpoint?.linked_sections?.map(s => s.section_id).sort() || []) ||
      customIcon !== checkpoint?.icon || customColor !== checkpoint?.color

    return hasDate && hasName && hasDescription && hasChanges && !updateCheckpoint.isPending
  }, [selectedTypeId, name, deadlineDate, description, linkedSectionIds, customIcon, customColor, checkpoint, updateCheckpoint.isPending])

  // Сохранение
  const handleSave = async (): Promise<void> => {
    if (!canSave || !checkpoint) return

    const optimisticLinkedSections = linkedSectionIds.map(id => {
      const section = projectSections.find(s => s.id === id)
      return {
        section_id: id,
        section_name: section?.name || '',
        object_id: section?.objectId || null,
      }
    })

    const payload = {
      checkpointId,
      typeId: selectedTypeId !== checkpoint.type_id ? selectedTypeId : undefined,
      title: name.trim() || undefined,
      checkpointDate: deadlineDate,
      description: description.trim() || null,
      linkedSectionIds,
      customIcon,
      customColor,
      _optimisticIcon: customIcon,
      _optimisticColor: customColor,
      _optimisticTypeName: selectedType?.name,
      _optimisticTypeCode: selectedType?.type,
      _optimisticIsCustom: selectedType?.is_custom,
      _optimisticLinkedSections: optimisticLinkedSections,
    }

    onClose()
    onSuccess?.()

    updateCheckpoint.mutate(payload, {
      onError: (error) => {
        console.error('[CheckpointEditModal] Failed to update checkpoint:', error)
      },
    })
  }

  // Удаление
  const handleDelete = (): void => {
    if (!checkpoint) return

    onClose()

    deleteCheckpoint.mutate(checkpointId, {
      onSuccess: () => {
        onSuccess?.()
      },
      onError: (error) => {
        console.error('[CheckpointEditModal] Failed to delete checkpoint:', error)
      },
    })
  }

  // Отметить выполненным/невыполненным
  const handleToggleComplete = (): void => {
    if (!checkpoint) return

    const newCompleted = !checkpoint.completed_at

    // Закрываем модалку сразу для лучшего UX
    onClose()

    completeCheckpoint.mutate(
      {
        checkpointId,
        completed: newCompleted,
      },
      {
        onSuccess: () => {
          onSuccess?.()
        },
        onError: (error) => {
          console.error('[CheckpointEditModal] Failed to toggle completion:', error)
        },
      }
    )
  }

  // Форматирование даты
  const formatDateLocal = (date: Date): string => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const isLoading = (!cachedCheckpoint && checkpointLoading) || typesLoading
  const isPending = updateCheckpoint.isPending || deleteCheckpoint.isPending || completeCheckpoint.isPending

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay - блокирует все клики */}
      <div
        className="absolute inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div
          className={cn(
            'pointer-events-auto w-full max-w-xl',
            'bg-white border border-border',
            'dark:bg-card/95 dark:backdrop-blur-md dark:border-border/50',
            'rounded-lg shadow-2xl',
            'shadow-border/20 dark:shadow-black/50',
            'transform transition-all duration-200',
            isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={cn(
            'flex items-center justify-between px-4 py-2.5 border-b',
            'border-border dark:border-border/50'
          )}>
            <div className="flex items-center gap-2">
              <Flag className="w-4 h-4 text-amber-500" />
              <span className={cn(
                'text-xs font-medium',
                'text-foreground dark:text-foreground'
              )}>
                Редактировать чекпоинт
              </span>
              {checkpoint && (
                <>
                  <span className="text-[10px] text-muted-foreground dark:text-muted-foreground">·</span>
                  <span
                    className={cn(
                      'text-[10px] truncate max-w-[200px]',
                      'text-muted-foreground dark:text-muted-foreground'
                    )}
                    title={checkpoint.title}
                  >
                    {checkpoint.title}
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Close button */}
              <button
                onClick={onClose}
                className={cn(
                  'p-1 rounded transition-colors',
                  'text-muted-foreground hover:text-muted-foreground hover:bg-muted',
                  'dark:text-muted-foreground dark:hover:text-foreground dark:hover:bg-muted'
                )}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-4 py-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className={cn(
                  'h-5 w-5 animate-spin',
                  'text-muted-foreground dark:text-muted-foreground'
                )} />
              </div>
            ) : (
              <div className="space-y-3">
                {/* Type Selector - шаблоны */}
                <div>
                  <label className={cn(
                    'block text-[10px] font-medium uppercase tracking-wide mb-1.5',
                    'text-muted-foreground dark:text-muted-foreground'
                  )}>
                    Шаблон чекпоинта
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {checkpointTypes.map((type) => {
                      const isSelected = selectedTypeId === type.type_id
                      const IconComp = getIcon(type.icon, Flag)

                      return (
                        <button
                          key={type.type_id}
                          type="button"
                          onClick={() => handleTypeSelect(type.type_id)}
                          className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium',
                            'border transition-all duration-150',
                            isSelected
                              ? 'shadow-sm'
                              : cn(
                                  'border-border bg-white text-muted-foreground',
                                  'hover:border-border hover:bg-muted',
                                  'dark:border-border dark:bg-muted/40 dark:text-muted-foreground',
                                  'dark:hover:border-border dark:hover:bg-muted/60'
                                )
                          )}
                          style={
                            isSelected
                              ? {
                                  borderColor: `${type.is_custom ? customColor : type.color}60`,
                                  backgroundColor: `${type.is_custom ? customColor : type.color}15`,
                                  color: type.is_custom ? customColor : type.color,
                                }
                              : undefined
                          }
                        >
                          {type.is_custom ? (
                            <>
                              {(() => {
                                const CustomIcon = getIcon(customIcon, Flag)
                                return <CustomIcon size={12} className="shrink-0" />
                              })()}
                              <span>Создать свой</span>
                            </>
                          ) : (
                            <>
                              <IconComp size={12} className="shrink-0" style={{ color: isSelected ? type.color : undefined }} />
                              <span>{type.name}</span>
                            </>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Two columns for the rest */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Left column */}
                  <div className="space-y-3">
                    {/* Name + Preview */}
                    <div>
                      <label className={cn(
                        'block text-[10px] font-medium uppercase tracking-wide mb-1.5',
                        'text-muted-foreground dark:text-muted-foreground'
                      )}>
                        Название <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <IconColorPicker
                          selectedIcon={customIcon}
                          selectedColor={customColor}
                          onIconChange={setCustomIcon}
                          onColorChange={setCustomColor}
                          renderTrigger={({ color: previewColor }) => {
                            const PreviewIcon = getIcon(customIcon, Flag)
                            return (
                              <button
                                type="button"
                                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 cursor-pointer transition-transform hover:scale-105"
                                style={{
                                  borderColor: previewColor,
                                  backgroundColor: `${previewColor}20`,
                                }}
                              >
                                <PreviewIcon size={14} style={{ color: previewColor }} />
                              </button>
                            )
                          }}
                        />
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Введите название"
                          className={cn(
                            'flex-1 px-2.5 py-1.5 text-xs rounded transition-colors',
                            'bg-white border border-border text-foreground placeholder:text-muted-foreground',
                            'focus:outline-none focus:border-border focus:ring-1 focus:ring-border/50',
                            'dark:bg-muted/50 dark:border-border dark:text-foreground dark:placeholder:text-muted-foreground',
                            'dark:focus:border-border dark:focus:ring-border/50'
                          )}
                          disabled={isPending}
                        />
                      </div>
                    </div>

                    {/* Deadline Date */}
                    <div>
                      <label className={cn(
                        'block text-[10px] font-medium uppercase tracking-wide mb-1.5',
                        'text-muted-foreground dark:text-muted-foreground'
                      )}>
                        Дата дедлайна <span className="text-red-500">*</span>
                      </label>
                      <DatePicker
                        value={deadlineDate ? new Date(deadlineDate) : null}
                        onChange={(d) => setDeadlineDate(formatDateLocal(d))}
                        placeholder="Выберите дату"
                        calendarWidth="260px"
                        offsetY={32}
                        offsetX={0}
                        inputClassName={cn(
                          'w-full px-2.5 py-1.5 text-xs rounded transition-colors cursor-pointer',
                          'bg-white border border-border text-foreground',
                          'focus:outline-none focus:border-border focus:ring-1 focus:ring-border/50',
                          'dark:bg-muted/50 dark:border-border dark:text-foreground',
                          'dark:focus:border-border dark:focus:ring-border/50'
                        )}
                      />
                    </div>

                    {/* Linked Sections */}
                    <div>
                      <label className={cn(
                        'block text-[10px] font-medium uppercase tracking-wide mb-1.5',
                        'text-muted-foreground dark:text-muted-foreground'
                      )}>
                        Связанные разделы
                      </label>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {linkedSectionIds.map((id) => {
                          const section = projectSections.find(s => s.id === id)
                          if (!section) return null
                          return (
                            <span
                              key={id}
                              className={cn(
                                'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px]',
                                'bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground'
                              )}
                            >
                              {section.name}
                              <button
                                type="button"
                                onClick={() => setLinkedSectionIds(prev => prev.filter(i => i !== id))}
                                className="hover:text-red-500 transition-colors"
                              >
                                <X size={10} />
                              </button>
                            </span>
                          )
                        })}
                        {/* Plus button with dropdown */}
                        <div className="relative group">
                          <button
                            type="button"
                            className={cn(
                              'w-6 h-6 rounded flex items-center justify-center transition-colors',
                              'border border-dashed border-border text-muted-foreground',
                              'hover:border-border hover:text-muted-foreground hover:bg-muted',
                              'dark:border-border dark:text-muted-foreground',
                              'dark:hover:border-border dark:hover:text-muted-foreground dark:hover:bg-muted/50'
                            )}
                          >
                            <Plus size={12} />
                          </button>
                          {/* Dropdown */}
                          <div className={cn(
                            'absolute left-0 top-full mt-1 z-20 min-w-[180px] max-h-[150px] overflow-y-auto',
                            'bg-white border border-border rounded-md shadow-lg',
                            'dark:bg-card dark:border-border',
                            'opacity-0 invisible group-hover:opacity-100 group-hover:visible',
                            'transition-all duration-150'
                          )}>
                            {sectionsLoading ? (
                              <div className="p-2 text-[10px] text-muted-foreground">Загрузка...</div>
                            ) : projectSections.filter(s => s.id !== checkpoint?.section_id && !linkedSectionIds.includes(s.id)).length === 0 ? (
                              <div className="p-2 text-[10px] text-muted-foreground">Нет доступных разделов</div>
                            ) : (
                              projectSections
                                .filter(s => s.id !== checkpoint?.section_id && !linkedSectionIds.includes(s.id))
                                .map(section => (
                                  <button
                                    key={section.id}
                                    type="button"
                                    onClick={() => setLinkedSectionIds(prev => [...prev, section.id])}
                                    className={cn(
                                      'w-full text-left px-2.5 py-1.5 text-[11px] transition-colors',
                                      'hover:bg-muted dark:hover:bg-muted',
                                      'text-muted-foreground dark:text-muted-foreground'
                                    )}
                                  >
                                    {section.name}
                                  </button>
                                ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right column */}
                  <div className="space-y-3">
                    {/* Description */}
                    <div className="flex flex-col h-full">
                      <label className={cn(
                        'block text-[10px] font-medium uppercase tracking-wide mb-1.5',
                        'text-muted-foreground dark:text-muted-foreground'
                      )}>
                        Описание <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Опишите событие для понимания другими участниками..."
                        rows={6}
                        className={cn(
                          'w-full px-2.5 py-1.5 text-xs flex-1 resize-none rounded transition-colors',
                          'bg-white border border-border text-foreground placeholder:text-muted-foreground',
                          'focus:outline-none focus:border-border focus:ring-1 focus:ring-border/50',
                          'dark:bg-muted/50 dark:border-border dark:text-foreground dark:placeholder:text-muted-foreground',
                          'dark:focus:border-border dark:focus:ring-border/50'
                        )}
                        disabled={isPending}
                      />
                    </div>
                  </div>
                </div>

                {/* Delete Confirmation - inline red zone */}
                {showDeleteConfirm && (
                  <div className="p-3 border border-red-500/30 bg-red-500/10 rounded-lg">
                    <div className="flex items-center gap-2 text-xs text-red-400 mb-2">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span className="font-medium">Удалить чекпоинт?</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground dark:text-muted-foreground mb-3">
                      Это действие нельзя будет отменить.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className={cn(
                          'flex-1 px-2 py-1 text-[11px] font-medium rounded',
                          'text-muted-foreground bg-muted hover:bg-muted',
                          'dark:text-muted-foreground dark:bg-muted dark:hover:bg-muted',
                          'transition-colors'
                        )}
                      >
                        Отмена
                      </button>
                      <button
                        onClick={handleDelete}
                        className={cn(
                          'flex-1 px-2 py-1 text-[11px] font-medium rounded',
                          'text-white bg-red-600 hover:bg-red-500',
                          'transition-colors'
                        )}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className={cn(
            'flex items-center justify-between gap-2 px-4 py-2.5 border-t',
            'border-border dark:border-border/50'
          )}>
            {/* Left side - Delete button */}
            <div className="flex items-center gap-2">
              {!showDeleteConfirm && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isLoading || isPending}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded transition-colors',
                    'text-red-600 hover:bg-red-50',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'dark:text-red-400 dark:hover:bg-red-500/10'
                  )}
                >
                  <Trash2 className="w-3 h-3" />
                  Удалить
                </button>
              )}
            </div>

            {/* Right side - Complete, Cancel and Save buttons */}
            <div className="flex items-center gap-2">
              {/* Complete/Uncomplete button */}
              {!isLoading && checkpoint && (
                <button
                  onClick={handleToggleComplete}
                  disabled={isPending}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded border transition-colors',
                    checkpoint.completed_at
                      ? 'text-amber-600 border-amber-300 bg-amber-50 hover:bg-amber-100 dark:text-amber-400 dark:border-amber-500/30 dark:bg-amber-500/10 dark:hover:bg-amber-500/20'
                      : 'text-green-600 border-green-300 bg-green-50 hover:bg-green-100 dark:text-green-400 dark:border-green-500/30 dark:bg-green-500/10 dark:hover:bg-green-500/20',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  <CircleCheckBig className="w-3.5 h-3.5" />
                  {checkpoint.completed_at ? 'Отменить' : 'Выполнено'}
                </button>
              )}
              <button
                onClick={onClose}
                disabled={isPending}
                className={cn(
                  'px-3 py-1.5 text-[11px] font-medium rounded border transition-colors',
                  'text-muted-foreground border-border bg-white',
                  'hover:text-foreground hover:border-border hover:bg-muted',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'dark:text-muted-foreground dark:border-border dark:bg-muted/50',
                  'dark:hover:text-foreground dark:hover:border-border dark:hover:bg-muted'
                )}
              >
                Отмена
              </button>
              <button
                onClick={handleSave}
                disabled={!canSave}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded transition-colors',
                  'text-slate-900 bg-amber-500 hover:bg-amber-400',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'disabled:bg-muted disabled:text-muted-foreground',
                  'dark:disabled:bg-muted dark:disabled:text-muted-foreground'
                )}
              >
                {updateCheckpoint.isPending ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  <>
                    <Check className="w-3 h-3" />
                    Сохранить
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CheckpointEditModal
