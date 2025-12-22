'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { X, Flag, Loader2, Check, ChevronDown, type LucideIcon, CircleDashed } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { cn } from '@/lib/utils'
import { useHasPermission } from '@/modules/permissions'
import { DatePicker } from '@/modules/projects/components/DatePicker'
import { useCheckpointTypes, useCreateCheckpoint } from '@/modules/checkpoints/hooks'
import { getProjectStructure } from '@/modules/resource-graph/actions'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { ScrollArea } from '@/components/ui/scroll-area'
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

interface SectionOption {
  id: string
  name: string
  objectId: string | null
}

// Предустановленные цвета для кастомных чекпоинтов
const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#6b7280', // gray
  '#1e293b', // slate
]

// Иконки для чекпоинтов
const CHECKPOINT_ICONS = [
  'Flag', 'Bookmark', 'Star', 'AlertCircle', 'CheckCircle',
  'Calendar', 'Clock', 'Target', 'Trophy', 'Award',
  'FileCheck', 'FileText', 'Send', 'ArrowRightFromLine', 'Milestone',
  'Rocket', 'Zap', 'Bell', 'Eye', 'Lock',
  'Unlock', 'Shield', 'Heart', 'ThumbsUp', 'MessageSquare',
  'CircleCheck', 'CircleDot', 'Hourglass', 'Timer', 'AlarmCheck',
  'Sparkles', 'Flame', 'Bolt', 'TrendingUp', 'Activity',
  'BarChart3', 'PieChart', 'LineChart', 'GitCommit', 'GitBranch',
  'Users', 'User', 'UserCheck', 'Crown', 'Gem',
  'Diamond', 'Box', 'Package', 'Inbox', 'Archive',
  'FolderCheck', 'FolderOpen', 'Files', 'ClipboardCheck', 'Layers',
  'CircleAlert', 'TriangleAlert', 'Info', 'HelpCircle', 'Ban',
  'XCircle', 'MinusCircle', 'PlusCircle', 'Play', 'Pause',
]

// ============================================================================
// Icon Picker Component (Compact)
// ============================================================================

interface IconPickerProps {
  value: string
  onChange: (icon: string) => void
  color: string
}

function IconPicker({ value, onChange, color }: IconPickerProps) {
  const [open, setOpen] = useState(false)

  const getIconComponent = useCallback((name: string): LucideIcon | undefined => {
    return (LucideIcons as unknown as Record<string, LucideIcon>)[name]
  }, [])

  const SelectedIcon = getIconComponent(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 text-[11px] rounded transition-colors border',
            'bg-white border-slate-300 text-slate-700',
            'hover:border-slate-400',
            'dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-200',
            'dark:hover:border-slate-600'
          )}
        >
          {SelectedIcon ? (
            <SelectedIcon size={12} color={color} />
          ) : (
            <Flag size={12} className="text-slate-500 dark:text-slate-400" />
          )}
          <span className="text-[10px]">{value || 'Иконка'}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          'w-[280px] p-0 border',
          'bg-white border-slate-300',
          'dark:bg-slate-900 dark:border-slate-700'
        )}
        align="start"
      >
        <ScrollArea className="h-[200px]">
          <div className="grid grid-cols-8 gap-1 p-2">
            {CHECKPOINT_ICONS.map((name) => {
              const IconComponent = getIconComponent(name)
              if (!IconComponent) return null
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    onChange(name)
                    setOpen(false)
                  }}
                  className={cn(
                    'p-1.5 rounded transition-colors border',
                    value === name
                      ? 'bg-amber-500/20 border-amber-500/50'
                      : cn(
                          'border-transparent hover:bg-slate-100',
                          'dark:hover:bg-slate-800'
                        )
                  )}
                  title={name}
                >
                  <IconComponent size={14} color={value === name ? color : '#94a3b8'} />
                </button>
              )
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

// ============================================================================
// Color Picker Component (Compact)
// ============================================================================

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
}

function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 text-[11px] rounded transition-colors border',
            'bg-white border-slate-300 text-slate-700',
            'hover:border-slate-400',
            'dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-200',
            'dark:hover:border-slate-600'
          )}
        >
          <div
            className="w-3 h-3 rounded-sm border border-slate-400 dark:border-slate-600"
            style={{ backgroundColor: value || '#6b7280' }}
          />
          <span className="text-[10px]">Цвет</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          'w-[180px] p-2 border',
          'bg-white border-slate-300',
          'dark:bg-slate-900 dark:border-slate-700'
        )}
        align="start"
      >
        <div className="grid grid-cols-5 gap-1.5">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => {
                onChange(color)
                setOpen(false)
              }}
              className={cn(
                'w-7 h-7 rounded-md border-2 transition-all',
                value === color
                  ? 'border-amber-500 scale-110'
                  : 'border-transparent hover:border-slate-400 dark:hover:border-slate-500'
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ============================================================================
// Multi-Select Sections Component (Compact Chips)
// ============================================================================

interface SectionMultiSelectProps {
  selectedIds: string[]
  onChange: (ids: string[]) => void
  sections: SectionOption[]
  excludeId?: string
  isLoading?: boolean
}

function SectionMultiSelect({
  selectedIds,
  onChange,
  sections,
  excludeId,
  isLoading,
}: SectionMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const availableSections = useMemo(() => {
    return sections.filter((s) => s.id !== excludeId)
  }, [sections, excludeId])

  const filteredSections = useMemo(() => {
    if (!search) return availableSections
    const searchLower = search.toLowerCase()
    return availableSections.filter((s) => s.name.toLowerCase().includes(searchLower))
  }, [search, availableSections])

  const selectedSections = useMemo(() => {
    return availableSections.filter((s) => selectedIds.includes(s.id))
  }, [availableSections, selectedIds])

  const toggleSection = (sectionId: string) => {
    if (selectedIds.includes(sectionId)) {
      onChange(selectedIds.filter((id) => id !== sectionId))
    } else {
      onChange([...selectedIds, sectionId])
    }
  }

  const removeSection = (sectionId: string) => {
    onChange(selectedIds.filter((id) => id !== sectionId))
  }

  return (
    <div className="space-y-1.5">
      {selectedSections.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedSections.map((section) => (
            <div
              key={section.id}
              className={cn(
                'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border',
                'bg-amber-100 border-amber-300 text-amber-700',
                'dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-400'
              )}
            >
              <span className="truncate max-w-[100px]">{section.name}</span>
              <button
                type="button"
                onClick={() => removeSection(section.id)}
                className="p-0.5 hover:bg-amber-500/20 rounded"
              >
                <X size={8} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={isLoading}
            className={cn(
              'w-full flex items-center justify-between px-2 py-1 text-[11px] rounded transition-colors border',
              'bg-white border-slate-300 text-slate-700',
              'hover:border-slate-400',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-200',
              'dark:hover:border-slate-600'
            )}
          >
            {isLoading ? (
              <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <Loader2 size={10} className="animate-spin" />
                <span className="text-[10px]">Загрузка...</span>
              </span>
            ) : (
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {selectedIds.length > 0
                  ? `Выбрано: ${selectedIds.length}`
                  : 'Связанные разделы...'}
              </span>
            )}
            <ChevronDown size={10} className="text-slate-500 dark:text-slate-400" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className={cn(
            'w-[260px] p-0 border',
            'bg-white border-slate-300',
            'dark:bg-slate-900 dark:border-slate-700'
          )}
          align="start"
        >
          <Command className="bg-transparent">
            <CommandInput
              placeholder="Поиск..."
              value={search}
              onValueChange={setSearch}
              className={cn(
                'text-[11px] border-b h-7',
                'text-slate-700 border-slate-200',
                'dark:text-slate-200 dark:border-slate-700'
              )}
            />
            <CommandList>
              <CommandEmpty className="py-3 text-center text-[10px] text-slate-400 dark:text-slate-500">
                Не найдено
              </CommandEmpty>
              <CommandGroup>
                <ScrollArea className="h-[140px]">
                  {filteredSections.map((section) => {
                    const isSelected = selectedIds.includes(section.id)
                    return (
                      <CommandItem
                        key={section.id}
                        value={section.id}
                        onSelect={() => toggleSection(section.id)}
                        className={cn(
                          'flex items-center gap-1.5 px-2 py-1 cursor-pointer text-[11px]',
                          isSelected && 'bg-amber-500/10'
                        )}
                      >
                        <div
                          className={cn(
                            'w-3 h-3 rounded border flex items-center justify-center shrink-0',
                            isSelected
                              ? 'bg-amber-500 border-amber-500'
                              : 'border-slate-400 bg-white dark:border-slate-600 dark:bg-slate-800/50'
                          )}
                        >
                          {isSelected && <Check size={8} className="text-slate-900" />}
                        </div>
                        <span className="truncate text-slate-700 dark:text-slate-200">
                          {section.name}
                        </span>
                      </CommandItem>
                    )
                  })}
                </ScrollArea>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
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

  // Sections state
  const [projectSections, setProjectSections] = useState<SectionOption[]>([])
  const [sectionsLoading, setSectionsLoading] = useState(false)
  const [projectId, setProjectId] = useState<string | null>(initialProjectId || null)

  // Hooks
  const { data: checkpointTypes = [], isLoading: typesLoading } = useCheckpointTypes()
  const createCheckpoint = useCreateCheckpoint()
  const canManageTypes = useHasPermission('checkpoints.types.manage')

  const selectedType = useMemo(() => {
    return checkpointTypes.find((t) => t.type_id === selectedTypeId)
  }, [checkpointTypes, selectedTypeId])

  // Загрузка разделов проекта
  useEffect(() => {
    async function loadSections() {
      if (!isOpen) return

      setSectionsLoading(true)
      try {
        const result = await getProjectStructure()
        if (result.success && result.data) {
          const currentSection = result.data.sections.find((s) => s.id === sectionId)
          if (currentSection?.objectId) {
            const currentObject = result.data.objects.find(
              (o) => o.id === currentSection.objectId
            )
            if (currentObject?.stageId) {
              const currentStage = result.data.stages.find(
                (s) => s.id === currentObject.stageId
              )
              if (currentStage?.projectId) {
                setProjectId(currentStage.projectId)

                const projectStages = result.data.stages.filter(
                  (s) => s.projectId === currentStage.projectId
                )
                const stageIds = new Set(projectStages.map((s) => s.id))

                const projectObjects = result.data.objects.filter(
                  (o) => o.stageId && stageIds.has(o.stageId)
                )
                const objectIds = new Set(projectObjects.map((o) => o.id))

                const sections = result.data.sections
                  .filter((s) => s.objectId && objectIds.has(s.objectId))
                  .map((s) => ({
                    id: s.id,
                    name: s.name,
                    objectId: s.objectId,
                  }))

                setProjectSections(sections)
              }
            }
          }
        }
      } catch (error) {
        console.error('[CheckpointCreateModal] Error loading sections:', error)
      } finally {
        setSectionsLoading(false)
      }
    }

    loadSections()
  }, [isOpen, sectionId])

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
                  {/* Checkpoint Type Selector - 2 Columns */}
                  <div>
                    <label className={cn(
                      'block text-[10px] font-medium uppercase tracking-wide mb-1.5',
                      'text-slate-500 dark:text-slate-400'
                    )}>
                      Тип чекпоинта
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {checkpointTypes.map((type) => {
                        const isSelected = selectedTypeId === type.type_id
                        const IconComponent =
                          (LucideIcons as unknown as Record<string, LucideIcon>)[type.icon] || Flag

                        // Кастомный тип - особое отображение
                        if (type.is_custom) {
                          const CustomIconComponent =
                            (LucideIcons as unknown as Record<string, LucideIcon>)[customIcon] || Flag

                          return (
                            <div
                              key={type.type_id}
                              className={cn(
                                'col-span-2 flex items-center gap-1 px-1.5 py-1 rounded-md',
                                'border-2 border-dashed transition-all duration-150',
                                !isSelected &&
                                  cn(
                                    'border-slate-300 bg-white',
                                    'hover:border-slate-400 hover:bg-slate-50',
                                    'dark:border-slate-600 dark:bg-slate-800/30',
                                    'dark:hover:border-slate-500 dark:hover:bg-slate-800/50'
                                  )
                              )}
                              style={
                                isSelected
                                  ? {
                                      borderColor: `${customColor}80`,
                                      backgroundColor: `${customColor}10`,
                                    }
                                  : undefined
                              }
                            >
                              {/* Левая часть - иконка с выпадающим списком */}
                              {isSelected ? (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button
                                      type="button"
                                      className="flex items-center justify-center w-5 h-5 rounded hover:bg-amber-500/10 transition-colors"
                                    >
                                      <CustomIconComponent size={12} style={{ color: customColor }} />
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent
                                    className={cn(
                                      'w-[320px] p-2 border',
                                      'bg-white border-slate-300',
                                      'dark:bg-slate-900 dark:border-slate-700'
                                    )}
                                    align="start"
                                  >
                                    {/* Выбор иконки */}
                                    <div className="space-y-2">
                                      <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                        Иконка
                                      </div>
                                      <ScrollArea className="h-[200px]">
                                        <div className="grid grid-cols-8 gap-1 p-1">
                                          {CHECKPOINT_ICONS.map((iconName) => {
                                            const IconComp = (LucideIcons as unknown as Record<string, LucideIcon>)[iconName]
                                            if (!IconComp) return null
                                            return (
                                              <button
                                                key={iconName}
                                                type="button"
                                                onClick={() => setCustomIcon(iconName)}
                                                className={cn(
                                                  'p-1.5 rounded transition-colors border',
                                                  customIcon === iconName
                                                    ? 'bg-amber-500/20 border-amber-500/50'
                                                    : cn(
                                                        'border-transparent hover:bg-slate-100',
                                                        'dark:hover:bg-slate-800'
                                                      )
                                                )}
                                                title={iconName}
                                              >
                                                <IconComp
                                                  size={14}
                                                  color={customIcon === iconName ? customColor : '#94a3b8'}
                                                />
                                              </button>
                                            )
                                          })}
                                        </div>
                                      </ScrollArea>
                                    </div>

                                    {/* Выбор цвета */}
                                    <div className={cn(
                                      'mt-2 pt-2 space-y-2 border-t',
                                      'border-slate-200 dark:border-slate-700/50'
                                    )}>
                                      <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                        Цвет
                                      </div>
                                      <div className="grid grid-cols-10 gap-1.5">
                                        {PRESET_COLORS.map((color) => (
                                          <button
                                            key={color}
                                            type="button"
                                            onClick={() => setCustomColor(color)}
                                            className={cn(
                                              'w-6 h-6 rounded-md border-2 transition-all',
                                              customColor === color
                                                ? 'border-amber-500 scale-110'
                                                : 'border-transparent hover:border-slate-400 dark:hover:border-slate-500'
                                            )}
                                            style={{ backgroundColor: color }}
                                          />
                                        ))}
                                      </div>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              ) : (
                                <div className="flex items-center justify-center w-5 h-5">
                                  <CircleDashed size={10} className="text-slate-400 dark:text-slate-500" />
                                </div>
                              )}

                              {/* Средняя часть - кнопка выбора типа */}
                              <button
                                type="button"
                                onClick={() => setSelectedTypeId(type.type_id)}
                                className="flex items-center min-w-0 flex-1"
                              >
                                <span
                                  className={cn(
                                    'truncate text-[9px] font-medium',
                                    !isSelected && 'text-slate-600 dark:text-slate-400'
                                  )}
                                  style={isSelected ? { color: customColor } : undefined}
                                >
                                  Создать свой тип
                                </span>
                              </button>
                            </div>
                          )
                        }

                        return (
                          <button
                            key={type.type_id}
                            type="button"
                            onClick={() => setSelectedTypeId(type.type_id)}
                            className={cn(
                              'flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium',
                              'border transition-all duration-150',
                              isSelected
                                ? 'shadow-sm'
                                : cn(
                                    'border-slate-200 bg-white text-slate-700',
                                    'hover:border-slate-300 hover:shadow-sm',
                                    'dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300',
                                    'dark:hover:border-slate-600 dark:hover:bg-slate-800/60'
                                  )
                            )}
                            style={
                              isSelected
                                ? {
                                    borderColor: `${type.color}60`,
                                    backgroundColor: `${type.color}10`,
                                    color: type.color,
                                  }
                                : undefined
                            }
                          >
                            <IconComponent
                              size={12}
                              className="shrink-0"
                              style={{ color: type.color || '#6b7280' }}
                            />
                            <span className="truncate">{type.name}</span>
                            {isSelected && <Check className="w-3 h-3 ml-0.5 shrink-0" style={{ color: type.color }} />}
                          </button>
                        )
                      })}
                    </div>

                    {/* Подсказка для кастомного типа */}
                    {selectedType?.is_custom && (
                      <div className="text-[9px] text-slate-500 dark:text-slate-400 italic mt-1">
                        Кликните на иконку, чтобы её сменить
                      </div>
                    )}
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
                        isLoading={sectionsLoading}
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
