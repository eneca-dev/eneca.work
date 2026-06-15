/**
 * Team Subgroup Divider
 *
 * Лёгкий разделитель между подгруппами команд внутри одного отдела
 * (например, гражд/пром направления внутри ВК на дневном виде).
 */

'use client'

import { SIDEBAR_WIDTH } from '../../constants'

interface TeamSubgroupDividerProps {
  /** Подпись подгруппы, идущей ниже разделителя */
  label: string
  /** Полная ширина строки (sidebar + timeline) */
  width: number
}

export function TeamSubgroupDivider({ label, width }: TeamSubgroupDividerProps) {
  return (
    <div
      className="flex items-stretch h-5 border-y border-border/60 bg-muted/30"
      style={{ width }}
    >
      <div
        className="shrink-0 flex items-center px-3 border-r border-border bg-card sticky left-0 z-10"
        style={{ width: SIDEBAR_WIDTH }}
      >
        <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
    </div>
  )
}
