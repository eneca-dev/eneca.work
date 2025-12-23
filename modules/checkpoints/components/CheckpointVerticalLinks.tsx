'use client'

import { useMemo } from 'react'
import { useCheckpointLinks } from '../context/CheckpointLinksContext'
import { SIDEBAR_WIDTH } from '@/modules/resource-graph/constants'

// ============================================================================
// Constants
// ============================================================================

const SVG_PADDING = 100
const ARROW_OFFSET = 15
const DEBUG = false // Set to true for development debugging

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

  // Фильтруем только группы с >= 2 позиций (связанные чекпоинты)
  const filtered = allGroups.filter(g => g.positions.length >= 2)

  if (DEBUG) {
    console.log('[groupCheckpointsByIdent] Filtered groups (>=2 positions):', filtered)
  }

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

  if (linkedGroups.length === 0) {
    return null
  }

  if (DEBUG) {
    console.log('[CheckpointVerticalLinks] Rendering SVG with groups:', linkedGroups)
  }

  // Вычисляем минимальные размеры SVG для покрытия всех линий
  const maxX = Math.max(...linkedGroups.map(g => g.x))
  const maxY = Math.max(...linkedGroups.flatMap(g => g.positions.map(p => p.y)))

  // Смещение для учета sidebar
  const X_OFFSET = SIDEBAR_WIDTH

  return (
    <svg
      className="absolute top-0 left-0 pointer-events-none overflow-visible z-0"
      style={{
        width: maxX + X_OFFSET + SVG_PADDING,
        height: maxY + SVG_PADDING,
      }}
    >
      {/* Определение маркера-стрелки */}
      <defs>
        <marker
          id="checkpoint-arrow"
          markerWidth="10"
          markerHeight="10"
          refX="5"
          refY="5"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path
            d="M 0 0 L 10 5 L 0 10 z"
            fill="hsl(var(--border))"
            opacity="0.9"
          />
        </marker>
      </defs>

      {linkedGroups.map(group => {
        // Создаём lookup map для быстрого поиска
        const positionsMap = new Map(
          positions.map(p => [`${p.checkpoint.checkpoint_id}-${p.sectionId}`, p])
        )

        // Найдём родительский чекпоинт (тот, где checkpoint.section_id совпадает с sectionId позиции)
        const parentPos = group.positions.find(pos => {
          const checkpoint = positionsMap.get(`${group.checkpoint_id}-${pos.sectionId}`)
          return checkpoint?.checkpoint.section_id === checkpoint?.sectionId
        })

        // Если не нашли родительский, используем первый по Y (резервный вариант)
        const sortedPositions = [...group.positions].sort((a, b) => a.y - b.y)
        const referencePos = parentPos || sortedPositions[0]

        const adjustedX = group.x + X_OFFSET

        if (DEBUG) {
          console.log('[CheckpointVerticalLinks] Rendering lines from parent:', {
            checkpoint_id: group.checkpoint_id,
            parentSectionId: referencePos.sectionId,
            linkedCount: group.positions.length - 1,
          })
        }

        return (
          <g key={group.checkpoint_id}>
            {/* Рисуем отдельную линию от родительского к каждому связанному чекпоинту */}
            {group.positions.map((pos) => {
              // Пропускаем сам родительский чекпоинт
              if (pos.sectionId === referencePos.sectionId) return null

              // Определяем направление для этой конкретной связи
              const isArrowUp = pos.y < referencePos.y

              // Для правильного отображения стрелки линия должна идти от начала к концу
              // markerEnd всегда на конце линии (y2)
              let y1, y2
              if (isArrowUp) {
                // Стрелка вверх: линия идёт от родительского (снизу) вверх к связанному
                y1 = referencePos.y
                y2 = pos.y + ARROW_OFFSET
              } else {
                // Стрелка вниз: линия идёт от родительского (сверху) вниз к связанному
                y1 = referencePos.y
                y2 = pos.y - ARROW_OFFSET
              }

              if (DEBUG) {
                console.log(`[Line] ${group.checkpoint_id} -> ${pos.sectionId}:`, {
                  isArrowUp,
                  y1,
                  y2,
                  direction: y2 > y1 ? 'down' : 'up'
                })
              }

              return (
                <line
                  key={`${group.checkpoint_id}-${pos.sectionId}`}
                  x1={adjustedX}
                  y1={y1}
                  x2={adjustedX}
                  y2={y2}
                  stroke="hsl(var(--border))"
                  strokeWidth="2"
                  strokeDasharray="4,4"
                  opacity="0.7"
                  markerEnd="url(#checkpoint-arrow)"
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
