/**
 * Budget Overview Component
 *
 * Обзор всех бюджетов:
 * - Таблица со всеми бюджетами
 * - Treemap визуализация
 */

'use client'

import { useState, useMemo } from 'react'
import {
  Table2,
  LayoutGrid,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

type EntityType = 'project' | 'stage' | 'object' | 'section'
type ViewMode = 'table' | 'treemap'
type SortField = 'name' | 'entity' | 'type' | 'planned' | 'spent' | 'remaining' | 'progress'
type SortDir = 'asc' | 'desc'

interface BudgetItem {
  id: string
  name: string
  type: 'Основной' | 'Премиальный' | 'Дополнительный'
  entityType: EntityType
  entityName: string
  entityPath: string // полный путь: Проект > Стадия > Объект > Раздел
  plannedAmount: number
  spentAmount: number
}

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_BUDGETS: BudgetItem[] = [
  // Проект 1
  {
    id: 'b1',
    name: 'Основной бюджет проекта',
    type: 'Основной',
    entityType: 'project',
    entityName: 'П-28/24 Жилой комплекс',
    entityPath: 'П-28/24 Жилой комплекс',
    plannedAmount: 450000,
    spentAmount: 127500,
  },
  {
    id: 'b2',
    name: 'Основной',
    type: 'Основной',
    entityType: 'stage',
    entityName: 'Стадия П (Проект)',
    entityPath: 'П-28/24 > Стадия П',
    plannedAmount: 180000,
    spentAmount: 54000,
  },
  {
    id: 'b3',
    name: 'Основной',
    type: 'Основной',
    entityType: 'section',
    entityName: 'АР - Архитектурные решения',
    entityPath: 'П-28/24 > Стадия П > Дом №1 > АР',
    plannedAmount: 45000,
    spentAmount: 18500,
  },
  {
    id: 'b4',
    name: 'Премиальный фонд',
    type: 'Премиальный',
    entityType: 'section',
    entityName: 'АР - Архитектурные решения',
    entityPath: 'П-28/24 > Стадия П > Дом №1 > АР',
    plannedAmount: 5000,
    spentAmount: 2100,
  },
  {
    id: 'b5',
    name: 'Основной',
    type: 'Основной',
    entityType: 'section',
    entityName: 'КР - Конструктивные решения',
    entityPath: 'П-28/24 > Стадия П > Дом №1 > КР',
    plannedAmount: 62000,
    spentAmount: 31000,
  },
  {
    id: 'b6',
    name: 'Дополнительные работы',
    type: 'Дополнительный',
    entityType: 'section',
    entityName: 'КР - Конструктивные решения',
    entityPath: 'П-28/24 > Стадия П > Дом №1 > КР',
    plannedAmount: 8000,
    spentAmount: 8500,
  },
  {
    id: 'b7',
    name: 'Основной',
    type: 'Основной',
    entityType: 'object',
    entityName: 'Жилой дом №2',
    entityPath: 'П-28/24 > Стадия П > Дом №2',
    plannedAmount: 73000,
    spentAmount: 24000,
  },
  {
    id: 'b8',
    name: 'Основной',
    type: 'Основной',
    entityType: 'section',
    entityName: 'ОВ - Отопление и вентиляция',
    entityPath: 'П-28/24 > Стадия П > Дом №1 > ОВ',
    plannedAmount: 38000,
    spentAmount: 12000,
  },
  // Проект 2
  {
    id: 'b9',
    name: 'Основной',
    type: 'Основной',
    entityType: 'project',
    entityName: 'П-15/24 Торговый центр',
    entityPath: 'П-15/24 Торговый центр',
    plannedAmount: 280000,
    spentAmount: 95000,
  },
  {
    id: 'b10',
    name: 'Премиальный',
    type: 'Премиальный',
    entityType: 'project',
    entityName: 'П-15/24 Торговый центр',
    entityPath: 'П-15/24 Торговый центр',
    plannedAmount: 25000,
    spentAmount: 8000,
  },
  {
    id: 'b11',
    name: 'Основной',
    type: 'Основной',
    entityType: 'section',
    entityName: 'ЭС - Электроснабжение',
    entityPath: 'П-15/24 > Стадия П > ЭС',
    plannedAmount: 52000,
    spentAmount: 28000,
  },
  {
    id: 'b12',
    name: 'Основной',
    type: 'Основной',
    entityType: 'section',
    entityName: 'ВК - Водоснабжение',
    entityPath: 'П-15/24 > Стадия П > ВК',
    plannedAmount: 41000,
    spentAmount: 15000,
  },
]

const BUDGET_TYPE_COLORS: Record<string, string> = {
  'Основной': '#1E7260',
  'Премиальный': '#F59E0B',
  'Дополнительный': '#6366F1',
}

const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  project: 'Проект',
  stage: 'Стадия',
  object: 'Объект',
  section: 'Раздел',
}

const ENTITY_TYPE_COLORS: Record<EntityType, string> = {
  project: '#3B82F6',
  stage: '#8B5CF6',
  object: '#EC4899',
  section: '#10B981',
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`
  }
  if (value >= 1000) {
    return `${Math.round(value / 1000)}K`
  }
  return value.toLocaleString('ru-RU')
}

function getProgress(planned: number, spent: number): number {
  if (planned === 0) return 0
  return Math.round((spent / planned) * 100)
}

// ============================================================================
// Table Component
// ============================================================================

interface TableViewProps {
  budgets: BudgetItem[]
}

function TableView({ budgets }: TableViewProps) {
  const [sortField, setSortField] = useState<SortField>('planned')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const sortedBudgets = useMemo(() => {
    return [...budgets].sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name)
          break
        case 'entity':
          cmp = a.entityName.localeCompare(b.entityName)
          break
        case 'type':
          cmp = a.type.localeCompare(b.type)
          break
        case 'planned':
          cmp = a.plannedAmount - b.plannedAmount
          break
        case 'spent':
          cmp = a.spentAmount - b.spentAmount
          break
        case 'remaining':
          cmp = (a.plannedAmount - a.spentAmount) - (b.plannedAmount - b.spentAmount)
          break
        case 'progress':
          cmp = getProgress(a.plannedAmount, a.spentAmount) - getProgress(b.plannedAmount, b.spentAmount)
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [budgets, sortField, sortDir])

  const totals = useMemo(() => {
    const planned = budgets.reduce((sum, b) => sum + b.plannedAmount, 0)
    const spent = budgets.reduce((sum, b) => sum + b.spentAmount, 0)
    return { planned, spent, remaining: planned - spent }
  }, [budgets])

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="text-white/20" />
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="text-primary" />
      : <ChevronDown size={12} className="text-primary" />
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className="bg-zinc-900/95 backdrop-blur-sm border-b border-white/10">
            <th
              className="text-left px-3 py-2 text-[10px] font-medium text-white/50 uppercase tracking-wider cursor-pointer hover:text-white/70"
              onClick={() => handleSort('name')}
            >
              <div className="flex items-center gap-1">
                Бюджет <SortIcon field="name" />
              </div>
            </th>
            <th
              className="text-left px-3 py-2 text-[10px] font-medium text-white/50 uppercase tracking-wider cursor-pointer hover:text-white/70"
              onClick={() => handleSort('entity')}
            >
              <div className="flex items-center gap-1">
                Сущность <SortIcon field="entity" />
              </div>
            </th>
            <th
              className="text-left px-3 py-2 text-[10px] font-medium text-white/50 uppercase tracking-wider cursor-pointer hover:text-white/70"
              onClick={() => handleSort('type')}
            >
              <div className="flex items-center gap-1">
                Тип <SortIcon field="type" />
              </div>
            </th>
            <th
              className="text-right px-3 py-2 text-[10px] font-medium text-white/50 uppercase tracking-wider cursor-pointer hover:text-white/70"
              onClick={() => handleSort('planned')}
            >
              <div className="flex items-center justify-end gap-1">
                План <SortIcon field="planned" />
              </div>
            </th>
            <th
              className="text-right px-3 py-2 text-[10px] font-medium text-white/50 uppercase tracking-wider cursor-pointer hover:text-white/70"
              onClick={() => handleSort('spent')}
            >
              <div className="flex items-center justify-end gap-1">
                Потрачено <SortIcon field="spent" />
              </div>
            </th>
            <th
              className="text-right px-3 py-2 text-[10px] font-medium text-white/50 uppercase tracking-wider cursor-pointer hover:text-white/70"
              onClick={() => handleSort('remaining')}
            >
              <div className="flex items-center justify-end gap-1">
                Остаток <SortIcon field="remaining" />
              </div>
            </th>
            <th
              className="text-center px-3 py-2 text-[10px] font-medium text-white/50 uppercase tracking-wider cursor-pointer hover:text-white/70 w-[140px]"
              onClick={() => handleSort('progress')}
            >
              <div className="flex items-center justify-center gap-1">
                Прогресс <SortIcon field="progress" />
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedBudgets.map((budget) => {
            const remaining = budget.plannedAmount - budget.spentAmount
            const progress = getProgress(budget.plannedAmount, budget.spentAmount)
            const isOverBudget = remaining < 0

            return (
              <tr
                key={budget.id}
                className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
              >
                {/* Бюджет */}
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: BUDGET_TYPE_COLORS[budget.type] }}
                    />
                    <span className="text-xs text-white/90">{budget.name}</span>
                  </div>
                </td>

                {/* Сущность */}
                <td className="px-3 py-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="px-1 py-0.5 rounded text-[9px] font-medium"
                        style={{
                          backgroundColor: `${ENTITY_TYPE_COLORS[budget.entityType]}20`,
                          color: ENTITY_TYPE_COLORS[budget.entityType]
                        }}
                      >
                        {ENTITY_TYPE_LABELS[budget.entityType]}
                      </span>
                      <span className="text-xs text-white/70">{budget.entityName}</span>
                    </div>
                    <div className="text-[10px] text-white/30 mt-0.5">{budget.entityPath}</div>
                  </div>
                </td>

                {/* Тип */}
                <td className="px-3 py-2">
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                    style={{
                      backgroundColor: `${BUDGET_TYPE_COLORS[budget.type]}20`,
                      color: BUDGET_TYPE_COLORS[budget.type]
                    }}
                  >
                    {budget.type}
                  </span>
                </td>

                {/* План */}
                <td className="px-3 py-2 text-right">
                  <span className="text-xs text-white/90 tabular-nums font-medium">
                    {formatCurrency(budget.plannedAmount)}
                  </span>
                  <span className="text-[10px] text-white/40 ml-1">BYN</span>
                </td>

                {/* Потрачено */}
                <td className="px-3 py-2 text-right">
                  <span className="text-xs text-violet-400 tabular-nums font-medium">
                    {formatCurrency(budget.spentAmount)}
                  </span>
                  <span className="text-[10px] text-white/40 ml-1">BYN</span>
                </td>

                {/* Остаток */}
                <td className="px-3 py-2 text-right">
                  <span className={cn(
                    'text-xs tabular-nums font-medium',
                    isOverBudget ? 'text-red-400' : 'text-emerald-400'
                  )}>
                    {isOverBudget ? '' : '+'}{formatCurrency(remaining)}
                  </span>
                  <span className="text-[10px] text-white/40 ml-1">BYN</span>
                </td>

                {/* Прогресс */}
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(progress, 100)}%`,
                          backgroundColor: isOverBudget ? '#EF4444' : progress > 80 ? '#F59E0B' : '#22C55E',
                        }}
                      />
                    </div>
                    <span className={cn(
                      'text-[10px] tabular-nums font-medium w-8 text-right',
                      isOverBudget ? 'text-red-400' : progress > 80 ? 'text-amber-400' : 'text-emerald-400'
                    )}>
                      {progress}%
                    </span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot className="sticky bottom-0">
          <tr className="bg-zinc-900/95 backdrop-blur-sm border-t border-white/10">
            <td colSpan={3} className="px-3 py-2">
              <span className="text-xs font-semibold text-white/70 uppercase">
                Итого ({budgets.length} бюджетов)
              </span>
            </td>
            <td className="px-3 py-2 text-right">
              <span className="text-sm text-white font-bold tabular-nums">
                {formatCurrency(totals.planned)}
              </span>
              <span className="text-[10px] text-white/40 ml-1">BYN</span>
            </td>
            <td className="px-3 py-2 text-right">
              <span className="text-sm text-violet-400 font-bold tabular-nums">
                {formatCurrency(totals.spent)}
              </span>
              <span className="text-[10px] text-white/40 ml-1">BYN</span>
            </td>
            <td className="px-3 py-2 text-right">
              <span className={cn(
                'text-sm font-bold tabular-nums',
                totals.remaining >= 0 ? 'text-emerald-400' : 'text-red-400'
              )}>
                {totals.remaining >= 0 ? '+' : ''}{formatCurrency(totals.remaining)}
              </span>
              <span className="text-[10px] text-white/40 ml-1">BYN</span>
            </td>
            <td className="px-3 py-2">
              <div className="flex items-center justify-center gap-1">
                {totals.remaining >= 0 ? (
                  <TrendingUp size={14} className="text-emerald-400" />
                ) : (
                  <TrendingDown size={14} className="text-red-400" />
                )}
                <span className={cn(
                  'text-xs font-bold',
                  totals.remaining >= 0 ? 'text-emerald-400' : 'text-red-400'
                )}>
                  {getProgress(totals.planned, totals.spent)}%
                </span>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ============================================================================
// Treemap Component
// ============================================================================

interface TreemapViewProps {
  budgets: BudgetItem[]
}

function TreemapView({ budgets }: TreemapViewProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  // Group by project (first part of path)
  const groupedByProject = useMemo(() => {
    const groups: Record<string, { name: string; budgets: BudgetItem[]; total: number }> = {}

    budgets.forEach(b => {
      const projectName = b.entityPath.split(' > ')[0]
      if (!groups[projectName]) {
        groups[projectName] = { name: projectName, budgets: [], total: 0 }
      }
      groups[projectName].budgets.push(b)
      groups[projectName].total += b.plannedAmount
    })

    return Object.values(groups).sort((a, b) => b.total - a.total)
  }, [budgets])

  const maxTotal = Math.max(...groupedByProject.map(g => g.total))

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {groupedByProject.map((group) => (
          <div
            key={group.name}
            className="rounded-lg border border-white/10 bg-white/[0.02] overflow-hidden"
          >
            {/* Project Header */}
            <div className="px-3 py-2 border-b border-white/10 bg-white/[0.02]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-white/90">{group.name}</span>
                <span className="text-xs text-white/50 tabular-nums">
                  {formatCurrency(group.total)} BYN
                </span>
              </div>
            </div>

            {/* Treemap Grid */}
            <div className="p-2">
              <div
                className="grid gap-1"
                style={{
                  gridTemplateColumns: `repeat(auto-fill, minmax(100px, 1fr))`,
                }}
              >
                {group.budgets
                  .sort((a, b) => b.plannedAmount - a.plannedAmount)
                  .map((budget) => {
                    const progress = getProgress(budget.plannedAmount, budget.spentAmount)
                    const isOverBudget = budget.spentAmount > budget.plannedAmount
                    const isHovered = hoveredId === budget.id
                    // Size based on relative amount within group
                    const relativeSize = (budget.plannedAmount / group.total) * 100
                    const minHeight = 60
                    const maxHeight = 120
                    const height = Math.max(minHeight, Math.min(maxHeight, minHeight + relativeSize))

                    return (
                      <div
                        key={budget.id}
                        className={cn(
                          'relative rounded-md overflow-hidden cursor-pointer transition-all',
                          isHovered ? 'ring-2 ring-primary scale-[1.02] z-10' : ''
                        )}
                        style={{
                          height,
                          backgroundColor: `${BUDGET_TYPE_COLORS[budget.type]}15`,
                        }}
                        onMouseEnter={() => setHoveredId(budget.id)}
                        onMouseLeave={() => setHoveredId(null)}
                      >
                        {/* Progress fill */}
                        <div
                          className="absolute bottom-0 left-0 right-0 transition-all"
                          style={{
                            height: `${Math.min(progress, 100)}%`,
                            backgroundColor: isOverBudget
                              ? 'rgba(239, 68, 68, 0.3)'
                              : `${BUDGET_TYPE_COLORS[budget.type]}40`,
                          }}
                        />

                        {/* Content */}
                        <div className="relative h-full p-2 flex flex-col justify-between">
                          <div>
                            <div
                              className="text-[10px] font-medium truncate"
                              style={{ color: BUDGET_TYPE_COLORS[budget.type] }}
                            >
                              {budget.name}
                            </div>
                            <div className="text-[9px] text-white/40 truncate">
                              {budget.entityName}
                            </div>
                          </div>

                          <div className="flex items-end justify-between">
                            <span className="text-[10px] text-white/70 font-medium tabular-nums">
                              {formatCurrency(budget.plannedAmount)}
                            </span>
                            <span className={cn(
                              'text-[9px] font-bold tabular-nums',
                              isOverBudget ? 'text-red-400' : 'text-white/50'
                            )}>
                              {progress}%
                            </span>
                          </div>
                        </div>

                        {/* Hover tooltip */}
                        {isHovered && (
                          <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full z-20 px-2 py-1.5 rounded bg-zinc-800 border border-white/10 shadow-xl whitespace-nowrap">
                            <div className="text-[10px] text-white/90 font-medium mb-1">{budget.name}</div>
                            <div className="flex items-center gap-3 text-[9px]">
                              <span className="text-white/50">
                                План: <span className="text-white/90">{formatCurrency(budget.plannedAmount)}</span>
                              </span>
                              <span className="text-white/50">
                                Факт: <span className="text-violet-400">{formatCurrency(budget.spentAmount)}</span>
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-white/10">
        {Object.entries(BUDGET_TYPE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: color }}
            />
            <span className="text-[10px] text-white/50">{type}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function BudgetOverview() {
  const [viewMode, setViewMode] = useState<ViewMode>('table')

  // Summary stats
  const stats = useMemo(() => {
    const planned = MOCK_BUDGETS.reduce((sum, b) => sum + b.plannedAmount, 0)
    const spent = MOCK_BUDGETS.reduce((sum, b) => sum + b.spentAmount, 0)
    const overBudget = MOCK_BUDGETS.filter(b => b.spentAmount > b.plannedAmount).length

    return {
      count: MOCK_BUDGETS.length,
      planned,
      spent,
      remaining: planned - spent,
      overBudget
    }
  }, [])

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-white/10 bg-zinc-900/50">
        <div className="flex items-center justify-between">
          {/* Stats */}
          <div className="flex items-center gap-6">
            <div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider">Всего бюджетов</div>
              <div className="text-lg font-bold text-white tabular-nums">{stats.count}</div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider">Общий план</div>
              <div className="text-lg font-bold text-white tabular-nums">{formatCurrency(stats.planned)} <span className="text-xs font-normal text-white/40">BYN</span></div>
            </div>
            <div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider">Потрачено</div>
              <div className="text-lg font-bold text-violet-400 tabular-nums">{formatCurrency(stats.spent)} <span className="text-xs font-normal text-white/40">BYN</span></div>
            </div>
            <div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider">Остаток</div>
              <div className={cn(
                'text-lg font-bold tabular-nums',
                stats.remaining >= 0 ? 'text-emerald-400' : 'text-red-400'
              )}>
                {stats.remaining >= 0 ? '+' : ''}{formatCurrency(stats.remaining)} <span className="text-xs font-normal text-white/40">BYN</span>
              </div>
            </div>
            {stats.overBudget > 0 && (
              <>
                <div className="w-px h-8 bg-white/10" />
                <div>
                  <div className="text-[10px] text-white/40 uppercase tracking-wider">Превышено</div>
                  <div className="text-lg font-bold text-red-400 tabular-nums">{stats.overBudget}</div>
                </div>
              </>
            )}
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5">
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] font-medium transition-colors',
                viewMode === 'table'
                  ? 'bg-white/10 text-white'
                  : 'text-white/50 hover:text-white/70'
              )}
            >
              <Table2 size={14} />
              Таблица
            </button>
            <button
              onClick={() => setViewMode('treemap')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] font-medium transition-colors',
                viewMode === 'treemap'
                  ? 'bg-white/10 text-white'
                  : 'text-white/50 hover:text-white/70'
              )}
            >
              <LayoutGrid size={14} />
              Карта
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'table' ? (
        <TableView budgets={MOCK_BUDGETS} />
      ) : (
        <TreemapView budgets={MOCK_BUDGETS} />
      )}
    </div>
  )
}

export default BudgetOverview
