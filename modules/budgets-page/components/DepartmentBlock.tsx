'use client'

import { useMemo } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useCachedDepartments } from '@/modules/cache'
import { pluralizeLoadings } from '@/lib/pluralize'
import { formatNumber } from '../utils'
import { useProjectDepartmentBudgets } from '../hooks/use-project-department-budgets'
import type { ProjectDepartmentBudgetSummary } from '../hooks/use-project-department-budgets'
import type { ExpandedState } from '../types'

/** Префикс синтетического id для блока ЧР (`hr:${projectId}`) — хранится в общем expanded state */
const HR_BLOCK_KEY_PREFIX = 'hr:'

// ============================================================================
// Справочник целевых отделов (бизнес-правила)
// ============================================================================
// Отделы гражданского направления + отделы без гражд/пром деления (АВТ, ВК, ТСБС).
// Все прочие отделы агрегируются в строку "Другое".
//
// Маппинг по department_name (как в БД) → отображаемый код + стандартный %.
// Имя для отображения подтягивается из cached-departments (useCachedDepartments),
// id вычисляется в runtime — устойчиво к переименованиям.
// ============================================================================

interface DepartmentMapping {
  /** Имя отдела в БД (departments.department_name) */
  dbName: string
  /** Короткий код для UI */
  code: string
  /** Стандартный процент распределения бюджета по гражданскому направлению */
  pct: number
}

const TARGET_MAPPINGS: readonly DepartmentMapping[] = [
  { dbName: 'АР гражд', code: 'АР', pct: 0.28 },
  { dbName: 'КР гражд', code: 'КР', pct: 0.34 },
  { dbName: 'ОВ гражд', code: 'ОВ', pct: 0.10 },
  { dbName: 'ВК',       code: 'ВК', pct: 0.05 },
  { dbName: 'ЭС гражд', code: 'ЭС', pct: 0.08 },
  { dbName: 'ТСБС',     code: 'ТСБС', pct: 0.07 },
  { dbName: 'АВТ',      code: 'Авт', pct: 0.02 },
] as const

const OTHER_PCT = 0.06
const OTHER_KEY = '__other__'

interface ResolvedDepartment {
  /** Уникальный ключ строки (id отдела или OTHER_KEY) */
  key: string
  /** Реальный department_id из БД, если есть */
  id: string | null
  code: string
  name: string
  pct: number
}

// ============================================================================
// Component
// ============================================================================

interface DepartmentBlockProps {
  projectId: string
  projectAllocatedBudget: number
  expanded: ExpandedState
  onToggle: (nodeId: string) => void
}

export function DepartmentBlock({ projectId, projectAllocatedBudget, expanded, onToggle }: DepartmentBlockProps) {
  const { data: departmentBudgets, isLoading: budgetsLoading } = useProjectDepartmentBudgets()
  const { data: departments, isLoading: departmentsLoading } = useCachedDepartments()

  const isLoading = budgetsLoading || departmentsLoading

  // Свёрнутость блока ЧР хранится в общем expanded state (localStorage).
  // Дефолт — раскрыто (как сейчас).
  const blockKey = `${HR_BLOCK_KEY_PREFIX}${projectId}`
  const isBlockExpanded = expanded[blockKey] ?? true

  // Резолвим целевые отделы по name → id через справочник из БД
  const resolved = useMemo<ResolvedDepartment[]>(() => {
    if (!departments) return []
    return TARGET_MAPPINGS.map(m => {
      const dept = departments.find(d => d.name === m.dbName)
      return {
        key: dept?.id ?? m.dbName,
        id: dept?.id ?? null,
        code: m.code,
        name: m.dbName,
        pct: m.pct,
      }
    })
  }, [departments])

  const targetIds = useMemo(() => new Set(resolved.map(d => d.id).filter(Boolean) as string[]), [resolved])

  const projectBudgets = departmentBudgets?.get(projectId)

  // "Другое" — сумма всех отделов проекта, которых нет в TARGET
  const otherSummary = useMemo<ProjectDepartmentBudgetSummary>(() => {
    const agg: ProjectDepartmentBudgetSummary = {
      calcBudget: 0,
      totalHours: 0,
      loadingCount: 0,
      errorsCount: 0,
    }
    if (!projectBudgets) return agg
    for (const [deptId, summary] of projectBudgets) {
      if (targetIds.has(deptId)) continue
      agg.calcBudget   += summary.calcBudget
      agg.totalHours   += summary.totalHours
      agg.loadingCount += summary.loadingCount
      agg.errorsCount  += summary.errorsCount
    }
    return agg
  }, [projectBudgets, targetIds])

  return (
    <>
      {/* Section header — toggleable */}
      <div
        className="flex items-center border-b border-t border-emerald-900/30 bg-emerald-950/20 min-h-[26px] cursor-pointer hover:bg-emerald-950/30 transition-colors"
        onClick={() => onToggle(blockKey)}
      >
        <div
          className="flex items-center gap-1.5 min-w-[400px] w-[400px] px-2 shrink-0"
          style={{ paddingLeft: '12px' }}
        >
          <span className="text-emerald-400/70 flex items-center">
            {isBlockExpanded
              ? <ChevronDown className="h-3 w-3" />
              : <ChevronRight className="h-3 w-3" />}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
            👥 Человеческие ресурсы
          </span>
          {isLoading && (
            <span className="text-[9px] text-muted-foreground italic">загрузка…</span>
          )}
        </div>
        <div className="flex items-center flex-1 min-w-[480px] shrink-0 border-l border-border/30" />
      </div>

      {/* Целевые отделы */}
      {isBlockExpanded && resolved.map((dept) => {
        const summary = dept.id ? projectBudgets?.get(dept.id) : undefined
        return (
          <DepartmentRow
            key={dept.key}
            code={dept.code}
            name={dept.name}
            pct={dept.pct}
            summary={summary}
            allocatedBudget={projectAllocatedBudget * dept.pct}
          />
        )
      })}

      {/* Прочие отделы — суммарно */}
      {isBlockExpanded && (
        <DepartmentRow
          key={OTHER_KEY}
          code="Другое"
          name="Прочие отделы"
          pct={OTHER_PCT}
          summary={otherSummary}
          allocatedBudget={projectAllocatedBudget * OTHER_PCT}
        />
      )}
    </>
  )
}

// ============================================================================
// Row
// ============================================================================

interface DepartmentRowProps {
  code: string
  name: string
  pct: number
  summary: ProjectDepartmentBudgetSummary | undefined
  allocatedBudget: number
}

function DepartmentRow({ code, name, pct, summary, allocatedBudget }: DepartmentRowProps) {
  const calcBudget = summary?.calcBudget ?? 0
  const totalHours = summary?.totalHours ?? 0
  const loadingCount = summary?.loadingCount ?? 0
  const errorsCount = summary?.errorsCount ?? 0
  const deviation = allocatedBudget - calcBudget
  const deviationPct = calcBudget > 0 ? (deviation / calcBudget) * 100 : 0
  const hasCalc = calcBudget > 0

  return (
    <div className="flex items-center border-b bg-emerald-950/10 hover:bg-emerald-950/15 min-h-[32px] transition-colors">
      <div
        className="flex items-center gap-1.5 min-w-[400px] w-[400px] px-2 shrink-0"
        style={{ paddingLeft: '28px' }}
      >
        <span className="text-[11px] font-semibold text-emerald-400 shrink-0 w-10">
          {code}
        </span>
        <span className="text-[12px] text-foreground truncate">
          {name}
        </span>
      </div>

      <div className="flex items-center flex-1 min-w-[480px] shrink-0 border-l border-border/30">
        {/* Расчётный */}
        <div className="w-[80px] px-1 text-right">
          {hasCalc ? (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={cn(
                    'text-[12px] tabular-nums text-primary font-medium cursor-help',
                    errorsCount > 0 && 'underline decoration-dotted decoration-amber-500'
                  )}>
                    {formatNumber(calcBudget)}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <div className="space-y-0.5">
                    <div>{formatNumber(totalHours)} ч / {loadingCount} {pluralizeLoadings(loadingCount)}</div>
                    {errorsCount > 0 && (
                      <div className="text-amber-500">
                        ⚠ {errorsCount} без отдела или ставки
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <span className="text-[12px] text-muted-foreground tabular-nums">—</span>
          )}
        </div>
        <div className="w-[10px] text-center">
          <span className="text-[11px] text-muted-foreground">/</span>
        </div>
        {/* Распред — не применяется для отделов */}
        <div className="w-[80px] px-1 text-center">
          <span className="text-[12px] text-muted-foreground tabular-nums">—</span>
        </div>
        <div className="w-[10px] text-center">
          <span className="text-[11px] text-muted-foreground">/</span>
        </div>
        {/* Выделенный */}
        <div className="w-[140px] shrink-0 px-1 flex items-center gap-1.5">
          {allocatedBudget > 0 ? (
            <>
              <span className="text-[12px] tabular-nums text-foreground font-medium">
                {formatNumber(allocatedBudget)}
              </span>
              <span className="text-[11px] text-emerald-400 font-medium tabular-nums">
                {(pct * 100).toFixed(0)}%
              </span>
            </>
          ) : (
            <span className="text-[12px] text-muted-foreground tabular-nums">—</span>
          )}
        </div>
        <div className="w-[10px] text-center">
          <span className="text-[11px] text-muted-foreground">/</span>
        </div>
        {/* Отклонение */}
        <div className="w-[140px] shrink-0 px-1 text-left">
          {hasCalc || allocatedBudget > 0 ? (
            <span className={cn(
              'text-[12px] tabular-nums font-medium',
              deviation >= 0 ? 'text-emerald-400' : 'text-red-400'
            )}>
              {deviation >= 0 ? '+' : ''}{formatNumber(deviation, 0)}
              <span className={cn(
                'ml-1 text-[11px]',
                deviation >= 0 ? 'text-emerald-500' : 'text-red-400/90'
              )}>
                {hasCalc
                  ? `(${deviationPct >= 0 ? '+' : ''}${deviationPct.toFixed(1)}%)`
                  : '(—)'}
              </span>
            </span>
          ) : (
            <span className="text-[12px] text-muted-foreground tabular-nums">—</span>
          )}
        </div>
      </div>
    </div>
  )
}
