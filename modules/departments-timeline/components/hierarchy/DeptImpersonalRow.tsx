/**
 * DeptImpersonalRow — строка безличной загрузки
 *
 * Bar на таймлайне в стиле EmployeeRow: ставка + проект · объект (оранжевый)
 */

'use client'

import { useMemo } from 'react'
import { UserX, FolderKanban, Building2 } from 'lucide-react'
import { formatMinskDate } from '@/lib/timezone-utils'
import { getCellClassNames } from '../../utils'
import { SIDEBAR_WIDTH, DAY_CELL_WIDTH } from '../../constants'
import type { DeptImpersonalLoading } from '../../types/hierarchy'
import type { DayCell } from '../../types'

const IMPERSONAL_ROW_HEIGHT = 44
const BAR_HEIGHT = 36

interface DeptImpersonalRowProps {
  loading: DeptImpersonalLoading
  dayCells: DayCell[]
  /** Текст на баре (проект · объект) */
  barLabel?: string
}

export function DeptImpersonalRow({ loading, dayCells, barLabel }: DeptImpersonalRowProps) {
  const timelineWidth = dayCells.length * DAY_CELL_WIDTH

  // Calculate bar position
  const barPosition = useMemo(() => {
    if (!loading.startDate || !loading.endDate) return null

    const startDate = new Date(loading.startDate + 'T00:00:00')
    const endDate = new Date(loading.endDate + 'T00:00:00')

    let startIdx = -1
    let endIdx = -1

    for (let i = 0; i < dayCells.length; i++) {
      const cellDate = formatMinskDate(dayCells[i].date)
      if (cellDate === loading.startDate) startIdx = i
      if (cellDate === loading.endDate) endIdx = i
    }

    if (startIdx === -1 && startDate < dayCells[0]?.date) startIdx = 0
    if (endIdx === -1 && endDate > dayCells[dayCells.length - 1]?.date) endIdx = dayCells.length - 1

    if (startIdx === -1 || endIdx === -1) return null

    return {
      left: startIdx * DAY_CELL_WIDTH,
      width: (endIdx - startIdx + 1) * DAY_CELL_WIDTH,
    }
  }, [loading.startDate, loading.endDate, dayCells])

  // Parse barLabel into parts: "Project · Object"
  const labelParts = useMemo(() => {
    if (!barLabel) return []
    return barLabel.split(' · ')
  }, [barLabel])

  const barColor = 'rgb(249, 115, 22)'

  return (
    <div className="group/row min-w-full relative border-b border-border/30">
      <div
        className="flex transition-colors"
        style={{ height: IMPERSONAL_ROW_HEIGHT }}
      >
        {/* Sidebar */}
        <div
          className="shrink-0 flex items-center justify-between px-3 border-r border-border bg-card sticky left-0 z-20"
          style={{ width: SIDEBAR_WIDTH }}
        >
          <div className="flex items-center gap-2 min-w-0 pl-[72px]">
            <UserX className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
            <span className="text-xs text-muted-foreground truncate">
              {loading.label}
            </span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 flex-shrink-0">
            {loading.rate}
          </span>
        </div>

        {/* Timeline */}
        <div className="flex relative z-0" style={{ width: timelineWidth }}>
          {/* Bar overlay */}
          {barPosition && (
            <div
              className="absolute pointer-events-none z-10"
              style={{
                left: barPosition.left + 2,
                width: barPosition.width - 4,
                top: (IMPERSONAL_ROW_HEIGHT - BAR_HEIGHT) / 2,
                height: BAR_HEIGHT,
              }}
            >
              <div
                className="w-full h-full rounded flex items-center overflow-hidden"
                style={{
                  backgroundColor: barColor,
                  opacity: 0.85,
                  border: `2px solid ${barColor}`,
                  paddingLeft: 6,
                  paddingRight: 6,
                  filter: 'brightness(1.1)',
                }}
                title={`Ставка: ${loading.rate}\n${barLabel || loading.label}\n${loading.startDate} — ${loading.endDate}`}
              >
                <div className="flex items-start gap-1 overflow-hidden w-full h-full">
                  <span className="mt-1.5 px-1 py-0.5 bg-black/15 text-white text-[9px] font-semibold rounded flex-shrink-0 tabular-nums">
                    {loading.rate}
                  </span>
                  <div className="flex flex-col justify-center items-start overflow-hidden flex-1" style={{ gap: 1 }}>
                    {labelParts[0] && (
                      <div className="flex items-center gap-1 w-full overflow-hidden">
                        <FolderKanban size={10} className="text-white flex-shrink-0" />
                        <span className="text-[9px] font-semibold text-white truncate">
                          {labelParts[0]}
                        </span>
                      </div>
                    )}
                    {labelParts[1] && (
                      <div className="flex items-center gap-1 w-full overflow-hidden">
                        <Building2 size={9} className="text-white/90 flex-shrink-0" />
                        <span className="text-[9px] font-medium text-white/90 truncate">
                          {labelParts.slice(1).join(' · ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Background cells */}
          {dayCells.map((cell, i) => (
            <div
              key={i}
              className={getCellClassNames(cell)}
              style={{ width: DAY_CELL_WIDTH, height: IMPERSONAL_ROW_HEIGHT }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
