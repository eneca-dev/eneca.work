'use client'

import { useState } from 'react'
import type React from 'react'
import type { BarRect, MockLink } from '../types'

const BAR_H = 24
const ARROW_YELLOW = '#eab308'
const ARROW_ALT = '#8b5cf6'
const ARROW_ACTIVE = '#1e7260'

const MARKERS = {
  yellow: ARROW_YELLOW,
  alt: ARROW_ALT,
  active: ARROW_ACTIVE,
} as const
type MarkerKey = keyof typeof MARKERS

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return [h * 360, s * 100, l * 100]
}

function isYellowish(hex: string): boolean {
  if (!hex.startsWith('#') || hex.length < 7) return false
  const [h, s, l] = hexToHsl(hex)
  return h >= 45 && h <= 70 && s > 30 && l > 20
}

function buildPath(from: BarRect, to: BarRect, startOffset = 0): string {
  const x1 = from.x + from.width + startOffset
  const y1 = from.y + BAR_H / 2
  const x2 = to.x
  const y2 = to.y + BAR_H / 2
  const dx = Math.max(Math.abs(x2 - x1) * 0.5, 40)
  return `M ${x1} ${y1} C ${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`
}

interface GanttLinksProps {
  links: MockLink[]
  barRects: Map<string, BarRect>
  stageProjectColors: Map<string, string>
  draftLink: { fromId: string; toX: number; toY: number } | null
  selectedLinkId: string | null
  onSelectLink: (id: string | null) => void
  onDeleteLink: (id: string) => void
  svgRef: React.RefObject<SVGSVGElement | null>
  timelineWidth: number
  totalHeight: number
}

export function GanttLinks({
  links,
  barRects,
  stageProjectColors,
  draftLink,
  selectedLinkId,
  onSelectLink,
  onDeleteLink,
  svgRef,
  timelineWidth,
  totalHeight,
}: GanttLinksProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  function getMarkerKey(link: MockLink): MarkerKey {
    const projColor = stageProjectColors.get(link.fromStageId) ?? ''
    return isYellowish(projColor) ? 'alt' : 'yellow'
  }

  return (
    <svg
      ref={svgRef}
      style={{
        width: timelineWidth,
        height: Math.max(totalHeight, 1),
        display: 'block',
        overflow: 'visible',
        pointerEvents: 'none',
      }}
    >
      <defs>
        {(Object.entries(MARKERS) as [MarkerKey, string][]).map(([key, color]) => (
          <marker key={key} id={`glink-arrow-${key}`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <path d="M0,0.5 L0,6.5 L6.5,3.5 z" fill={color} />
          </marker>
        ))}
      </defs>

      {links.map(link => {
        const from = barRects.get(link.fromStageId)
        const to = barRects.get(link.toStageId)
        if (!from || !to) return null

        const isSelected = selectedLinkId === link.id
        const isHovered = hoveredId === link.id
        const markerKey: MarkerKey = isSelected ? 'active' : getMarkerKey(link)
        const strokeColor = MARKERS[markerKey]
        const d = buildPath(from, to)

        // X button at the arrow's attachment to the target bar (its left edge)
        const xBtnX = to.x
        const xBtnY = to.y + BAR_H / 2

        return (
          <g key={link.id}>
            {/* Wide transparent hit area — starts 26px from source bar edge to avoid
                blocking the yellow grab circle (circle center ≈ 21px from bar right) */}
            <path
              d={buildPath(from, to, 26)}
              stroke="transparent"
              strokeWidth={14}
              fill="none"
              style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
              onClick={e => {
                e.stopPropagation()
                onSelectLink(isSelected ? null : link.id)
              }}
              onMouseEnter={() => setHoveredId(link.id)}
              onMouseLeave={() => setHoveredId(null)}
            />
            {/* Visible arrow */}
            <path
              d={d}
              stroke={strokeColor}
              strokeWidth={isSelected || isHovered ? 2 : 1.5}
              fill="none"
              markerEnd={`url(#glink-arrow-${markerKey})`}
              style={{ pointerEvents: 'none' }}
            />

            {/* X button — visible on hover, positioned at the target bar's left edge */}
            {isHovered && (
              <g
                style={{ pointerEvents: 'all', cursor: 'pointer' }}
                onMouseEnter={() => setHoveredId(link.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={e => {
                  e.stopPropagation()
                  onDeleteLink(link.id)
                  if (isSelected) onSelectLink(null)
                }}
              >
                <circle cx={xBtnX} cy={xBtnY} r={9} fill="white" stroke="#d1d5db" strokeWidth={1.5} />
                <text
                  x={xBtnX}
                  y={xBtnY + 5}
                  textAnchor="middle"
                  fill="#6b7280"
                  fontSize={15}
                  fontWeight="bold"
                  style={{ userSelect: 'none', pointerEvents: 'none' }}
                >
                  ×
                </text>
              </g>
            )}
          </g>
        )
      })}

      {/* Draft link — shown while drawing */}
      {draftLink && (() => {
        const from = barRects.get(draftLink.fromId)
        if (!from) return null
        const x1 = from.x + from.width
        const y1 = from.y + BAR_H / 2
        return (
          <line
            x1={x1}
            y1={y1}
            x2={draftLink.toX}
            y2={draftLink.toY}
            stroke={ARROW_ACTIVE}
            strokeWidth={1.5}
            strokeDasharray="5,3"
            markerEnd="url(#glink-arrow-active)"
            style={{ pointerEvents: 'none' }}
          />
        )
      })()}
    </svg>
  )
}
