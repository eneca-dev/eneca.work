/**
 * DeptEmployeeRow — строка именного сотрудника (leaf)
 *
 * Bar на таймлайне: цветной фон с полосками, ставка + название проекта/объекта/этапа
 */

'use client'

import { useMemo } from 'react'
import { FolderKanban, Building2 } from 'lucide-react'
import { formatMinskDate } from '@/lib/timezone-utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getCellClassNames } from '../../utils'
import { SIDEBAR_WIDTH, DAY_CELL_WIDTH } from '../../constants'
import type { DeptEmployeeLeaf } from '../../types/hierarchy'
import type { DayCell } from '../../types'

const EMPLOYEE_ROW_HEIGHT = 44
const BAR_HEIGHT = 34

// Палитра цветов для баров загрузок
const BAR_COLORS = [
  { bg: 'rgba(147, 51, 234, 0.85)', stripe: 'rgba(147, 51, 234, 0.55)', text: '#fff' },  // purple
  { bg: 'rgba(37, 99, 235, 0.85)', stripe: 'rgba(37, 99, 235, 0.55)', text: '#fff' },    // blue
  { bg: 'rgba(22, 163, 74, 0.85)', stripe: 'rgba(22, 163, 74, 0.55)', text: '#fff' },    // green
  { bg: 'rgba(234, 88, 12, 0.85)', stripe: 'rgba(234, 88, 12, 0.55)', text: '#fff' },    // orange
  { bg: 'rgba(219, 39, 119, 0.85)', stripe: 'rgba(219, 39, 119, 0.55)', text: '#fff' },  // pink
  { bg: 'rgba(79, 70, 229, 0.85)', stripe: 'rgba(79, 70, 229, 0.55)', text: '#fff' },    // indigo
  { bg: 'rgba(13, 148, 136, 0.85)', stripe: 'rgba(13, 148, 136, 0.55)', text: '#fff' },  // teal
  { bg: 'rgba(202, 138, 4, 0.85)', stripe: 'rgba(202, 138, 4, 0.55)', text: '#fff' },    // yellow
]

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function getBarColor(id: string) {
  return BAR_COLORS[hashString(id) % BAR_COLORS.length]
}

interface DeptEmployeeRowProps {
  employee: DeptEmployeeLeaf
  dayCells: DayCell[]
  /** Название проекта — для отображения на баре */
  projectName: string
  /** Название объекта — для отображения на баре */
  objectName: string
}

function getInitials(name: string): string {
  const parts = name.split(' ')
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return name[0]?.toUpperCase() || '?'
}

export function DeptEmployeeRow({ employee, dayCells, projectName, objectName }: DeptEmployeeRowProps) {
  const timelineWidth = dayCells.length * DAY_CELL_WIDTH

  // Calculate bar position
  const barPosition = useMemo(() => {
    if (!employee.startDate || !employee.endDate) return null

    const startDate = new Date(employee.startDate + 'T00:00:00')
    const endDate = new Date(employee.endDate + 'T00:00:00')

    let startIdx = -1
    let endIdx = -1

    for (let i = 0; i < dayCells.length; i++) {
      const cellDate = formatMinskDate(dayCells[i].date)
      if (cellDate === employee.startDate) startIdx = i
      if (cellDate === employee.endDate) endIdx = i
    }

    if (startIdx === -1 && startDate < dayCells[0]?.date) startIdx = 0
    if (endIdx === -1 && endDate > dayCells[dayCells.length - 1]?.date) endIdx = dayCells.length - 1

    if (startIdx === -1 || endIdx === -1) return null

    return {
      left: startIdx * DAY_CELL_WIDTH,
      width: (endIdx - startIdx + 1) * DAY_CELL_WIDTH,
    }
  }, [employee.startDate, employee.endDate, dayCells])

  const color = getBarColor(employee.id)

  return (
    <div className="group/row min-w-full relative border-b border-border/30">
      <div
        className="flex transition-colors"
        style={{ height: EMPLOYEE_ROW_HEIGHT }}
      >
        {/* Sidebar */}
        <div
          className="shrink-0 flex items-center justify-between px-3 border-r border-border bg-card sticky left-0 z-20"
          style={{ width: SIDEBAR_WIDTH }}
        >
          <div className="flex items-center gap-2 min-w-0 pl-14">
            <Avatar className="h-6 w-6 flex-shrink-0">
              <AvatarImage src={employee.avatarUrl} />
              <AvatarFallback className="text-[10px]">
                {getInitials(employee.employeeName)}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0">
              <span className="text-xs font-medium truncate block">
                {employee.employeeName}
              </span>
              {employee.position && (
                <span className="text-[10px] text-muted-foreground truncate block">
                  {employee.position}
                </span>
              )}
            </div>
          </div>

          {/* Rate badge */}
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary flex-shrink-0">
            {employee.rate}
          </span>
        </div>

        {/* Timeline */}
        <div className="flex relative z-0" style={{ width: timelineWidth }}>
          {/* Loading bar */}
          {barPosition && (
            <div
              className="absolute pointer-events-none z-10"
              style={{
                left: barPosition.left + 2,
                width: barPosition.width - 4,
                top: (EMPLOYEE_ROW_HEIGHT - BAR_HEIGHT) / 2,
                height: BAR_HEIGHT,
              }}
            >
              <div
                className="w-full h-full rounded-[3px] flex flex-col justify-center overflow-hidden px-2"
                style={{
                  background: `
                    repeating-linear-gradient(
                      -45deg,
                      ${color.bg},
                      ${color.bg} 3px,
                      ${color.stripe} 3px,
                      ${color.stripe} 6px
                    )
                  `,
                }}
                title={`${employee.employeeName}\n${projectName} / ${objectName}${employee.stageName ? `\n${employee.stageName}` : ''}\nСтавка: ${employee.rate}\n${employee.startDate} — ${employee.endDate}`}
              >
                {/* Line 1: rate + project name */}
                <div className="flex items-center gap-1 min-w-0">
                  <span
                    className="px-1 py-px text-[10px] font-bold flex-shrink-0 tabular-nums rounded-sm"
                    style={{
                      color: color.bg.replace('0.85', '1'),
                      backgroundColor: 'rgba(255,255,255,0.9)',
                    }}
                  >
                    {employee.rate}
                  </span>
                  <FolderKanban className="h-3 w-3 flex-shrink-0" style={{ color: color.text }} />
                  <span className="text-[10px] font-medium truncate" style={{ color: color.text }}>
                    {projectName}
                  </span>
                </div>
                {/* Line 2: object name + optional stage */}
                <div className="flex items-center gap-1 min-w-0 mt-px">
                  <Building2 className="h-3 w-3 flex-shrink-0 ml-[2px]" style={{ color: color.text, opacity: 0.8 }} />
                  <span className="text-[10px] truncate" style={{ color: color.text, opacity: 0.9 }}>
                    {objectName}
                    {employee.stageName && ` \u00b7 ${employee.stageName}`}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Background cells */}
          {dayCells.map((cell, i) => (
            <div
              key={i}
              className={getCellClassNames(cell)}
              style={{ width: DAY_CELL_WIDTH, height: EMPLOYEE_ROW_HEIGHT }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
