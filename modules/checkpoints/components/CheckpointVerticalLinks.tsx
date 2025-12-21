'use client'

import { useMemo } from 'react'
import { useCheckpointLinks } from '../context/CheckpointLinksContext'

// ============================================================================
// Types
// ============================================================================

interface CheckpointGroup {
  checkpoint_id: string
  x: number
  positions: Array<{
    sectionId: string
    y: number
  }>
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Сгруппировать чекпоинты по checkpoint_id
 * Возвращает только группы с более чем одной позицией (связанные чекпоинты)
 */
function groupCheckpointsByIdent(
  positions: ReturnType<typeof useCheckpointLinks>['positions']
): CheckpointGroup[] {
  const groups = new Map<string, CheckpointGroup>()

  for (const pos of positions) {
    const key = pos.checkpoint.checkpoint_id

    if (!groups.has(key)) {
      groups.set(key, {
        checkpoint_id: pos.checkpoint.checkpoint_id,
        x: pos.x,
        positions: [],
      })
    }

    groups.get(key)!.positions.push({ sectionId: pos.sectionId, y: pos.y })
  }

  // Фильтруем только группы с >= 2 позиций (связанные чекпоинты)
  return Array.from(groups.values()).filter(g => g.positions.length >= 2)
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Компонент для отрисовки вертикальных линий между связанными чекпоинтами
 *
 * Этот компонент рендерится поверх всего timeline и рисует линии между
 * чекпоинтами с одинаковым checkpoint_id, которые отображаются в разных
 * секциях (строках).
 *
 * Использует CheckpointLinksContext для получения позиций всех чекпоинтов.
 */
export function CheckpointVerticalLinks() {
  const { positions } = useCheckpointLinks()

  // Группируем чекпоинты по checkpoint_id
  const linkedGroups = useMemo(() => {
    return groupCheckpointsByIdent(positions)
  }, [positions])

  if (linkedGroups.length === 0) return null

  return (
    <svg
      className="absolute top-0 left-0 pointer-events-none overflow-visible"
      style={{
        width: '100%',
        height: '100%',
        zIndex: 45, // Выше графиков (z-40), но ниже маркеров (z-50)
      }}
    >
      {linkedGroups.map(group => {
        // Сортируем позиции по Y для корректного рисования линии сверху вниз
        const sortedPositions = [...group.positions].sort((a, b) => a.y - b.y)

        const firstY = sortedPositions[0].y
        const lastY = sortedPositions[sortedPositions.length - 1].y

        return (
          <g key={group.checkpoint_id}>
            {/* Вертикальная пунктирная линия между первым и последним чекпоинтом */}
            <line
              x1={group.x}
              y1={firstY}
              x2={group.x}
              y2={lastY}
              stroke="hsl(var(--border))"
              strokeWidth="2"
              strokeDasharray="4,4"
              opacity="0.5"
              className="transition-all duration-300"
            />

            {/* Опционально: точки на каждой позиции для визуальной связи */}
            {sortedPositions.map((pos, idx) => {
              // Не рисуем точки на первом и последнем (там уже есть маркеры)
              if (idx === 0 || idx === sortedPositions.length - 1) return null

              return (
                <circle
                  key={`${group.checkpoint_id}-${pos.sectionId}`}
                  cx={group.x}
                  cy={pos.y}
                  r={3}
                  fill="hsl(var(--border))"
                  opacity="0.6"
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
