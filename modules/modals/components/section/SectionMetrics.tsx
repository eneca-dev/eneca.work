'use client'

import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Section } from '@/modules/resource-graph/types'

interface SectionMetricsProps {
  section: Section
  /** Компактный режим для строчного отображения */
  compact?: boolean
}

/**
 * Интерполирует плановую готовность на указанную дату
 */
function interpolateReadiness(
  checkpoints: Section['readinessCheckpoints'],
  targetDate: Date
): number {
  if (checkpoints.length === 0) return 0

  const sorted = [...checkpoints].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  const target = targetDate.getTime()

  // До первой точки
  if (target <= new Date(sorted[0].date).getTime()) {
    return sorted[0].value
  }

  // После последней точки
  if (target >= new Date(sorted[sorted.length - 1].date).getTime()) {
    return sorted[sorted.length - 1].value
  }

  // Между точками - линейная интерполяция
  for (let i = 0; i < sorted.length - 1; i++) {
    const curr = sorted[i]
    const next = sorted[i + 1]
    const currTime = new Date(curr.date).getTime()
    const nextTime = new Date(next.date).getTime()

    if (target >= currTime && target <= nextTime) {
      const ratio = (target - currTime) / (nextTime - currTime)
      return curr.value + (next.value - curr.value) * ratio
    }
  }

  return 0
}

/**
 * Форматирует число как валюту
 */
function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}K`
  }
  return value.toFixed(0)
}

export function SectionMetrics({ section, compact = false }: SectionMetricsProps) {
  const metrics = useMemo(() => {
    const now = new Date()

    // План - интерполированное значение на сегодня
    const planned = Math.round(interpolateReadiness(section.readinessCheckpoints, now))

    // Факт - последнее значение actualReadiness
    const lastActual = section.actualReadiness[section.actualReadiness.length - 1]
    const actual = lastActual?.value ?? 0

    // Бюджет - последнее значение budgetSpending
    const lastBudget = section.budgetSpending[section.budgetSpending.length - 1]
    const spent = lastBudget?.spent ?? 0

    // Отклонение факта от плана
    const deviation = actual - planned

    return { planned, actual, spent, deviation }
  }, [section.readinessCheckpoints, section.actualReadiness, section.budgetSpending])

  const deviationColor = metrics.deviation > 0
    ? 'text-green-400'
    : metrics.deviation < 0
    ? 'text-red-400'
    : 'text-slate-400'

  const DeviationIcon = metrics.deviation > 0
    ? TrendingUp
    : metrics.deviation < 0
    ? TrendingDown
    : Minus

  // Compact inline layout
  if (compact) {
    return (
      <div className="flex items-center gap-3 text-[10px]">
        {/* План */}
        <div className="flex items-center gap-1">
          <span className="text-slate-500">П:</span>
          <span className="font-medium text-slate-300 font-mono">{metrics.planned}%</span>
        </div>

        {/* Факт с отклонением */}
        <div className="flex items-center gap-1">
          <span className="text-slate-500">Ф:</span>
          <span className="font-medium text-slate-300 font-mono">{metrics.actual}%</span>
          {metrics.deviation !== 0 && (
            <span className={cn('flex items-center gap-0.5', deviationColor)}>
              <DeviationIcon className="w-2.5 h-2.5" />
              <span>{metrics.deviation > 0 ? '+' : ''}{metrics.deviation}</span>
            </span>
          )}
        </div>

        {/* Бюджет */}
        <div className="flex items-center gap-1">
          <span className="text-slate-500">Б:</span>
          <span className="font-medium text-amber-400 font-mono">{formatCurrency(metrics.spent)}</span>
        </div>
      </div>
    )
  }

  // Full layout
  return (
    <div>
      <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-2">
        Показатели
      </label>

      <div className="grid grid-cols-3 gap-2">
        {/* План */}
        <div className="bg-slate-800/50 rounded-md px-3 py-2 text-center">
          <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">
            План
          </div>
          <div className="text-lg font-semibold text-slate-200 font-mono">
            {metrics.planned}%
          </div>
        </div>

        {/* Факт */}
        <div className="bg-slate-800/50 rounded-md px-3 py-2 text-center">
          <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">
            Факт
          </div>
          <div className="text-lg font-semibold text-slate-200 font-mono">
            {metrics.actual}%
          </div>
          {/* Deviation indicator */}
          {metrics.deviation !== 0 && (
            <div className={cn('flex items-center justify-center gap-0.5 text-[9px] mt-0.5', deviationColor)}>
              <DeviationIcon className="w-2.5 h-2.5" />
              <span>{metrics.deviation > 0 ? '+' : ''}{metrics.deviation}%</span>
            </div>
          )}
        </div>

        {/* Бюджет */}
        <div className="bg-slate-800/50 rounded-md px-3 py-2 text-center">
          <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">
            Бюджет
          </div>
          <div className="text-lg font-semibold text-amber-400 font-mono">
            {formatCurrency(metrics.spent)}
          </div>
        </div>
      </div>
    </div>
  )
}
