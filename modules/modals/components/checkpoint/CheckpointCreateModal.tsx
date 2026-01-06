'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { X, Flag, Loader2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DatePicker } from '@/modules/projects/components/DatePicker'
import { useCheckpointTypes, useCreateCheckpoint, useProjectStructure } from '@/modules/checkpoints/hooks'
import { IconColorPicker } from '@/modules/checkpoints/components/shared'
import { getIcon } from '@/modules/checkpoints/constants/icon-map'
import type { SectionOption } from '@/modules/checkpoints/components/shared'
import type { BaseModalProps } from '../../types'

// ============================================================================
// Types
// ============================================================================

export interface CheckpointCreateModalProps extends BaseModalProps {
  /** ID раздела */
  sectionId: string
  /** Название раздела (для отображения в header) */
  sectionName: string
  /** ID проекта (если известен) */
  projectId?: string
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
  projectId: initialProjectId,
}: CheckpointCreateModalProps) {
  // State
  const [selectedTypeId, setSelectedTypeId] = useState<string>('')
  const [name, setName] = useState<string>('')
  const [deadlineDate, setDeadlineDate] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [linkedSectionIds, setLinkedSectionIds] = useState<string[]>([])

  // Icon and color state (editable after type selection)
  const [icon, setIcon] = useState<string>('Flag')
  const [color, setColor] = useState<string>('#6b7280')

  // Hooks
  const { data: checkpointTypes = [], isLoading: typesLoading } = useCheckpointTypes()
  const { data: projectStructureResult, isLoading: structureLoading } = useProjectStructure()
  const createCheckpoint = useCreateCheckpoint()

  const selectedType = useMemo(() => {
    return checkpointTypes.find((t) => t.type_id === selectedTypeId)
  }, [checkpointTypes, selectedTypeId])

  // При выборе типа - предзаполняем поля (тип = шаблон)
  const handleTypeSelect = useCallback((typeId: string) => {
    setSelectedTypeId(typeId)

    const type = checkpointTypes.find((t) => t.type_id === typeId)
    if (type && !type.is_custom) {
      // Предзаполняем из шаблона типа
      setName(type.name)
      setIcon(type.icon)
      setColor(type.color)
    }
    // Для кастомного типа - ничего не предзаполняем
  }, [checkpointTypes])

  // Обработка структуры проекта для получения разделов
  // Иерархия: Project → Object → Section (stages убраны из иерархии)
  const { projectSections, projectId } = useMemo(() => {
    if (!projectStructureResult || !sectionId || !isOpen) {
      return { projectSections: [], projectId: initialProjectId || null }
    }

    const { sections, objects } = projectStructureResult

    // Находим текущую секцию
    const currentSection = sections.find((s) => s.id === sectionId)
    if (!currentSection?.objectId) return { projectSections: [], projectId: initialProjectId || null }

    // Находим объект секции
    const currentObject = objects.find((o) => o.id === currentSection.objectId)
    // stageId теперь содержит projectId (объекты связаны напрямую с проектами)
    const currentProjectId = currentObject?.stageId
    if (!currentProjectId) return { projectSections: [], projectId: initialProjectId || null }

    // Находим все объекты этого проекта
    const projectObjects = objects.filter((o) => o.stageId === currentProjectId)
    const objectIds = new Set(projectObjects.map((o) => o.id))

    // Находим все секции этих объектов
    const filteredSections: SectionOption[] = sections
      .filter((s) => s.objectId && objectIds.has(s.objectId))
      .map((s) => ({
        id: s.id,
        name: s.name,
        objectId: s.objectId,
      }))

    return {
      projectSections: filteredSections,
      projectId: currentProjectId,
    }
  }, [projectStructureResult, sectionId, isOpen, initialProjectId])

  // Reset при открытии
  useEffect(() => {
    if (isOpen) {
      setSelectedTypeId('')
      setName('')
      setDeadlineDate('')
      setDescription('')
      setLinkedSectionIds([])
      setIcon('Flag')
      setColor('#6b7280')
    }
  }, [isOpen])

  // Валидация - название и описание обязательны
  const canSave = useMemo(() => {
    const hasType = !!selectedTypeId
    const hasDate = !!deadlineDate
    const hasName = name.trim().length > 0
    const hasDescription = description.trim().length > 0
    return hasType && hasDate && hasName && hasDescription && !createCheckpoint.isPending
  }, [selectedTypeId, deadlineDate, name, description, createCheckpoint.isPending])

  // Сохранение
  const handleSave = async () => {
    if (!canSave) return

    // Подготавливаем данные для optimistic update
    const optimisticLinkedSections = linkedSectionIds.map(id => {
      const section = projectSections.find(s => s.id === id)
      return {
        section_id: id,
        section_name: section?.name || '',
        object_id: section?.objectId || null,
      }
    })

    const payload = {
      sectionId: sectionId,
      typeId: selectedTypeId,
      title: name.trim(),
      checkpointDate: deadlineDate,
      description: description.trim() || null,
      linkedSectionIds: linkedSectionIds.length > 0 ? linkedSectionIds : undefined,
      // Всегда передаём иконку и цвет (пользователь мог изменить после предзаполнения)
      customIcon: icon,
      customColor: color,
      // Данные для optimistic update
      _optimisticTypeName: selectedType?.name || name.trim(),
      _optimisticTypeCode: selectedType?.type || 'custom',
      _optimisticIsCustom: selectedType?.is_custom ?? true,
      _optimisticLinkedSections: optimisticLinkedSections.length > 0 ? optimisticLinkedSections : undefined,
    }

    // Закрываем модалку сразу для мгновенного отклика
    // Optimistic update добавит чекпоинт на график мгновенно
    onClose()
    onSuccess?.()

    // Создание происходит в фоне с optimistic update
    createCheckpoint.mutate(payload, {
      onSuccess: (result) => {
        console.log('[CheckpointCreateModal] Checkpoint created successfully:', result)
      },
      onError: (error) => {
        console.error('[CheckpointCreateModal] Failed to create checkpoint:', error)
        // TODO: Показать toast с ошибкой пользователю
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

  const isLoading = typesLoading

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
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
                Добавить чекпоинт
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-500">·</span>
              <span
                className={cn(
                  'text-[10px] truncate max-w-[200px]',
                  'text-slate-500 dark:text-slate-400'
                )}
                title={sectionName}
              >
                {sectionName}
              </span>
            </div>
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
                                  'border-slate-200 bg-white text-slate-600',
                                  'hover:border-slate-300 hover:bg-slate-50',
                                  'dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400',
                                  'dark:hover:border-slate-600 dark:hover:bg-slate-800/60'
                                )
                          )}
                          style={
                            isSelected
                              ? {
                                  borderColor: `${type.is_custom ? color : type.color}60`,
                                  backgroundColor: `${type.is_custom ? color : type.color}15`,
                                  color: type.is_custom ? color : type.color,
                                }
                              : undefined
                          }
                        >
                          {type.is_custom ? (
                            <>
                              {(() => {
                                const CustomIcon = getIcon(icon, Flag)
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
                          selectedIcon={icon}
                          selectedColor={color}
                          onIconChange={setIcon}
                          onColorChange={setColor}
                          renderTrigger={({ color: previewColor }) => {
                            const PreviewIcon = getIcon(icon, Flag)
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
                          disabled={createCheckpoint.isPending}
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
                            {structureLoading ? (
                              <div className="p-2 text-[10px] text-slate-400">Загрузка...</div>
                            ) : projectSections.filter(s => s.id !== sectionId && !linkedSectionIds.includes(s.id)).length === 0 ? (
                              <div className="p-2 text-[10px] text-slate-400">Нет доступных разделов</div>
                            ) : (
                              projectSections
                                .filter(s => s.id !== sectionId && !linkedSectionIds.includes(s.id))
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
                        disabled={createCheckpoint.isPending}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className={cn(
            'flex items-center justify-end gap-2 px-4 py-2.5 border-t',
            'border-slate-200 dark:border-slate-700/50'
          )}>
            <button
              onClick={onClose}
              disabled={createCheckpoint.isPending}
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
