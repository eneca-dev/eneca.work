/**
 * Department Group Divider
 *
 * Визуальный разделитель между группами отделов: Гражданское / Общие / Промышленное.
 * Лейбл в левой sticky-области, акцентная линия через весь timeline.
 */

'use client'

import { SIDEBAR_WIDTH } from '../../constants'

interface DepartmentGroupDividerProps {
  /** Подпись группы, которая идёт ниже разделителя */
  label: string
  /** Полная ширина строки (sidebar + timeline) */
  width: number
}

export function DepartmentGroupDivider({ label, width }: DepartmentGroupDividerProps) {
  return (
    <div
      className="flex items-stretch h-9 border-y-2 border-primary/40 bg-primary/[0.07]"
      style={{ width }}
    >
      <div
        className="shrink-0 flex items-center px-3 border-r border-border bg-card sticky left-0 z-20"
        style={{ width: SIDEBAR_WIDTH }}
      >
        <div className="flex items-center gap-2">
          <div className="h-[3px] w-3 rounded-full bg-primary/60" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-primary/90">
            {label}
          </span>
        </div>
      </div>
    </div>
  )
}
