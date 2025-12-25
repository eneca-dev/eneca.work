'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { X, Flag, Loader2, Check, Trash2, CircleCheckBig, Plus } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
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
import { DeleteConfirmDialog } from '@/modules/modals/components/section/decomposition/dialogs'
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

  // Delete confirmation state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

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
      console.log('[CheckpointEditModal] Initializing checkpoint data:', {
        checkpointId,
        completed_at: checkpoint.completed_at,
        isCompleted: !!checkpoint.completed_at,
        title: checkpoint.title,
        checkpoint_date: checkpoint.checkpoint_date,
      })

      setSelectedTypeId(checkpoint.type_id)
      setName(checkpoint.title || '')
      setDeadlineDate(checkpoint.checkpoint_date || '')
      setDescription(checkpoint.description || '')
      setLinkedSectionIds(checkpoint.linked_sections?.map(s => s.section_id) || [])

      // Всегда берём icon/color из чекпоинта (они уже скомбинированы в VIEW)
      setCustomIcon(checkpoint.icon || 'Flag')
      setCustomColor(checkpoint.color || '#6b7280')
    }
  }, [checkpoint, checkpointTypes, checkpointId])

  // Note: Removed auto-update of icon/color on type change
  // Now handled by handleTypeSelect which prefills when user explicitly selects a type template

  // При выборе типа - предзаполняем поля (тип = шаблон)
  const handleTypeSelect = useCallback((typeId: string) => {
    setSelectedTypeId(typeId)

    const type = checkpointTypes.find((t) => t.type_id === typeId)
    if (type && !type.is_custom) {
      // Предзаполняем из шаблона типа
      setName(type.name)
      setCustomIcon(type.icon)
      setCustomColor(type.color)
    }
    // Для кастомного типа - ничего не предзаполняем
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

    const payload = {
      checkpointId,
      typeId: selectedTypeId !== checkpoint.type_id ? selectedTypeId : undefined,
      title: name.trim() || undefined,
      checkpointDate: deadlineDate,
      description: description.trim() || null,
      linkedSectionIds,
      // Всегда передаём иконку и цвет (пользователь мог изменить после предзаполнения)
      customIcon,
      customColor,
      // Для optimistic update: передаем иконку и цвет явно
      _optimisticIcon: customIcon,
      _optimisticColor: customColor,
    }

    // Закрываем модалку сразу для мгновенного отклика
    // Optimistic update обновит чекпоинт в кеше мгновенно
    onClose()
    onSuccess?.()

    // Обновление происходит в фоне с optimistic update
    updateCheckpoint.mutate(payload, {
      onSuccess: (result) => {
        console.log('[CheckpointEditModal] Checkpoint updated successfully:', result)
      },
      onError: (error) => {
        console.error('[CheckpointEditModal] Failed to update checkpoint:', error)
        // TODO: Показать toast с ошибкой пользователю
      },
    })
  }

  // Удаление
  const handleDelete = (): void => {
    setShowDeleteDialog(true)
  }

  const handleConfirmDelete = (): void => {
    if (!checkpoint) return

    // Закрываем модалку сразу (optimistic update)
    onClose()

    deleteCheckpoint.mutate(checkpointId, {
      onSuccess: () => {
        console.log('[CheckpointEditModal] Checkpoint deleted successfully')
        onSuccess?.()
      },
      onError: (error) => {
        console.error('[CheckpointEditModal] Failed to delete checkpoint:', error)
        // TODO: Показать toast с ошибкой и переоткрыть модалку если нужно
      },
    })
  }

  // Отметить выполненным/невыполненным
  const handleToggleComplete = (): void => {
    if (!checkpoint) return

    const newCompleted = !checkpoint.completed_at

    console.log('[CheckpointEditModal] Toggle complete clicked:', {
      checkpointId,
      currentStatus: checkpoint.completed_at ? 'completed' : 'not completed',
      newStatus: newCompleted ? 'completed' : 'not completed',
      completed_at: checkpoint.completed_at,
      willBe: newCompleted,
    })

    // Optimistic update происходит автоматически в хуке useCompleteCheckpoint
    completeCheckpoint.mutate(
      {
        checkpointId,
        completed: newCompleted,
      },
      {
        onSuccess: () => {
          console.log('[CheckpointEditModal] Checkpoint completion toggled successfully')
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

  // Loading state: не показываем loader если checkpoint уже в кеше
  const isLoading = (!cachedCheckpoint && checkpointLoading) || typesLoading

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/20 dark:bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className={cn(
            'pointer-events-auto w-full max-w-xl',
            'bg-white border border-slate-300',
            'dark:bg-slate-900/95 dark:backdrop-blur-md dark:border-slate-700/50',
            'rounded-lg shadow-2xl',
            'shadow-slate-500/20 dark:shadow-black/50',
            'transform transition-all duration-200',
            isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={cn(
            'flex items-center justify-between px-4 py-2.5 border-b',
            'border-slate-200 dark:border-slate-700/50'
          )}>
            <div className="flex items-center gap-2">
              <Flag className="w-4 h-4 text-amber-500" />
              <span className={cn(
                'text-xs font-medium',
                'text-slate-700 dark:text-slate-300'
              )}>
                Редактировать чекпоинт
              </span>
              {checkpoint && (
                <>
                  <span className="text-[10px] text-slate-500 dark:text-slate-500">·</span>
                  <span
                    className={cn(
                      'text-[10px] truncate max-w-[200px]',
                      'text-slate-500 dark:text-slate-400'
                    )}
                    title={checkpoint.title}
                  >
                    {checkpoint.title}
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Complete/Uncomplete button */}
              {!isLoading && checkpoint && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleToggleComplete}
                        disabled={completeCheckpoint.isPending || updateCheckpoint.isPending}
                        className={cn(
                          'flex items-center justify-center transition-all',
                          'disabled:opacity-50 disabled:cursor-not-allowed'
                        )}
                      >
                        <CircleCheckBig
                          className={cn(
                            'w-5 h-5 transition-colors',
                            checkpoint.completed_at
                              ? 'text-green-500 hover:text-green-600 dark:text-green-500 dark:hover:text-green-400'
                              : 'text-slate-400 hover:text-slate-500 dark:text-slate-500 dark:hover:text-slate-400'
                          )}
                          strokeWidth={2}
                        />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-[11px] py-1 px-2">
                      {checkpoint.completed_at ? 'Отменить выполнение' : 'Отметить выполненным'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {/* Close button */}
              <button
                onClick={onClose}
                className={cn(
                  'p-1 rounded transition-colors',
                  'text-slate-400 hover:text-slate-600 hover:bg-slate-100',
                  'dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-800'
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
                  'text-slate-500 dark:text-slate-400'
                )} />
              </div>
            ) : (
              <div className="space-y-3">
                {/* Type Selector - шаблоны */}
                <div>
                  <label className={cn(
                    'block text-[10px] font-medium uppercase tracking-wide mb-1.5',
                    'text-slate-500 dark:text-slate-400'
                  )}>
                    Шаблон чекпоинта
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {checkpointTypes.map((type) => {
                      const isSelected = selectedTypeId === type.type_id
                      const IconComp = (LucideIcons as unknown as Record<string, LucideIcon>)[type.icon] || Flag

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
                                  'border-slate-200 bg-white text-slate-600',
                                  'hover:border-slate-300 hover:bg-slate-50',
                                  'dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400',
                                  'dark:hover:border-slate-600 dark:hover:bg-slate-800/60'
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
                                const CustomIcon = (LucideIcons as unknown as Record<string, LucideIcon>)[customIcon] || Flag
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
                        'text-slate-500 dark:text-slate-400'
                      )}>
                        Название <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-center gap-2">
                        {/* Checkpoint Preview - circle with icon (clickable to open picker) */}
                        <IconColorPicker
                          selectedIcon={customIcon}
                          selectedColor={customColor}
                          onIconChange={setCustomIcon}
                          onColorChange={setCustomColor}
                          renderTrigger={({ color: previewColor }) => {
                            const PreviewIcon = (LucideIcons as unknown as Record<string, LucideIcon>)[customIcon] || Flag
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
                            'bg-white border border-slate-300 text-slate-700 placeholder:text-slate-400',
                            'focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400/50',
                            'dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-600',
                            'dark:focus:border-slate-600 dark:focus:ring-slate-600/50'
                          )}
                          disabled={updateCheckpoint.isPending}
                        />
                      </div>
                    </div>

                    {/* Deadline Date */}
                    <div>
                      <label className={cn(
                        'block text-[10px] font-medium uppercase tracking-wide mb-1.5',
                        'text-slate-500 dark:text-slate-400'
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
                          'bg-white border border-slate-300 text-slate-700',
                          'focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400/50',
                          'dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-200',
                          'dark:focus:border-slate-600 dark:focus:ring-slate-600/50'
                        )}
                      />
                    </div>

                    {/* Linked Sections - Plus button approach */}
                    <div>
                      <label className={cn(
                        'block text-[10px] font-medium uppercase tracking-wide mb-1.5',
                        'text-slate-500 dark:text-slate-400'
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
                                'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
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
                              'border border-dashed border-slate-300 text-slate-400',
                              'hover:border-slate-400 hover:text-slate-500 hover:bg-slate-50',
                              'dark:border-slate-700 dark:text-slate-500',
                              'dark:hover:border-slate-600 dark:hover:text-slate-400 dark:hover:bg-slate-800/50'
                            )}
                          >
                            <Plus size={12} />
                          </button>
                          {/* Dropdown */}
                          <div className={cn(
                            'absolute left-0 top-full mt-1 z-20 min-w-[180px] max-h-[150px] overflow-y-auto',
                            'bg-white border border-slate-200 rounded-md shadow-lg',
                            'dark:bg-slate-900 dark:border-slate-700',
                            'opacity-0 invisible group-hover:opacity-100 group-hover:visible',
                            'transition-all duration-150'
                          )}>
                            {sectionsLoading ? (
                              <div className="p-2 text-[10px] text-slate-400">Загрузка...</div>
                            ) : projectSections.filter(s => s.id !== checkpoint?.section_id && !linkedSectionIds.includes(s.id)).length === 0 ? (
                              <div className="p-2 text-[10px] text-slate-400">Нет доступных разделов</div>
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
                                      'hover:bg-slate-50 dark:hover:bg-slate-800',
                                      'text-slate-600 dark:text-slate-400'
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
                    {/* Description - required */}
                    <div className="flex flex-col h-full">
                      <label className={cn(
                        'block text-[10px] font-medium uppercase tracking-wide mb-1.5',
                        'text-slate-500 dark:text-slate-400'
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
                          'bg-white border border-slate-300 text-slate-700 placeholder:text-slate-400',
                          'focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400/50',
                          'dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-600',
                          'dark:focus:border-slate-600 dark:focus:ring-slate-600/50'
                        )}
                        disabled={updateCheckpoint.isPending}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className={cn(
            'flex items-center justify-between gap-2 px-4 py-2.5 border-t',
            'border-slate-200 dark:border-slate-700/50'
          )}>
            {/* Left side - Delete button */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleDelete}
                disabled={isLoading || deleteCheckpoint.isPending || updateCheckpoint.isPending}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded transition-colors',
                  'text-red-600 hover:bg-red-50',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'dark:text-red-400 dark:hover:bg-red-500/10'
                )}
              >
                {deleteCheckpoint.isPending ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Удаление...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3 h-3" />
                    Удалить
                  </>
                )}
              </button>
            </div>

            {/* Right side - Cancel and Save buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                disabled={updateCheckpoint.isPending}
                className={cn(
                  'px-3 py-1.5 text-[11px] font-medium rounded border transition-colors',
                  'text-slate-600 border-slate-300 bg-white',
                  'hover:text-slate-700 hover:border-slate-400 hover:bg-slate-50',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'dark:text-slate-400 dark:border-slate-700 dark:bg-slate-800/50',
                  'dark:hover:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800'
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
                  'disabled:bg-slate-200 disabled:text-slate-400',
                  'dark:disabled:bg-slate-700 dark:disabled:text-slate-500'
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

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleConfirmDelete}
        title="Удалить чекпоинт?"
        description={`Вы уверены, что хотите удалить чекпоинт "${checkpoint?.title || ''}"? Это действие нельзя будет отменить.`}
      />
    </>
  )
}

export default CheckpointEditModal
