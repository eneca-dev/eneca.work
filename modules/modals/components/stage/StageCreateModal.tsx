'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { X, Layers, Plus, Trash2, Loader2, AlertCircle, ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUsers, type CachedUser } from '@/modules/cache'
import type { BaseModalProps } from '../../types'
import {
  useCreateDecompositionStage,
  useBulkCreateDecompositionItems,
  useWorkCategories,
  useStageStatuses,
  useDifficultyLevels,
} from '../../hooks'
import { ResponsiblesDropdown } from './ResponsiblesDropdown'

// ============================================================================
// Custom Dropdown Component (inline for this modal)
// ============================================================================

interface DropdownOption {
  value: string
  label: string
}

interface InlineDropdownProps {
  options: DropdownOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

function InlineDropdown({
  options,
  value,
  onChange,
  placeholder = 'Выберите...',
  disabled = false,
  className,
}: InlineDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = useMemo(
    () => options.find((o) => o.value === value),
    [options, value]
  )

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'w-full flex items-center justify-between gap-1.5',
          'px-2.5 py-1.5 text-xs',
          'bg-slate-800/50 border border-slate-700',
          'rounded text-left',
          'hover:border-slate-600',
          'focus:outline-none',
          'transition-colors',
          disabled && 'opacity-50 cursor-not-allowed',
          selectedOption ? 'text-slate-200' : 'text-slate-500'
        )}
      >
        <span className="truncate flex-1">{selectedOption?.label || placeholder}</span>
        <ChevronDown className={cn('w-3.5 h-3.5 text-slate-500 flex-shrink-0 transition-transform', isOpen && 'rotate-180')} />
      </button>
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-[100] bg-slate-800/95 backdrop-blur-sm border border-slate-700 rounded-lg shadow-xl shadow-black/40 max-h-44 overflow-y-auto py-1">
          <button
            type="button"
            onClick={() => { onChange(''); setIsOpen(false) }}
            className={cn('w-full px-3 py-2 text-xs text-left flex items-center gap-2 hover:bg-slate-700/50 transition-colors', !value && 'bg-slate-700/30')}
          >
            <span className="w-4 flex-shrink-0">{!value && <Check className="w-3 h-3 text-amber-500" />}</span>
            <span className="text-slate-500">{placeholder}</span>
          </button>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setIsOpen(false) }}
              className={cn('w-full px-3 py-2 text-xs text-left flex items-center gap-2 hover:bg-slate-700/50 transition-colors', value === opt.value && 'bg-slate-700/30')}
            >
              <span className="w-4 flex-shrink-0">{value === opt.value && <Check className="w-3 h-3 text-amber-500" />}</span>
              <span className="text-slate-200 truncate">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Types
// ============================================================================

/** Ключ статуса в канбане (маппится на название в БД) */
type KanbanStatusKey = 'backlog' | 'planned' | 'in_progress' | 'paused' | 'review' | 'done'

export interface StageCreateModalProps extends BaseModalProps {
  /** ID раздела, к которому создаётся этап */
  sectionId: string
  /** Название раздела для отображения */
  sectionName: string
  /** Ключ статуса для предзаполнения (из канбан-колонки) */
  initialStatusKey?: KanbanStatusKey
}

interface SubtaskInput {
  id: string
  description: string
  workCategoryId: string
  difficultyId: string
  plannedHours: number
}

// ============================================================================
// Helpers
// ============================================================================

/** Маппинг ключа канбан-статуса → название в БД */
const STATUS_KEY_TO_NAME: Record<KanbanStatusKey, string> = {
  backlog: 'Бэклог',
  planned: 'План',
  in_progress: 'В работе',
  paused: 'Пауза',
  review: 'Проверка',
  done: 'Готово',
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

function createEmptySubtask(): SubtaskInput {
  return {
    id: generateId(),
    description: '',
    workCategoryId: '',
    difficultyId: '',
    plannedHours: 0,
  }
}

// ============================================================================
// Component
// ============================================================================

export function StageCreateModal({
  isOpen,
  onClose,
  onSuccess,
  sectionId,
  sectionName,
  initialStatusKey,
}: StageCreateModalProps) {
  // Form state
  const [stageName, setStageName] = useState('')
  const [stageDescription, setStageDescription] = useState('')
  const [selectedStatusId, setSelectedStatusId] = useState<string>('')
  const [selectedResponsibles, setSelectedResponsibles] = useState<CachedUser[]>([])
  const [subtasks, setSubtasks] = useState<SubtaskInput[]>([])
  const [error, setError] = useState<string | null>(null)

  // Queries
  const { data: workCategories = [], isLoading: categoriesLoading } = useWorkCategories()
  const { data: stageStatuses = [], isLoading: statusesLoading } = useStageStatuses()
  const { data: difficultyLevels = [], isLoading: difficultiesLoading } = useDifficultyLevels()
  const { data: users = [], isLoading: usersLoading } = useUsers()

  // Mutations
  const { mutateAsync: createStage, isPending: isCreatingStage } = useCreateDecompositionStage()
  const { mutateAsync: createItems, isPending: isCreatingItems } = useBulkCreateDecompositionItems()

  const isCreating = isCreatingStage || isCreatingItems
  const isLoading = categoriesLoading || statusesLoading || difficultiesLoading || usersLoading

  // Memoized options for dropdowns
  const statusOptions = useMemo(
    () => stageStatuses.map((s) => ({ value: s.id, label: s.name })),
    [stageStatuses]
  )

  const categoryOptions = useMemo(
    () => workCategories.map((c) => ({ value: c.work_category_id, label: c.work_category_name })),
    [workCategories]
  )

  const difficultyOptions = useMemo(
    () => difficultyLevels.map((d) => ({ value: d.difficulty_id, label: d.difficulty_abbr })),
    [difficultyLevels]
  )

  // Find initial status by key
  const initialStatusId = useMemo(() => {
    if (!initialStatusKey || stageStatuses.length === 0) return ''
    const targetName = STATUS_KEY_TO_NAME[initialStatusKey]
    const found = stageStatuses.find((s) => s.name === targetName)
    return found?.id || ''
  }, [initialStatusKey, stageStatuses])

  // Derived state
  const isFormValid = useMemo(() => {
    if (stageName.trim() === '') return false

    // Проверяем подзадачи, если они есть
    for (const subtask of subtasks) {
      if (subtask.description.trim() !== '') {
        // Если есть описание, то нужны категория и часы
        if (!subtask.workCategoryId || subtask.plannedHours <= 0) {
          return false
        }
      }
    }

    return true
  }, [stageName, subtasks])

  // Подзадачи с заполненными данными (для отправки)
  const validSubtasks = useMemo(() => {
    return subtasks.filter(
      (s) => s.description.trim() !== '' && s.workCategoryId && s.plannedHours > 0
    )
  }, [subtasks])

  // Reset form on open
  useEffect(() => {
    if (isOpen) {
      setStageName('')
      setStageDescription('')
      setSelectedStatusId(initialStatusId)
      setSelectedResponsibles([])
      setSubtasks([])
      setError(null)
    }
  }, [isOpen, initialStatusId])

  // Handlers
  const handleAddSubtask = useCallback(() => {
    setSubtasks((prev) => [...prev, createEmptySubtask()])
  }, [])

  const handleRemoveSubtask = useCallback((id: string) => {
    setSubtasks((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const handleSubtaskChange = useCallback(
    (id: string, field: keyof SubtaskInput, value: string | number) => {
      setSubtasks((prev) =>
        prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
      )
    },
    []
  )

  const handleSubmit = useCallback(async () => {
    if (!isFormValid || isCreating) return

    setError(null)

    try {
      // 1. Создаём этап
      const responsibleIds = selectedResponsibles.map((u) => u.user_id)
      const stageResult = await createStage({
        sectionId,
        name: stageName.trim(),
        description: stageDescription.trim() || null,
        statusId: selectedStatusId || null,
        responsibles: responsibleIds.length > 0 ? responsibleIds : undefined,
      })

      // createCacheMutation возвращает данные напрямую (не обёрнутые в { success, data })
      if (!stageResult || !stageResult.id) {
        console.error('[StageCreateModal] Stage creation failed: no stage data returned')
        setError('Не удалось создать этап')
        return
      }

      const newStageId = stageResult.id

      // 2. Создаём подзадачи, если есть
      if (validSubtasks.length > 0) {
        const itemsToCreate = validSubtasks.map((subtask, index) => ({
          sectionId,
          stageId: newStageId,
          description: subtask.description.trim(),
          workCategoryId: subtask.workCategoryId,
          difficultyId: subtask.difficultyId || null,
          plannedHours: subtask.plannedHours,
          order: index,
        }))

        const itemsResult = await createItems({
          items: itemsToCreate,
          sectionId,
        })

        // createCacheMutation возвращает данные напрямую
        if (!itemsResult) {
          // Этап создан, но задачи - нет. Показываем предупреждение
          setError('Этап создан, но не удалось создать задачи')
          return
        }
      }

      // Успех
      onSuccess?.()
      onClose()
    } catch (err) {
      console.error('[StageCreateModal] Unexpected error:', err)
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка')
    }
  }, [
    isFormValid,
    isCreating,
    createStage,
    createItems,
    sectionId,
    stageName,
    stageDescription,
    selectedStatusId,
    selectedResponsibles,
    validSubtasks,
    onSuccess,
    onClose,
  ])

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
            'pointer-events-auto w-full max-w-2xl',
            'bg-slate-900/95 backdrop-blur-md',
            'border border-slate-700/50',
            'rounded-lg shadow-2xl shadow-black/50',
            'transform transition-all duration-200',
            isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/50">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-medium text-slate-300">Создать этап</span>
              <span className="text-[10px] text-slate-500">·</span>
              <span
                className="text-[10px] text-slate-400 truncate max-w-[200px]"
                title={sectionName}
              >
                Раздел: {sectionName}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-4 py-3 max-h-[70vh] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-track]:bg-transparent">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Stage fields */}
                <div className="space-y-3">
                  {/* Row 1: Name, Status, Description */}
                  <div className="grid grid-cols-3 gap-3">
                    {/* Name */}
                    <div>
                      <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1.5">
                        Название этапа *
                      </label>
                      <input
                        type="text"
                        value={stageName}
                        onChange={(e) => setStageName(e.target.value)}
                        placeholder="Введите название"
                        className={cn(
                          'w-full px-2.5 py-1.5 text-xs',
                          'bg-slate-800/50 border border-slate-700',
                          'rounded text-slate-200',
                          'placeholder:text-slate-600',
                          'focus:outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600/50',
                          'transition-colors'
                        )}
                        disabled={isCreating}
                      />
                    </div>

                    {/* Status */}
                    <div>
                      <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1.5">
                        Статус
                      </label>
                      <InlineDropdown
                        options={statusOptions}
                        value={selectedStatusId}
                        onChange={setSelectedStatusId}
                        placeholder="Без статуса"
                        disabled={isCreating}
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1.5">
                        Описание
                      </label>
                      <input
                        type="text"
                        value={stageDescription}
                        onChange={(e) => setStageDescription(e.target.value)}
                        placeholder="Необязательно"
                        className={cn(
                          'w-full px-2.5 py-1.5 text-xs',
                          'bg-slate-800/50 border border-slate-700',
                          'rounded text-slate-200',
                          'placeholder:text-slate-600',
                          'focus:outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600/50',
                          'transition-colors'
                        )}
                        disabled={isCreating}
                      />
                    </div>
                  </div>

                  {/* Row 2: Responsibles */}
                  <div>
                    <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1.5">
                      Ответственные
                    </label>
                    <ResponsiblesDropdown
                      users={users}
                      value={selectedResponsibles}
                      onChange={(userIds) => {
                        // Convert user IDs back to CachedUser objects
                        const selected = users.filter((u) => userIds.includes(u.user_id))
                        setSelectedResponsibles(selected)
                      }}
                      disabled={isCreating}
                    />
                  </div>
                </div>

                {/* Subtasks section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">
                      Задачи
                    </label>
                    <button
                      type="button"
                      onClick={handleAddSubtask}
                      disabled={isCreating}
                      className={cn(
                        'flex items-center gap-1.5 text-xs',
                        'text-amber-500/80 hover:text-amber-400',
                        'transition-colors',
                        'disabled:opacity-50 disabled:cursor-not-allowed'
                      )}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Добавить задачу
                    </button>
                  </div>

                  {subtasks.length === 0 ? (
                    <div className="text-[11px] text-slate-500 text-center py-4 border border-dashed border-slate-700/50 rounded">
                      Задачи можно добавить позже
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {subtasks.map((subtask, index) => (
                        <div
                          key={subtask.id}
                          className="grid grid-cols-[1fr_120px_80px_65px_28px] gap-2 items-start"
                        >
                          {/* Description */}
                          <input
                            type="text"
                            value={subtask.description}
                            onChange={(e) =>
                              handleSubtaskChange(subtask.id, 'description', e.target.value)
                            }
                            placeholder={`Задача ${index + 1}`}
                            className={cn(
                              'px-2.5 py-1.5 text-xs',
                              'bg-slate-800/50 border border-slate-700',
                              'rounded text-slate-200',
                              'placeholder:text-slate-600',
                              'hover:border-slate-600',
                              'focus:outline-none focus:border-slate-600',
                              'transition-colors'
                            )}
                            disabled={isCreating}
                          />

                          {/* Work Category */}
                          <InlineDropdown
                            options={categoryOptions}
                            value={subtask.workCategoryId}
                            onChange={(v) => handleSubtaskChange(subtask.id, 'workCategoryId', v)}
                            placeholder="Категория"
                            disabled={isCreating}
                          />

                          {/* Difficulty (optional) */}
                          <InlineDropdown
                            options={difficultyOptions}
                            value={subtask.difficultyId}
                            onChange={(v) => handleSubtaskChange(subtask.id, 'difficultyId', v)}
                            placeholder="Сложн."
                            disabled={isCreating}
                          />

                          {/* Planned Hours */}
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={subtask.plannedHours || ''}
                              onChange={(e) =>
                                handleSubtaskChange(
                                  subtask.id,
                                  'plannedHours',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              placeholder="0"
                              className={cn(
                                'w-full px-2 py-1.5 pr-5 text-xs text-right',
                                'bg-slate-800/50 border border-slate-700',
                                'rounded text-slate-200 font-mono',
                                'placeholder:text-slate-600',
                                'hover:border-slate-600',
                                'focus:outline-none focus:border-slate-600',
                                'transition-colors'
                              )}
                              disabled={isCreating}
                            />
                            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">
                              ч
                            </span>
                          </div>

                          {/* Remove button */}
                          <button
                            type="button"
                            onClick={() => handleRemoveSubtask(subtask.id)}
                            disabled={isCreating}
                            className={cn(
                              'p-1.5 rounded mt-0.5',
                              'text-slate-600 hover:text-red-400',
                              'hover:bg-red-500/10',
                              'transition-colors',
                              'disabled:opacity-50 disabled:cursor-not-allowed'
                            )}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Error message */}
                {error && (
                  <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-red-400 bg-red-500/10 border border-red-500/30 rounded">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-700/50">
            <div className="text-[10px] text-slate-500">
              {validSubtasks.length > 0 && (
                <span>
                  {validSubtasks.length} {validSubtasks.length === 1 ? 'задача' : 'задач'} будет создано
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                disabled={isCreating}
                className={cn(
                  'px-3 py-1.5 text-[11px] font-medium rounded',
                  'text-slate-400 hover:text-slate-300',
                  'border border-slate-700 hover:border-slate-600',
                  'bg-slate-800/50 hover:bg-slate-800',
                  'transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                Отмена
              </button>
              <button
                onClick={handleSubmit}
                disabled={!isFormValid || isCreating}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded',
                  'text-slate-900 bg-amber-500 hover:bg-amber-400',
                  'transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500'
                )}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Создание...
                  </>
                ) : (
                  <>
                    <Layers className="w-3 h-3" />
                    Создать
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
