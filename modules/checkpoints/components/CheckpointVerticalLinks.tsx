'use client'

import { useMemo, useEffect } from 'react'
import { useCheckpointLinks } from '../context/CheckpointLinksContext'
import { SIDEBAR_WIDTH } from '@/modules/resource-graph/constants'

// ============================================================================
// Types
// ============================================================================

interface CheckpointGroup {
  checkpoint_id: string
  /** Синхронизированная X координата для всей группы (максимальное смещение) */
  x: number
  positions: Array<{
    sectionId: string
    y: number
    overlapIndex: number
    overlapTotal: number
  }>
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Сгруппировать чекпоинты по checkpoint_id
 * Возвращает только группы с более чем одной позицией (связанные чекпоинты)
 *
 * Для каждой группы вычисляется максимальное смещение X среди всех чекпоинтов,
 * чтобы все маркеры и вертикальная стрелка были выровнены по одной линии.
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
        x: pos.x, // Временное значение, будет пересчитано ниже
        positions: [],
      })
    }

    groups.get(key)!.positions.push({
      sectionId: pos.sectionId,
      y: pos.y,
      overlapIndex: pos.overlapIndex,
      overlapTotal: pos.overlapTotal,
    })
  }

  // Пересчитываем X для каждой группы: берём максимальное смещение
  // Это гарантирует, что все связанные чекпоинты будут на одной вертикали
  const allGroups = Array.from(groups.values()).map(group => {
    // Находим максимальное X среди всех позиций в группе
    const positionsWithX = positions.filter(p => p.checkpoint.checkpoint_id === group.checkpoint_id)
    const maxX = Math.max(...positionsWithX.map(p => p.x))

    return {
      ...group,
      x: maxX,
    }
  })

  console.log('[groupCheckpointsByIdent] All groups before filter:', allGroups)

  // Логируем детали каждой группы
  allGroups.forEach((g, idx) => {
    console.log(`[groupCheckpointsByIdent] Group ${idx}:`, {
      checkpoint_id: g.checkpoint_id,
      x: g.x,
      positions_count: g.positions.length,
      positions: g.positions,
      will_pass_filter: g.positions.length >= 2
    })
  })

  // Фильтруем только группы с >= 2 позиций (связанные чекпоинты)
  const filtered = allGroups.filter(g => g.positions.length >= 2)
  console.log('[groupCheckpointsByIdent] Filtered groups (>=2 positions):', filtered)

  return filtered
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

  // Временное логирование для отладки
  useEffect(() => {
    if (positions.length > 0) {
      console.log('[CheckpointVerticalLinks] Positions:', positions)
      console.log('[CheckpointVerticalLinks] Linked groups:', linkedGroups)
    }
  }, [positions, linkedGroups])

  if (linkedGroups.length === 0) {
    console.log('[CheckpointVerticalLinks] No linked groups, not rendering')
    return null
  }

  console.log('[CheckpointVerticalLinks] Rendering SVG with groups:', linkedGroups)

  // Вычисляем минимальные размеры SVG для покрытия всех линий
  const maxX = Math.max(...linkedGroups.map(g => g.x))
  const maxY = Math.max(...linkedGroups.flatMap(g => g.positions.map(p => p.y)))

  // Смещение для учета sidebar (340px - 36px = 304px)
  const X_OFFSET = SIDEBAR_WIDTH

  console.log('[CheckpointVerticalLinks] SVG dimensions:', { maxX, maxY, X_OFFSET })

  return (
    <svg
      className="absolute top-0 left-0 pointer-events-none overflow-visible z-0"
      style={{
        width: maxX + X_OFFSET + 100, // Добавляем запас
        height: maxY + 100, // Добавляем запас
      }}
    >
      {/* Определение маркера-стрелки */}
      <defs>
        <marker
          id="checkpoint-arrow"
          markerWidth="6"
          markerHeight="6"
          refX="3"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path
            d="M 0 0 L 6 3 L 0 6 z"
            fill="hsl(var(--border))"
            opacity="0.7"
          />
        </marker>
      </defs>

      {linkedGroups.map(group => {
        // Сортируем позиции по Y для корректного рисования линии сверху вниз
        const sortedPositions = [...group.positions].sort((a, b) => a.y - b.y)

        const firstY = sortedPositions[0].y
        const lastY = sortedPositions[sortedPositions.length - 1].y - 15 // Уменьшаем на 20px для стрелки

        const adjustedX = group.x + X_OFFSET

        console.log('[CheckpointVerticalLinks] Rendering line:', {
          checkpoint_id: group.checkpoint_id,
          x: group.x,
          adjustedX,
          firstY,
          lastY,
          positions: sortedPositions,
        })

        return (
          <g key={group.checkpoint_id}>
            {/* Вертикальная пунктирная линия между первым и последним чекпоинтом */}
            <line
              x1={adjustedX}
              y1={firstY}
              x2={adjustedX}
              y2={lastY}
              stroke="hsl(var(--border))"
              strokeWidth="2"
              strokeDasharray="4,4"
              opacity="0.7"
              markerEnd="url(#checkpoint-arrow)"
              className="transition-all duration-300"
            />

            {/* Опционально: точки на каждой позиции для визуальной связи */}
            {sortedPositions.map((pos, idx) => {
              // Не рисуем точки на первом и последнем (там уже есть маркеры)
              if (idx === 0 || idx === sortedPositions.length - 1) return null

              return (
                <circle
                  key={`${group.checkpoint_id}-${pos.sectionId}`}
                  cx={adjustedX}
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
