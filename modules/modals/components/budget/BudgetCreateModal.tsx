'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { X, Wallet, AlertCircle, Check, Loader2, Link2, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useBudgetTypes,
  useBudgetsByEntity,
  useCreateBudget,
  useFindParentBudgetCandidates,
} from '@/modules/budgets'
import type { BudgetEntityType, BudgetCurrent } from '@/modules/budgets/types'
import type { BaseModalProps } from '../../types'

// ============================================================================
// Types
// ============================================================================

export interface BudgetCreateModalProps extends BaseModalProps {
  /** Тип сущности (section, object, stage, project) */
  entityType: BudgetEntityType
  /** ID сущности */
  entityId: string
  /** Отображаемое название сущности */
  entityName: string
}

// Названия типов сущностей на русском
const ENTITY_TYPE_LABELS: Record<BudgetEntityType, string> = {
  section: 'Раздел',
  object: 'Объект',
  stage: 'Стадия',
  project: 'Проект',
}

// Имя "Основного" бюджета для проверки уникальности
const MAIN_BUDGET_TYPE_NAME = 'Основной'

// ============================================================================
// Helpers
// ============================================================================

/**
 * Форматирует число как валюту (без символа)
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Парсит строку в число (убирая пробелы и запятые)
 */
function parseCurrency(value: string): number {
  const cleaned = value.replace(/\s/g, '').replace(',', '.')
  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? 0 : parsed
}

// ============================================================================
// Component
// ============================================================================

export function BudgetCreateModal({
  isOpen,
  onClose,
  onSuccess,
  entityType,
  entityId,
  entityName,
}: BudgetCreateModalProps) {
  // Form state
  const [selectedTypeId, setSelectedTypeId] = useState<string>('')
  const [budgetName, setBudgetName] = useState('')
  const [amountString, setAmountString] = useState('')
  const [comment, setComment] = useState('')
  const [hasInteractedWithName, setHasInteractedWithName] = useState(false)
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null)
  const [showParentDropdown, setShowParentDropdown] = useState(false)

  // Queries
  const { data: budgetTypes = [], isLoading: typesLoading } = useBudgetTypes()
  const { data: existingBudgets = [], isLoading: budgetsLoading } = useBudgetsByEntity(
    entityType,
    entityId
  )

  // Parent budget candidates (только когда выбран тип)
  const { data: parentCandidates = [], isLoading: parentLoading } = useFindParentBudgetCandidates(
    entityType,
    entityId,
    selectedTypeId || undefined
  )

  // Mutation
  const { mutate: createBudget, isPending: isCreating } = useCreateBudget()

  // Derived state
  const selectedType = useMemo(
    () => budgetTypes.find((t) => t.type_id === selectedTypeId),
    [budgetTypes, selectedTypeId]
  )

  const isMainBudgetType = selectedType?.name === MAIN_BUDGET_TYPE_NAME

  const hasExistingMainBudget = useMemo(
    () => existingBudgets.some((b) => b.type_name === MAIN_BUDGET_TYPE_NAME && b.is_active),
    [existingBudgets]
  )

  const canCreateMainBudget = !hasExistingMainBudget || !isMainBudgetType

  const amount = useMemo(() => parseCurrency(amountString), [amountString])

  // Выбранный родительский бюджет
  const selectedParent = useMemo(
    () => parentCandidates.find((p) => p.budget_id === selectedParentId),
    [parentCandidates, selectedParentId]
  )

  const isFormValid = useMemo(() => {
    return (
      selectedTypeId.trim() !== '' &&
      budgetName.trim() !== '' &&
      amount > 0 &&
      canCreateMainBudget
    )
  }, [selectedTypeId, budgetName, amount, canCreateMainBudget])

  // Auto-fill budget name when type selected (if user hasn't manually edited)
  useEffect(() => {
    if (selectedType && !hasInteractedWithName) {
      setBudgetName(selectedType.name)
    }
  }, [selectedType, hasInteractedWithName])

  // Auto-select first parent candidate when type changes
  useEffect(() => {
    if (parentCandidates.length > 0) {
      setSelectedParentId(parentCandidates[0].budget_id)
    } else {
      setSelectedParentId(null)
    }
  }, [parentCandidates])

  // Reset form on open
  useEffect(() => {
    if (isOpen) {
      setSelectedTypeId('')
      setBudgetName('')
      setAmountString('')
      setComment('')
      setHasInteractedWithName(false)
      setSelectedParentId(null)
      setShowParentDropdown(false)
    }
  }, [isOpen])

  // Handlers
  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setBudgetName(e.target.value)
    setHasInteractedWithName(true)
  }, [])

  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    // Allow only numbers, spaces, commas and dots
    const cleaned = raw.replace(/[^\d\s,\.]/g, '')
    setAmountString(cleaned)
  }, [])

  const handleAmountBlur = useCallback(() => {
    // Format on blur for better UX
    if (amount > 0) {
      setAmountString(formatCurrency(amount))
    }
  }, [amount])

  const handleParentSelect = useCallback((parent: BudgetCurrent | null) => {
    setSelectedParentId(parent?.budget_id || null)
    setShowParentDropdown(false)
  }, [])

  const handleSubmit = useCallback(() => {
    if (!isFormValid || isCreating) return

    createBudget(
      {
        entity_type: entityType,
        entity_id: entityId,
        name: budgetName.trim(),
        planned_amount: amount,
        comment: comment.trim() || undefined,
        budget_type_id: selectedTypeId,
        parent_budget_id: selectedParentId,
      },
      {
        onSuccess: () => {
          onSuccess?.()
          onClose()
        },
      }
    )
  }, [
    isFormValid,
    isCreating,
    createBudget,
    entityType,
    entityId,
    budgetName,
    amount,
    comment,
    selectedTypeId,
    selectedParentId,
    onSuccess,
    onClose,
  ])

  const isLoading = typesLoading || budgetsLoading

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
              <Wallet className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-medium text-slate-300">Добавить бюджет</span>
              <span className="text-[10px] text-slate-500">·</span>
              <span className="text-[10px] text-slate-400 truncate max-w-[200px]" title={entityName}>
                {ENTITY_TYPE_LABELS[entityType]}: {entityName}
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
          <div className="px-4 py-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
              </div>
            ) : (
              <div className="space-y-3">
                {/* Budget Type Selector */}
                <div>
                  <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1.5">
                    Тип бюджета
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {budgetTypes
                      .filter((t) => t.is_active)
                      .map((type) => {
                        const isSelected = selectedTypeId === type.type_id
                        const isMain = type.name === MAIN_BUDGET_TYPE_NAME
                        const isDisabled = isMain && hasExistingMainBudget

                        return (
                          <button
                            key={type.type_id}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => setSelectedTypeId(type.type_id)}
                            className={cn(
                              'flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium',
                              'border transition-all duration-150',
                              isSelected
                                ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                                : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-300',
                              isDisabled && 'opacity-40 cursor-not-allowed'
                            )}
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

                  {/* Warning for main budget */}
                  {isMainBudgetType && hasExistingMainBudget && (
                    <div className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-500/80">
                      <AlertCircle className="h-3 w-3" />
                      <span>Основной бюджет уже создан</span>
                    </div>
                  )}
                </div>

                {/* Parent Budget (показываем только если выбран тип и это не проект) */}
                {selectedTypeId && entityType !== 'project' && (
                  <div>
                    <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1.5">
                      Родительский бюджет
                    </label>
                    {parentLoading ? (
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
                            'w-full flex items-center justify-between px-2.5 py-1.5 text-xs',
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
                                <span>{selectedParent.name}</span>
                                <span className="text-slate-500">
                                  ({ENTITY_TYPE_LABELS[selectedParent.entity_type]})
                                </span>
                              </>
                            ) : (
                              <span className="text-slate-500">Выберите родителя...</span>
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
                            'max-h-32 overflow-y-auto'
                          )}>
                            {/* Option: No parent */}
                            <button
                              type="button"
                              onClick={() => handleParentSelect(null)}
                              className={cn(
                                'w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left',
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
                                  'w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left',
                                  'hover:bg-slate-700/50 transition-colors',
                                  selectedParentId === parent.budget_id && 'bg-slate-700/30'
                                )}
                              >
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: parent.type_color || '#6b7280' }}
                                />
                                <span className="text-slate-200">{parent.name}</span>
                                <span className="text-slate-500">
                                  ({ENTITY_TYPE_LABELS[parent.entity_type]})
                                </span>
                                <span className="ml-auto text-slate-600 font-mono">
                                  {formatCurrency(parent.planned_amount)} BYN
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Two column layout for name, amount, comment */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Left column */}
                  <div className="space-y-3">
                    {/* Budget Name */}
                    <div>
                      <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1.5">
                        Название
                      </label>
                      <input
                        type="text"
                        value={budgetName}
                        onChange={handleNameChange}
                        placeholder="Название бюджета"
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

                  {/* Right column */}
                  <div className="space-y-3">
                    {/* Amount */}
                    <div>
                      <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1.5">
                        Сумма
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
                            'w-full px-2.5 py-1.5 pr-8 text-xs text-right',
                            'bg-slate-800/50 border border-slate-700',
                            'rounded text-slate-200 font-mono',
                            'placeholder:text-slate-600',
                            'focus:outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600/50',
                            'transition-colors'
                          )}
                          disabled={isCreating}
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">
                          BYN
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Comment - full width */}
                <div>
                  <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1.5">
                    Комментарий
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Необязательно..."
                    rows={2}
                    className={cn(
                      'w-full px-2.5 py-1.5 text-xs',
                      'bg-slate-800/50 border border-slate-700',
                      'rounded text-slate-200 resize-none',
                      'placeholder:text-slate-600',
                      'focus:outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600/50',
                      'transition-colors'
                    )}
                    disabled={isCreating}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-slate-700/50">
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
                  <Wallet className="w-3 h-3" />
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
