/**
 * Budget Management - Main Table Component
 *
 * Иерархия: Проект → Стадия → Объект → Раздел → Этап → Задача
 * С колонкой компактных баров бюджетов для каждого уровня
 */

'use client'

import { useState, useMemo } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

type EmployeeCategory = 'К' | 'ВС' | 'ГС'

interface Budget {
  id: string
  name: string
  type: 'Основной' | 'Премиальный' | 'Дополнительный'
  planned: number
  spent: number
}

interface Task {
  id: string
  name: string
  category: EmployeeCategory
  plannedHours: number
}

interface DecompStage {
  id: string
  name: string
  tasks: Task[]
}

interface Section {
  id: string
  code: string
  name: string
  budgets: Budget[]
  stages: DecompStage[]
}

interface ProjectObject {
  id: string
  name: string
  budgets: Budget[]
  sections: Section[]
}

interface ProjectStage {
  id: string
  name: string
  budgets: Budget[]
  objects: ProjectObject[]
}

interface Project {
  id: string
  name: string
  budgets: Budget[]
  stages: ProjectStage[]
}

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_DATA: Project[] = [
  {
    id: 'p1',
    name: 'П-28/24 Жилой комплекс "Минск-Сити"',
    budgets: [
      { id: 'b1', name: 'Основной', type: 'Основной', planned: 450000, spent: 127500 },
      { id: 'b2', name: 'Премиальный', type: 'Премиальный', planned: 35000, spent: 12000 },
    ],
    stages: [
      {
        id: 'ps1',
        name: 'Стадия П (Проект)',
        budgets: [
          { id: 'b3', name: 'Основной', type: 'Основной', planned: 280000, spent: 95000 },
        ],
        objects: [
          {
            id: 'o1',
            name: 'Жилой дом №1 (корпус А)',
            budgets: [
              { id: 'b4', name: 'Основной', type: 'Основной', planned: 145000, spent: 52000 },
            ],
            sections: [
              {
                id: 's1',
                code: 'АР',
                name: 'Архитектурные решения',
                budgets: [
                  { id: 'b5', name: 'Основной', type: 'Основной', planned: 45000, spent: 18500 },
                  { id: 'b6', name: 'Премиальный', type: 'Премиальный', planned: 5000, spent: 2100 },
                ],
                stages: [
                  {
                    id: 'ds1',
                    name: '1.1 Курирование',
                    tasks: [
                      { id: 't1', name: 'Совещания и координация', category: 'ГС', plannedHours: 80 },
                      { id: 't2', name: 'Контроль качества', category: 'ГС', plannedHours: 40 },
                    ],
                  },
                  {
                    id: 'ds2',
                    name: '1.2 Моделирование LOD200',
                    tasks: [
                      { id: 't3', name: 'Объёмно-планировочное решение', category: 'ВС', plannedHours: 160 },
                      { id: 't4', name: 'Функциональное зонирование', category: 'ВС', plannedHours: 80 },
                    ],
                  },
                ],
              },
              {
                id: 's2',
                code: 'КР',
                name: 'Конструктивные решения',
                budgets: [
                  { id: 'b7', name: 'Основной', type: 'Основной', planned: 62000, spent: 31000 },
                  { id: 'b8', name: 'Доп. работы', type: 'Дополнительный', planned: 8000, spent: 8500 },
                ],
                stages: [
                  {
                    id: 'ds3',
                    name: '2.1 Расчёт конструкций',
                    tasks: [
                      { id: 't5', name: 'Статический расчёт', category: 'ВС', plannedHours: 200 },
                      { id: 't6', name: 'Динамический расчёт', category: 'ВС', plannedHours: 120 },
                    ],
                  },
                ],
              },
              {
                id: 's3',
                code: 'ОВ',
                name: 'Отопление и вентиляция',
                budgets: [
                  { id: 'b9', name: 'Основной', type: 'Основной', planned: 38000, spent: 12000 },
                ],
                stages: [
                  {
                    id: 'ds4',
                    name: '3.1 Расчёт систем',
                    tasks: [
                      { id: 't7', name: 'Теплотехнический расчёт', category: 'ВС', plannedHours: 60 },
                    ],
                  },
                ],
              },
            ],
          },
          {
            id: 'o2',
            name: 'Жилой дом №2 (корпус Б)',
            budgets: [
              { id: 'b10', name: 'Основной', type: 'Основной', planned: 135000, spent: 43000 },
            ],
            sections: [
              {
                id: 's4',
                code: 'АР',
                name: 'Архитектурные решения',
                budgets: [
                  { id: 'b11', name: 'Основной', type: 'Основной', planned: 42000, spent: 15000 },
                ],
                stages: [
                  {
                    id: 'ds5',
                    name: '1.1 Курирование',
                    tasks: [
                      { id: 't8', name: 'Совещания', category: 'ГС', plannedHours: 60 },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'ps2',
        name: 'Стадия Р (Рабочая документация)',
        budgets: [
          { id: 'b12', name: 'Основной', type: 'Основной', planned: 170000, spent: 32500 },
        ],
        objects: [],
      },
    ],
  },
  {
    id: 'p2',
    name: 'П-15/24 Торговый центр',
    budgets: [
      { id: 'b13', name: 'Основной', type: 'Основной', planned: 280000, spent: 95000 },
    ],
    stages: [
      {
        id: 'ps3',
        name: 'Стадия П',
        budgets: [],
        objects: [
          {
            id: 'o3',
            name: 'Торговый блок',
            budgets: [
              { id: 'b14', name: 'Основной', type: 'Основной', planned: 180000, spent: 65000 },
            ],
            sections: [
              {
                id: 's5',
                code: 'ЭС',
                name: 'Электроснабжение',
                budgets: [
                  { id: 'b15', name: 'Основной', type: 'Основной', planned: 52000, spent: 28000 },
                ],
                stages: [],
              },
            ],
          },
        ],
      },
    ],
  },
]

const BUDGET_COLORS: Record<string, string> = {
  'Основной': '#1E7260',
  'Премиальный': '#F59E0B',
  'Дополнительный': '#6366F1',
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatCurrency(value: number): string {
  return value.toLocaleString('ru-RU', { maximumFractionDigits: 0 })
}

function getTotalBudget(budgets: Budget[]): number {
  return budgets.reduce((sum, b) => sum + b.planned, 0)
}

function formatHours(value: number): string {
  return value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })
}

function calcTotalHours(stages: DecompStage[]): number {
  return stages.reduce((sum, stage) =>
    sum + stage.tasks.reduce((s, t) => s + t.plannedHours, 0), 0)
}

// ============================================================================
// Sub-Components
// ============================================================================

/** Компактные бары бюджетов с суммами и процентом от родителя */
function BudgetBars({
  budgets,
  parentTotal = 0,
  maxWidth = 100
}: {
  budgets: Budget[]
  parentTotal?: number
  maxWidth?: number
}) {
  if (budgets.length === 0) {
    return <span className="text-[10px] text-white/20">—</span>
  }

  const total = getTotalBudget(budgets)
  const percentOfParent = parentTotal > 0 ? Math.round((total / parentTotal) * 100) : null

  return (
    <div className="flex items-center gap-3">
      {/* Bars */}
      <div className="flex flex-col gap-0.5" style={{ width: maxWidth }}>
        {budgets.map((budget) => {
          const progress = budget.planned > 0 ? (budget.spent / budget.planned) * 100 : 0
          const isOver = budget.spent > budget.planned

          return (
            <div
              key={budget.id}
              className="group relative"
              title={`${budget.name}: ${formatCurrency(budget.spent)} / ${formatCurrency(budget.planned)} BYN`}
            >
              {/* Background bar (planned) */}
              <div
                className="h-2 rounded-sm overflow-hidden"
                style={{ backgroundColor: `${BUDGET_COLORS[budget.type]}20` }}
              >
                {/* Progress bar (spent) */}
                <div
                  className="h-full rounded-sm transition-all"
                  style={{
                    width: `${Math.min(progress, 100)}%`,
                    backgroundColor: isOver ? '#EF4444' : BUDGET_COLORS[budget.type],
                  }}
                />
              </div>

              {/* Label on hover */}
              <div className="absolute left-0 -top-6 hidden group-hover:block z-20 px-1.5 py-0.5 rounded bg-zinc-800 border border-white/10 text-[9px] text-white/80 whitespace-nowrap shadow-lg">
                {budget.name}: {formatCurrency(budget.spent)} / {formatCurrency(budget.planned)} BYN
                {isOver && <span className="text-red-400 ml-1">(+{formatCurrency(budget.spent - budget.planned)})</span>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Amount + Percent */}
      <div className="flex flex-col items-end min-w-[90px]">
        <div className="flex items-baseline gap-1">
          <span className="text-[11px] text-white/80 tabular-nums font-medium">
            {formatCurrency(total)}
          </span>
          <span className="text-[9px] text-white/30">BYN</span>
        </div>
        {percentOfParent !== null && (
          <span className="text-[9px] text-white/40 tabular-nums">
            {percentOfParent}% от родителя
          </span>
        )}
      </div>
    </div>
  )
}

/** Бейдж категории */
function CategoryBadge({ category }: { category: EmployeeCategory }) {
  const colors: Record<EmployeeCategory, string> = {
    К: '#3b82f6',
    ВС: '#8b5cf6',
    ГС: '#f59e0b',
  }
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-4 rounded text-[9px] font-semibold"
      style={{ backgroundColor: `${colors[category]}20`, color: colors[category] }}
    >
      {category}
    </span>
  )
}

// ============================================================================
// Row Components
// ============================================================================

interface RowProps {
  expanded: Set<string>
  onToggle: (id: string) => void
  parentTotal?: number
}

function ProjectRow({ project, expanded, onToggle }: { project: Project } & RowProps) {
  const isExpanded = expanded.has(project.id)
  const hasChildren = project.stages.length > 0
  const projectTotal = getTotalBudget(project.budgets)

  return (
    <>
      <tr
        className="border-b border-white/5 bg-gradient-to-r from-blue-500/10 to-transparent hover:from-blue-500/15 cursor-pointer"
        onClick={() => hasChildren && onToggle(project.id)}
      >
        <td className="px-3 py-2">
          <div className="flex items-center gap-2">
            <button className={cn('w-4 h-4 flex items-center justify-center text-white/40', !hasChildren && 'invisible')}>
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-[9px] text-blue-400 font-medium">
              ПРОЕКТ
            </span>
            <span className="text-xs font-medium text-white/90">{project.name}</span>
          </div>
        </td>
        <td className="px-3 py-2">
          <BudgetBars budgets={project.budgets} />
        </td>
        <td className="px-3 py-2 text-right text-[11px] text-white/50">—</td>
      </tr>
      {isExpanded && project.stages.map(stage => (
        <StageRow key={stage.id} stage={stage} expanded={expanded} onToggle={onToggle} parentTotal={projectTotal} />
      ))}
    </>
  )
}

function StageRow({ stage, expanded, onToggle, parentTotal = 0 }: { stage: ProjectStage } & RowProps) {
  const isExpanded = expanded.has(stage.id)
  const hasChildren = stage.objects.length > 0
  const stageTotal = getTotalBudget(stage.budgets)

  return (
    <>
      <tr
        className="border-b border-white/5 bg-gradient-to-r from-violet-500/5 to-transparent hover:from-violet-500/10 cursor-pointer"
        onClick={() => hasChildren && onToggle(stage.id)}
      >
        <td className="px-3 py-1.5">
          <div className="flex items-center gap-2 pl-6">
            <button className={cn('w-4 h-4 flex items-center justify-center text-white/40', !hasChildren && 'invisible')}>
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
            <span className="px-1.5 py-0.5 rounded bg-violet-500/20 text-[9px] text-violet-400 font-medium">
              СТАДИЯ
            </span>
            <span className="text-[11px] text-white/80">{stage.name}</span>
          </div>
        </td>
        <td className="px-3 py-1.5">
          <BudgetBars budgets={stage.budgets} parentTotal={parentTotal} />
        </td>
        <td className="px-3 py-1.5 text-right text-[11px] text-white/50">—</td>
      </tr>
      {isExpanded && stage.objects.map(obj => (
        <ObjectRow key={obj.id} object={obj} expanded={expanded} onToggle={onToggle} parentTotal={stageTotal || parentTotal} />
      ))}
    </>
  )
}

function ObjectRow({ object, expanded, onToggle, parentTotal = 0 }: { object: ProjectObject } & RowProps) {
  const isExpanded = expanded.has(object.id)
  const hasChildren = object.sections.length > 0
  const objectTotal = getTotalBudget(object.budgets)

  return (
    <>
      <tr
        className="border-b border-white/5 bg-gradient-to-r from-pink-500/5 to-transparent hover:from-pink-500/10 cursor-pointer"
        onClick={() => hasChildren && onToggle(object.id)}
      >
        <td className="px-3 py-1.5">
          <div className="flex items-center gap-2 pl-12">
            <button className={cn('w-4 h-4 flex items-center justify-center text-white/40', !hasChildren && 'invisible')}>
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
            <span className="px-1.5 py-0.5 rounded bg-pink-500/20 text-[9px] text-pink-400 font-medium">
              ОБЪЕКТ
            </span>
            <span className="text-[11px] text-white/70">{object.name}</span>
          </div>
        </td>
        <td className="px-3 py-1.5">
          <BudgetBars budgets={object.budgets} parentTotal={parentTotal} />
        </td>
        <td className="px-3 py-1.5 text-right text-[11px] text-white/50">—</td>
      </tr>
      {isExpanded && object.sections.map(section => (
        <SectionRow key={section.id} section={section} expanded={expanded} onToggle={onToggle} parentTotal={objectTotal || parentTotal} />
      ))}
    </>
  )
}

function SectionRow({ section, expanded, onToggle, parentTotal = 0 }: { section: Section } & RowProps) {
  const isExpanded = expanded.has(section.id)
  const hasChildren = section.stages.length > 0
  const totalHours = calcTotalHours(section.stages)

  return (
    <>
      <tr
        className="border-b border-white/5 bg-gradient-to-r from-emerald-500/5 to-transparent hover:from-emerald-500/10 cursor-pointer"
        onClick={() => hasChildren && onToggle(section.id)}
      >
        <td className="px-3 py-1.5">
          <div className="flex items-center gap-2 pl-[72px]">
            <button className={cn('w-4 h-4 flex items-center justify-center text-white/40', !hasChildren && 'invisible')}>
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
            <span className="px-1 py-0.5 rounded bg-emerald-500/20 text-[9px] text-emerald-400 font-mono font-medium">
              {section.code}
            </span>
            <span className="text-[11px] text-white/70">{section.name}</span>
          </div>
        </td>
        <td className="px-3 py-1.5">
          <BudgetBars budgets={section.budgets} parentTotal={parentTotal} />
        </td>
        <td className="px-3 py-1.5 text-right">
          {totalHours > 0 && (
            <span className="text-[11px] text-white/60 tabular-nums">{formatHours(totalHours)} ч</span>
          )}
        </td>
      </tr>
      {isExpanded && section.stages.map(stage => (
        <DecompStageRow key={stage.id} stage={stage} expanded={expanded} onToggle={onToggle} />
      ))}
    </>
  )
}

function DecompStageRow({ stage, expanded, onToggle }: { stage: DecompStage } & RowProps) {
  const isExpanded = expanded.has(stage.id)
  const hasChildren = stage.tasks.length > 0
  const totalHours = stage.tasks.reduce((sum, t) => sum + t.plannedHours, 0)

  return (
    <>
      <tr
        className="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer"
        onClick={() => hasChildren && onToggle(stage.id)}
      >
        <td className="px-3 py-1">
          <div className="flex items-center gap-2 pl-[96px]">
            <button className={cn('w-4 h-4 flex items-center justify-center text-white/30', !hasChildren && 'invisible')}>
              {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            </button>
            <span className="text-[10px] text-white/50">{stage.name}</span>
          </div>
        </td>
        <td className="px-3 py-1">
          <span className="text-[10px] text-white/20">—</span>
        </td>
        <td className="px-3 py-1 text-right">
          <span className="text-[10px] text-white/50 tabular-nums">{formatHours(totalHours)} ч</span>
        </td>
      </tr>
      {isExpanded && stage.tasks.map(task => (
        <TaskRow key={task.id} task={task} />
      ))}
    </>
  )
}

function TaskRow({ task }: { task: Task }) {
  return (
    <tr className="border-b border-white/5 hover:bg-white/[0.01]">
      <td className="px-3 py-1">
        <div className="flex items-center gap-2 pl-[120px]">
          <CategoryBadge category={task.category} />
          <span className="text-[10px] text-white/40">{task.name}</span>
        </div>
      </td>
      <td className="px-3 py-1">
        <span className="text-[10px] text-white/20">—</span>
      </td>
      <td className="px-3 py-1 text-right">
        <span className="text-[10px] text-white/40 tabular-nums">{task.plannedHours} ч</span>
      </td>
    </tr>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function BudgetTable() {
  const [expanded, setExpanded] = useState<Set<string>>(() =>
    new Set(['p1', 'ps1', 'o1', 's1'])
  )

  const handleToggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Expand all / collapse all
  const allIds = useMemo(() => {
    const ids: string[] = []
    MOCK_DATA.forEach(p => {
      ids.push(p.id)
      p.stages.forEach(ps => {
        ids.push(ps.id)
        ps.objects.forEach(o => {
          ids.push(o.id)
          o.sections.forEach(s => {
            ids.push(s.id)
            s.stages.forEach(ds => ids.push(ds.id))
          })
        })
      })
    })
    return ids
  }, [])

  const expandAll = () => setExpanded(new Set(allIds))
  const collapseAll = () => setExpanded(new Set())

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-white/10 bg-zinc-900/50">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-medium text-white/70">Декомпозиция с бюджетами</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={expandAll}
              className="px-2 py-0.5 text-[10px] text-white/40 hover:text-white/70 hover:bg-white/5 rounded transition-colors"
            >
              Развернуть всё
            </button>
            <button
              onClick={collapseAll}
              className="px-2 py-0.5 text-[10px] text-white/40 hover:text-white/70 hover:bg-white/5 rounded transition-colors"
            >
              Свернуть всё
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[9px] text-white/40">
          {Object.entries(BUDGET_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
              <span>{type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse min-w-[700px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-zinc-900/95 backdrop-blur-sm border-b border-white/10">
              <th className="text-left px-3 py-2 text-[10px] font-medium text-white/50 uppercase tracking-wider w-1/2">
                Структура
              </th>
              <th className="text-left px-3 py-2 text-[10px] font-medium text-white/50 uppercase tracking-wider w-[240px]">
                <div className="flex items-center gap-1">
                  <Wallet size={10} />
                  Бюджеты
                </div>
              </th>
              <th className="text-right px-3 py-2 text-[10px] font-medium text-white/50 uppercase tracking-wider w-[80px]">
                Часы
              </th>
            </tr>
          </thead>
          <tbody>
            {MOCK_DATA.map(project => (
              <ProjectRow
                key={project.id}
                project={project}
                expanded={expanded}
                onToggle={handleToggle}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default BudgetTable
