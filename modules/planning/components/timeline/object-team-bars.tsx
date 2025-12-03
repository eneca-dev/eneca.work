"use client"

import { useMemo } from "react"
import { Users } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Section, TimelineUnit, Loading } from "../../types"
import {
  aggregateLoadingsByTeam,
  calculateObjectTeamBarRenders,
  formatObjectTeamTooltip,
  type ObjectTeamPeriod,
} from "./loading-bars-utils"

interface ObjectTeamBarsProps {
  sections: Section[]
  timeUnits: TimelineUnit[]
  cellWidth: number
  theme: string
  loadingsMap?: Record<string, Loading[]>
}

// Высота одной линии команды
const TEAM_LINE_HEIGHT = 16
const LINE_GAP = 2

/**
 * Компонент для отображения линий команд на уровне объекта.
 * Показывает тонкие цветные линии с названием команды в начале.
 */
export function ObjectTeamBars({
  sections,
  timeUnits,
  cellWidth,
  theme,
  loadingsMap,
}: ObjectTeamBarsProps) {
  const isDark = theme === "dark"

  // Агрегируем загрузки по командам
  const teamPeriods = useMemo(() => {
    return aggregateLoadingsByTeam(sections, loadingsMap)
  }, [sections, loadingsMap])

  // Вычисляем параметры отрисовки
  const barRenders = useMemo(() => {
    if (teamPeriods.length === 0 || timeUnits.length === 0) return []
    return calculateObjectTeamBarRenders(teamPeriods, timeUnits, cellWidth, isDark)
  }, [teamPeriods, timeUnits, cellWidth, isDark])

  if (barRenders.length === 0) return null

  // Находим уникальные команды и их слои
  const uniqueTeams = new Map<string, number>()
  barRenders.forEach(bar => {
    if (!uniqueTeams.has(bar.period.teamName)) {
      uniqueTeams.set(bar.period.teamName, bar.layer)
    }
  })

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 4 }}>
      {barRenders.map((bar, idx) => {
        const top = 4 + bar.layer * (TEAM_LINE_HEIGHT + LINE_GAP)

        // Определяем, начинается ли линия с начала видимой области
        const isStartVisible = bar.left > 5

        return (
          <div
            key={`${bar.period.id}-${idx}`}
            className={cn(
              "absolute rounded-sm transition-all duration-200 pointer-events-auto",
              "flex items-center",
              "cursor-pointer hover:brightness-110"
            )}
            style={{
              left: `${bar.left}px`,
              width: `${bar.width}px`,
              height: `${TEAM_LINE_HEIGHT}px`,
              top: `${top}px`,
              backgroundColor: bar.color,
              opacity: 0.9,
            }}
            title={formatObjectTeamTooltip(bar.period)}
          >
            {/* Название команды - всегда показываем если есть место */}
            <div
              className="flex items-center gap-1 px-1.5 h-full overflow-hidden"
              style={{ maxWidth: `${bar.width - 2}px` }}
            >
              <Users
                size={10}
                className="text-white flex-shrink-0"
                style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.5))" }}
              />
              {bar.width >= 50 && (
                <span
                  className="text-[10px] font-medium text-white truncate"
                  style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
                >
                  {bar.period.teamName}
                </span>
              )}
              {bar.width >= 80 && bar.period.employeeCount > 1 && (
                <span
                  className="text-[9px] text-white/80 flex-shrink-0"
                  style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
                >
                  ({bar.period.employeeCount})
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Вычисляет требуемую высоту для отображения всех линий команд
 */
export function calculateObjectTeamBarsHeight(
  sections: Section[],
  minHeight: number,
  loadingsMap?: Record<string, Loading[]>
): number {
  const teamPeriods = aggregateLoadingsByTeam(sections, loadingsMap)
  if (teamPeriods.length === 0) return minHeight

  // Находим количество уникальных команд
  const uniqueTeams = new Set(teamPeriods.map(p => p.teamName))
  const teamCount = uniqueTeams.size

  const requiredHeight = 4 + teamCount * (TEAM_LINE_HEIGHT + LINE_GAP) + 4

  return Math.max(minHeight, requiredHeight)
}
