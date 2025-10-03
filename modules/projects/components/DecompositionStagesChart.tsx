"use client"

import React, { useMemo } from "react"
import { cn } from "@/lib/utils"
import { useTheme } from "next-themes"

interface Stage {
  id: string
  name: string
  start: string | null
  finish: string | null
  description: string | null
}

interface DecompositionStagesChartProps {
  stages: Stage[]
  className?: string
}

export function DecompositionStagesChart({ stages, className }: DecompositionStagesChartProps) {
  const { theme } = useTheme()
  const isDark = theme === "dark"

  // Фильтруем этапы с датами
  const stagesWithDates = useMemo(() => {
    return stages.filter(s => s.start && s.finish)
  }, [stages])

  // Вычисляем границы временной шкалы
  const { minDate, maxDate, totalDays } = useMemo(() => {
    if (stagesWithDates.length === 0) {
      return { minDate: null, maxDate: null, totalDays: 0 }
    }

    const allDates = stagesWithDates.flatMap(s => [
      new Date(s.start!),
      new Date(s.finish!)
    ])
    
    const min = new Date(Math.min(...allDates.map(d => d.getTime())))
    const max = new Date(Math.max(...allDates.map(d => d.getTime())))
    
    // Добавляем небольшой отступ по краям (5% от общего диапазона)
    const rangeDays = Math.ceil((max.getTime() - min.getTime()) / (1000 * 60 * 60 * 24))
    const padding = Math.max(Math.floor(rangeDays * 0.05), 1)
    
    min.setDate(min.getDate() - padding)
    max.setDate(max.getDate() + padding)
    
    const total = Math.ceil((max.getTime() - min.getTime()) / (1000 * 60 * 60 * 24))
    
    return { minDate: min, maxDate: max, totalDays: total }
  }, [stagesWithDates])

  // Форматирование даты
  const formatDate = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    return `${day}.${month}`
  }

  // Вычисляем позицию и ширину бара для каждого этапа
  const getBars = useMemo(() => {
    if (!minDate || !maxDate || totalDays === 0) return []

    return stagesWithDates.map((stage, idx) => {
      const start = new Date(stage.start!)
      const finish = new Date(stage.finish!)
      
      const startOffset = Math.max(0, (start.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24))
      const duration = Math.max(1, (finish.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      
      const left = (startOffset / totalDays) * 100
      const width = (duration / totalDays) * 100
      
      return {
        id: stage.id,
        name: stage.name,
        left,
        width,
        startText: formatDate(start),
        finishText: formatDate(finish),
        color: getStageColor(idx, stagesWithDates.length, isDark)
      }
    })
  }, [stagesWithDates, minDate, maxDate, totalDays, isDark])

  // Генерируем цвет для этапа
  function getStageColor(index: number, total: number, isDark: boolean): string {
    const colors = isDark
      ? [
          'bg-blue-500',
          'bg-emerald-500',
          'bg-purple-500',
          'bg-amber-500',
          'bg-pink-500',
          'bg-cyan-500',
          'bg-orange-500',
          'bg-teal-500',
        ]
      : [
          'bg-blue-600',
          'bg-emerald-600',
          'bg-purple-600',
          'bg-amber-600',
          'bg-pink-600',
          'bg-cyan-600',
          'bg-orange-600',
          'bg-teal-600',
        ]
    
    return colors[index % colors.length]
  }

  if (stagesWithDates.length === 0) {
    return (
      <div className={cn("py-3 px-4 rounded-md border", 
        isDark ? "border-slate-700 bg-slate-800/40" : "border-slate-200 bg-slate-50",
        className
      )}>
        <p className={cn("text-xs text-center", isDark ? "text-slate-400" : "text-slate-500")}>
          Нет этапов с указанными датами для отображения на графике
        </p>
      </div>
    )
  }

  return (
    <div className={cn(
      "py-3 px-4 rounded-md border",
      isDark ? "border-slate-700 bg-slate-800/40" : "border-slate-200 bg-slate-50",
      className
    )}>
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-3">
        <h4 className={cn("text-xs font-medium", isDark ? "text-slate-300" : "text-slate-600")}>
          График этапов
        </h4>
        {minDate && maxDate && (
          <div className="flex items-center gap-2">
            <div className={cn("px-2 py-0.5 rounded text-[11px] font-medium tabular-nums", 
              isDark ? "bg-blue-500/20 text-blue-300" : "bg-blue-100 text-blue-700"
            )}>
              Старт: {formatDate(minDate)}
            </div>
            <div className={cn("px-2 py-0.5 rounded text-[11px] font-medium tabular-nums", 
              isDark ? "bg-emerald-500/20 text-emerald-300" : "bg-emerald-100 text-emerald-700"
            )}>
              Финиш: {formatDate(maxDate)}
            </div>
          </div>
        )}
      </div>

      {/* Временная шкала */}
      <div className="space-y-2">
        {getBars.map((bar, idx) => (
          <div key={bar.id} className="relative">
            {/* Название этапа */}
            <div className="flex items-center mb-1">
              <div className={cn("w-2 h-2 rounded-sm mr-2", bar.color)} />
              <span className={cn("text-[11px] font-medium truncate", isDark ? "text-slate-200" : "text-slate-700")}>
                {bar.name}
              </span>
            </div>
            
            {/* Фоновая линия */}
            <div className={cn(
              "h-6 rounded relative",
              isDark ? "bg-slate-700/30" : "bg-slate-200/50"
            )}>
              {/* Бар этапа */}
              <div
                className={cn(
                  "absolute h-full rounded transition-all duration-200 flex items-center justify-between px-1",
                  bar.color,
                  isDark ? "opacity-80" : "opacity-90"
                )}
                style={{
                  left: `${bar.left}%`,
                  width: `${bar.width}%`,
                }}
                title={`${bar.name}: ${bar.startText} — ${bar.finishText}`}
              >
                {/* Дата старта */}
                <span className={cn(
                  "text-[9px] font-semibold tabular-nums px-1 rounded",
                  isDark ? "bg-black/30 text-white" : "bg-white/40 text-slate-900"
                )}>
                  {bar.startText}
                </span>
                {/* Дата финиша */}
                <span className={cn(
                  "text-[9px] font-semibold tabular-nums px-1 rounded",
                  isDark ? "bg-black/30 text-white" : "bg-white/40 text-slate-900"
                )}>
                  {bar.finishText}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

