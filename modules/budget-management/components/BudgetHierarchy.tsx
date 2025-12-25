/**
 * Budget Hierarchy Component
 *
 * Простой UI для управления бюджетами по иерархии:
 * Проект → Стадия → Объект → Раздел
 *
 * Моковые данные, без интеграции с БД
 */

'use client'

import { useState, useMemo } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Plus,
  Pencil,
  Trash2,
  Wallet,
  X,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

type EntityType = 'project' | 'stage' | 'object' | 'section'

interface Budget {
  id: string
  name: string
  type: 'Основной' | 'Премиальный' | 'Дополнительный'
  plannedAmount: number
  spentAmount: number
}

interface TreeNode {
  id: string
  name: string
  code?: string
  type: EntityType
  budgets: Budget[]
  children?: TreeNode[]
}

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_TREE: TreeNode[] = [
  {
    id: 'p1',
    name: 'П-28/24 Жилой комплекс "Минск-Сити"',
    type: 'project',
    budgets: [
      { id: 'b1', name: 'Основной бюджет проекта', type: 'Основной', plannedAmount: 450000, spentAmount: 127500 },
    ],
    children: [
      {
        id: 'st1',
        name: 'Стадия П (Проект)',
        type: 'stage',
        budgets: [
          { id: 'b2', name: 'Основной', type: 'Основной', plannedAmount: 180000, spentAmount: 54000 },
        ],
        children: [
          {
            id: 'o1',
            name: 'Жилой дом №1',
            type: 'object',
            budgets: [],
            children: [
              {
                id: 's1',
                code: 'АР',
                name: 'Архитектурные решения',
                type: 'section',
                budgets: [
                  { id: 'b3', name: 'Основной', type: 'Основной', plannedAmount: 45000, spentAmount: 18500 },
                  { id: 'b4', name: 'Премиальный', type: 'Премиальный', plannedAmount: 5000, spentAmount: 2100 },
                ],
              },
              {
                id: 's2',
                code: 'КР',
                name: 'Конструктивные решения',
                type: 'section',
                budgets: [
                  { id: 'b5', name: 'Основной', type: 'Основной', plannedAmount: 62000, spentAmount: 31000 },
                ],
              },
              {
                id: 's3',
                code: 'ОВ',
                name: 'Отопление и вентиляция',
                type: 'section',
                budgets: [],
              },
            ],
          },
          {
            id: 'o2',
            name: 'Жилой дом №2',
            type: 'object',
            budgets: [
              { id: 'b6', name: 'Основной', type: 'Основной', plannedAmount: 73000, spentAmount: 2400 },
            ],
            children: [
              {
                id: 's4',
                code: 'АР',
                name: 'Архитектурные решения',
                type: 'section',
                budgets: [],
              },
            ],
          },
        ],
      },
      {
        id: 'st2',
        name: 'Стадия Р (Рабочая документация)',
        type: 'stage',
        budgets: [],
        children: [],
      },
    ],
  },
  {
    id: 'p2',
    name: 'П-15/24 Торговый центр',
    type: 'project',
    budgets: [
      { id: 'b7', name: 'Основной', type: 'Основной', plannedAmount: 280000, spentAmount: 95000 },
    ],
    children: [],
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

// ============================================================================
// Utility Functions
// ============================================================================

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}K`
  }
  return value.toLocaleString('ru-RU')
}

// ============================================================================
// Sub-Components
// ============================================================================

interface TreeItemProps {
  node: TreeNode
  level: number
  selectedId: string | null
  expandedIds: Set<string>
  onSelect: (node: TreeNode) => void
  onToggle: (id: string) => void
}

function TreeItem({ node, level, selectedId, expandedIds, onSelect, onToggle }: TreeItemProps) {
  const isExpanded = expandedIds.has(node.id)
  const isSelected = selectedId === node.id
  const hasChildren = node.children && node.children.length > 0
  const hasBudgets = node.budgets.length > 0

  const paddingLeft = 12 + level * 16

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-1.5 h-8 pr-2 cursor-pointer transition-colors',
          isSelected
            ? 'bg-primary/10 text-primary'
            : 'hover:bg-white/5 text-white/70 hover:text-white/90'
        )}
        style={{ paddingLeft }}
        onClick={() => onSelect(node)}
      >
        {/* Expand/Collapse */}
        <button
          className={cn(
            'w-4 h-4 flex items-center justify-center shrink-0',
            !hasChildren && 'invisible'
          )}
          onClick={(e) => {
            e.stopPropagation()
            onToggle(node.id)
          }}
        >
          {isExpanded ? (
            <ChevronDown size={12} />
          ) : (
            <ChevronRight size={12} />
          )}
        </button>

        {/* Icon */}
        <span className="shrink-0">
          {isExpanded ? (
            <FolderOpen size={14} className="text-amber-400/70" />
          ) : (
            <Folder size={14} className="text-amber-400/50" />
          )}
        </span>

        {/* Code badge (for sections) */}
        {node.code && (
          <span className="shrink-0 px-1 py-0.5 rounded bg-white/10 text-[9px] font-mono">
            {node.code}
          </span>
        )}

        {/* Name */}
        <span className="flex-1 truncate text-[11px]">
          {node.name}
        </span>

        {/* Budget indicator */}
        {hasBudgets && (
          <span className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-[9px] text-emerald-400">
            <Wallet size={10} />
            {node.budgets.length}
          </span>
        )}
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface BudgetCardProps {
  budget: Budget
  onEdit: () => void
  onDelete: () => void
}

function BudgetCard({ budget, onEdit, onDelete }: BudgetCardProps) {
  const percentage = budget.plannedAmount > 0
    ? Math.min((budget.spentAmount / budget.plannedAmount) * 100, 100)
    : 0
  const remaining = budget.plannedAmount - budget.spentAmount
  const isOverBudget = remaining < 0

  return (
    <div className="p-3 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: BUDGET_TYPE_COLORS[budget.type] || '#6B7280' }}
          />
          <div>
            <div className="text-xs font-medium text-white/90">{budget.name}</div>
            <div className="text-[10px] text-white/40">{budget.type}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={onDelete}
            className="p-1 rounded hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-2">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${percentage}%`,
            backgroundColor: isOverBudget ? '#EF4444' : BUDGET_TYPE_COLORS[budget.type] || '#6B7280',
          }}
        />
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-[10px]">
        <div className="text-white/50">
          <span className="text-white/70 font-medium">{formatCurrency(budget.spentAmount)}</span>
          {' / '}
          {formatCurrency(budget.plannedAmount)} BYN
        </div>
        <div className={cn(
          'font-medium',
          isOverBudget ? 'text-red-400' : 'text-emerald-400'
        )}>
          {isOverBudget ? '' : '+'}{formatCurrency(remaining)} BYN
        </div>
      </div>
    </div>
  )
}

interface AddBudgetFormProps {
  onSave: (budget: Omit<Budget, 'id' | 'spentAmount'>) => void
  onCancel: () => void
}

function AddBudgetForm({ onSave, onCancel }: AddBudgetFormProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<Budget['type']>('Основной')
  const [amount, setAmount] = useState('')

  const canSave = name.trim() && Number(amount) > 0

  const handleSave = () => {
    if (!canSave) return
    onSave({
      name: name.trim(),
      type,
      plannedAmount: Number(amount),
    })
  }

  return (
    <div className="p-3 rounded-lg border border-primary/30 bg-primary/5">
      <div className="space-y-2.5">
        {/* Name */}
        <div>
          <label className="block text-[10px] text-white/50 mb-1">Название</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Основной бюджет"
            className="w-full px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50"
            autoFocus
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-[10px] text-white/50 mb-1">Тип</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as Budget['type'])}
            className="w-full px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded text-white focus:outline-none focus:border-primary/50"
          >
            <option value="Основной">Основной</option>
            <option value="Премиальный">Премиальный</option>
            <option value="Дополнительный">Дополнительный</option>
          </select>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-[10px] text-white/50 mb-1">Плановая сумма (BYN)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="50000"
            min={0}
            className="w-full px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={onCancel}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-white/50 hover:text-white/70 transition-colors"
          >
            <X size={12} />
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 text-[11px] rounded transition-colors',
              canSave
                ? 'bg-primary text-white hover:bg-primary/80'
                : 'bg-white/10 text-white/30 cursor-not-allowed'
            )}
          >
            <Check size={12} />
            Добавить
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function BudgetHierarchy() {
  const [tree, setTree] = useState<TreeNode[]>(MOCK_TREE)
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['p1', 'st1', 'o1']))
  const [isAddingBudget, setIsAddingBudget] = useState(false)

  const handleToggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSelect = (node: TreeNode) => {
    setSelectedNode(node)
    setIsAddingBudget(false)
  }

  const handleAddBudget = (budgetData: Omit<Budget, 'id' | 'spentAmount'>) => {
    if (!selectedNode) return

    const newBudget: Budget = {
      id: `b${Date.now()}`,
      ...budgetData,
      spentAmount: 0,
    }

    // Update tree (deep clone and modify)
    const updateNode = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.map((node) => {
        if (node.id === selectedNode.id) {
          return {
            ...node,
            budgets: [...node.budgets, newBudget],
          }
        }
        if (node.children) {
          return {
            ...node,
            children: updateNode(node.children),
          }
        }
        return node
      })
    }

    setTree(updateNode(tree))
    setSelectedNode({
      ...selectedNode,
      budgets: [...selectedNode.budgets, newBudget],
    })
    setIsAddingBudget(false)
  }

  const handleDeleteBudget = (budgetId: string) => {
    if (!selectedNode) return

    const updateNode = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.map((node) => {
        if (node.id === selectedNode.id) {
          return {
            ...node,
            budgets: node.budgets.filter((b) => b.id !== budgetId),
          }
        }
        if (node.children) {
          return {
            ...node,
            children: updateNode(node.children),
          }
        }
        return node
      })
    }

    setTree(updateNode(tree))
    setSelectedNode({
      ...selectedNode,
      budgets: selectedNode.budgets.filter((b) => b.id !== budgetId),
    })
  }

  // Calculate totals for selected node
  const totals = useMemo(() => {
    if (!selectedNode) return null
    const planned = selectedNode.budgets.reduce((sum, b) => sum + b.plannedAmount, 0)
    const spent = selectedNode.budgets.reduce((sum, b) => sum + b.spentAmount, 0)
    return { planned, spent, remaining: planned - spent }
  }, [selectedNode])

  return (
    <div className="h-full flex bg-zinc-950">
      {/* Left Panel - Tree */}
      <div className="w-[320px] shrink-0 border-r border-white/10 flex flex-col">
        {/* Header */}
        <div className="shrink-0 px-3 py-2 border-b border-white/10 bg-zinc-900/50">
          <h2 className="text-xs font-medium text-white/70">Структура проектов</h2>
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-y-auto py-1">
          {tree.map((node) => (
            <TreeItem
              key={node.id}
              node={node}
              level={0}
              selectedId={selectedNode?.id || null}
              expandedIds={expandedIds}
              onSelect={handleSelect}
              onToggle={handleToggle}
            />
          ))}
        </div>
      </div>

      {/* Right Panel - Budgets */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedNode ? (
          <>
            {/* Header */}
            <div className="shrink-0 px-4 py-3 border-b border-white/10 bg-zinc-900/50">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="px-1.5 py-0.5 rounded bg-white/10 text-[9px] text-white/50 uppercase">
                      {ENTITY_TYPE_LABELS[selectedNode.type]}
                    </span>
                    {selectedNode.code && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-[10px] text-amber-400 font-mono">
                        {selectedNode.code}
                      </span>
                    )}
                  </div>
                  <h2 className="text-sm font-medium text-white/90">{selectedNode.name}</h2>
                </div>

                <button
                  onClick={() => setIsAddingBudget(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
                >
                  <Plus size={12} />
                  Добавить бюджет
                </button>
              </div>

              {/* Totals */}
              {totals && totals.planned > 0 && (
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/5">
                  <div>
                    <div className="text-[10px] text-white/40">План</div>
                    <div className="text-sm font-semibold text-white/90 tabular-nums">
                      {formatCurrency(totals.planned)} BYN
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-white/40">Потрачено</div>
                    <div className="text-sm font-semibold text-violet-400 tabular-nums">
                      {formatCurrency(totals.spent)} BYN
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-white/40">Остаток</div>
                    <div className={cn(
                      'text-sm font-semibold tabular-nums',
                      totals.remaining >= 0 ? 'text-emerald-400' : 'text-red-400'
                    )}>
                      {totals.remaining >= 0 ? '+' : ''}{formatCurrency(totals.remaining)} BYN
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {/* Add budget form */}
                {isAddingBudget && (
                  <AddBudgetForm
                    onSave={handleAddBudget}
                    onCancel={() => setIsAddingBudget(false)}
                  />
                )}

                {/* Existing budgets */}
                {selectedNode.budgets.map((budget) => (
                  <BudgetCard
                    key={budget.id}
                    budget={budget}
                    onEdit={() => {
                      // TODO: Edit functionality
                      console.log('Edit budget:', budget.id)
                    }}
                    onDelete={() => handleDeleteBudget(budget.id)}
                  />
                ))}

                {/* Empty state */}
                {selectedNode.budgets.length === 0 && !isAddingBudget && (
                  <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
                    <Wallet className="w-10 h-10 text-white/20 mb-3" />
                    <div className="text-sm text-white/50 mb-1">Нет бюджетов</div>
                    <div className="text-xs text-white/30 mb-4">
                      Добавьте бюджет для {ENTITY_TYPE_LABELS[selectedNode.type].toLowerCase()}а
                    </div>
                    <button
                      onClick={() => setIsAddingBudget(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-dashed border-white/20 text-white/50 hover:border-primary/50 hover:text-primary transition-colors"
                    >
                      <Plus size={14} />
                      Добавить бюджет
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          /* No selection state */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <Folder className="w-12 h-12 text-white/20 mb-4" />
            <div className="text-sm text-white/50 mb-1">Выберите элемент</div>
            <div className="text-xs text-white/30 max-w-[240px]">
              Выберите проект, стадию, объект или раздел в дереве слева для управления бюджетами
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default BudgetHierarchy
