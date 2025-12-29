/**
 * Budget Create Popover Component
 *
 * Popover для создания нового бюджета прямо в строке иерархии.
 * Дизайн в стиле Resource Graph модалки (slate-900, amber акценты).
 */

'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { Plus, Check, Loader2, Wallet, Link2, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  useCreateBudget,
  useBudgetTypes,
  useFindParentBudgetCandidates,
} from '@/modules/budgets'
import type { BudgetEntityType, BudgetCurrent } from '@/modules/budgets/types'
import { formatAmount } from '../utils'
import type { BudgetInfo } from '../types'

// ============================================================================
// Types
// ============================================================================

interface BudgetCreatePopoverProps {
  /** Тип сущности */
  entityType: BudgetEntityType
  /** ID сущности */
  entityId: string
  /** Название сущности (для отображения) */
  entityName: string
  /** Существующие бюджеты (для проверки дубликатов) */
  existingBudgets: BudgetInfo[]
  /** Триггер (кнопка открытия) */
  trigger?: React.ReactNode
  /** Callback после создания */
  onCreated?: () => void
}

const MAIN_BUDGET_TYPE_NAME = 'Основной'

// Названия типов сущностей на русском
const ENTITY_TYPE_LABELS: Record<BudgetEntityType, string> = {
  section: 'Раздел',
  object: 'Объект',
  stage: 'Стадия',
  project: 'Проект',
}

// ============================================================================
// Helpers
// ============================================================================

function parseAmount(value: string): number {
  const cleaned = value.replace(/\s/g, '').replace(',', '.')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

// ============================================================================
// Main Component
// ============================================================================

export function BudgetCreatePopover({
  entityType,
  entityId,
  entityName,
  existingBudgets,
  trigger,
  onCreated,
}: BudgetCreatePopoverProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedTypeId, setSelectedTypeId] = useState('')
  const [amountString, setAmountString] = useState('')
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null)
  const [showParentDropdown, setShowParentDropdown] = useState(false)

  // Hooks
  const { data: budgetTypes = [], isLoading: typesLoading } = useBudgetTypes()
  const { data: parentCandidates = [], isLoading: parentsLoading } = useFindParentBudgetCandidates(
    entityType,
    entityId,
    selectedTypeId || undefined
  )
  const { mutate: createBudget, isPending: isCreating } = useCreateBudget()

  // Активные типы бюджетов (исключаем "Основной" — он создаётся автоматически)
  const activeTypes = useMemo(
    () => budgetTypes.filter((t) => t.is_active && t.name !== MAIN_BUDGET_TYPE_NAME),
    [budgetTypes]
  )

  // Выбранный тип
  const selectedType = useMemo(
    () => activeTypes.find((t) => t.type_id === selectedTypeId),
    [activeTypes, selectedTypeId]
  )

  // "Основной" бюджет создаётся автоматически, проверка не нужна

  // Выбранный родитель
  const selectedParent = useMemo(
    () => parentCandidates.find((p) => p.budget_id === selectedParentId),
    [parentCandidates, selectedParentId]
  )

  // Сумма
  const amount = useMemo(() => parseAmount(amountString), [amountString])

  // Валидация формы
  const isFormValid = useMemo(() => {
    return selectedTypeId !== '' && amount > 0
  }, [selectedTypeId, amount])

  // Сброс при открытии/закрытии
  useEffect(() => {
    if (isOpen) {
      setSelectedTypeId('')
      setAmountString('')
      setSelectedParentId(null)
      setShowParentDropdown(false)
    }
  }, [isOpen])

  // Авто-выбор первого родителя
  useEffect(() => {
    if (parentCandidates.length > 0 && !selectedParentId) {
      setSelectedParentId(parentCandidates[0].budget_id)
    }
  }, [parentCandidates, selectedParentId])

  // Обработка изменения суммы
  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    const cleaned = raw.replace(/[^\d\s,\.]/g, '')
    setAmountString(cleaned)
  }, [])

  const handleAmountBlur = useCallback(() => {
    if (amount > 0) {
      setAmountString(formatCurrency(amount))
    }
  }, [amount])

  // Выбор родителя
  const handleParentSelect = useCallback((parent: BudgetCurrent | null) => {
    setSelectedParentId(parent?.budget_id || null)
    setShowParentDropdown(false)
  }, [])

  // Создание бюджета
  const handleCreate = useCallback(() => {
    if (!isFormValid || !selectedType) return

    createBudget(
      {
        entity_type: entityType,
        entity_id: entityId,
        name: selectedType.name,
        planned_amount: amount,
        budget_type_id: selectedTypeId,
        parent_budget_id: selectedParentId,
      },
      {
        onSuccess: () => {
          setIsOpen(false)
          onCreated?.()
        },
      }
    )
  }, [
    isFormValid,
    selectedType,
    entityType,
    entityId,
    amount,
    selectedTypeId,
    selectedParentId,
    createBudget,
    onCreated,
  ])

  // Проекты не имеют родителей
  const showParentOption = entityType !== 'project'
  const isLoading = typesLoading

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <button
            className={cn(
              'w-5 h-5 flex items-center justify-center rounded',
              'text-muted-foreground hover:text-foreground hover:bg-muted',
              'transition-colors'
            )}
            title="Добавить бюджет"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </PopoverTrigger>

      <PopoverContent
        className={cn(
          'w-80 p-0',
          'bg-slate-900/95 backdrop-blur-md',
          'border border-slate-700/50',
          'shadow-2xl shadow-black/50'
        )}
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <Wallet className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[11px] font-medium text-slate-300">Добавить бюджет</span>
            <span className="text-[10px] text-slate-500">·</span>
            <span className="text-[10px] text-slate-400 truncate max-w-[120px]" title={entityName}>
              {ENTITY_TYPE_LABELS[entityType]}: {entityName}
            </span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-0.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-3 py-2.5">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
            </div>
          ) : (
            <div className="space-y-2.5">
              {/* Budget Type Selector */}
              <div>
                <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1.5">
                  Тип бюджета
                </label>
                <div className="flex flex-wrap gap-1">
                  {activeTypes.map((type) => {
                    const isSelected = selectedTypeId === type.type_id

                    return (
                      <button
                        key={type.type_id}
                        type="button"
                        onClick={() => setSelectedTypeId(type.type_id)}
                        className={cn(
                          'flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium',
                          'border transition-all duration-150',
                          isSelected
                            ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                            : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                        )}
                        title={type.name}
                      >
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: type.color || '#6b7280' }}
                        />
                        {type.name}
                        {isSelected && <Check className="w-3 h-3 text-amber-500" />}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Parent Budget (показываем только если выбран тип и это не проект) */}
              {selectedTypeId && showParentOption && (
                <div>
                  <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1.5">
                    Родительский бюджет
                  </label>
                  {parentsLoading ? (
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Поиск...</span>
                    </div>
                  ) : parentCandidates.length === 0 ? (
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <Link2 className="w-3 h-3" />
                      <span>Нет родительского бюджета</span>
                    </div>
                  ) : (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowParentDropdown(!showParentDropdown)}
                        className={cn(
                          'w-full flex items-center justify-between px-2 py-1.5 text-[11px]',
                          'bg-slate-800/50 border border-slate-700 rounded',
                          'text-slate-200 hover:border-slate-600',
                          'transition-colors'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Link2 className="w-3 h-3 text-slate-500" />
                          {selectedParent ? (
                            <>
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: selectedParent.type_color || '#6b7280' }}
                              />
                              <span className="truncate max-w-[100px]">{selectedParent.name}</span>
                              <span className="text-slate-500 text-[10px]">
                                ({ENTITY_TYPE_LABELS[selectedParent.entity_type]})
                              </span>
                            </>
                          ) : (
                            <span className="text-slate-500">Без родителя</span>
                          )}
                        </div>
                        <ChevronDown className={cn(
                          'w-3 h-3 text-slate-500 transition-transform',
                          showParentDropdown && 'rotate-180'
                        )} />
                      </button>

                      {/* Dropdown */}
                      {showParentDropdown && (
                        <div className={cn(
                          'absolute top-full left-0 right-0 mt-1 z-10',
                          'bg-slate-800 border border-slate-700 rounded',
                          'shadow-lg shadow-black/50',
                          'max-h-28 overflow-y-auto'
                        )}>
                          {/* Option: No parent */}
                          <button
                            type="button"
                            onClick={() => handleParentSelect(null)}
                            className={cn(
                              'w-full flex items-center gap-2 px-2 py-1.5 text-[11px] text-left',
                              'hover:bg-slate-700/50 transition-colors',
                              !selectedParentId && 'bg-slate-700/30'
                            )}
                          >
                            <Link2 className="w-3 h-3 text-slate-500" />
                            <span className="text-slate-400">Без родителя</span>
                          </button>

                          {/* Parent candidates */}
                          {parentCandidates.map((parent) => (
                            <button
                              key={parent.budget_id}
                              type="button"
                              onClick={() => handleParentSelect(parent)}
                              className={cn(
                                'w-full flex items-center gap-2 px-2 py-1.5 text-[11px] text-left',
                                'hover:bg-slate-700/50 transition-colors',
                                selectedParentId === parent.budget_id && 'bg-slate-700/30'
                              )}
                            >
                              <div
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: parent.type_color || '#6b7280' }}
                              />
                              <span className="text-slate-200 truncate">{parent.name}</span>
                              <span className="text-slate-500 text-[10px] shrink-0">
                                ({ENTITY_TYPE_LABELS[parent.entity_type]})
                              </span>
                              <span className="ml-auto text-slate-600 font-mono text-[10px] shrink-0">
                                {formatAmount(parent.planned_amount)}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Amount */}
              {selectedTypeId && (
                <div>
                  <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1.5">
                    Плановая сумма
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={amountString}
                      onChange={handleAmountChange}
                      onBlur={handleAmountBlur}
                      placeholder="0"
                      className={cn(
                        'w-full px-2 py-1.5 pr-10 text-[11px] text-right',
                        'bg-slate-800/50 border border-slate-700',
                        'rounded text-slate-200 font-mono',
                        'placeholder:text-slate-600',
                        'focus:outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600/50',
                        'transition-colors'
                      )}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">
                      BYN
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-slate-700/50">
          <button
            onClick={() => setIsOpen(false)}
            className={cn(
              'px-2.5 py-1 text-[11px] font-medium rounded',
              'text-slate-400 hover:text-slate-300',
              'border border-slate-700 hover:border-slate-600',
              'bg-slate-800/50 hover:bg-slate-800',
              'transition-colors'
            )}
          >
            Отмена
          </button>
          <button
            onClick={handleCreate}
            disabled={!isFormValid || isCreating}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded',
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
                <Wallet className="w-3 h-3" />
                Создать
              </>
            )}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
