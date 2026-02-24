"use client"

import { useMemo } from "react"
import type { Section, TimelineUnit, Loading } from "../../types"
import {
  calculateDailyIntensity,
  getIntensityColor,
} from "./loading-bars-utils"

interface ProjectIntensityBarProps {
  sections: Section[]
  timeUnits: TimelineUnit[]
  cellWidth: number
  theme: string
  loadingsMap?: Record<string, Loading[]>
  rowHeight: number
}

/**
 * Компонент для отображения heatmap интенсивности загрузки проекта.
 * Показывает цветовую интенсивность по дням на основе суммарной ставки.
 */
export function ProjectIntensityBar({
  sections,
  timeUnits,
  cellWidth,
  theme,
  loadingsMap,
  rowHeight,
}: ProjectIntensityBarProps) {
  const isDark = theme === "dark"

  // Вычисляем интенсивность по дням
  const dailyIntensity = useMemo(() => {
    return calculateDailyIntensity(sections, timeUnits, loadingsMap)
  }, [sections, timeUnits, loadingsMap])

  // Находим максимальную интенсивность для нормализации
  const maxIntensity = useMemo(() => {
    return Math.max(...dailyIntensity.map(d => d.totalRate), 1)
  }, [dailyIntensity])

  // Проверяем есть ли вообще загрузки
  const hasAnyLoad = useMemo(() => {
    return dailyIntensity.some(d => d.totalRate > 0)
  }, [dailyIntensity])

  // Ранний выход если нет загрузок - после всех хуков
  if (!hasAnyLoad) return null

  return (
    <div
      className="absolute inset-0 pointer-events-none flex"
      style={{ zIndex: 3 }}
    >
      {dailyIntensity.map((day, idx) => {
        const unit = timeUnits[idx]
        if (!unit) return null

        const color = getIntensityColor(day.totalRate, maxIntensity, isDark)
        const hasLoad = day.totalRate > 0

        return (
          <div
            key={idx}
            className="pointer-events-auto relative flex items-center justify-center"
            style={{
              width: `${unit.width ?? cellWidth}px`,
              minWidth: `${unit.width ?? cellWidth}px`,
              height: `${rowHeight}px`,
              backgroundColor: color,
              flexShrink: 0,
            }}
            title={hasLoad ? `${day.totalRate.toFixed(1)} ставок • ${day.teamsCount} команд • ${day.employeesCount} человек` : undefined}
          >
            {hasLoad && (
              <span
                className="select-none"
                style={{
                  fontSize: '9px',
                  fontWeight: 500,
                  color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)',
                  lineHeight: 1,
                }}
              >
                {day.totalRate >= 10 ? Math.round(day.totalRate) : (day.totalRate % 1 === 0 ? day.totalRate : day.totalRate.toFixed(1))}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
