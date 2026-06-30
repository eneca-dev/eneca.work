'use client'

import { useState, useRef, useMemo, forwardRef, useCallback, useEffect } from 'react'
import { addDays, differenceInDays, format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ChevronDown, ChevronRight, ZoomIn, ZoomOut, FolderKanban, Building2, FileText, CalendarDays, Link2, Unlink, CalendarX2, RotateCcw } from 'lucide-react'
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
import { GanttLinks } from './GanttLinks'
import { MOCK_LINKS, MOCK_PROJECTS } from '../mock-data'
import type { BarRect, GanttScale, MockLink, MockProject, MockStage } from '../types'

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
const HEADER_HEIGHT = 52 // 28 (months) + 24 (weeks/days)

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
  return sorted.map((stage, index) => ({ stage, track: index }))
}

// ─── BFS cascade: collect this bar + all bars reachable via FS links (both directions) ───
function getCascadeIds(fromId: string, links: MockLink[]): Set<string> {
  const visited = new Set<string>()
  const queue = [fromId]
  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)
    for (const link of links) {
      if (link.fromStageId === current && !visited.has(link.toStageId))
        queue.push(link.toStageId)
      if (link.toStageId === current && !visited.has(link.fromStageId))
        queue.push(link.fromStageId)
    }
  }
  return visited
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
  isSelected: boolean
  // true on all NON-source bars when link drag is in progress → show connection circles
  showConnectionPoints: boolean
  // true on the bar that initiated the link drag → hide its own circles
  isLinkSource: boolean
  onLinkStart?: (stageId: string, e: React.PointerEvent<HTMLDivElement>) => void
  onBarClick?: (stageId: string, shiftKey: boolean) => void
}

const GanttBarDraggable = forwardRef<HTMLDivElement, GanttBarProps>(
  ({ stage, effStart, effEnd, left, width, top, color,
     isSelected, showConnectionPoints, isLinkSource,
     onLinkStart, onBarClick }, ref) => {

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

    return (
      <div
        ref={mergedRef}
        {...moveD.attributes}
        {...moveD.listeners}
        data-gantt-bar="true"
        className="absolute rounded flex items-center group cursor-grab active:cursor-grabbing touch-none select-none"
        style={{
          left, width, top, height: BAR_H,
          backgroundColor: color,
          boxShadow: isSelected
            ? '0 0 0 2px white, 0 0 0 4px #eab308'
            : undefined,
          zIndex: isSelected ? 2 : 1,
        }}
        onClick={e => onBarClick?.(stage.id, e.shiftKey)}
      >
            {/* Hover zone — extends group:hover 16px left and 32px right (covers arrow + circle) */}
            <div
              className="absolute inset-y-0 pointer-events-auto"
              style={{ left: -16, right: -32 }}
            />

            {/* Left drop target circle — shown on all non-source bars when a link drag is active */}
            <div
              className={cn(
                'absolute w-3 h-3 rounded-full bg-white border-2 border-yellow-400 z-20 -translate-y-1/2 cursor-default transition-all duration-100 hover:scale-125',
                showConnectionPoints && !isLinkSource
                  ? 'opacity-100 pointer-events-auto'
                  : 'opacity-0 pointer-events-none',
              )}
              style={{ left: -14, top: '50%' }}
            />

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
              <span className="px-2 text-[11px] text-white font-medium truncate pointer-events-none flex-1 min-w-0">
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

            {/* Right: yellow arrow stub + draggable circle — shown on hover to create a link */}
            {!isLinkSource && (
              <div
                className="absolute flex items-center opacity-0 group-hover:opacity-100 transition-opacity duration-100 z-20"
                style={{ left: '100%', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              >
                <svg width="12" height="8" viewBox="0 0 12 8" style={{ display: 'block', flexShrink: 0 }}>
                  <line x1="0" y1="4" x2="8" y2="4" stroke="#eab308" strokeWidth="1.5" />
                  <polygon points="7,1.5 12,4 7,6.5" fill="#eab308" />
                </svg>
                <div
                  className="w-3 h-3 rounded-full bg-yellow-400 border-2 border-yellow-500 cursor-crosshair shrink-0 touch-none transition-transform duration-100 hover:scale-125"
                  style={{ marginLeft: 3, pointerEvents: 'auto' }}
                  onPointerDown={e => {
                    e.stopPropagation()
                    e.preventDefault()
                    onLinkStart?.(stage.id, e)
                  }}
                />
              </div>
            )}
          </div>
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
  const [links, setLinks] = useState<MockLink[]>(MOCK_LINKS)
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null)
  const [draftLink, setDraftLink] = useState<{ fromId: string; toX: number; toY: number } | null>(null)

  // Link drag state — controls connection point visibility on all bars
  const [isDraggingLink, setIsDraggingLink] = useState(false)
  const [linkDragSourceId, setLinkDragSourceId] = useState<string | null>(null)
  const isDraggingLinkRef = useRef(false)

  // Multi-select state
  const [selectedStageIds, setSelectedStageIds] = useState<Set<string>>(new Set())
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [shiftDays, setShiftDays] = useState(1)
  const [hiddenFromTimeline, setHiddenFromTimeline] = useState<Set<string>>(new Set())

  const scrollRef = useRef<HTMLDivElement>(null)
  const dataRowsRef = useRef<HTMLDivElement>(null)
  const barRectsRef = useRef<Map<string, BarRect>>(new Map())
  const svgRef = useRef<SVGSVGElement | null>(null)

  const dragStartRef = useRef<{ origStart: string; origEnd: string } | null>(null)
  const ppdRef = useRef(PPD[scale])
  const rangeStartRef = useRef<Date | null>(null)

  // Stable refs for callback closures
  const linksRef = useRef(links)
  useEffect(() => { linksRef.current = links }, [links])
  const dateOverridesRef = useRef(dateOverrides)
  useEffect(() => { dateOverridesRef.current = dateOverrides }, [dateOverrides])
  const selectedIdsRef = useRef(selectedStageIds)
  useEffect(() => { selectedIdsRef.current = selectedStageIds }, [selectedStageIds])

  // Map of all original stages for cascade / group drag date lookup
  const allStagesMap = useMemo(() => {
    const map = new Map<string, MockStage>()
    for (const p of MOCK_PROJECTS)
      for (const o of p.objects)
        for (const s of o.sections)
          for (const st of s.stages)
            map.set(st.id, st)
    return map
  }, [])

  // IDs + original dates of bars that co-move with the dragged bar
  const movingIdsRef = useRef<Map<string, { startDate: string; endDate: string }>>(new Map())

  // Rubber band refs
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null)
  const selectionRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null)

  // Tracks whether a dnd-kit drag just ended — used to suppress spurious onClick on bars
  const wasBarDraggedRef = useRef(false)

  const ppd = PPD[scale]
  useEffect(() => { ppdRef.current = ppd }, [ppd])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
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

  // ─── Bar positions for link arrows ────────────────────────────────────────
  const { barRects, totalHeight } = useMemo(() => {
    const map = new Map<string, BarRect>()
    let y = 0
    const _bl = (d: string) => differenceInDays(parseMinskDate(d), rangeStart) * ppd
    const _bw = (s: string, e: string) => (differenceInDays(parseMinskDate(e), parseMinskDate(s)) + 1) * ppd

    for (const project of filteredProjects) {
      y += PROJECT_ROW_H
      if (collapsed.has(project.id)) continue
      for (const obj of project.objects) {
        y += OBJECT_ROW_H
        if (collapsed.has(obj.id)) continue
        for (const section of obj.sections) {
          const effStages = section.stages.map(s => ({
            ...s,
            startDate: hiddenFromTimeline.has(s.id) ? null : (dateOverrides[s.id]?.startDate ?? s.startDate),
            endDate: hiddenFromTimeline.has(s.id) ? null : (dateOverrides[s.id]?.endDate ?? s.endDate),
          }))
          const stacked = stackStages(effStages)
          const pills = effStages.filter(s => !s.startDate || !s.endDate)
          const trackCount = stacked.length === 0 ? 1 : Math.max(...stacked.map(s => s.track)) + 1
          const pillRows = Math.ceil(pills.length / 3) || 0
          const barsH = trackCount * (BAR_H + BAR_GAP) - BAR_GAP
          const pillsH = pillRows * (PILL_H + PILL_GAP) - (pillRows > 0 ? PILL_GAP : 0)
          const sectionH = Math.max(
            MIN_SECTION_H,
            ROW_PAD * 2 + Math.max(barsH, pillsH + (pills.length > 0 ? 20 : 0))
          )
          for (const { stage, track } of stacked) {
            const bl = _bl(stage.startDate!)
            const bw = Math.max(_bw(stage.startDate!, stage.endDate!), 6)
            map.set(stage.id, { x: bl, y: y + ROW_PAD + track * (BAR_H + BAR_GAP), width: bw, height: BAR_H })
          }
          y += sectionH
        }
      }
    }
    barRectsRef.current = map
    return { barRects: map, totalHeight: y }
  }, [filteredProjects, collapsed, dateOverrides, ppd, rangeStart])

  const stageProjectColors = useMemo(() => {
    const map = new Map<string, string>()
    for (const project of filteredProjects)
      for (const obj of project.objects)
        for (const section of obj.sections)
          for (const stage of section.stages)
            map.set(stage.id, project.color)
    return map
  }, [filteredProjects])

  // ─── Link handlers ────────────────────────────────────────────────────────
  const handleLinkStart = useCallback((stageId: string, e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    e.preventDefault()
    if (!svgRef.current) return

    setIsDraggingLink(true)
    isDraggingLinkRef.current = true
    setLinkDragSourceId(stageId)

    const svgBRect = svgRef.current.getBoundingClientRect()
    setDraftLink({ fromId: stageId, toX: e.clientX - svgBRect.left, toY: e.clientY - svgBRect.top })

    // Returns the target bar ID if cursor is near it (with 20px left margin for drop-target circle)
    const findTargetBar = (clientX: number, clientY: number, svgRect: DOMRect) => {
      const x = clientX - svgRect.left
      const y = clientY - svgRect.top
      for (const [id, rect] of barRectsRef.current.entries()) {
        if (
          id !== stageId &&
          x >= rect.x - 20 &&
          x <= rect.x + rect.width &&
          y >= rect.y - 6 &&
          y <= rect.y + rect.height + 6
        ) return { id, rect }
      }
      return null
    }

    const onMove = (ev: PointerEvent) => {
      const r = svgRef.current?.getBoundingClientRect()
      if (!r) return
      const hit = findTargetBar(ev.clientX, ev.clientY, r)
      // Snap draft arrow tip to target bar's left edge when close
      const toX = hit ? hit.rect.x : ev.clientX - r.left
      const toY = hit ? hit.rect.y + BAR_H / 2 : ev.clientY - r.top
      setDraftLink(prev => prev ? { ...prev, toX, toY } : null)
    }

    const onUp = (ev: PointerEvent) => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      const r = svgRef.current?.getBoundingClientRect()
      if (r) {
        const hit = findTargetBar(ev.clientX, ev.clientY, r)
        if (hit) {
          setLinks(prev =>
            prev.some(l => l.fromStageId === stageId && l.toStageId === hit.id)
              ? prev
              : [...prev, { id: `l-${stageId}-${hit.id}`, fromStageId: stageId, toStageId: hit.id, type: 'FS' }]
          )
        }
      }
      setDraftLink(null)
      setIsDraggingLink(false)
      isDraggingLinkRef.current = false
      setLinkDragSourceId(null)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }, [])

  const deleteLink = useCallback((id: string) => {
    setLinks(prev => prev.filter(l => l.id !== id))
  }, [])

  // Keyboard: Escape to deselect link, Delete to remove
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedLinkId(null)
      if (e.key === 'Delete') setSelectedLinkId(prev => { if (prev) deleteLink(prev); return null })
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [deleteLink])

  // ─── Bar click selection ──────────────────────────────────────────────────
  const handleBarClick = useCallback((stageId: string, shiftKey: boolean) => {
    if (wasBarDraggedRef.current) return
    setSelectedStageIds(prev => {
      const next = new Set(prev)
      if (shiftKey) {
        if (next.has(stageId)) next.delete(stageId)
        else next.add(stageId)
      } else {
        if (next.size === 1 && next.has(stageId)) {
          next.clear()
        } else {
          next.clear()
          next.add(stageId)
        }
      }
      return next
    })
  }, [])

  // ─── Rubber band selection ────────────────────────────────────────────────
  const handleDataRowsMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    if (isDraggingLinkRef.current) return

    const scroller = scrollRef.current
    if (!scroller) return

    const scrollerRect = scroller.getBoundingClientRect()
    const timelineX = e.clientX - scrollerRect.left + scroller.scrollLeft - SIDEBAR_WIDTH
    const barY = e.clientY - scrollerRect.top + scroller.scrollTop - HEADER_HEIGHT

    // Only in timeline area
    if (timelineX < 0) return

    // Skip if clicking on a bar
    for (const [, rect] of barRectsRef.current) {
      if (
        timelineX >= rect.x && timelineX <= rect.x + rect.width &&
        barY >= rect.y && barY <= rect.y + rect.height
      ) return
    }

    e.preventDefault()
    selectionStartRef.current = { x: timelineX, y: barY }
    const initialRect = { x: timelineX, y: barY, w: 0, h: 0 }
    selectionRectRef.current = initialRect
    setSelectionRect(initialRect)

    const onMove = (ev: MouseEvent) => {
      if (!selectionStartRef.current) return
      const cx = ev.clientX - scrollerRect.left + scroller.scrollLeft - SIDEBAR_WIDTH
      const cy = ev.clientY - scrollerRect.top + scroller.scrollTop - HEADER_HEIGHT
      const { x: sx, y: sy } = selectionStartRef.current
      const r = { x: Math.min(sx, cx), y: Math.min(sy, cy), w: Math.abs(cx - sx), h: Math.abs(cy - sy) }
      selectionRectRef.current = r
      setSelectionRect({ ...r })
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      const r = selectionRectRef.current
      if (r && (r.w > 4 || r.h > 4)) {
        const newSel = new Set<string>()
        for (const [id, br] of barRectsRef.current) {
          if (!(r.x + r.w < br.x || br.x + br.width < r.x || r.y + r.h < br.y || br.y + br.height < r.y)) {
            newSel.add(id)
          }
        }
        setSelectedStageIds(newSel)
      } else {
        setSelectedStageIds(new Set())
      }
      selectionStartRef.current = null
      selectionRectRef.current = null
      setSelectionRect(null)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  // ─── Selection toolbar actions ────────────────────────────────────────────
  const applyDeltaToSelected = useCallback((days: number) => {
    setDateOverrides(prev => {
      const next = { ...prev }
      for (const id of selectedIdsRef.current) {
        const stage = allStagesMap.get(id)
        const curr = next[id]
        const start = curr?.startDate ?? stage?.startDate
        const end = curr?.endDate ?? stage?.endDate
        if (start && end) {
          next[id] = {
            startDate: format(addDays(parseMinskDate(start), days), 'yyyy-MM-dd'),
            endDate: format(addDays(parseMinskDate(end), days), 'yyyy-MM-dd'),
          }
        }
      }
      return next
    })
  }, [allStagesMap])

  const linkSelectedChain = useCallback(() => {
    const bars = Array.from(selectedIdsRef.current)
      .map(id => {
        const stage = allStagesMap.get(id)
        const eff = dateOverridesRef.current[id]?.startDate ?? stage?.startDate ?? ''
        return { id, startDate: eff }
      })
      .filter(b => b.startDate)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))

    const newLinks: MockLink[] = []
    for (let i = 0; i < bars.length - 1; i++) {
      const from = bars[i].id
      const to = bars[i + 1].id
      if (!linksRef.current.some(l => l.fromStageId === from && l.toStageId === to)) {
        newLinks.push({ id: `l-chain-${from}-${to}`, fromStageId: from, toStageId: to, type: 'FS' })
      }
    }
    if (newLinks.length > 0) setLinks(prev => [...prev, ...newLinks])
  }, [allStagesMap])

  const unlinkSelected = useCallback(() => {
    const sel = selectedIdsRef.current
    setLinks(prev => prev.filter(l => !sel.has(l.fromStageId) && !sel.has(l.toStageId)))
  }, [])

  const removeFromTimeline = useCallback(() => {
    setHiddenFromTimeline(prev => {
      const next = new Set(prev)
      for (const id of selectedIdsRef.current) next.add(id)
      return next
    })
    setSelectedStageIds(new Set())
  }, [])

  const resetSelectedDates = useCallback(() => {
    setDateOverrides(prev => {
      const next = { ...prev }
      for (const id of selectedIdsRef.current) delete next[id]
      return next
    })
  }, [])

  // ─── DnD handlers ─────────────────────────────────────────────────────────
  const handleDragStart = useCallback(({ active }: DragStartEvent) => {
    const d = active.data.current
    setActiveDragType(d?.type ?? null)
    if (d?.effStart && d?.effEnd) {
      dragStartRef.current = { origStart: d.effStart, origEnd: d.effEnd }
    }

    if (d?.type === 'move') {
      const selIds = selectedIdsRef.current
      // Group drag if this bar is selected; otherwise cascade via FS links
      const idsToMove: Set<string> = selIds.has(d.stageId)
        ? new Set(selIds)
        : getCascadeIds(d.stageId, linksRef.current)

      const movingIds = new Map<string, { startDate: string; endDate: string }>()
      for (const id of idsToMove) {
        if (id === d.stageId) continue // main bar uses dragStartRef
        const stage = allStagesMap.get(id)
        const override = dateOverridesRef.current[id]
        const start = override?.startDate ?? stage?.startDate
        const end = override?.endDate ?? stage?.endDate
        if (start && end) movingIds.set(id, { startDate: start, endDate: end })
      }
      movingIdsRef.current = movingIds
    } else {
      movingIdsRef.current = new Map()
    }
  }, [allStagesMap])

  const handleDragMove = useCallback(({ active, over, delta, activatorEvent }: DragMoveEvent) => {
    const d = active.data.current
    if (!d) return
    const ppd = ppdRef.current

    if (d.type === 'move') {
      if (!dragStartRef.current) return
      const { origStart, origEnd } = dragStartRef.current
      const deltaDays = Math.round(delta.x / ppd)
      const newStart = format(addDays(parseMinskDate(origStart), deltaDays), 'yyyy-MM-dd')
      const newEnd = format(addDays(parseMinskDate(origEnd), deltaDays), 'yyyy-MM-dd')

      setDateOverrides(prev => {
        const next: typeof prev = { ...prev, [d.stageId]: { startDate: newStart, endDate: newEnd } }
        for (const [id, { startDate, endDate }] of movingIdsRef.current) {
          next[id] = {
            startDate: format(addDays(parseMinskDate(startDate), deltaDays), 'yyyy-MM-dd'),
            endDate: format(addDays(parseMinskDate(endDate), deltaDays), 'yyyy-MM-dd'),
          }
        }
        return next
      })
    } else if (d.type === 'resize-left' || d.type === 'resize-right') {
      if (!dragStartRef.current) return
      const { origStart, origEnd } = dragStartRef.current
      const deltaDays = Math.round(delta.x / ppd)

      if (d.type === 'resize-left') {
        const newStart = format(addDays(parseMinskDate(origStart), deltaDays), 'yyyy-MM-dd')
        if (newStart < origEnd)
          setDateOverrides(prev => ({ ...prev, [d.stageId]: { ...prev[d.stageId], startDate: newStart } }))
      } else {
        const newEnd = format(addDays(parseMinskDate(origEnd), deltaDays), 'yyyy-MM-dd')
        if (newEnd > origStart)
          setDateOverrides(prev => ({ ...prev, [d.stageId]: { ...prev[d.stageId], endDate: newEnd } }))
      }
    }

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
    movingIdsRef.current = new Map()
    setActiveDragType(null)
    setDropIndicator(null)
    wasBarDraggedRef.current = true
    setTimeout(() => { wasBarDraggedRef.current = false }, 0)

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
        setHiddenFromTimeline(prev => {
          const next = new Set(prev)
          next.delete(d.stageId)
          return next
        })
      }
    }
  }, [])

  const handleDragCancel = useCallback(() => {
    dragStartRef.current = null
    movingIdsRef.current = new Map()
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
        autoScroll={{ threshold: { x: 0.15, y: 0.15 }, acceleration: 8 }}
      >
        <div className="flex flex-col h-screen bg-background text-foreground">

          {/* ── Top toolbar ── */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0 min-h-0 flex-wrap">
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
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomIn} disabled={scale === 'day'}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomOut} disabled={scale === 'month'}>
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
                    <div className="absolute top-0 bottom-0 bg-primary/10 pointer-events-none z-10" style={{ left: todayLeft, width: ppd }} />
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

              {/* ── Data rows + SVG link overlay ── */}
              <div
                ref={dataRowsRef}
                style={{ position: 'relative' }}
                onMouseDown={handleDataRowsMouseDown}
              >
                {/* SVG arrows overlay — outer div is pointer-events:none so bars receive hover.
                    Individual SVG paths/groups restore pointer-events where needed. */}
                <div style={{ position: 'absolute', top: 0, left: SIDEBAR_WIDTH, zIndex: 5, pointerEvents: 'none' }}>
                  <GanttLinks
                    links={links}
                    barRects={barRects}
                    stageProjectColors={stageProjectColors}
                    draftLink={draftLink}
                    selectedLinkId={selectedLinkId}
                    onSelectLink={setSelectedLinkId}
                    onDeleteLink={deleteLink}
                    svgRef={svgRef}
                    timelineWidth={timelineWidth}
                    totalHeight={totalHeight}
                  />
                </div>

                {/* Rubber band selection rectangle */}
                {selectionRect && (selectionRect.w > 2 || selectionRect.h > 2) && (
                  <div
                    style={{
                      position: 'absolute',
                      left: selectionRect.x + SIDEBAR_WIDTH,
                      top: selectionRect.y,
                      width: selectionRect.w,
                      height: selectionRect.h,
                      border: '1.5px dashed #1e7260',
                      background: 'rgba(30,114,96,0.06)',
                      zIndex: 25,
                      pointerEvents: 'none',
                    }}
                  />
                )}

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
                          <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
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
                                startDate: hiddenFromTimeline.has(s.id) ? null : (dateOverrides[s.id]?.startDate ?? s.startDate),
                                endDate: hiddenFromTimeline.has(s.id) ? null : (dateOverrides[s.id]?.endDate ?? s.endDate),
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

                                          isSelected={selectedStageIds.has(stage.id)}
                                          showConnectionPoints={isDraggingLink && linkDragSourceId !== stage.id}
                                          isLinkSource={linkDragSourceId === stage.id}
                                          onLinkStart={handleLinkStart}
                                          onBarClick={handleBarClick}
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
        </div>

        {/* ── Selection toolbar (floating bottom) ── */}
        {selectedStageIds.size > 0 && (
          <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 border border-border rounded-xl px-3 py-1.5 bg-background shadow-lg text-xs">
            <span className="text-muted-foreground font-medium whitespace-nowrap pr-1">
              {selectedStageIds.size} {selectedStageIds.size === 1 ? 'этап' : 'этапов'}
            </span>
            <div className="w-px h-4 bg-border" />
            <button
              className="px-1.5 py-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Сдвинуть назад"
              onClick={() => applyDeltaToSelected(-shiftDays)}
            >←</button>
            <input
              type="number"
              min={1}
              max={365}
              value={shiftDays}
              onChange={e => setShiftDays(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-8 text-center border border-border rounded px-0.5 py-0.5 text-xs bg-background"
            />
            <span className="text-muted-foreground">дн.</span>
            <button
              className="px-1.5 py-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Сдвинуть вперёд"
              onClick={() => applyDeltaToSelected(shiftDays)}
            >→</button>
            <div className="w-px h-4 bg-border" />
            <button
              className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-muted text-muted-foreground hover:text-primary whitespace-nowrap"
              title="Связать выделенные цепочкой FS"
              onClick={linkSelectedChain}
            >
              <Link2 className="h-3 w-3" />
              Связать
            </button>
            <button
              className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive whitespace-nowrap"
              title="Убрать все связи выделенных (входящие и исходящие)"
              onClick={unlinkSelected}
            >
              <Unlink className="h-3 w-3" />
              Убрать связи
            </button>
            <button
              className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground whitespace-nowrap"
              title="Убрать с таймлайна — бары станут пиллами в боковом списке"
              onClick={removeFromTimeline}
            >
              <CalendarX2 className="h-3 w-3" />
              В список
            </button>
            <button
              className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground whitespace-nowrap"
              title="Сбросить сдвиг дат — вернуть исходные даты выделенных баров"
              onClick={resetSelectedDates}
            >
              <RotateCcw className="h-3 w-3" />
              Сбросить
            </button>
            <div className="w-px h-4 bg-border" />
            <button
              className="px-1.5 py-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Снять выделение"
              onClick={() => setSelectedStageIds(new Set())}
            >✕</button>
          </div>
        )}

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
