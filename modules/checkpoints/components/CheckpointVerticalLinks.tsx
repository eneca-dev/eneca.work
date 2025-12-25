'use client'

import { useMemo } from 'react'
import { useCheckpointLinks } from '../context/CheckpointLinksContext'

// ============================================================================
// Constants
// ============================================================================

const SVG_PADDING = 100
const ARROW_OFFSET = 12  // Отступ для стрелки

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
    return Array.from(groups.values())
      .filter(g => g.positions.length >= 2)
      .map(g => ({
        ...g,
        positions: g.positions.sort((a, b) => a.y - b.y),
      }))
  }, [positions])

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
      {/* Определение маркера-стрелки */}
      <defs>
        <marker
          id="checkpoint-link-arrow"
          markerWidth="6"
          markerHeight="6"
          refX="3"
          refY="3"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path
            d="M 0 0 L 6 3 L 0 6 z"
            fill="hsl(var(--muted-foreground))"
            opacity="0.6"
          />
        </marker>
      </defs>

      {linkedGroups.map(group => {
        // X координата уже абсолютная (относительно контейнера)
        const x = group.x

        // Рисуем линии между соседними позициями (отсортированы по Y)
        return (
          <g key={group.checkpointId}>
            {group.positions.slice(0, -1).map((pos, index) => {
              const nextPos = group.positions[index + 1]

              // Линия идёт от текущей позиции к следующей (вниз)
              const y1 = pos.y
              const y2 = nextPos.y - ARROW_OFFSET

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
                  opacity="0.5"
                  markerEnd="url(#checkpoint-link-arrow)"
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
