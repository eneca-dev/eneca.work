/**
 * Stale Group Row — свёрнутая по умолчанию группа проектов отдела, исключённых
 * из основного списка. Критерий и подпись приходят снаружи (см. flattenSections):
 * без периода в календаре — «Завершённые» (Project.isStale), с периодом —
 * «Нет загрузок за период». Клик разворачивает/сворачивает — тогда сами проекты
 * рендерятся обычными ProjectRowContent через flattenSections.
 */

'use client'

import { ChevronDown, ChevronRight, Archive } from 'lucide-react'
import { useSectionsPageUIStore } from '../../stores/useSectionsPageUIStore'
import { staleGroupNodeId } from '../flatten-sections'
import { SIDEBAR_WIDTH, PROJECT_ROW_HEIGHT } from '../../constants'

interface StaleGroupRowProps {
  departmentId: string
  count: number
  label: string
  title: string
}

export function StaleGroupRow({ departmentId, count, label, title }: StaleGroupRowProps) {
  const nodeId = staleGroupNodeId(departmentId)
  const isExpanded = useSectionsPageUIStore((s) => s.isExpanded(nodeId))
  const toggleStore = useSectionsPageUIStore((s) => s.toggle)
  const toggle = () => toggleStore(nodeId)

  return (
    <div className="group/row min-w-full relative border-b border-border/50 bg-muted/10">
      <div
        className="flex items-center gap-2 px-3 sticky left-0 z-10 bg-muted/40 cursor-pointer hover:bg-accent transition-colors text-muted-foreground"
        style={{ height: PROJECT_ROW_HEIGHT, width: SIDEBAR_WIDTH }}
        onClick={toggle}
        title={title}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 flex-shrink-0" />
        )}
        <Archive className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="text-xs">{label} ({count})</span>
      </div>
    </div>
  )
}
