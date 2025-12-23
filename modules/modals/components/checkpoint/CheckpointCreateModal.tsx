'use client'

import { useEffect, useState, useMemo } from 'react'
import { X, Flag, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DatePicker } from '@/modules/projects/components/DatePicker'
import { useCheckpointTypes, useCreateCheckpoint, useProjectStructure } from '@/modules/checkpoints/hooks'
import { CheckpointTypeSelector, SectionMultiSelect } from '@/modules/checkpoints/components/shared'
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

  // Custom type state
  const [customIcon, setCustomIcon] = useState<string>('Flag')
  const [customColor, setCustomColor] = useState<string>('#6b7280')

  // Hooks
  const { data: checkpointTypes = [], isLoading: typesLoading } = useCheckpointTypes()
  const { data: projectStructureResult, isLoading: structureLoading } = useProjectStructure()
  const createCheckpoint = useCreateCheckpoint()

  const selectedType = useMemo(() => {
    return checkpointTypes.find((t) => t.type_id === selectedTypeId)
  }, [checkpointTypes, selectedTypeId])

  // Обработка структуры проекта для получения разделов
  const { projectSections, projectId } = useMemo(() => {
    if (!projectStructureResult || !sectionId || !isOpen) {
      return { projectSections: [], projectId: initialProjectId || null }
    }

    const { sections, objects, stages } = projectStructureResult

    const currentSection = sections.find((s) => s.id === sectionId)
    if (!currentSection?.objectId) return { projectSections: [], projectId: initialProjectId || null }

    const currentObject = objects.find((o) => o.id === currentSection.objectId)
    if (!currentObject?.stageId) return { projectSections: [], projectId: initialProjectId || null }

    const currentStage = stages.find((s) => s.id === currentObject.stageId)
    if (!currentStage?.projectId) return { projectSections: [], projectId: initialProjectId || null }

    const projectStages = stages.filter((s) => s.projectId === currentStage.projectId)
    const stageIds = new Set(projectStages.map((s) => s.id))

    const projectObjects = objects.filter((o) => o.stageId && stageIds.has(o.stageId))
    const objectIds = new Set(projectObjects.map((o) => o.id))

    const filteredSections: SectionOption[] = sections
      .filter((s) => s.objectId && objectIds.has(s.objectId))
      .map((s) => ({
        id: s.id,
        name: s.name,
        objectId: s.objectId,
      }))

    return {
      projectSections: filteredSections,
      projectId: currentStage.projectId,
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
      setCustomIcon('Flag')
      setCustomColor('#6b7280')
    }
  }, [isOpen])

  // Валидация
  const canSave = useMemo(() => {
    const hasType = !!selectedTypeId
    const hasDate = !!deadlineDate
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
      linkedSectionIds: linkedSectionIds.length > 0 ? linkedSectionIds : undefined,
      customIcon: selectedType?.is_custom ? customIcon : undefined,
      customColor: selectedType?.is_custom ? customColor : undefined,
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
              <div className="grid grid-cols-2 gap-3">
                {/* Left column */}
                <div className="space-y-3">
                  {/* Checkpoint Type Selector */}
                  <div>
                    <label className={cn(
                      'block text-[10px] font-medium uppercase tracking-wide mb-1.5',
                      'text-slate-500 dark:text-slate-400'
                    )}>
                      Тип чекпоинта
                    </label>
                    <CheckpointTypeSelector
                      types={checkpointTypes}
                      selectedTypeId={selectedTypeId}
                      onSelect={setSelectedTypeId}
                      customIcon={customIcon}
                      customColor={customColor}
                      onCustomIconChange={setCustomIcon}
                      onCustomColorChange={setCustomColor}
                      isLoading={typesLoading}
                    />
                  </div>

                  {/* Linked Sections */}
                  <div>
                    <label className={cn(
                      'block text-[10px] font-medium uppercase tracking-wide mb-1.5',
                      'text-slate-500 dark:text-slate-400'
                    )}>
                      Связанные разделы
                    </label>
                    <SectionMultiSelect
                      selectedIds={linkedSectionIds}
                      onChange={setLinkedSectionIds}
                      sections={projectSections}
                      excludeId={sectionId}
                      isLoading={structureLoading}
                    />
                  </div>
                </div>

                {/* Right column */}
                <div className="space-y-3">
                  {/* Checkpoint Name */}
                  <div>
                    <label className={cn(
                      'block text-[10px] font-medium uppercase tracking-wide mb-1.5',
                      'text-slate-500 dark:text-slate-400'
                    )}>
                      Название {selectedType?.is_custom && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={
                        selectedType?.is_custom
                          ? 'Введите название'
                          : 'По умолчанию — название типа'
                      }
                      className={cn(
                        'w-full px-2.5 py-1.5 text-xs rounded transition-colors',
                        'bg-white border border-slate-300 text-slate-700 placeholder:text-slate-400',
                        'focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400/50',
                        'dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-600',
                        'dark:focus:border-slate-600 dark:focus:ring-slate-600/50'
                      )}
                      disabled={createCheckpoint.isPending}
                    />
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
                      offsetX={-260}
                      inputClassName={cn(
                        'w-full px-2.5 py-1.5 text-xs rounded transition-colors cursor-pointer',
                        'bg-white border border-slate-300 text-slate-700',
                        'focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400/50',
                        'dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-200',
                        'dark:focus:border-slate-600 dark:focus:ring-slate-600/50'
                      )}
                    />
                  </div>

                  {/* Description */}
                  <div className="flex flex-col">
                    <label className={cn(
                      'block text-[10px] font-medium uppercase tracking-wide mb-1.5',
                      'text-slate-500 dark:text-slate-400'
                    )}>
                      Описание
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Необязательно..."
                      rows={3}
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
