/**
 * Budget Create Popover Component (V2)
 *
 * Простой popover для создания бюджета:
 * - Вводим сумму → создаётся бюджет с основной частью (main)
 * - Родительский бюджет ищется автоматически
 *
 * Дизайн в стиле Resource Graph модалки (slate-900, amber акценты).
 */

'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { Loader2, Wallet, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useCreateBudget } from '@/modules/budgets'
import type { BudgetEntityType } from '@/modules/budgets/types'
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
  /** Существующие бюджеты (для проверки — у сущности уже есть бюджет?) */
  existingBudgets: BudgetInfo[]
  /** Триггер (кнопка открытия) */
  trigger?: React.ReactNode
  /** Callback после создания */
  onCreated?: () => void
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
  const [amountString, setAmountString] = useState('')
  const [budgetName, setBudgetName] = useState('')

  // Проверяем есть ли уже бюджет у сущности (в V2 один бюджет на сущность)
  const hasExistingBudget = existingBudgets.some((b) => b.is_active)

  // Hooks
  const { mutate: createBudget, isPending: isCreating } = useCreateBudget()

  // Сумма
  const amount = useMemo(() => parseAmount(amountString), [amountString])

  // Валидация формы
  const isFormValid = useMemo(() => {
    return amount > 0
  }, [amount])

  // Сброс при открытии/закрытии
  useEffect(() => {
    if (isOpen) {
      setAmountString('')
      setBudgetName('')
    }
  }, [isOpen])

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

  // Создание бюджета
  const handleCreate = useCallback(() => {
    if (!isFormValid) return

    createBudget(
      {
        entity_type: entityType,
        entity_id: entityId,
        name: budgetName.trim() || 'Бюджет',
        total_amount: amount,
        // parent_budget_id определяется автоматически в action
      },
      {
        onSuccess: () => {
          setIsOpen(false)
          onCreated?.()
        },
      }
    )
  }, [isFormValid, entityType, entityId, budgetName, amount, createBudget, onCreated])

  // Если бюджет уже есть — не показываем popover
  if (hasExistingBudget) {
    return null
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>

      <PopoverContent
        className={cn(
          'w-72 p-0',
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
            <span className="text-[11px] font-medium text-slate-300">Создать бюджет</span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-0.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-3 py-2.5 space-y-2.5">
          {/* Entity info */}
          <div className="text-[10px] text-slate-400">
            {ENTITY_TYPE_LABELS[entityType]}: <span className="text-slate-300">{entityName}</span>
          </div>

          {/* Budget Name (optional) */}
          <div>
            <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">
              Название <span className="text-slate-600">(опционально)</span>
            </label>
            <input
              type="text"
              value={budgetName}
              onChange={(e) => setBudgetName(e.target.value)}
              placeholder="Бюджет"
              className={cn(
                'w-full px-2 py-1.5 text-[11px]',
                'bg-slate-800/50 border border-slate-700',
                'rounded text-slate-200',
                'placeholder:text-slate-600',
                'focus:outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600/50',
                'transition-colors'
              )}
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">
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

          {/* Info */}
          <div className="text-[10px] text-slate-500 leading-relaxed">
            Бюджет создаётся с основной частью (main). Премиальную часть можно добавить позже.
          </div>
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
