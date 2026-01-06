'use client'

import { useMemo } from 'react'
import { useCheckpointLinks } from '../context/CheckpointLinksContext'
import { useUIStateStore } from '@/modules/resource-graph/stores'

// ============================================================================
// Constants
// ============================================================================

const SVG_PADDING = 100
const MARKER_RADIUS = 8   // Радиус маркера чекпоинта (синхронизирован с CheckpointMarker)

// ============================================================================
// Types
// ============================================================================

interface LinkedGroup {
  checkpointId: string
  /** Синхронизированная X координата (максимальная среди всех позиций группы) */
  x: number
  /** Позиции отсортированные по Y */
  positions: Array<{
    sectionId: string
    y: number
  }>
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Компонент для отрисовки вертикальных линий между связанными чекпоинтами
 *
 * Простая логика:
 * 1. Берём все зарегистрированные позиции чекпоинтов из контекста
 * 2. Группируем по checkpoint_id
 * 3. Для групп с 2+ позициями рисуем вертикальные линии
 *
 * Если зависимый чекпоинт не виден (секция свёрнута/отфильтрована),
 * он не будет зарегистрирован в контексте, и линия к нему не рисуется.
 */
export function CheckpointVerticalLinks() {
  const { positions } = useCheckpointLinks()
  const expandedSections = useUIStateStore((state) => state.expandedNodes.section)

  // Группируем чекпоинты по checkpoint_id
  const linkedGroups = useMemo((): LinkedGroup[] => {
    if (positions.length === 0) return []

    // Группируем по checkpoint_id
    const groups = new Map<string, LinkedGroup>()

    for (const pos of positions) {
      const key = pos.checkpoint.checkpoint_id

      if (!groups.has(key)) {
        groups.set(key, {
          checkpointId: key,
          x: pos.x,
          positions: [],
        })
      }

      const group = groups.get(key)!
      group.positions.push({
        sectionId: pos.sectionId,
        y: pos.y,
      })
      // Берём максимальный X для выравнивания всех маркеров по одной вертикали
      group.x = Math.max(group.x, pos.x)
    }

    // Оставляем только группы с 2+ позициями и сортируем позиции по Y
    // Исключаем группы, где хотя бы одна секция развёрнута
    return Array.from(groups.values())
      .filter(g => g.positions.length >= 2)
      .filter(g => !g.positions.some(p => expandedSections.has(p.sectionId)))
      .map(g => ({
        ...g,
        positions: g.positions.sort((a, b) => a.y - b.y),
      }))
  }, [positions, expandedSections])

  if (linkedGroups.length === 0) {
    return null
  }

  // Вычисляем размеры SVG
  const maxX = Math.max(...linkedGroups.map(g => g.x))
  const maxY = Math.max(...linkedGroups.flatMap(g => g.positions.map(p => p.y)))

  return (
    <svg
      className="absolute top-0 left-0 pointer-events-none overflow-visible z-0"
      style={{
        width: maxX + SVG_PADDING,
        height: maxY + SVG_PADDING,
      }}
    >

      {linkedGroups.map(group => {
        // X координата уже абсолютная (относительно контейнера)
        const x = group.x

        // Рисуем линии между соседними позициями (отсортированы по Y)
        return (
          <g key={group.checkpointId}>
            {group.positions.slice(0, -1).map((pos, index) => {
              const nextPos = group.positions[index + 1]

              // Линия идёт от центра текущего чекпоинта к верхнему краю следующего
              // y1 из центра - линия будет скрыта под маркером source
              // y2 до верхнего края target - стрелка укажет на край
              const y1 = pos.y                          // Центр source (скрыт под маркером)
              const y2 = nextPos.y - MARKER_RADIUS      // Верхний край target

              // Не рисуем линию если она слишком короткая
              if (y2 - y1 < MARKER_RADIUS + 4) return null

              return (
                <line
                  key={`${group.checkpointId}-${pos.sectionId}-${nextPos.sectionId}`}
                  x1={x}
                  y1={y1}
                  x2={x}
                  y2={y2}
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth="1"
                  strokeDasharray="4,3"
                  opacity="0.4"
                  className="transition-all duration-300"
                />
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}

export default CheckpointVerticalLinks
