/**
 * Budget Row Component
 *
 * Строка иерархии с информацией о бюджетах.
 * Табличная структура с группами колонок и контрастными разделами.
 */

'use client'

import React from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BudgetInlineEdit } from './BudgetInlineEdit'
import { HoursInput } from './HoursInput'
import type { HierarchyNode, HierarchyNodeType, ExpandedState } from '../types'

// ============================================================================
// Types
// ============================================================================

interface BudgetRowProps {
  /** Узел иерархии */
  node: HierarchyNode
  /** Уровень вложенности (0 = корень) */
  level: number
  /** Развёрнутые узлы */
  expanded: ExpandedState
  /** Callback для toggle узла */
  onToggle: (nodeId: string) => void
  /** Callback для раскрытия всех детей узла */
  onExpandAll?: (nodeIds: string[]) => void
  /** Средняя ставка (BYN/час) - наследуется от корня */
  hourlyRate?: number
  /** Находимся ли внутри развёрнутого раздела */
  insideSection?: boolean
  /** Приведённые часы родителя (для расчёта % от общих) */
  parentAdjustedHours?: number
}

// ============================================================================
// Constants
// ============================================================================

/** Мок средней ставки (BYN/час) */
const MOCK_HOURLY_RATE = 15

/** Мок коэффициента приведения часов (К) */
const HOURS_ADJUSTMENT_FACTOR = 1.2

/** Полные названия типов узлов */
const NODE_LABELS: Record<HierarchyNodeType, string> = {
  project: 'Проект',
  stage: 'Стадия',
  object: 'Объект',
  section: 'Раздел',
  decomposition_stage: 'Этап',
  decomposition_item: '',
}

/** Цвета для бейджей типов */
const NODE_LABEL_COLORS: Record<HierarchyNodeType, string> = {
  project: 'bg-amber-500/20 text-amber-400',
  stage: 'bg-blue-500/20 text-blue-400',
  object: 'bg-violet-500/20 text-violet-400',
  section: 'bg-teal-500/20 text-teal-400',
  decomposition_stage: 'bg-slate-600/30 text-slate-400',
  decomposition_item: '',
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Форматирует число с разделителями тысяч
 */
function formatNumber(value: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value)
}

/**
 * Собирает все ID детей узла рекурсивно
 */
function collectChildIds(node: HierarchyNode): string[] {
  const ids: string[] = []
  for (const child of node.children) {
    ids.push(child.id)
    ids.push(...collectChildIds(child))
  }
  return ids
}

// ============================================================================
// Main Component
// ============================================================================

export const BudgetRow = React.memo(function BudgetRow({
  node,
  level,
  expanded,
  onToggle,
  onExpandAll,
  hourlyRate = MOCK_HOURLY_RATE,
  insideSection = false,
  parentAdjustedHours = 0
}: BudgetRowProps) {
  const hasChildren = node.children.length > 0
  const isExpanded = expanded[node.id] ?? false

  // Определяем тип строки
  const isSection = node.type === 'section'
  const isDecompStage = node.type === 'decomposition_stage'
  const isItem = node.type === 'decomposition_item'
  const isTopLevel = node.type === 'project' || node.type === 'stage' || node.type === 'object'

  // Плановые часы
  const plannedHours = node.plannedHours || 0

  // Приведённые часы = плановые * К
  const adjustedHours = plannedHours * HOURS_ADJUSTMENT_FACTOR

  // % от общих (доля в родительских часах)
  const percentOfParent = parentAdjustedHours > 0 && adjustedHours > 0
    ? Math.round((adjustedHours / parentAdjustedHours) * 100)
    : null

  // Расчётный бюджет = приведённые часы * ставка
  const calcBudget = adjustedHours > 0 ? adjustedHours * hourlyRate : null

  // Выделенный бюджет (сумма planned_amount всех бюджетов)
  const allocatedBudget = node.budgets.reduce((sum, b) => sum + b.planned_amount, 0)

  // Распределено (сумма выделенных бюджетов всех детей рекурсивно)
  const calculateDistributedBudget = (n: HierarchyNode): number => {
    if (n.children.length === 0) {
      return n.budgets.reduce((sum, b) => sum + b.planned_amount, 0)
    }
    return n.children.reduce((sum, child) => sum + calculateDistributedBudget(child), 0)
  }
  const distributedBudget = node.children.length > 0 ? calculateDistributedBudget(node) : allocatedBudget

  // Сравнение: перебор если выделено меньше чем расчётный
  const isOverBudget = calcBudget !== null && allocatedBudget < calcBudget
  // Распределено больше чем выделено
  const isOverDistributed = distributedBudget > allocatedBudget

  // Метка типа
  const typeLabel = NODE_LABELS[node.type]
  const labelColor = NODE_LABEL_COLORS[node.type]

  // Полная иерархия отступов
  const INDENT_MAP: Record<HierarchyNodeType, number> = {
    project: 0,
    stage: 16,
    object: 32,
    section: 48,
    decomposition_stage: 64,
    decomposition_item: 80,
  }
  const indent = INDENT_MAP[node.type]

  // Стили строки в зависимости от типа
  const isProject = node.type === 'project'
  const isStageLevel = node.type === 'stage'
  const isObject = node.type === 'object'

  const rowStyles = cn(
    'group flex items-center border-b transition-colors',
    // Проект - самый верхний уровень
    isProject && 'bg-slate-800/50 border-slate-700 hover:bg-slate-800/70',
    // Стадия
    isStageLevel && 'bg-slate-850/40 border-slate-700/70 hover:bg-slate-800/50',
    // Объект
    isObject && 'bg-slate-900/50 border-slate-700/60 hover:bg-slate-900/70',
    // Разделы - бирюзовый оттенок с левой полоской
    isSection && 'bg-teal-950/40 border-slate-700/60 hover:bg-teal-950/60 border-l-2 border-l-teal-500/50',
    // Этапы декомпозиции внутри раздела - чуть выделены
    isDecompStage && insideSection && 'bg-slate-800/30 border-slate-800/50 hover:bg-slate-800/50',
    // Задачи внутри раздела - самый тёмный фон
    isItem && insideSection && 'bg-slate-900/60 border-slate-800/30 hover:bg-slate-900/80',
    // Высота строки
    'min-h-[32px]'
  )

  // Обработчик клика: для раздела раскрываем всё содержимое
  const handleToggle = () => {
    if (!hasChildren) return

    if (isSection && !isExpanded && onExpandAll) {
      // Раскрываем раздел и все его содержимое
      const allChildIds = collectChildIds(node)
      onExpandAll([node.id, ...allChildIds])
    } else {
      onToggle(node.id)
    }
  }

  return (
    <>
      {/* Main row */}
      <div className={rowStyles}>
        {/* ===== НАИМЕНОВАНИЕ ===== */}
        <div
          className="flex items-center gap-2 min-w-[400px] w-[400px] px-2 shrink-0"
          style={{ paddingLeft: `${8 + indent}px` }}
        >
          {/* Expand/collapse button */}
          <button
            onClick={handleToggle}
            className={cn(
              'w-4 h-4 flex items-center justify-center rounded transition-colors shrink-0',
              hasChildren ? 'hover:bg-slate-700 cursor-pointer' : 'opacity-0'
            )}
            disabled={!hasChildren}
          >
            {hasChildren && (
              <ChevronRight
                className={cn(
                  'h-3 w-3 text-slate-500 transition-transform duration-200',
                  isExpanded && 'rotate-90'
                )}
              />
            )}
          </button>

          {/* Type label badge (для всех кроме items) */}
          {typeLabel && (
            <span
              className={cn(
                'shrink-0 px-1.5 py-0.5 rounded text-[9px] font-medium',
                labelColor
              )}
            >
              {typeLabel}
            </span>
          )}

          {/* Name */}
          <span
            className={cn(
              'truncate text-[12px]',
              isSection && 'font-medium text-teal-200',
              isDecompStage && 'text-slate-300',
              isItem && 'text-slate-400',
              isTopLevel && 'font-medium text-slate-200'
            )}
            title={node.name}
          >
            {node.name}
          </span>
        </div>

        {/* ===== КАТЕГОРИЯ (сложность) ===== */}
        <div className="w-10 shrink-0 flex items-center justify-center">
          {isItem && node.difficulty?.abbr && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-orange-500/20 text-orange-400">
              {node.difficulty.abbr}
            </span>
          )}
        </div>

        {/* ===== ТРУДОЗАТРАТЫ ===== */}
        <div className="flex items-center shrink-0 border-l border-slate-700/30">
          {/* Плановые часы */}
          <div className="w-[72px] px-2 text-right">
            {isItem ? (
              <HoursInput
                value={plannedHours}
                dimIfZero
                // TODO: подключить мутацию для обновления
                // onChange={(newValue) => updateItemHours(node.id, newValue)}
              />
            ) : (
              <HoursInput
                value={plannedHours}
                readOnly
                dimIfZero
                bold={isSection || isTopLevel}
              />
            )}
          </div>

          {/* С коэффициентом (приведённые часы) */}
          <div className="w-[72px] px-2 text-right">
            {adjustedHours > 0 ? (
              <span className={cn(
                'text-[12px] tabular-nums',
                isSection || isTopLevel ? 'text-slate-300 font-medium' : 'text-slate-400'
              )}>
                {formatNumber(Math.round(adjustedHours))}
              </span>
            ) : (
              <span className="text-[12px] text-slate-600 tabular-nums">0</span>
            )}
          </div>

          {/* % от общих (доля в родительских часах) */}
          <div className="w-[52px] px-1 text-right">
            {percentOfParent !== null ? (
              <span className="text-[11px] tabular-nums text-slate-500">
                {percentOfParent}%
              </span>
            ) : (
              <span className="text-[11px] text-slate-700">—</span>
            )}
          </div>
        </div>

        {/* ===== СТАВКА ===== */}
        <div className="flex items-center shrink-0 border-l border-slate-700/30">
          <div className="w-[72px] px-2 text-right">
            {isSection && (
              <span className="text-[11px] text-slate-500 tabular-nums">
                {hourlyRate}
              </span>
            )}
          </div>
        </div>

        {/* ===== БЮДЖЕТЫ: Расчётный / Распределено / Выделенный ===== */}
        <div className="flex items-center flex-1 min-w-[340px] shrink-0 border-l border-slate-700/30">
          <div className="w-full flex items-center">
            {/* Расчётный */}
            <div className="w-[80px] px-1 text-right">
              {calcBudget !== null && calcBudget > 0 ? (
                <span className={cn(
                  'text-[12px] tabular-nums',
                  isSection || isTopLevel ? 'text-cyan-400 font-medium' : 'text-cyan-400/70'
                )}>
                  {formatNumber(Math.round(calcBudget))}
                </span>
              ) : (
                <span className="text-[12px] text-slate-600 tabular-nums">—</span>
              )}
            </div>
            {/* Слеш */}
            <div className="w-[10px] text-center">
              <span className="text-[11px] text-slate-700">/</span>
            </div>
            {/* Распределено */}
            <div className="w-[80px] px-1 text-center">
              {distributedBudget > 0 ? (
                <span className={cn(
                  'text-[12px] tabular-nums font-medium',
                  isOverDistributed ? 'text-red-400' : 'text-slate-300'
                )}>
                  {formatNumber(distributedBudget)}
                </span>
              ) : (
                <span className="text-[12px] text-slate-600 tabular-nums">—</span>
              )}
            </div>
            {/* Слеш */}
            <div className="w-[10px] text-center">
              <span className="text-[11px] text-slate-700">/</span>
            </div>
            {/* Выделенный - inline редактирование */}
            <div className="flex-1 px-1">
              <BudgetInlineEdit
                budgets={node.budgets}
                entityType={node.entityType}
                entityId={node.id}
                entityName={node.name}
                isOverBudget={isOverBudget}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Children (if expanded) */}
      {isExpanded &&
        node.children.map((child) => (
          <BudgetRow
            key={child.id}
            node={child}
            level={level + 1}
            expanded={expanded}
            onToggle={onToggle}
            onExpandAll={onExpandAll}
            hourlyRate={hourlyRate}
            insideSection={isSection || insideSection}
            parentAdjustedHours={adjustedHours}
          />
        ))}
    </>
  )
})
