"use client"

import { useMemo, useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { ChevronRight, Box } from "lucide-react"
import { format, parseISO, differenceInDays, startOfWeek } from "date-fns"
import { ru } from "date-fns/locale"
import type { PlanningSection, TimelineRange, WeeklyStats } from "../../types"
import type { DayCell } from "../../utils"
import { calculateBarPosition, calculateMilestonePosition, formatDate, formatBudget } from "../../utils"
import { stageColors, milestoneConfig, budgetConfig } from "../../config"
import { TimelineGridBackground } from "../TimelineGridBackground"
import { StageRow } from "./StageRow"

// Редактируемое поле для планового процента
interface EditablePlanProps {
  value: number
  onChange: (value: number) => void
  isFuture: boolean
  isCurrent: boolean
  theme: string
}

function EditablePlan({ value, onChange, isFuture, isCurrent, theme }: EditablePlanProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [inputValue, setInputValue] = useState(value.toString())
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  useEffect(() => {
    setInputValue(value.toString())
  }, [value])

  const handleSubmit = () => {
    const num = parseInt(inputValue, 10)
    if (!isNaN(num) && num >= 0 && num <= 100) {
      onChange(num)
    } else {
      setInputValue(value.toString())
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit()
    } else if (e.key === "Escape") {
      setInputValue(value.toString())
      setIsEditing(false)
    }
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={handleSubmit}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-8 h-4 text-[8px] text-center tabular-nums rounded border-0 outline-none",
          theme === "dark"
            ? "bg-slate-700 text-slate-200 focus:ring-1 focus:ring-sky-500"
            : "bg-white text-slate-700 focus:ring-1 focus:ring-sky-500"
        )}
      />
    )
  }

  return (
    <span
      onClick={(e) => {
        e.stopPropagation()
        setIsEditing(true)
      }}
      className={cn(
        "text-[8px] tabular-nums px-1 rounded cursor-pointer transition-colors",
        "hover:ring-1 hover:ring-sky-400",
        isCurrent
          ? theme === "dark" ? "bg-sky-900/50 text-sky-400" : "bg-sky-100 text-sky-600"
          : isFuture
          ? theme === "dark" ? "bg-slate-800/50 text-slate-500" : "bg-slate-100 text-slate-400"
          : theme === "dark" ? "bg-slate-800/30 text-slate-500" : "bg-slate-100/50 text-slate-400"
      )}
      title="Нажмите для редактирования плана"
    >
      {isFuture ? "план " : "→"}{value}%
    </span>
  )
}

// Компонент для отображения недельных баров
interface WeeklyBarsProps {
  weeklyStats: WeeklyStats[]
  range: TimelineRange
  theme: string
  onUpdatePlan?: (weekNumber: number, plannedProgress: number) => void
}

import type { Milestone } from "../../types"

// Компонент таймлайна вех - горизонтальная линия с маркерами
interface MilestonesTimelineProps {
  milestones: Milestone[]
  range: TimelineRange
  theme: string
}

function MilestonesTimeline({ milestones, range, theme }: MilestonesTimelineProps) {
  // Вычисляем позиции вех
  const milestonesWithPositions = useMemo(() => {
    return milestones
      .map(milestone => {
        const position = calculateMilestonePosition(milestone.date, range)
        if (position === null) return null
        return { ...milestone, position }
      })
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .sort((a, b) => a.position - b.position)
  }, [milestones, range])

  if (milestonesWithPositions.length === 0) return null

  return (
    <div className="absolute top-0 left-0 right-0 h-[18px] z-30">
      {/* Соединительная линия между первой и последней вехой */}
      {milestonesWithPositions.length > 1 && (
        <div
          className={cn(
            "absolute top-1/2 h-[2px] -translate-y-1/2",
            theme === "dark" ? "bg-slate-600" : "bg-slate-300"
          )}
          style={{
            left: `${milestonesWithPositions[0].position}%`,
            width: `${milestonesWithPositions[milestonesWithPositions.length - 1].position - milestonesWithPositions[0].position}%`
          }}
        />
      )}

      {/* Маркеры вех */}
      {milestonesWithPositions.map((milestone) => {
        const config = milestoneConfig[milestone.type]
        const MilestoneIcon = config.icon

        return (
          <div
            key={milestone.id}
            className="absolute top-1/2 -translate-y-1/2 z-20 group/milestone"
            style={{ left: `${milestone.position}%` }}
          >
            {/* Веха - компактный маркер */}
            <div
              className={cn(
                "w-4 h-4 -ml-2 flex items-center justify-center transition-all duration-200",
                "rounded-full border-2 shadow-sm",
                milestone.isCompleted
                  ? cn(config.bgClass, config.borderClass)
                  : cn(
                      theme === "dark" ? "bg-slate-800" : "bg-white",
                      config.borderClass
                    ),
                "hover:scale-125 cursor-pointer"
              )}
            >
              <MilestoneIcon
                className={cn(
                  "w-2 h-2",
                  milestone.isCompleted
                    ? "text-white"
                    : config.textClass
                )}
              />
            </div>

            {/* Вертикальная линия вниз к барам */}
            <div
              className={cn(
                "absolute top-full left-1/2 -translate-x-1/2 w-[1px] h-[58px]",
                theme === "dark" ? "bg-slate-600/40" : "bg-slate-300/60",
                "pointer-events-none"
              )}
            />

            {/* Hover tooltip */}
            <div
              className={cn(
                "absolute left-1/2 -translate-x-1/2 bottom-full mb-1 opacity-0 pointer-events-none",
                "group-hover/milestone:opacity-100 group-hover/milestone:pointer-events-auto",
                "transition-opacity duration-200 z-50"
              )}
            >
              <div
                className={cn(
                  "px-2 py-1.5 text-[10px] whitespace-nowrap border shadow-lg rounded",
                  theme === "dark"
                    ? "bg-slate-800 border-slate-700 text-slate-200"
                    : "bg-white border-slate-200 text-slate-800"
                )}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <MilestoneIcon className={cn("w-3 h-3", config.textClass)} />
                  <span className="font-semibold">{milestone.title}</span>
                  {milestone.isCompleted && (
                    <span className="text-[8px] px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-500">
                      ✓
                    </span>
                  )}
                </div>
                <div className={cn(
                  "text-[9px]",
                  theme === "dark" ? "text-slate-400" : "text-slate-500"
                )}>
                  {format(parseISO(milestone.date), "d MMM", { locale: ru })}
                </div>
              </div>
              {/* Arrow */}
              <div
                className={cn(
                  "absolute left-1/2 -translate-x-1/2 top-full w-0 h-0",
                  "border-l-4 border-l-transparent",
                  "border-r-4 border-r-transparent",
                  "border-t-4",
                  theme === "dark" ? "border-t-slate-700" : "border-t-slate-200"
                )}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ============================================
// ВАРИАНТ 2: Линейный график — план vs факт
// с опциональным отображением часов и бюджета
// ============================================

interface WeeklyChartProps {
  weeklyStats: WeeklyStats[]
  range: TimelineRange
  theme: string
  onUpdatePlan?: (weekNumber: number, plannedProgress: number) => void
}

type MetricKey = "progress" | "budget" | "hours"

function WeeklyChart({ weeklyStats, range, theme }: WeeklyChartProps) {
  const today = new Date()

  // Состояние видимости метрик (прогресс всегда виден)
  const [visibleMetrics, setVisibleMetrics] = useState<Record<MetricKey, boolean>>({
    progress: true,
    budget: false,
    hours: false,
  })

  const toggleMetric = (key: MetricKey) => {
    if (key === "progress") return // прогресс нельзя отключить
    setVisibleMetrics(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Позиция по дате на таймлайне (в процентах)
  const getDatePosition = (dateStr: string) => {
    const date = parseISO(dateStr)
    const daysDiff = differenceInDays(date, range.start)
    return Math.max(0, Math.min(100, (daysDiff / range.totalDays) * 100))
  }

  // Текущая неделя
  const currentWeekIndex = weeklyStats.findIndex(week => {
    const weekStart = startOfWeek(parseISO(week.weekStart), { weekStartsOn: 1 })
    const weekEnd = parseISO(week.weekEnd)
    return weekStart <= today && weekEnd >= today
  })

  // Цвета
  const colors = {
    progress: theme === "dark" ? "#22d3ee" : "#0891b2",  // cyan
    budget: theme === "dark" ? "#fbbf24" : "#d97706",     // amber
    hours: theme === "dark" ? "#a78bfa" : "#7c3aed",      // violet
    plan: theme === "dark" ? "#94a3b8" : "#64748b",       // slate
  }

  // Генерация SVG path
  const generatePath = (getValue: (w: WeeklyStats) => number) => {
    if (weeklyStats.length === 0) return ""
    return weeklyStats
      .map((week, i) => {
        const x = getDatePosition(week.weekEnd)
        const y = 100 - Math.min(getValue(week), 100)
        return `${i === 0 ? "M" : "L"} ${x} ${y}`
      })
      .join(" ")
  }

  // Область заливки под линией
  const generateArea = (getValue: (w: WeeklyStats) => number) => {
    if (weeklyStats.length === 0) return ""
    const linePath = weeklyStats
      .map((week, i) => {
        const x = getDatePosition(week.weekEnd)
        const y = 100 - Math.min(getValue(week), 100)
        return `${i === 0 ? "M" : "L"} ${x} ${y}`
      })
      .join(" ")

    const firstX = getDatePosition(weeklyStats[0].weekEnd)
    const lastX = getDatePosition(weeklyStats[weeklyStats.length - 1].weekEnd)

    return `${linePath} L ${lastX} 100 L ${firstX} 100 Z`
  }

  // Конфигурация метрик
  const metrics: { key: MetricKey; label: string; getValue: (w: WeeklyStats) => number }[] = [
    { key: "progress", label: "готовность", getValue: w => w.actualProgress },
    { key: "budget", label: "бюджет", getValue: w => w.actualBudgetSpent },
    { key: "hours", label: "часы", getValue: w => w.actualHoursSpent },
  ]

  return (
    <div className="absolute inset-0 flex">
      {/* Шкала Y */}
      <div className={cn(
        "w-7 flex flex-col justify-between items-end pr-1.5 py-1 text-[9px] font-mono tabular-nums",
        theme === "dark" ? "text-slate-500" : "text-slate-400"
      )}>
        <span>100</span>
        <span>50</span>
        <span>0</span>
      </div>

      {/* График */}
      <div className="flex-1 relative">
        {/* Легенда — кликабельная */}
        <div className={cn(
          "absolute top-0.5 right-1 flex items-center gap-2 text-[9px] font-medium z-20",
          theme === "dark" ? "text-slate-400" : "text-slate-500"
        )}>
          {metrics.map(({ key, label }) => (
            <button
              key={key}
              onClick={(e) => { e.stopPropagation(); toggleMetric(key) }}
              className={cn(
                "flex items-center gap-1 px-1 py-0.5 rounded transition-all",
                visibleMetrics[key]
                  ? "opacity-100"
                  : "opacity-40 hover:opacity-70",
                key !== "progress" && "cursor-pointer hover:bg-slate-700/30"
              )}
              title={key === "progress" ? "Всегда отображается" : `Нажмите чтобы ${visibleMetrics[key] ? "скрыть" : "показать"}`}
            >
              <span
                className="w-3 h-[2px] rounded-full"
                style={{ background: colors[key] }}
              />
              {label}
            </button>
          ))}
          <span className="flex items-center gap-1 opacity-60">
            <span className="w-3 h-[2px] border-t border-dashed" style={{ borderColor: colors.plan }} />
            план
          </span>
        </div>

        {/* SVG */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {/* Сетка */}
          {[0, 50, 100].map((percent) => (
            <line
              key={percent}
              x1="0"
              y1={100 - percent}
              x2="100"
              y2={100 - percent}
              stroke={theme === "dark" ? "#334155" : "#e2e8f0"}
              strokeWidth={percent === 100 ? "0.5" : "0.3"}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* Линия "сегодня" */}
          {(() => {
            const todayPos = getDatePosition(format(today, "yyyy-MM-dd"))
            if (todayPos > 0 && todayPos < 100) {
              return (
                <line
                  x1={todayPos}
                  y1="0"
                  x2={todayPos}
                  y2="100"
                  stroke={colors.progress}
                  strokeWidth="1"
                  opacity="0.2"
                  vectorEffect="non-scaling-stroke"
                />
              )
            }
            return null
          })()}

          {/* Заливка под прогрессом */}
          <path
            d={generateArea(w => w.actualProgress)}
            fill={colors.progress}
            opacity="0.08"
          />

          {/* Линия плана */}
          <path
            d={generatePath(w => w.plannedProgress)}
            fill="none"
            stroke={colors.plan}
            strokeWidth="2"
            strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke"
          />

          {/* Линия часов */}
          {visibleMetrics.hours && (
            <path
              d={generatePath(w => w.actualHoursSpent)}
              fill="none"
              stroke={colors.hours}
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* Линия бюджета */}
          {visibleMetrics.budget && (
            <path
              d={generatePath(w => w.actualBudgetSpent)}
              fill="none"
              stroke={colors.budget}
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* Линия прогресса — всегда видна */}
          <path
            d={generatePath(w => w.actualProgress)}
            fill="none"
            stroke={colors.progress}
            strokeWidth="2.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* Точки данных */}
        {weeklyStats.map((week, i) => {
          const x = getDatePosition(week.weekEnd)
          const isCurrent = i === currentWeekIndex
          const diff = week.actualProgress - week.plannedProgress
          const isAhead = diff >= 0
          const isPast = parseISO(week.weekEnd) < today

          return (
            <div
              key={week.weekNumber}
              className="absolute top-0 bottom-0 z-10"
              style={{ left: `${x}%` }}
            >
              {/* Точка часов */}
              {visibleMetrics.hours && (
                <div
                  className="absolute w-2 h-2 -ml-1 rounded-full border cursor-pointer transition-transform hover:scale-150"
                  style={{
                    top: `${100 - Math.min(week.actualHoursSpent, 100)}%`,
                    background: colors.hours,
                    borderColor: theme === "dark" ? "#0f172a" : "#fff",
                    transform: "translateY(-50%)",
                  }}
                  title={`W${week.weekNumber}: часы ${week.actualHoursSpent}%`}
                />
              )}

              {/* Точка бюджета */}
              {visibleMetrics.budget && (
                <div
                  className="absolute w-2 h-2 -ml-1 rounded-full border cursor-pointer transition-transform hover:scale-150"
                  style={{
                    top: `${100 - Math.min(week.actualBudgetSpent, 100)}%`,
                    background: colors.budget,
                    borderColor: theme === "dark" ? "#0f172a" : "#fff",
                    transform: "translateY(-50%)",
                  }}
                  title={`W${week.weekNumber}: бюджет ${week.actualBudgetSpent}%`}
                />
              )}

              {/* Точка прогресса */}
              <div
                className={cn(
                  "absolute rounded-full border-2 cursor-pointer transition-transform hover:scale-125",
                  isCurrent ? "w-3.5 h-3.5 -ml-[7px]" : "w-2.5 h-2.5 -ml-[5px]"
                )}
                style={{
                  top: `${100 - Math.min(week.actualProgress, 100)}%`,
                  background: colors.progress,
                  borderColor: theme === "dark" ? "#0f172a" : "#fff",
                  transform: "translateY(-50%)",
                }}
                title={`Неделя ${week.weekNumber}: ${week.actualProgress}% (план ${week.plannedProgress}%)`}
              />

              {/* Значение у текущей точки */}
              {isCurrent && (
                <div
                  className="absolute -translate-x-1/2 text-[10px] font-bold"
                  style={{
                    top: `${100 - Math.min(week.actualProgress, 100)}%`,
                    marginTop: week.actualProgress > 85 ? "8px" : "-16px",
                    color: colors.progress,
                  }}
                >
                  {week.actualProgress}%
                </div>
              )}

              {/* Индикатор отставания/опережения */}
              {!isPast && Math.abs(diff) >= 5 && (
                <div
                  className={cn(
                    "absolute bottom-1 -translate-x-1/2 text-[8px] font-semibold tabular-nums",
                    isAhead ? "text-emerald-500" : "text-rose-500"
                  )}
                >
                  {isAhead ? "+" : ""}{diff}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================
// ВАРИАНТ 1: Горизонтальные бары (Bars) - оригинальный
// ============================================

// Компонент одного бара с визуализацией превышения/отставания
interface MetricBarProps {
  value: number
  plannedValue: number
  prevValue?: number // Значение предыдущей недели для расчёта прироста
  type: "progress" | "budget" | "hours"
  theme: string
  timeStatus: "past" | "current" | "future"
}

function MetricBar({ value, plannedValue, prevValue, type, theme, timeStatus }: MetricBarProps) {
  const isPast = timeStatus === "past"
  const isFuture = timeStatus === "future"
  const isCurrent = timeStatus === "current"

  // Для будущих недель показываем только план
  const displayValue = isFuture ? plannedValue : value

  // Прирост за неделю (только для текущей недели)
  const increment = isCurrent && prevValue !== undefined ? value - prevValue : 0

  const isOverBudget = type !== "progress" && value > plannedValue
  const isOverLimit = value > 100
  const isBehindPlan = type === "progress" && value < plannedValue
  const isAheadOfPlan = type === "progress" && value >= plannedValue

  // Цвета в зависимости от типа и состояния
  const getBarColor = () => {
    // Прошедшие недели - приглушённые цвета
    if (isPast) {
      if (type === "progress") return "bg-slate-400"
      if (type === "budget") return "bg-slate-400"
      return "bg-slate-400"
    }
    // Будущие недели - плановые цвета (пунктирные/полупрозрачные)
    if (isFuture) {
      return "bg-slate-400/50"
    }
    // Текущая неделя - яркие цвета
    if (type === "progress") {
      if (value >= 100) return "bg-emerald-500"
      if (isAheadOfPlan) return "bg-teal-500"
      return "bg-sky-500"
    }
    if (type === "budget") {
      if (isOverLimit) return "bg-rose-500"
      if (value > plannedValue) return "bg-orange-500"
      if (value >= 80) return "bg-amber-500"
      return "bg-amber-400"
    }
    // hours
    if (isOverLimit) return "bg-fuchsia-600"
    if (value > plannedValue) return "bg-violet-500"
    return "bg-violet-400"
  }

  // Иконка типа метрики
  const getIcon = () => {
    switch (type) {
      case "progress": return "◉"
      case "budget": return "₽"
      case "hours": return "◷"
    }
  }

  // Рассчитываем отображаемую ширину (до 100%)
  const barWidth = Math.min(displayValue, 100)
  // Превышение отображается как отдельный индикатор
  const overflowAmount = Math.max(0, value - 100)

  return (
    <div className={cn(
      "relative h-[15px] flex items-center gap-1",
      isPast && "opacity-50"
    )}>
      {/* Иконка типа */}
      <div
        className={cn(
          "w-3 text-[8px] flex-shrink-0 text-center font-medium",
          isPast
            ? "text-slate-400"
            : isFuture
            ? "text-slate-400"
            : type === "progress" && (theme === "dark" ? "text-teal-400" : "text-teal-600"),
          !isPast && !isFuture && type === "budget" && (theme === "dark" ? "text-amber-400" : "text-amber-600"),
          !isPast && !isFuture && type === "hours" && (theme === "dark" ? "text-violet-400" : "text-violet-600")
        )}
      >
        {getIcon()}
      </div>

      {/* Бар */}
      <div
        className={cn(
          "relative flex-1 h-[11px] overflow-visible",
          theme === "dark" ? "bg-slate-700/60" : "bg-slate-200/80"
        )}
      >
        {/* Основной заполненный бар */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 transition-all duration-300",
            getBarColor(),
            isFuture && "border border-dashed border-slate-400"
          )}
          style={{ width: `${barWidth}%` }}
        />

        {/* Индикатор превышения 100% - штриховка справа (только для текущей недели) */}
        {isCurrent && isOverLimit && (
          <div
            className={cn(
              "absolute inset-y-0 right-0 w-[6px]",
              "bg-gradient-to-r from-transparent",
              type === "budget" ? "to-rose-600" : "to-fuchsia-600"
            )}
            style={{
              background: `repeating-linear-gradient(
                -45deg,
                transparent,
                transparent 2px,
                ${type === "budget" ? "#e11d48" : "#c026d3"} 2px,
                ${type === "budget" ? "#e11d48" : "#c026d3"} 4px
              )`
            }}
            title={`Превышение: ${overflowAmount}%`}
          />
        )}

        {/* Выразительная линия плана с маркером (только для текущей недели) */}
        {isCurrent && (
          <>
            {/* Основная линия плана */}
            <div
              className={cn(
                "absolute top-[-2px] bottom-[-2px] w-[3px] z-10 rounded-full",
                isBehindPlan
                  ? "bg-rose-500 shadow-[0_0_4px_rgba(244,63,94,0.6)]"
                  : "bg-slate-500 shadow-[0_0_3px_rgba(100,116,139,0.4)]"
              )}
              style={{ left: `calc(${Math.min(plannedValue, 100)}% - 1.5px)` }}
            />
            {/* Треугольный маркер сверху */}
            <div
              className={cn(
                "absolute w-0 h-0 z-20",
                "border-l-[4px] border-l-transparent",
                "border-r-[4px] border-r-transparent",
                "border-t-[5px]",
                isBehindPlan ? "border-t-rose-500" : "border-t-slate-500"
              )}
              style={{
                left: `calc(${Math.min(plannedValue, 100)}% - 4px)`,
                top: "-6px"
              }}
            />
          </>
        )}

        {/* Gap индикатор отставания от плана (только для текущей недели) */}
        {isCurrent && type === "progress" && isBehindPlan && (
          <div
            className="absolute inset-y-0 bg-rose-500/20 border-r-2 border-rose-500/60"
            style={{
              left: `${value}%`,
              width: `${plannedValue - value}%`
            }}
          />
        )}

        {/* Значение */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-end pr-1 text-[9px] font-semibold tabular-nums z-20",
            isPast
              ? "text-slate-500"
              : isFuture
              ? theme === "dark" ? "text-slate-400" : "text-slate-500"
              : displayValue > 60
              ? "text-white drop-shadow-sm"
              : theme === "dark" ? "text-slate-300" : "text-slate-600"
          )}
        >
          <span className={cn(
            isCurrent && isOverLimit && "text-white",
            isCurrent && isBehindPlan && value <= 30 && "text-rose-500"
          )}>
            {displayValue}
          </span>
        </div>
      </div>

      {/* Прирост и индикаторы справа */}
      <div className="w-6 text-[8px] font-bold flex-shrink-0 text-right tabular-nums">
        {/* Прирост за неделю (для текущей недели) */}
        {isCurrent && increment !== 0 && (
          <span className={cn(
            increment > 0
              ? type === "budget" ? "text-amber-500" : "text-sky-500"
              : "text-slate-400"
          )}>
            +{increment}
          </span>
        )}
        {/* Превышение 100% */}
        {isCurrent && isOverLimit && increment === 0 && (
          <span className={cn(
            type === "budget" ? "text-rose-500" : "text-fuchsia-500"
          )}>
            +{overflowAmount}
          </span>
        )}
      </div>
    </div>
  )
}

function WeeklyBars({ weeklyStats, range, theme, onUpdatePlan }: WeeklyBarsProps) {
  const today = new Date()

  // Локальное состояние для редактирования планов
  const [localStats, setLocalStats] = useState<WeeklyStats[]>(weeklyStats)

  // Синхронизация с внешними данными
  useEffect(() => {
    setLocalStats(weeklyStats)
  }, [weeklyStats])

  // Обработчик изменения плана
  const handlePlanChange = (weekNumber: number, newValue: number) => {
    setLocalStats(prev => prev.map(week =>
      week.weekNumber === weekNumber
        ? { ...week, plannedProgress: newValue }
        : week
    ))
    onUpdatePlan?.(weekNumber, newValue)
  }

  // Вычисляем позицию каждой недели на таймлайне
  // Неделя начинается с понедельника
  const weeksWithPositions = useMemo(() => {
    return localStats.map(week => {
      // Парсим даты и выравниваем по понедельнику
      const weekStartRaw = parseISO(week.weekStart)
      const weekEndRaw = parseISO(week.weekEnd)

      // Выравниваем начало недели по понедельнику (weekStartsOn: 1)
      const weekStart = startOfWeek(weekStartRaw, { weekStartsOn: 1 })
      const weekEnd = weekEndRaw

      // Позиция начала недели в % от таймлайна
      const startDays = differenceInDays(weekStart, range.start)
      const endDays = differenceInDays(weekEnd, range.start)

      const left = Math.max(0, (startDays / range.totalDays) * 100)
      const right = Math.min(100, ((endDays + 1) / range.totalDays) * 100)
      const width = right - left

      // Определяем временной статус недели
      const isPast = weekEnd < today
      const isCurrent = weekStart <= today && weekEnd >= today
      const isFuture = weekStart > today

      // Определяем общий статус недели (для прошедших и текущей)
      const progressDiff = week.actualProgress - week.plannedProgress
      const budgetOverrun = week.actualBudgetSpent > week.plannedProgress
      const status: "good" | "warning" | "danger" =
        progressDiff < -10 || week.actualBudgetSpent > 100 ? "danger" :
        progressDiff < 0 || budgetOverrun ? "warning" : "good"

      return {
        ...week,
        left,
        width,
        status,
        isPast,
        isCurrent,
        isFuture,
      }
    }).filter(w => w.width > 0)
  }, [localStats, range, today])

  if (weeksWithPositions.length === 0) return null

  return (
    <div className="absolute inset-0 pt-[18px] flex items-center">
      <div className="relative w-full h-full">
        {weeksWithPositions.map((week, idx) => {
          const timeStatus = week.isPast ? "past" : week.isCurrent ? "current" : "future"
          // Получаем данные предыдущей недели для расчёта прироста
          const prevWeek = idx > 0 ? weeksWithPositions[idx - 1] : null

          return (
            <div
              key={week.weekNumber}
              className={cn(
                "absolute top-1/2 -translate-y-1/2 flex flex-col gap-[2px] px-0.5",
                week.isPast && "opacity-60"
              )}
              style={{
                left: `${week.left}%`,
                width: `${week.width}%`,
                height: "62px",
              }}
            >
              {/* Заголовок недели */}
              <div className={cn(
                "flex items-center justify-between px-0.5 h-[12px]",
                week.isPast
                  ? "text-slate-400"
                  : week.isFuture
                  ? "text-slate-400"
                  : theme === "dark" ? "text-slate-300" : "text-slate-600"
              )}>
                <span className={cn(
                  "text-[9px] font-semibold",
                  week.isCurrent && "text-sky-500",
                  week.isCurrent && week.status === "danger" && "text-rose-500",
                  week.isCurrent && week.status === "good" && week.actualProgress >= 100 && "text-emerald-500"
                )}>
                  {week.isCurrent ? "▸" : ""} W{week.weekNumber}
                </span>
                <EditablePlan
                  value={week.plannedProgress}
                  onChange={(newValue) => handlePlanChange(week.weekNumber, newValue)}
                  isFuture={week.isFuture}
                  isCurrent={week.isCurrent}
                  theme={theme}
                />
              </div>

              {/* Три метрики с общим плановым значением */}
              <MetricBar
                value={week.actualProgress}
                plannedValue={week.plannedProgress}
                prevValue={prevWeek?.actualProgress}
                type="progress"
                theme={theme}
                timeStatus={timeStatus}
              />
              <MetricBar
                value={week.actualBudgetSpent}
                plannedValue={week.plannedProgress}
                prevValue={prevWeek?.actualBudgetSpent}
                type="budget"
                theme={theme}
                timeStatus={timeStatus}
              />
              <MetricBar
                value={week.actualHoursSpent}
                plannedValue={week.plannedProgress}
                prevValue={prevWeek?.actualHoursSpent}
                type="hours"
                theme={theme}
                timeStatus={timeStatus}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Тип визуализации недельной статистики
export type WeeklyVisualVariant = "bars" | "chart"

interface SectionRowProps {
  section: PlanningSection
  range: TimelineRange
  dayCells: DayCell[]
  theme: string
  isExpanded: boolean
  onToggle: () => void
  expandedStages: Record<string, boolean>
  toggleStage: (stageId: string) => void
  visualVariant?: WeeklyVisualVariant // Вариант визуализации: bars (по умолчанию) или rings
}

export function SectionRow({
  section,
  range,
  dayCells,
  theme,
  isExpanded,
  onToggle,
  expandedStages,
  toggleStage,
  visualVariant,
}: SectionRowProps) {
  // Автоматический выбор варианта: для демо второй раздел с weeklyStats показываем графиком
  const effectiveVariant: WeeklyVisualVariant = visualVariant ??
    (section.id === "sec-kb-1" ? "chart" : "bars")

  const sectionBar = calculateBarPosition(section.startDate, section.endDate, range)
  const sortedStages = useMemo(
    () => [...section.stages].sort((a, b) => a.order - b.order),
    [section.stages]
  )

  // Calculate section progress
  const { totalPlannedHours, totalLoggedHours, progressPercent, doneStages, totalStages } = useMemo(() => {
    const totalPlanned = section.stages.reduce((sum, stage) => sum + stage.plannedHours, 0)
    const totalLogged = section.stages.reduce(
      (sum, stage) => sum + stage.tasks.reduce((ts, t) => ts + (t.workLogs || []).reduce((s, log) => s + log.hours, 0), 0),
      0
    )
    const done = section.stages.filter(s => s.status === "done").length
    return {
      totalPlannedHours: totalPlanned,
      totalLoggedHours: totalLogged,
      progressPercent: totalPlanned > 0 ? Math.min((totalLogged / totalPlanned) * 100, 100) : 0,
      doneStages: done,
      totalStages: section.stages.length,
    }
  }, [section.stages])

  return (
    <div className={cn(
      "group",
      theme === "dark"
        ? "border-t border-slate-700"
        : "border-t border-slate-200"
    )}>
      {/* Section header */}
      <div
        className={cn(
          "relative flex cursor-pointer transition-colors",
          // Увеличиваем высоту если есть недельная статистика и вехи
          section.weeklyStats && section.weeklyStats.length > 0
            ? section.milestones && section.milestones.length > 0
              ? "h-[94px]"  // С вехами
              : "h-[76px]"  // Без вех
            : "h-10",
          theme === "dark"
            ? "hover:bg-slate-800/50"
            : "hover:bg-slate-50"
        )}
        onClick={onToggle}
      >
        {/* Left info panel */}
        <div
          className={cn(
            "w-96 flex-shrink-0 pl-[84px] pr-4 border-r flex items-center gap-2",
            theme === "dark"
              ? "border-slate-700/50 bg-slate-900/50"
              : "border-slate-200 bg-slate-50/50"
          )}
        >
          <ChevronRight
            className={cn(
              "w-3 h-3 flex-shrink-0 transition-transform duration-200",
              theme === "dark" ? "text-cyan-400" : "text-cyan-500",
              isExpanded && "rotate-90"
            )}
          />
          <Box className={cn(
            "w-3.5 h-3.5 flex-shrink-0",
            theme === "dark" ? "text-cyan-400" : "text-cyan-500"
          )} />
          <h3
            className={cn(
              "text-sm truncate flex-1",
              theme === "dark" ? "text-slate-200" : "text-slate-800"
            )}
            title={section.name}
          >
            {section.name}
          </h3>
          <span
            className={cn(
              "text-[11px] flex-shrink-0",
              theme === "dark" ? "text-slate-500" : "text-slate-400"
            )}
          >
            {formatDate(section.startDate)}—{formatDate(section.endDate)}
          </span>
          <span
            className={cn(
              "text-xs tabular-nums flex-shrink-0",
              progressPercent >= 100
                ? "text-green-500"
                : progressPercent >= 50
                ? "text-teal-500"
                : progressPercent > 0
                ? "text-blue-500"
                : theme === "dark" ? "text-slate-500" : "text-slate-400"
            )}
          >
            {totalLoggedHours}/{totalPlannedHours}ч
          </span>

          {/* Budget badge */}
          {section.budget && (() => {
            const config = budgetConfig[section.budget.type]
            const BudgetIcon = config.icon
            const budgetPercent = section.budget.amount > 0
              ? Math.round((section.budget.spent / section.budget.amount) * 100)
              : 0
            return (
              <div
                className={cn(
                  "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0",
                  config.bgClass,
                  config.colorClass
                )}
                title={`${config.label} бюджет: ${formatBudget(section.budget.spent)} / ${formatBudget(section.budget.amount)} (${budgetPercent}%)`}
              >
                <BudgetIcon className="w-3 h-3" />
                <span>{formatBudget(section.budget.spent)}/{formatBudget(section.budget.amount)}</span>
              </div>
            )
          })()}
        </div>

        {/* Timeline area */}
        <div className={cn(
          "flex-1 relative",
          theme === "dark" ? "bg-slate-900" : "bg-white"
        )}>
          <TimelineGridBackground dayCells={dayCells} theme={theme} />

          {/* Если есть недельная статистика - показываем выбранный вариант визуализации */}
          {section.weeklyStats && section.weeklyStats.length > 0 ? (
            effectiveVariant === "chart" ? (
              <WeeklyChart
                weeklyStats={section.weeklyStats}
                range={range}
                theme={theme}
              />
            ) : (
              <WeeklyBars
                weeklyStats={section.weeklyStats}
                range={range}
                theme={theme}
              />
            )
          ) : (
            /* Иначе показываем обычные прогресс-бары */
            sectionBar && (
              <div
                className="absolute flex flex-col gap-0.5 z-10"
                style={{
                  left: `${sectionBar.left}%`,
                  width: `${sectionBar.width}%`,
                  minWidth: "20px",
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
              >
                {/* Progress bar (hours) */}
                <div
                  className={cn(
                    "h-[14px] overflow-hidden relative",
                    theme === "dark"
                      ? "bg-slate-700/50 border border-slate-600/50"
                      : "bg-slate-200 border border-slate-300"
                  )}
                  title={`Готовность: ${totalLoggedHours}/${totalPlannedHours}ч (${Math.round(progressPercent)}%) • ${doneStages}/${totalStages} этапов`}
                >
                  {/* Progress fill */}
                  <div
                    className={cn(
                      "absolute inset-y-0 left-0 transition-all duration-500",
                      progressPercent >= 100
                        ? "bg-green-500"
                        : progressPercent >= 50
                        ? "bg-teal-500"
                        : progressPercent > 0
                        ? "bg-blue-500"
                        : ""
                    )}
                    style={{ width: `${progressPercent}%` }}
                  />
                  {/* Progress text */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={cn(
                      "text-[9px] font-bold drop-shadow-sm",
                      progressPercent > 50
                        ? "text-white"
                        : theme === "dark" ? "text-slate-300" : "text-slate-600"
                    )}>
                      {Math.round(progressPercent)}%
                    </span>
                  </div>
                </div>

                {/* Budget bar */}
                {section.budget && (() => {
                  const budgetPercent = section.budget.amount > 0
                    ? Math.min((section.budget.spent / section.budget.amount) * 100, 100)
                    : 0
                  const config = budgetConfig[section.budget.type]
                  return (
                    <div
                      className={cn(
                        "h-[14px] overflow-hidden relative",
                        theme === "dark"
                          ? "bg-slate-700/50 border border-slate-600/50"
                          : "bg-slate-200 border border-slate-300"
                      )}
                      title={`Бюджет (${config.label.toLowerCase()}): ${formatBudget(section.budget.spent)} / ${formatBudget(section.budget.amount)} (${Math.round(budgetPercent)}%)`}
                    >
                      {/* Budget fill */}
                      <div
                        className={cn(
                          "absolute inset-y-0 left-0 transition-all duration-500",
                          budgetPercent >= 100
                            ? "bg-red-500"
                            : budgetPercent >= 80
                            ? "bg-amber-500"
                            : section.budget.type === "premium"
                            ? "bg-amber-400"
                            : "bg-emerald-500"
                        )}
                        style={{ width: `${budgetPercent}%` }}
                      />
                      {/* Budget text */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className={cn(
                          "text-[9px] font-bold drop-shadow-sm",
                          budgetPercent > 50
                            ? "text-white"
                            : theme === "dark" ? "text-slate-300" : "text-slate-600"
                        )}>
                          {Math.round(budgetPercent)}%
                        </span>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )
          )}

          {/* Milestones timeline - над барами */}
          {section.milestones && section.milestones.length > 0 && section.weeklyStats && (
            <MilestonesTimeline
              milestones={section.milestones}
              range={range}
              theme={theme}
            />
          )}
        </div>
      </div>

      {/* Expanded stages */}
      <div
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          {sortedStages.map((stage, stageIndex) => (
            <StageRow
              key={stage.id}
              stage={stage}
              range={range}
              dayCells={dayCells}
              theme={theme}
              colorIndex={stageIndex % stageColors.length}
              index={stageIndex}
              isVisible={isExpanded}
              isExpanded={expandedStages[stage.id] ?? false}
              onToggle={() => toggleStage(stage.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
