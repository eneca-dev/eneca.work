"use client"

import { useMemo } from "react"
import { Users } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Loading, TimelineUnit } from "../../types"
import {
  sectionLoadingsToPeriods,
  calculateSectionBarRenders,
  getSectionLoadingLabelParts,
  formatSectionLoadingTooltip,
  calculateBarTop,
  BASE_BAR_HEIGHT,
  BAR_GAP,
  type SectionLoadingPeriod,
  type BarRender,
} from "./loading-bars-utils"

interface SectionLoadingBarsProps {
  loadings: Loading[]
  timeUnits: TimelineUnit[]
  cellWidth: number
  theme: string
  rowHeight: number
}

/**
 * Компонент для отображения чипов загрузок в строке раздела
 * Показывает команду и имя сотрудника
 */
export function SectionLoadingBars({
  loadings,
  timeUnits,
  cellWidth,
  theme,
}: SectionLoadingBarsProps) {
  const isDark = theme === "dark"

  // Преобразуем загрузки в периоды (с объединением смежных)
  const periods = useMemo(() => {
    return sectionLoadingsToPeriods(loadings)
  }, [loadings])

  // Вычисляем параметры отрисовки баров
  const barRenders = useMemo(() => {
    if (periods.length === 0 || timeUnits.length === 0) return []
    return calculateSectionBarRenders(periods, timeUnits, cellWidth, isDark)
  }, [periods, timeUnits, cellWidth, isDark])

  // Если нет баров — ничего не рендерим
  if (barRenders.length === 0) return null

  // Находим соответствующий SectionLoadingPeriod для каждого barRender
  const getOriginalPeriod = (barRender: BarRender): SectionLoadingPeriod | undefined => {
    return periods.find(p => p.id === barRender.period.id)
  }

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 4 }}>
      {barRenders.map((bar, idx) => {
        const originalPeriod = getOriginalPeriod(bar)
        if (!originalPeriod) return null

        const barHeight = BASE_BAR_HEIGHT // Фиксированная высота

        // Вычисляем top на основе слоя
        const top = calculateBarTop(bar, barRenders, BASE_BAR_HEIGHT, BAR_GAP, 4)

        const labelParts = getSectionLoadingLabelParts(originalPeriod, bar.width)

        return (
          <div
            key={`${bar.period.id}-${idx}`}
            className={cn(
              "absolute rounded pointer-events-auto",
              "flex items-center",
              "cursor-pointer hover:brightness-110"
            )}
            style={{
              left: `${bar.left}px`,
              width: `${bar.width}px`,
              height: `${barHeight}px`,
              top: `${top}px`,
              backgroundColor: bar.color,
              opacity: 0.85,
              border: `2px solid ${bar.color}`,
              paddingLeft: "6px",
              paddingRight: "6px",
              overflow: "hidden",
              filter: "brightness(1.05)",
            }}
            title={formatSectionLoadingTooltip(originalPeriod)}
          >
            {renderBarContent(labelParts, originalPeriod, isDark)}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Рендерит содержимое бара в зависимости от режима отображения
 */
function renderBarContent(
  labelParts: ReturnType<typeof getSectionLoadingLabelParts>,
  period: SectionLoadingPeriod,
  isDark: boolean
) {
  const { displayMode, teamName, employeeName } = labelParts

  // Общие стили для текста
  const textShadow = "0 1px 2px rgba(0,0,0,0.5)"
  const iconFilter = "drop-shadow(0 1px 1px rgba(0,0,0,0.5))"

  if (displayMode === 'icon-only') {
    return (
      <Users
        size={12}
        className="text-white flex-shrink-0"
        style={{ filter: iconFilter }}
      />
    )
  }

  if (displayMode === 'minimal') {
    // Только имя (или инициалы если очень узко)
    const shortName = getShortName(employeeName || '')
    return (
      <span
        className="text-[10px] font-semibold text-white truncate"
        style={{ textShadow }}
      >
        {shortName}
      </span>
    )
  }

  if (displayMode === 'compact') {
    // Команда или имя в одну строку
    return (
      <div className="flex items-center gap-1 overflow-hidden">
        <Users
          size={10}
          className="text-white flex-shrink-0"
          style={{ filter: iconFilter }}
        />
        <span
          className="text-[10px] font-semibold text-white truncate"
          style={{ textShadow }}
          title={`${teamName} - ${employeeName}`}
        >
          {employeeName || teamName}
        </span>
      </div>
    )
  }

  // full mode — команда и имя
  return (
    <div className="flex flex-col justify-center overflow-hidden w-full" style={{ gap: "1px" }}>
      {/* Команда */}
      <div className="flex items-center gap-1 overflow-hidden">
        <Users
          size={9}
          className="text-white/90 flex-shrink-0"
          style={{ filter: iconFilter }}
        />
        <span
          className="text-[9px] font-medium text-white/90 truncate"
          style={{ textShadow, lineHeight: "1.2" }}
          title={teamName}
        >
          {teamName}
        </span>
      </div>
      {/* Имя сотрудника */}
      <div className="overflow-hidden">
        <span
          className="text-[10px] font-semibold text-white truncate block"
          style={{ textShadow, lineHeight: "1.2" }}
          title={employeeName}
        >
          {employeeName}
        </span>
      </div>
    </div>
  )
}

/**
 * Возвращает сокращённое имя (инициалы или первое имя)
 */
function getShortName(fullName: string): string {
  if (!fullName) return '?'

  const parts = fullName.trim().split(/\s+/)

  // Если имя короткое — возвращаем как есть
  if (parts[0].length <= 6) {
    return parts[0]
  }

  // Иначе — инициалы
  if (parts.length >= 2) {
    return `${parts[0][0]}.${parts[1][0]}.`
  }

  return parts[0].substring(0, 6) + '.'
}

/**
 * Вычисляет требуемую высоту для отображения всех баров
 */
export function calculateSectionBarsHeight(
  loadings: Loading[],
  timeUnits: TimelineUnit[],
  cellWidth: number,
  isDark: boolean,
  minHeight: number
): number {
  const periods = sectionLoadingsToPeriods(loadings)
  if (periods.length === 0) return minHeight

  const barRenders = calculateSectionBarRenders(periods, timeUnits, cellWidth, isDark)
  if (barRenders.length === 0) return minHeight

  let maxBottom = 0

  barRenders.forEach(bar => {
    const barHeight = BASE_BAR_HEIGHT * (bar.period.rate || 1)
    const top = calculateBarTop(bar, barRenders, BASE_BAR_HEIGHT, BAR_GAP, 4)
    maxBottom = Math.max(maxBottom, top + barHeight)
  })

  return Math.max(minHeight, maxBottom + 4)
}
