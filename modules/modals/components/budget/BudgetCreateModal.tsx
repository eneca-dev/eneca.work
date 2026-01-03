'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { X, Wallet, Loader2, Link2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useBudgetsByEntity,
  useCreateBudget,
  useFindParentBudget,
} from '@/modules/budgets'
import type { BudgetEntityType } from '@/modules/budgets/types'
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
  const [amountString, setAmountString] = useState('')
  const [budgetName, setBudgetName] = useState('Бюджет')

  // Queries
  const { data: existingBudgets = [], isLoading: budgetsLoading } = useBudgetsByEntity(
    entityType,
    entityId
  )

  // Parent budget (автоматически находится в иерархии)
  const { data: parentBudget, isLoading: parentLoading } = useFindParentBudget(
    entityType,
    entityId
  )

  // Mutation
  const { mutate: createBudget, isPending: isCreating } = useCreateBudget()

  // Derived state
  const hasExistingBudget = existingBudgets.some((b) => b.is_active)
  const amount = useMemo(() => parseCurrency(amountString), [amountString])

  const isFormValid = useMemo(() => {
    return amount > 0 && !hasExistingBudget
  }, [amount, hasExistingBudget])

  // Reset form on open
  useEffect(() => {
    if (isOpen) {
      setAmountString('')
      setBudgetName('Бюджет')
    }
  }, [isOpen])

  // Handlers
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

  const handleSubmit = useCallback(() => {
    if (!isFormValid || isCreating) return

    createBudget(
      {
        entity_type: entityType,
        entity_id: entityId,
        name: budgetName.trim() || 'Бюджет',
        total_amount: amount,
        parent_budget_id: parentBudget?.budget_id || null,
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
    parentBudget,
    onSuccess,
    onClose,
  ])

  const isLoading = budgetsLoading || parentLoading

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
            'pointer-events-auto w-full max-w-md',
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
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-300 dark:border-slate-700/50">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Создать бюджет</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">·</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[200px]" title={entityName}>
                {ENTITY_TYPE_LABELS[entityType]}: {entityName}
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
          <div className="px-4 py-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400 dark:text-slate-500" />
              </div>
            ) : hasExistingBudget ? (
              <div className="text-center py-6">
                <div className="text-amber-600 dark:text-amber-500/80 text-sm mb-2">
                  Бюджет уже существует
                </div>
                <p className="text-slate-500 text-xs">
                  У этой сущности уже есть активный бюджет.
                  <br />
                  Отредактируйте существующий бюджет.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Parent budget info */}
                {parentBudget && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 px-3 py-2 rounded">
                    <Link2 className="w-3 h-3" />
                    <span>Родитель:</span>
                    <span className="text-slate-700 dark:text-slate-300">{parentBudget.name}</span>
                    <span className="text-slate-500">
                      ({formatCurrency(parentBudget.total_amount)} BYN)
                    </span>
                  </div>
                )}

                {/* Budget Name */}
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                    Название
                  </label>
                  <input
                    type="text"
                    value={budgetName}
                    onChange={(e) => setBudgetName(e.target.value)}
                    placeholder="Бюджет"
                    className={cn(
                      'w-full px-3 py-2 text-sm',
                      'bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700',
                      'rounded text-slate-800 dark:text-slate-200',
                      'placeholder:text-slate-400 dark:placeholder:text-slate-600',
                      'focus:outline-none focus:border-slate-400 dark:focus:border-slate-600 focus:ring-1 focus:ring-slate-400/50 dark:focus:ring-slate-600/50',
                      'transition-colors'
                    )}
                    disabled={isCreating}
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                    Сумма бюджета
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={amountString}
                      onChange={handleAmountChange}
                      onBlur={handleAmountBlur}
                      placeholder="0"
                      autoFocus
                      className={cn(
                        'w-full px-3 py-2 pr-12 text-sm text-right',
                        'bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700',
                        'rounded text-slate-800 dark:text-slate-200 font-mono',
                        'placeholder:text-slate-400 dark:placeholder:text-slate-600',
                        'focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30',
                        'transition-colors'
                      )}
                      disabled={isCreating}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 dark:text-slate-500">
                      BYN
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-slate-300 dark:border-slate-700/50">
            <button
              onClick={onClose}
              disabled={isCreating}
              className={cn(
                'px-3 py-1.5 text-[11px] font-medium rounded',
                'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300',
                'border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600',
                'bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-800',
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
