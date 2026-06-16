'use client'

import { useState, useRef, useMemo, forwardRef, useCallback, useEffect } from 'react'
import { addDays, differenceInDays, format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ChevronDown, ChevronRight, ZoomIn, ZoomOut, FolderKanban, Building2, FileText, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import type React from 'react'
import { getTodayMinsk, parseMinskDate } from '@/lib/timezone-utils'
import { SIDEBAR_WIDTH } from '@/modules/resource-graph/constants'
import { InlineFilter, parseFilterString } from '@/modules/inline-filter'
import type { FilterConfig, FilterOption } from '@/modules/inline-filter'
import { MOCK_PROJECTS } from '../mock-data'
import type { GanttScale, MockProject, MockStage } from '../types'

// ─── Filter config ────────────────────────────────────────────────────────────
const DIAGRAM_FILTER_CONFIG: FilterConfig = {
  keys: {
    'проект': { field: 'project_name', label: 'Проект', icon: FolderKanban, color: 'amber' },
    'объект': { field: 'object_name', label: 'Объект', icon: Building2, color: 'blue' },
    'раздел': { field: 'section_name', label: 'Раздел', icon: FileText, color: 'emerald' },
    'этап': { field: 'stage_name', label: 'Этап', icon: CalendarDays, color: 'violet' },
  },
  placeholder: 'Фильтр: проект:"Альфа" раздел:"АР" этап:"Концепция"',
}

// ─── Layout constants ────────────────────────────────────────────────────────
const PPD: Record<GanttScale, number> = { day: 36, week: 14, month: 5 }
const TOTAL_DAYS = 210
const DAYS_BEFORE = 30
const ROW_PAD = 8
const BAR_H = 24
const BAR_GAP = 4
const PILL_H = 22
const PILL_GAP = 4
const PROJECT_ROW_H = 38
const OBJECT_ROW_H = 34
const MIN_SECTION_H = BAR_H + ROW_PAD * 2

// ─── Stacking algorithm ──────────────────────────────────────────────────────
interface StackedStage {
  stage: MockStage
  track: number
}

function stackStages(stages: MockStage[]): StackedStage[] {
  const timed = stages.filter(s => s.startDate && s.endDate)
  const sorted = [...timed].sort((a, b) =>
    parseMinskDate(a.startDate!).getTime() - parseMinskDate(b.startDate!).getTime()
  )
  const trackEnds: Date[] = []
  return sorted.map(stage => {
    const start = parseMinskDate(stage.startDate!)
    const trackIdx = trackEnds.findIndex(end => end < start)
    const track = trackIdx === -1 ? trackEnds.length : trackIdx
    trackEnds[track] = parseMinskDate(stage.endDate!)
    return { stage, track }
  })
}

// ─── Month / week header ─────────────────────────────────────────────────────
interface MonthGroup { label: string; days: number }

function buildMonthGroups(rangeStart: Date, totalDays: number): MonthGroup[] {
  const groups: MonthGroup[] = []
  let current: string | null = null
  let count = 0
  for (let i = 0; i < totalDays; i++) {
    const d = addDays(rangeStart, i)
    const key = format(d, 'LLLL yyyy', { locale: ru })
    if (key !== current) {
      if (current) groups.push({ label: current, days: count })
      current = key; count = 1
    } else { count++ }
  }
  if (current) groups.push({ label: current, days: count })
  return groups
}

interface WeekMarker { dayOffset: number; label: string }

function buildWeekMarkers(rangeStart: Date, totalDays: number, scale: GanttScale): WeekMarker[] {
  if (scale === 'day') return []
  const markers: WeekMarker[] = []
  for (let i = 0; i < totalDays; i++) {
    const d = addDays(rangeStart, i)
    if (scale === 'week' && d.getDay() === 1)
      markers.push({ dayOffset: i, label: format(d, 'd MMM', { locale: ru }) })
    else if (scale === 'month' && d.getDate() === 1)
      markers.push({ dayOffset: i, label: format(d, 'LLL', { locale: ru }) })
  }
  return markers
}

// ─── Filter helpers ───────────────────────────────────────────────────────────
function applyFilter(projects: MockProject[], filterString: string): MockProject[] {
  if (!filterString.trim()) return projects

  const { tokens } = parseFilterString(filterString, DIAGRAM_FILTER_CONFIG)

  const matches = (value: string, key: string): boolean => {
    const relevant = tokens.filter(t => t.key === key)
    if (relevant.length === 0) return true
    return relevant.every(t => {
      const hit = value.toLowerCase().includes(t.value.toLowerCase())
      return t.negated ? !hit : hit
    })
  }

  const hasStageFilter = tokens.some(t => t.key === 'этап')

  return projects
    .filter(p => matches(p.name, 'проект'))
    .map(p => ({
      ...p,
      objects: p.objects
        .filter(o => matches(o.name, 'объект'))
        .map(o => ({
          ...o,
          sections: o.sections
            .filter(s => {
              if (!matches(s.name, 'раздел')) return false
              if (!hasStageFilter) return true
              return s.stages.some(st => matches(st.name, 'этап'))
            })
            .map(s => ({
              ...s,
              stages: hasStageFilter
                ? s.stages.filter(st => matches(st.name, 'этап'))
                : s.stages,
            })),
        }))
        .filter(o => o.sections.length > 0),
    }))
    .filter(p => p.objects.length > 0)
}

// ─── PillItem ─────────────────────────────────────────────────────────────────
const PillItem = forwardRef<
  HTMLDivElement,
  { pill: MockStage; color: string }
>(({ pill, color }, ref) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `pill-${pill.id}`,
    data: { type: 'pill', stageId: pill.id },
  })
  const mergedRef = (node: HTMLDivElement | null) => {
    setNodeRef(node)
    if (typeof ref === 'function') ref(node)
    else if (ref) (ref as React.RefObject<HTMLDivElement | null>).current = node
  }

  return (
    <div
      ref={mergedRef}
      {...attributes}
      {...listeners}
      className={cn(
        'inline-flex items-center rounded px-2 text-[10px] font-medium text-white cursor-grab shrink-0 truncate max-w-[110px] transition-opacity touch-none select-none',
        isDragging && 'opacity-30'
      )}
      style={{ height: PILL_H, backgroundColor: color + 'cc' }}
    >
      {pill.name}
    </div>
  )
})
PillItem.displayName = 'PillItem'

// ─── TimelineDropZone ─────────────────────────────────────────────────────────
function TimelineDropZone({
  sectionId,
  children,
  style,
}: {
  sectionId: string
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `zone-${sectionId}`,
    data: { type: 'timeline', sectionId },
  })
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('relative', isOver && 'bg-emerald-500/5')}
    >
      {children}
    </div>
  )
}

// ─── GanttBarDraggable ────────────────────────────────────────────────────────
interface GanttBarProps {
  stage: MockStage
  effStart: string
  effEnd: string
  left: number
  width: number
  top: number
  color: string
  sectionName: string
}

const GanttBarDraggable = forwardRef<HTMLDivElement, GanttBarProps>(
  ({ stage, effStart, effEnd, left, width, top, color, sectionName }, ref) => {
    const moveD = useDraggable({
      id: `move-${stage.id}`,
      data: { type: 'move', stageId: stage.id, effStart, effEnd },
    })
    const leftD = useDraggable({
      id: `left-${stage.id}`,
      data: { type: 'resize-left', stageId: stage.id, effStart, effEnd },
    })
    const rightD = useDraggable({
      id: `right-${stage.id}`,
      data: { type: 'resize-right', stageId: stage.id, effStart, effEnd },
    })

    const mergedRef = (node: HTMLDivElement | null) => {
      moveD.setNodeRef(node)
      if (typeof ref === 'function') ref(node)
      else if (ref) (ref as React.RefObject<HTMLDivElement | null>).current = node
    }

    const days = differenceInDays(parseMinskDate(effEnd), parseMinskDate(effStart)) + 1

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            ref={mergedRef}
            {...moveD.attributes}
            {...moveD.listeners}
            className="absolute rounded flex items-center overflow-hidden group cursor-grab active:cursor-grabbing touch-none select-none"
            style={{ left, width, top, height: BAR_H, backgroundColor: color }}
          >
            {/* Left resize handle */}
            <div
              ref={leftD.setNodeRef}
              {...leftD.attributes}
              className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto bg-white/30 rounded-l z-10 touch-none"
              onPointerDown={e => {
                e.stopPropagation()
                leftD.listeners?.onPointerDown?.(e)
              }}
            />
            {width > 50 && (
              <span className="px-2 text-[11px] text-white font-medium truncate pointer-events-none">
                {stage.name}
              </span>
            )}
            {/* Right resize handle */}
            <div
              ref={rightD.setNodeRef}
              {...rightD.attributes}
              className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto bg-white/30 rounded-r z-10 touch-none"
              onPointerDown={e => {
                e.stopPropagation()
                rightD.listeners?.onPointerDown?.(e)
              }}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p className="font-semibold">{stage.name}</p>
          <p className="text-muted-foreground">{sectionName}</p>
          <p>
            {format(parseMinskDate(effStart), 'd MMM yyyy', { locale: ru })}
            {' — '}
            {format(parseMinskDate(effEnd), 'd MMM yyyy', { locale: ru })}
          </p>
          <p className="text-muted-foreground">{days} дн.</p>
        </TooltipContent>
      </Tooltip>
    )
  }
)
GanttBarDraggable.displayName = 'GanttBarDraggable'

// ─── Component ───────────────────────────────────────────────────────────────
export function ProjectDiagram() {
  const [scale, setScale] = useState<GanttScale>('week')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [filterString, setFilterString] = useState('')
  const [dateOverrides, setDateOverrides] = useState<Record<string, { startDate?: string; endDate?: string }>>({})
  const [dropIndicator, setDropIndicator] = useState<{ sectionId: string; x: number } | null>(null)
  const [activeDragType, setActiveDragType] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Freeze origStart/origEnd at drag start to avoid stale closure drift
  const dragStartRef = useRef<{ origStart: string; origEnd: string } | null>(null)
  // Stable refs for values used in callbacks
  const ppdRef = useRef(PPD[scale])
  const rangeStartRef = useRef<Date | null>(null)

  const ppd = PPD[scale]
  useEffect(() => { ppdRef.current = ppd }, [ppd])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  )

  const today = useMemo(() => getTodayMinsk(), [])
  const rangeStart = useMemo(() => addDays(today, -DAYS_BEFORE), [today])
  const timelineWidth = TOTAL_DAYS * ppd
  const todayLeft = DAYS_BEFORE * ppd

  useEffect(() => { rangeStartRef.current = rangeStart }, [rangeStart])

  const monthGroups = useMemo(() => buildMonthGroups(rangeStart, TOTAL_DAYS), [rangeStart])
  const weekMarkers = useMemo(() => buildWeekMarkers(rangeStart, TOTAL_DAYS, scale), [rangeStart, scale])

  const filterOptions = useMemo((): FilterOption[] => [
    ...MOCK_PROJECTS.map(p => ({ id: p.id, name: p.name, key: 'проект' })),
    ...MOCK_PROJECTS.flatMap(p => p.objects.map(o => ({ id: o.id, name: o.name, key: 'объект' }))),
    ...MOCK_PROJECTS.flatMap(p =>
      p.objects.flatMap(o => o.sections.map(s => ({ id: s.id, name: s.name, key: 'раздел' })))
    ),
    ...MOCK_PROJECTS.flatMap(p =>
      p.objects.flatMap(o =>
        o.sections.flatMap(s => s.stages.map(st => ({ id: st.id, name: st.name, key: 'этап' })))
      )
    ),
  ], [])

  const filteredProjects = useMemo(
    () => applyFilter(MOCK_PROJECTS, filterString),
    [filterString]
  )

  // ─── DnD handlers ─────────────────────────────────────────────────────────

  const handleDragStart = useCallback(({ active }: DragStartEvent) => {
    const d = active.data.current
    setActiveDragType(d?.type ?? null)
    if (d?.effStart && d?.effEnd) {
      dragStartRef.current = { origStart: d.effStart, origEnd: d.effEnd }
    }
  }, [])

  const handleDragMove = useCallback(({ active, over, delta, activatorEvent }: DragMoveEvent) => {
    const d = active.data.current
    if (!d) return
    const ppd = ppdRef.current

    if (d.type === 'move' || d.type === 'resize-left' || d.type === 'resize-right') {
      if (!dragStartRef.current) return
      const { origStart, origEnd } = dragStartRef.current
      const deltaDays = Math.round(delta.x / ppd)

      if (d.type === 'move') {
        const newStart = format(addDays(parseMinskDate(origStart), deltaDays), 'yyyy-MM-dd')
        const newEnd = format(addDays(parseMinskDate(origEnd), deltaDays), 'yyyy-MM-dd')
        setDateOverrides(prev => ({ ...prev, [d.stageId]: { startDate: newStart, endDate: newEnd } }))
      } else if (d.type === 'resize-left') {
        const newStart = format(addDays(parseMinskDate(origStart), deltaDays), 'yyyy-MM-dd')
        if (newStart < origEnd)
          setDateOverrides(prev => ({ ...prev, [d.stageId]: { ...prev[d.stageId], startDate: newStart } }))
      } else {
        const newEnd = format(addDays(parseMinskDate(origEnd), deltaDays), 'yyyy-MM-dd')
        if (newEnd > origStart)
          setDateOverrides(prev => ({ ...prev, [d.stageId]: { ...prev[d.stageId], endDate: newEnd } }))
      }
    }

    // Drop indicator for pill being dragged over a timeline zone
    if (d.type === 'pill' && over?.data.current?.type === 'timeline') {
      const pointerX = (activatorEvent as PointerEvent).clientX + delta.x
      const relX = pointerX - (over.rect?.left ?? 0)
      setDropIndicator({ sectionId: over.data.current.sectionId, x: Math.max(0, relX) })
    } else if (d.type === 'pill') {
      setDropIndicator(null)
    }
  }, [])

  const handleDragEnd = useCallback(({ active, over, delta, activatorEvent }: DragEndEvent) => {
    dragStartRef.current = null
    setActiveDragType(null)
    setDropIndicator(null)

    const d = active.data.current
    if (d?.type === 'pill' && over?.data.current?.type === 'timeline' && over.rect) {
      const pointerX = (activatorEvent as PointerEvent).clientX + delta.x
      const relX = pointerX - over.rect.left
      const dayOffset = Math.floor(relX / ppdRef.current)
      const rs = rangeStartRef.current
      if (rs) {
        const startDate = format(addDays(rs, dayOffset), 'yyyy-MM-dd')
        const endDate = format(addDays(rs, dayOffset + 7), 'yyyy-MM-dd')
        setDateOverrides(prev => ({ ...prev, [d.stageId]: { startDate, endDate } }))
      }
    }
  }, [])

  const handleDragCancel = useCallback(() => {
    dragStartRef.current = null
    setActiveDragType(null)
    setDropIndicator(null)
  }, [])

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const toggle = (id: string) =>
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const scrollToToday = () => {
    if (scrollRef.current)
      scrollRef.current.scrollLeft = todayLeft - SIDEBAR_WIDTH / 2
  }

  const zoomIn = () => setScale(s => s === 'month' ? 'week' : s === 'week' ? 'day' : s)
  const zoomOut = () => setScale(s => s === 'day' ? 'week' : s === 'week' ? 'month' : s)

  const barLeft = (dateStr: string) =>
    differenceInDays(parseMinskDate(dateStr), rangeStart) * ppd

  const barWidth = (start: string, end: string) =>
    (differenceInDays(parseMinskDate(end), parseMinskDate(start)) + 1) * ppd

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <TooltipProvider delayDuration={300}>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        autoScroll={{
          threshold: { x: 0.15, y: 0.15 },
          acceleration: 8,
        }}
      >
        <div className="flex flex-col h-screen bg-background text-foreground">

          {/* ── Top toolbar ── */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
            <InlineFilter
              config={DIAGRAM_FILTER_CONFIG}
              value={filterString}
              onChange={setFilterString}
              options={filterOptions}
              className="flex-1 min-w-0"
            />
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="outline" size="sm" onClick={scrollToToday} className="h-7 text-xs">
                Сегодня
              </Button>
              <Button
                variant="ghost" size="icon" className="h-7 w-7"
                onClick={zoomIn} disabled={scale === 'day'}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost" size="icon" className="h-7 w-7"
                onClick={zoomOut} disabled={scale === 'month'}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              {(['day', 'week', 'month'] as GanttScale[]).map(s => (
                <Button
                  key={s}
                  variant={scale === s ? 'default' : 'ghost'}
                  size="sm" className="h-7 text-xs"
                  onClick={() => setScale(s)}
                >
                  {{ day: 'День', week: 'Неделя', month: 'Месяц' }[s]}
                </Button>
              ))}
            </div>
          </div>

          {/* ── Main scroll container ── */}
          <div ref={scrollRef} className="overflow-auto flex-1 relative">
            <div style={{ minWidth: SIDEBAR_WIDTH + timelineWidth }}>

              {/* ── Sticky header ── */}
              <div className="sticky top-0 z-20 bg-background border-b border-border">
                {/* Row 1: months */}
                <div className="flex border-b border-border" style={{ height: 28 }}>
                  <div
                    className="sticky left-0 z-30 bg-background border-r border-border shrink-0"
                    style={{ width: SIDEBAR_WIDTH, minWidth: SIDEBAR_WIDTH }}
                  />
                  <div className="relative flex" style={{ width: timelineWidth }}>
                    <div
                      className="absolute top-0 bottom-0 bg-primary/10 pointer-events-none z-10"
                      style={{ left: todayLeft, width: ppd }}
                    />
                    {monthGroups.map((g, i) => (
                      <div
                        key={i}
                        className="border-r border-border flex items-center px-2 text-xs font-medium text-muted-foreground capitalize shrink-0 overflow-hidden"
                        style={{ width: g.days * ppd }}
                      >
                        {g.label}
                      </div>
                    ))}
                  </div>
                </div>
                {/* Row 2: weeks / days */}
                <div className="flex" style={{ height: 24 }}>
                  <div
                    className="sticky left-0 z-30 bg-background border-r border-border shrink-0"
                    style={{ width: SIDEBAR_WIDTH, minWidth: SIDEBAR_WIDTH }}
                  />
                  <div className="relative" style={{ width: timelineWidth, height: 24 }}>
                    {scale === 'day'
                      ? Array.from({ length: TOTAL_DAYS }).map((_, i) => {
                          const d = addDays(rangeStart, i)
                          const isWeekend = d.getDay() === 0 || d.getDay() === 6
                          return (
                            <div
                              key={i}
                              className={cn(
                                'absolute top-0 flex items-center justify-center text-[10px] border-r border-border',
                                isWeekend ? 'text-muted-foreground/50' : 'text-muted-foreground'
                              )}
                              style={{ left: i * ppd, width: ppd, height: 24 }}
                            >
                              {format(d, 'd')}
                            </div>
                          )
                        })
                      : weekMarkers.map((m, i) => (
                          <div key={i} className="absolute top-0 bottom-0" style={{ left: m.dayOffset * ppd }}>
                            <div className="absolute top-0 bottom-0 w-px bg-border" />
                            <span className="absolute top-0 bottom-0 flex items-center pl-1 text-[10px] text-muted-foreground whitespace-nowrap">
                              {m.label}
                            </span>
                          </div>
                        ))
                    }
                  </div>
                </div>
              </div>

              {/* ── Data rows ── */}
              {filteredProjects.map(project => {
                const projCollapsed = collapsed.has(project.id)
                return (
                  <div key={project.id}>
                    {/* Project row */}
                    <div
                      className="flex border-b border-border hover:bg-muted/30 cursor-pointer"
                      style={{ height: PROJECT_ROW_H }}
                      onClick={() => toggle(project.id)}
                    >
                      <div
                        className="sticky left-0 z-20 bg-background flex items-center gap-2 px-3 border-r border-border shrink-0"
                        style={{ width: SIDEBAR_WIDTH, minWidth: SIDEBAR_WIDTH }}
                      >
                        {projCollapsed
                          ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        }
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: project.color }}
                        />
                        <span className="font-semibold text-sm truncate">{project.name}</span>
                      </div>
                      <div className="relative" style={{ width: timelineWidth }}>
                        <div className="absolute top-0 bottom-0 bg-primary/10 z-0" style={{ left: todayLeft, width: ppd }} />
                        <div className="absolute top-0 bottom-0 w-px bg-primary/60 z-10" style={{ left: todayLeft }} />
                        {projCollapsed && (() => {
                          const allStages = project.objects.flatMap(o => o.sections.flatMap(s => s.stages))
                          return allStages.filter(s => s.startDate && s.endDate).map(st => (
                            <div
                              key={st.id}
                              className="absolute rounded-sm opacity-60"
                              style={{
                                left: barLeft(st.startDate!),
                                width: Math.max(barWidth(st.startDate!, st.endDate!), 4),
                                height: 10,
                                top: (PROJECT_ROW_H - 10) / 2,
                                backgroundColor: project.color,
                              }}
                            />
                          ))
                        })()}
                      </div>
                    </div>

                    {!projCollapsed && project.objects.map(obj => {
                      const objCollapsed = collapsed.has(obj.id)
                      return (
                        <div key={obj.id}>
                          {/* Object row */}
                          <div
                            className="flex border-b border-border hover:bg-muted/30 cursor-pointer"
                            style={{ height: OBJECT_ROW_H }}
                            onClick={() => toggle(obj.id)}
                          >
                            <div
                              className="sticky left-0 z-20 bg-background flex items-center gap-2 px-3 pl-7 border-r border-border shrink-0"
                              style={{ width: SIDEBAR_WIDTH, minWidth: SIDEBAR_WIDTH }}
                            >
                              {objCollapsed
                                ? <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                : <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                              }
                              <span className="text-sm text-muted-foreground truncate">{obj.name}</span>
                            </div>
                            <div className="relative" style={{ width: timelineWidth }}>
                              <div className="absolute top-0 bottom-0 bg-primary/10 z-0" style={{ left: todayLeft, width: ppd }} />
                              <div className="absolute top-0 bottom-0 w-px bg-primary/60 z-10" style={{ left: todayLeft }} />
                              {objCollapsed && (() => {
                                const timed = obj.sections.flatMap(s => s.stages).filter(s => s.startDate && s.endDate)
                                return timed.map(st => (
                                  <div
                                    key={st.id}
                                    className="absolute rounded-sm opacity-50"
                                    style={{
                                      left: barLeft(st.startDate!),
                                      width: Math.max(barWidth(st.startDate!, st.endDate!), 4),
                                      height: 8,
                                      top: (OBJECT_ROW_H - 8) / 2,
                                      backgroundColor: project.color,
                                    }}
                                  />
                                ))
                              })()}
                            </div>
                          </div>

                          {!objCollapsed && obj.sections.map(section => {
                            const effectiveStages = section.stages.map(s => ({
                              ...s,
                              startDate: dateOverrides[s.id]?.startDate ?? s.startDate,
                              endDate: dateOverrides[s.id]?.endDate ?? s.endDate,
                            }))
                            const stacked = stackStages(effectiveStages)
                            const pills = effectiveStages.filter(s => !s.startDate || !s.endDate)
                            const trackCount = stacked.length === 0 ? 1 : Math.max(...stacked.map(s => s.track)) + 1
                            const pillRows = Math.ceil(pills.length / 3) || 0
                            const barsHeight = trackCount * (BAR_H + BAR_GAP) - BAR_GAP
                            const pillsHeight = pillRows * (PILL_H + PILL_GAP) - (pillRows > 0 ? PILL_GAP : 0)
                            const sectionH = Math.max(
                              MIN_SECTION_H,
                              ROW_PAD * 2 + Math.max(barsHeight, pillsHeight + (pills.length > 0 ? 20 : 0))
                            )

                            return (
                              <div
                                key={section.id}
                                className="flex border-b border-border"
                                style={{ height: sectionH }}
                              >
                                {/* Sidebar cell */}
                                <div
                                  className="sticky left-0 z-20 bg-background border-r border-b border-border shrink-0 relative"
                                  style={{ width: SIDEBAR_WIDTH, minWidth: SIDEBAR_WIDTH, height: sectionH }}
                                >
                                  <div className="flex flex-col gap-1 px-3 pl-12 pt-2">
                                    <span className="text-xs font-medium truncate">{section.name}</span>
                                    {pills.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {pills.map(pill => (
                                          <Tooltip key={pill.id}>
                                            <TooltipTrigger asChild>
                                              <PillItem pill={pill} color={project.color} />
                                            </TooltipTrigger>
                                            <TooltipContent side="top">
                                              <p className="text-xs">{pill.name} — перетащи на шкалу для установки сроков</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Timeline cell */}
                                <TimelineDropZone
                                  sectionId={section.id}
                                  style={{ width: timelineWidth, height: sectionH }}
                                >
                                  <div className="absolute top-0 bottom-0 bg-primary/10 z-0" style={{ left: todayLeft, width: ppd }} />
                                  <div className="absolute top-0 bottom-0 w-px bg-primary/60 z-10" style={{ left: todayLeft }} />

                                  {/* Drop indicator for pill drag */}
                                  {dropIndicator?.sectionId === section.id && (
                                    <div
                                      className="absolute top-0 bottom-0 w-px bg-emerald-400 z-20 pointer-events-none"
                                      style={{ left: dropIndicator.x }}
                                    >
                                      <div className="absolute top-1 left-1 bg-emerald-400 text-white text-[10px] px-1 rounded whitespace-nowrap">
                                        {format(addDays(rangeStart, Math.floor(dropIndicator.x / ppd)), 'd MMM', { locale: ru })}
                                      </div>
                                    </div>
                                  )}

                                  {/* Grid lines */}
                                  {scale === 'day'
                                    ? Array.from({ length: TOTAL_DAYS }).map((_, i) => (
                                        <div key={i} className="absolute top-0 bottom-0 w-px bg-border/50" style={{ left: i * ppd }} />
                                      ))
                                    : weekMarkers.map((m, i) => (
                                        <div key={i} className="absolute top-0 bottom-0 w-px bg-border/50" style={{ left: m.dayOffset * ppd }} />
                                      ))
                                  }

                                  {/* Bars */}
                                  {stacked.map(({ stage, track }) => {
                                    const effStart = stage.startDate!
                                    const effEnd = stage.endDate!
                                    const left = barLeft(effStart)
                                    const width = Math.max(barWidth(effStart, effEnd), 6)
                                    const top = ROW_PAD + track * (BAR_H + BAR_GAP)

                                    return (
                                      <GanttBarDraggable
                                        key={stage.id}
                                        stage={stage}
                                        effStart={effStart}
                                        effEnd={effEnd}
                                        left={left}
                                        width={width}
                                        top={top}
                                        color={project.color}
                                        sectionName={section.name}
                                      />
                                    )
                                  })}
                                </TimelineDropZone>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                )
              })}

            </div>
          </div>
        </div>

        {/* Drag overlay for pills */}
        <DragOverlay dropAnimation={null}>
          {activeDragType === 'pill' && (
            <div
              className="inline-flex items-center rounded px-2 text-[10px] font-medium text-white shadow-lg opacity-90 cursor-grabbing"
              style={{ height: PILL_H, backgroundColor: '#888' }}
            >
              ···
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </TooltipProvider>
  )
}
