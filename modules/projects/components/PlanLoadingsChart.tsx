"use client"

import React, { useMemo } from "react"

type PlanLoadRow = {
  start: string
  finish: string
  categoryId: string
  rate: number
}

type Category = {
  category_id: string
  category_name: string
}

interface PlanLoadingsChartProps {
  stageStart: string | null | undefined
  stageFinish: string | null | undefined
  rows: PlanLoadRow[]
  categories: Category[]
  className?: string
}

// Вспомогательные функции для работы с датами
const startOfDay = (d: Date) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

const parseISO = (iso: string) => startOfDay(new Date(iso))

const daysDiffInclusive = (a: Date, b: Date) => {
  const msPerDay = 24 * 60 * 60 * 1000
  const diff = Math.floor((startOfDay(b).getTime() - startOfDay(a).getTime()) / msPerDay)
  return diff + 1
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

// Детерминированное назначение цвета по идентификатору категории
const colorClasses = [
  "bg-emerald-500",
  "bg-blue-500",
  "bg-amber-500",
  "bg-fuchsia-500",
  "bg-indigo-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-teal-500",
]

const colorForCategory = (categoryId: string) => {
  let hash = 0
  for (let i = 0; i < categoryId.length; i++) {
    // Простая хеш-функция для стабильного распределения
    hash = (hash * 31 + categoryId.charCodeAt(i)) >>> 0
  }
  const idx = hash % colorClasses.length
  return colorClasses[idx]
}

export function PlanLoadingsChart({ stageStart, stageFinish, rows, categories, className }: PlanLoadingsChartProps) {
  const dataset = useMemo(() => {
    const validRows = rows
      .filter(r => r.start && r.finish)
      .map(r => ({
        ...r,
        startDate: parseISO(r.start),
        finishDate: parseISO(r.finish),
      }))

    if (validRows.length === 0 && !stageStart && !stageFinish) {
      return null
    }

    const minRowDate = validRows.length > 0 ? new Date(Math.min(...validRows.map(r => r.startDate.getTime()))) : null
    const maxRowDate = validRows.length > 0 ? new Date(Math.max(...validRows.map(r => r.finishDate.getTime()))) : null

    const minBound = stageStart ? parseISO(stageStart) : (minRowDate ? startOfDay(minRowDate) : null)
    const maxBound = stageFinish ? parseISO(stageFinish) : (maxRowDate ? startOfDay(maxRowDate) : null)

    if (!minBound || !maxBound) return null

    const totalDays = Math.max(1, daysDiffInclusive(minBound, maxBound))

    const items = validRows.map(r => {
      // Обрезаем плановые интервалы рамками этапа
      const clampedStart = r.startDate < minBound ? minBound : r.startDate
      const clampedFinish = r.finishDate > maxBound ? maxBound : r.finishDate
      const offsetDays = Math.max(0, daysDiffInclusive(minBound, clampedStart) - 1)
      const lengthDays = Math.max(1, daysDiffInclusive(clampedStart, clampedFinish))
      const leftPct = clamp((offsetDays / totalDays) * 100, 0, 100)
      const widthPct = clamp((lengthDays / totalDays) * 100, 0, 100 - leftPct)
      return {
        ...r,
        leftPct,
        widthPct,
      }
    })

    // Формируем тики шкалы времени здесь, чтобы не вызывать отдельный хук позже
    const desiredTicks = 8
    const step = Math.max(1, Math.ceil(totalDays / desiredTicks))
    const ticks: { dayIndex: number; label: string }[] = []
    for (let i = 0; i < totalDays; i += step) {
      const d = new Date(minBound)
      d.setDate(d.getDate() + i)
      ticks.push({ dayIndex: i, label: d.toLocaleDateString('ru-RU') })
    }
    if (ticks[ticks.length - 1]?.dayIndex !== totalDays - 1) {
      ticks.push({ dayIndex: totalDays - 1, label: maxBound.toLocaleDateString('ru-RU') })
    }

    return { minBound, maxBound, totalDays, items, ticks }
  }, [rows, stageStart, stageFinish])

  const categoryName = (id: string) => categories.find(c => c.category_id === id)?.category_name || "Категория"

  if (!dataset) {
    return (
      <div className={"rounded-md border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-500 dark:text-slate-400 " + (className || "")}>Нет данных для визуализации</div>
    )
  }

  const { minBound, maxBound, totalDays, items, ticks } = dataset

  return (
    <div className={"rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 " + (className || "")}> 
      <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
        Диапазон: {minBound.toLocaleDateString('ru-RU')} — {maxBound.toLocaleDateString('ru-RU')} ({totalDays} дн.)
      </div>
      <div className="px-3 py-2">
        <div className="relative w-full h-6">
          {/* Тики шкалы времени */}
          {ticks.map((t, idx) => {
            const leftPct = clamp((t.dayIndex / totalDays) * 100, 0, 100)
            return (
              <div key={idx} className="absolute top-0 h-full border-l border-slate-200 dark:border-slate-700" style={{ left: `${leftPct}%` }} />
            )
          })}
        </div>
        <div className="relative w-full h-5 mt-1">
          {/* Подписи к тикам */}
          {ticks.map((t, idx) => {
            const leftPct = clamp((t.dayIndex / totalDays) * 100, 0, 100)
            return (
              <div key={idx} className="absolute -translate-x-1/2 text-[10px] text-slate-500 dark:text-slate-400" style={{ left: `${leftPct}%` }}>
                {t.label}
              </div>
            )
          })}
        </div>

        {/* Полосы плановой загрузки */}
        <div className="mt-3 space-y-2">
          {items.length === 0 ? (
            <div className="text-xs text-slate-500 dark:text-slate-400">Нет строк плановой загрузки</div>
          ) : (
            items.map((it, idx) => {
              const color = colorForCategory(it.categoryId)
              return (
                <div key={idx} className="border border-slate-100 dark:border-slate-800 rounded-md p-2">
                  <div className="flex items-center justify-between text-[12px]">
                    <div className="truncate">
                      <span className="font-medium">{categoryName(it.categoryId)}</span>
                      <span className="mx-2 text-slate-400">•</span>
                      <span className="text-slate-600 dark:text-slate-300">Ставка: {it.rate}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {new Date(it.start).toLocaleDateString('ru-RU')} — {new Date(it.finish).toLocaleDateString('ru-RU')}
                    </div>
                  </div>
                  <div className="relative w-full h-6 mt-2 rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={"absolute top-0 bottom-0 rounded-sm opacity-90 " + color}
                      style={{ left: `${it.leftPct}%`, width: `${it.widthPct}%` }}
                      title={`${categoryName(it.categoryId)}: ${new Date(it.start).toLocaleDateString('ru-RU')} — ${new Date(it.finish).toLocaleDateString('ru-RU')}`}
                    />
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
      <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400">
        Превью. Данные будут сохранены только при создании этапа.
      </div>
    </div>
  )
}

export default PlanLoadingsChart


