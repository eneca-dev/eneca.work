/**
 * Budget Parts Editor Component
 *
 * Popover для управления частями бюджета (main, premium, custom).
 * Позволяет:
 * - Видеть распределение бюджета по частям
 * - Добавлять premium или custom части
 * - Редактировать проценты/суммы частей
 * - Удалять части (кроме main)
 *
 * Дизайн в стиле Resource Graph модалки (slate-900, amber акценты).
 */

'use client'

import { useState, useCallback, useMemo } from 'react'
import { Plus, Trash2, Loader2, PieChart, AlertCircle, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  useBudgetFull,
  useAddBudgetPart,
  useUpdateBudgetPart,
  useDeleteBudgetPart,
} from '@/modules/budgets'
import type { BudgetPart, BudgetPartType } from '@/modules/budgets'

// ============================================================================
// Types
// ============================================================================

interface BudgetPartsEditorProps {
  /** ID бюджета */
  budgetId: string
  /** Общая сумма бюджета */
  totalAmount: number
  /** Триггер (кнопка открытия) */
  trigger?: React.ReactNode
  /** Callback после изменения */
  onChanged?: () => void
}

// Названия типов частей
const PART_TYPE_LABELS: Record<BudgetPartType, string> = {
  main: 'Основной',
  premium: 'Премиальный',
  custom: 'Дополнительный',
}

// Цвета по умолчанию для типов
const PART_TYPE_COLORS: Record<BudgetPartType, string> = {
  main: '#1E7260',
  premium: '#F59E0B',
  custom: '#6366F1',
}

// ============================================================================
// Helpers
// ============================================================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function parsePercentage(value: string): number {
  const cleaned = value.replace(/[^\d,\.]/g, '').replace(',', '.')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : Math.min(100, Math.max(0, num))
}

// ============================================================================
// Part Row Component
// ============================================================================

interface PartRowProps {
  part: BudgetPart
  budgetId: string
  totalAmount: number
  isMain: boolean
  onDelete?: () => void
}

function PartRow({ part, budgetId, totalAmount, isMain, onDelete }: PartRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [localPercentage, setLocalPercentage] = useState(
    part.percentage?.toString() || '0'
  )

  const { mutate: updatePart, isPending: isUpdating } = useUpdateBudgetPart()

  const calculatedAmount = useMemo(() => {
    if (part.fixed_amount) return part.fixed_amount
    if (part.percentage) return Math.round((part.percentage / 100) * totalAmount)
    return 0
  }, [part, totalAmount])

  const handleSave = useCallback(() => {
    const newPercentage = parsePercentage(localPercentage)
    if (newPercentage !== part.percentage) {
      updatePart({
        part_id: part.part_id,
        budget_id: budgetId,
        percentage: newPercentage,
        // fixed_amount автоматически станет NULL в action
      })
    }
    setIsEditing(false)
  }, [localPercentage, part, budgetId, updatePart])

  const handleCancel = useCallback(() => {
    setLocalPercentage(part.percentage?.toString() || '0')
    setIsEditing(false)
  }, [part])

  const color = part.color || PART_TYPE_COLORS[part.part_type]

  return (
    <div className={cn(
      'flex items-center gap-2 px-2 py-1.5 rounded',
      'bg-muted/30 hover:bg-muted/50',
      'transition-colors group'
    )}>
      {/* Color indicator */}
      <div
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />

      {/* Name */}
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-foreground truncate">
          {part.custom_name || PART_TYPE_LABELS[part.part_type]}
        </div>
        {part.requires_approval && (
          <div className="text-[9px] text-amber-500/80">Требует согласования</div>
        )}
      </div>

      {/* Percentage / Amount */}
      {isEditing ? (
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={localPercentage}
            onChange={(e) => setLocalPercentage(e.target.value)}
            className={cn(
              'w-12 h-5 px-1 text-[10px] text-right font-mono',
              'bg-muted border border-border rounded',
              'text-foreground focus:outline-none focus:border-amber-500/50'
            )}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') handleCancel()
            }}
          />
          <span className="text-[9px] text-muted-foreground">%</span>
          <button
            onClick={handleSave}
            disabled={isUpdating}
            className="p-0.5 text-green-500 hover:bg-muted rounded"
          >
            {isUpdating ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Check className="w-3 h-3" />
            )}
          </button>
          <button
            onClick={handleCancel}
            className="p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={() => !isMain && setIsEditing(true)}
            disabled={isMain}
            className={cn(
              'text-[10px] font-mono px-1.5 py-0.5 rounded',
              isMain
                ? 'text-muted-foreground cursor-default'
                : 'text-foreground hover:bg-muted cursor-pointer'
            )}
          >
            {part.percentage !== null ? (
              <span>{part.percentage}%</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </button>

          <span className="text-[10px] font-mono text-muted-foreground">
            {formatCurrency(calculatedAmount)} BYN
          </span>

          {/* Delete button (not for main) */}
          {!isMain && (
            <button
              onClick={onDelete}
              className={cn(
                'p-0.5 text-muted-foreground/50 hover:text-destructive',
                'hover:bg-muted rounded',
                'opacity-0 group-hover:opacity-100 transition-opacity'
              )}
              title="Удалить"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Add Part Form
// ============================================================================

interface AddPartFormProps {
  budgetId: string
  existingTypes: BudgetPartType[]
  onClose: () => void
}

function AddPartForm({ budgetId, existingTypes, onClose }: AddPartFormProps) {
  const [partType, setPartType] = useState<'premium' | 'custom'>('premium')
  const [percentage, setPercentage] = useState('20')
  const [customName, setCustomName] = useState('')
  const [requiresApproval, setRequiresApproval] = useState(true)

  const { mutate: addPart, isPending } = useAddBudgetPart()

  const hasPremium = existingTypes.includes('premium')
  const availableTypes = hasPremium ? ['custom'] : ['premium', 'custom']

  const handleAdd = useCallback(() => {
    const pct = parsePercentage(percentage)
    if (pct <= 0) return

    addPart(
      {
        budget_id: budgetId,
        part_type: partType,
        percentage: pct,
        custom_name: partType === 'custom' ? customName || undefined : undefined,
        requires_approval: requiresApproval,
        color: PART_TYPE_COLORS[partType],
      },
      {
        onSuccess: () => onClose(),
      }
    )
  }, [budgetId, partType, percentage, customName, requiresApproval, addPart, onClose])

  return (
    <div className="space-y-2 p-2 bg-muted/50 rounded-lg border border-border/50">
      {/* Part type selector */}
      <div className="flex gap-1">
        {availableTypes.map((type) => (
          <button
            key={type}
            onClick={() => setPartType(type as 'premium' | 'custom')}
            className={cn(
              'flex-1 px-2 py-1 text-[10px] font-medium rounded',
              'border transition-colors',
              partType === type
                ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                : 'border-border bg-muted/50 text-muted-foreground hover:border-muted-foreground/50'
            )}
          >
            <div
              className="inline-block w-2 h-2 rounded-full mr-1.5"
              style={{ backgroundColor: PART_TYPE_COLORS[type as BudgetPartType] }}
            />
            {PART_TYPE_LABELS[type as BudgetPartType]}
          </button>
        ))}
      </div>

      {/* Custom name for custom type */}
      {partType === 'custom' && (
        <input
          type="text"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="Название части"
          className={cn(
            'w-full px-2 py-1 text-[10px]',
            'bg-muted border border-border rounded',
            'text-foreground placeholder:text-muted-foreground/50',
            'focus:outline-none focus:border-muted-foreground/50'
          )}
        />
      )}

      {/* Percentage input */}
      <div className="flex items-center gap-2">
        <label className="text-[10px] text-muted-foreground">Процент:</label>
        <input
          type="text"
          value={percentage}
          onChange={(e) => setPercentage(e.target.value)}
          className={cn(
            'w-16 px-2 py-1 text-[10px] text-right font-mono',
            'bg-muted border border-border rounded',
            'text-foreground focus:outline-none focus:border-muted-foreground/50'
          )}
        />
        <span className="text-[10px] text-muted-foreground">%</span>
      </div>

      {/* Requires approval checkbox */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={requiresApproval}
          onChange={(e) => setRequiresApproval(e.target.checked)}
          className="w-3 h-3 rounded border-border bg-muted text-amber-500 focus:ring-0 focus:ring-offset-0"
        />
        <span className="text-[10px] text-muted-foreground">Требует согласования</span>
      </label>

      {/* Actions */}
      <div className="flex justify-end gap-1.5 pt-1">
        <button
          onClick={onClose}
          className={cn(
            'px-2 py-1 text-[10px] rounded',
            'text-muted-foreground hover:text-foreground',
            'border border-border hover:border-muted-foreground/50'
          )}
        >
          Отмена
        </button>
        <button
          onClick={handleAdd}
          disabled={isPending || parsePercentage(percentage) <= 0}
          className={cn(
            'px-2 py-1 text-[10px] font-medium rounded',
            'text-slate-900 bg-amber-500 hover:bg-amber-400',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {isPending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            'Добавить'
          )}
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function BudgetPartsEditor({
  budgetId,
  totalAmount,
  trigger,
  onChanged,
}: BudgetPartsEditorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  const { data: budget, isLoading } = useBudgetFull(budgetId, {
    enabled: isOpen,
  })
  const { mutate: deletePart, isPending: isDeleting } = useDeleteBudgetPart()

  const parts = budget?.parts || []
  const existingTypes = parts.map((p) => p.part_type)

  // Calculate total percentage
  const totalPercentage = useMemo(() => {
    return parts.reduce((sum, p) => sum + (p.percentage || 0), 0)
  }, [parts])

  const isOverAllocated = totalPercentage > 100

  const handleDeletePart = useCallback((partId: string) => {
    deletePart(
      { part_id: partId, budget_id: budgetId },
      {
        onSuccess: () => onChanged?.(),
      }
    )
  }, [deletePart, budgetId, onChanged])

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <button
            className={cn(
              'flex items-center gap-1 px-1.5 py-0.5 rounded',
              'text-[10px] text-muted-foreground hover:text-foreground',
              'hover:bg-muted transition-colors'
            )}
            title="Управление частями бюджета"
          >
            <PieChart className="w-3 h-3" />
            <span>Части</span>
          </button>
        )}
      </PopoverTrigger>

      <PopoverContent
        className={cn(
          'w-80 p-0',
          'bg-card/95 backdrop-blur-md',
          'border border-border/50',
          'shadow-2xl shadow-black/50'
        )}
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <PieChart className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[11px] font-medium text-foreground">Распределение бюджета</span>
          </div>
          <div className="text-[10px] font-mono text-muted-foreground">
            {formatCurrency(totalAmount)} BYN
          </div>
        </div>

        {/* Body */}
        <div className="px-3 py-2.5">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2">
              {/* Percentage indicator */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">Распределено:</span>
                <span className={cn(
                  'text-[10px] font-mono',
                  isOverAllocated ? 'text-destructive' : 'text-foreground'
                )}>
                  {totalPercentage}%
                  {isOverAllocated && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertCircle className="inline w-3 h-3 ml-1 text-destructive" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <span className="text-[10px]">Сумма процентов превышает 100%</span>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                {parts.map((part, index) => (
                  <div
                    key={part.part_id}
                    className="h-full float-left transition-all"
                    style={{
                      width: `${Math.min(part.percentage || 0, 100 - parts.slice(0, index).reduce((s, p) => s + (p.percentage || 0), 0))}%`,
                      backgroundColor: part.color || PART_TYPE_COLORS[part.part_type],
                    }}
                  />
                ))}
              </div>

              {/* Parts list */}
              <div className="space-y-1 pt-1">
                {parts.map((part) => (
                  <PartRow
                    key={part.part_id}
                    part={part}
                    budgetId={budgetId}
                    totalAmount={totalAmount}
                    isMain={part.part_type === 'main'}
                    onDelete={() => handleDeletePart(part.part_id)}
                  />
                ))}
              </div>

              {/* Add part form or button */}
              {showAddForm ? (
                <AddPartForm
                  budgetId={budgetId}
                  existingTypes={existingTypes}
                  onClose={() => setShowAddForm(false)}
                />
              ) : (
                <button
                  onClick={() => setShowAddForm(true)}
                  className={cn(
                    'w-full flex items-center justify-center gap-1.5 px-2 py-1.5 mt-2',
                    'text-[10px] text-muted-foreground hover:text-foreground',
                    'border border-dashed border-border hover:border-muted-foreground/50',
                    'rounded transition-colors'
                  )}
                >
                  <Plus className="w-3 h-3" />
                  Добавить часть
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t border-border/50">
          <div className="text-[9px] text-muted-foreground leading-relaxed">
            <strong className="text-muted-foreground">Основной</strong> — базовые расходы.{' '}
            <strong className="text-amber-500/80">Премиальный</strong> — требует согласования.
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
