'use client'

import { useMemo } from 'react'
import { useCheckpointLinks } from '../context/CheckpointLinksContext'
import { SIDEBAR_WIDTH } from '@/modules/resource-graph/constants'

// ============================================================================
// Constants
// ============================================================================

const SVG_PADDING = 100
const ARROW_OFFSET = 15
const DEBUG = true // Set to true for development debugging

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
  const { positions, getSectionVisibility } = useCheckpointLinks()

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
      {/* Определение маркеров-стрелок */}
      <defs>
        {/* Основная стрелка для связей между чекпоинтами */}
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

        {/* Стрелка для указания направления к родительскому разделу */}
        <marker
          id="parent-direction-arrow"
          markerWidth="8"
          markerHeight="8"
          refX="4"
          refY="4"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path
            d="M 0 0 L 8 4 L 0 8 z"
            fill="hsl(var(--muted-foreground))"
            opacity="0.6"
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

        // Получаем данные родительского чекпоинта для определения родительской секции
        const parentCheckpoint = positionsMap.get(`${group.checkpoint_id}-${referencePos.sectionId}`)?.checkpoint
        const parentSectionId = parentCheckpoint?.section_id
        const parentSectionVisibility = parentSectionId ? getSectionVisibility(parentSectionId) : undefined

        if (DEBUG) {
          console.log('[CheckpointVerticalLinks] Rendering lines from parent:', {
            checkpoint_id: group.checkpoint_id,
            parentSectionId: referencePos.sectionId,
            linkedCount: group.positions.length - 1,
            parentSectionVisibility,
          })
        }

        return (
          <g key={group.checkpoint_id}>
            {/* Проверяем связи для поиска невидимых разделов */}
            {(() => {
              const parentCheckpointData = positionsMap.get(`${group.checkpoint_id}-${referencePos.sectionId}`)
              const linkedSections = parentCheckpointData?.checkpoint.linked_sections || []

              // Собираем все видимые sectionId из group.positions
              const visibleSectionIds = new Set(group.positions.map(p => p.sectionId))

              // Собираем стрелки к невидимым разделам (будем рисовать только уникальные)
              const collapsedSectionArrows = new Map<string, { sectionName: string; fromY: number }>()

              if (DEBUG) {
                console.log('[CheckpointVerticalLinks] Processing group:', {
                  checkpoint_id: group.checkpoint_id,
                  linkedSections: linkedSections.map(ls => ({ id: ls.section_id, name: ls.section_name })),
                  visibleSectionIds: Array.from(visibleSectionIds),
                  referencePos,
                })
              }

              // 1. Проверяем связанные разделы от родительского чекпоинта
              linkedSections.forEach((linkedSection) => {
                const isVisible = visibleSectionIds.has(linkedSection.section_id)
                const visibility = getSectionVisibility(linkedSection.section_id)

                if (DEBUG) {
                  console.log('[Step 1] Checking linked section from parent:', {
                    linkedSectionId: linkedSection.section_id,
                    linkedSectionName: linkedSection.section_name,
                    isVisible,
                    hasVisibility: !!visibility,
                    visibility,
                  })
                }

                if (!isVisible) {
                  if (visibility) {
                    collapsedSectionArrows.set(linkedSection.section_id, {
                      sectionName: linkedSection.section_name,
                      fromY: referencePos.y,
                    })
                    if (DEBUG) {
                      console.log('[Step 1] ✅ Added arrow for collapsed linked section:', linkedSection.section_name)
                    }
                  } else if (DEBUG) {
                    console.log('[Step 1] ⚠️ No visibility info for:', linkedSection.section_name)
                  }
                }
              })

              // 2. Проверяем родительский раздел (checkpoint.section_id) - если он не виден, добавляем стрелку
              // Это покрывает случай, когда видим связанный чекпоинт, но не видим родительский
              const parentSectionIdFromCheckpoint = parentCheckpointData?.checkpoint.section_id

              if (DEBUG) {
                console.log('[Step 2] Checking if parent section is visible:', {
                  parentSectionId: parentSectionIdFromCheckpoint,
                  isParentVisible: parentSectionIdFromCheckpoint ? visibleSectionIds.has(parentSectionIdFromCheckpoint) : null,
                  visibleSections: Array.from(visibleSectionIds),
                })
              }

              if (parentSectionIdFromCheckpoint && !visibleSectionIds.has(parentSectionIdFromCheckpoint)) {
                const visibility = getSectionVisibility(parentSectionIdFromCheckpoint)

                if (DEBUG) {
                  console.log('[Step 2] Parent section is collapsed:', {
                    parentSectionId: parentSectionIdFromCheckpoint,
                    hasVisibility: !!visibility,
                    visibility,
                    alreadyHasArrow: collapsedSectionArrows.has(parentSectionIdFromCheckpoint),
                  })
                }

                if (visibility && !collapsedSectionArrows.has(parentSectionIdFromCheckpoint)) {
                  // Используем позицию первого видимого связанного чекпоинта
                  const firstLinkedPos = group.positions.find(p => p.sectionId !== parentSectionIdFromCheckpoint)
                  if (firstLinkedPos) {
                    collapsedSectionArrows.set(parentSectionIdFromCheckpoint, {
                      sectionName: visibility.sectionName,
                      fromY: firstLinkedPos.y,
                    })
                    if (DEBUG) {
                      console.log('[Step 2] ✅ Added arrow for collapsed parent section:', visibility.sectionName)
                    }
                  }
                }
              }

              if (DEBUG) {
                console.log('[CheckpointVerticalLinks] Final arrows to render:', {
                  checkpoint_id: group.checkpoint_id,
                  arrows: Array.from(collapsedSectionArrows.entries()).map(([id, data]) => ({
                    sectionId: id,
                    sectionName: data.sectionName,
                    fromY: data.fromY,
                  })),
                })
              }

              return (
                <>
                  {/* Рисуем линии между видимыми чекпоинтами */}
                  {group.positions.map((pos) => {
                    // Пропускаем сам родительский чекпоинт
                    if (pos.sectionId === referencePos.sectionId) return null

                    // Определяем направление для этой конкретной связи
                    const isArrowUp = pos.y < referencePos.y

                    // Для правильного отображения стрелки линия должна идти от начала к концу
                    let y1, y2
                    if (isArrowUp) {
                      y1 = referencePos.y
                      y2 = pos.y + ARROW_OFFSET
                    } else {
                      y1 = referencePos.y
                      y2 = pos.y - ARROW_OFFSET
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

                  {/* Рисуем стрелки-указатели к невидимым (свёрнутым) разделам */}
                  {Array.from(collapsedSectionArrows.entries()).map(([sectionId, { sectionName, fromY }]) => {
                    if (DEBUG) {
                      console.log('[CollapsedSection Arrow]:', {
                        checkpoint_id: group.checkpoint_id,
                        collapsedSectionId: sectionId,
                        collapsedSectionName: sectionName,
                        fromY,
                      })
                    }

                    return (
                      <g key={`collapsed-${group.checkpoint_id}-${sectionId}`}>
                        {/* Вертикальная пунктирная стрелка в направлении свёрнутого раздела (вниз) */}
                        <line
                          x1={adjustedX}
                          y1={fromY}
                          x2={adjustedX}
                          y2={fromY + 40}
                          stroke="hsl(var(--muted-foreground))"
                          strokeWidth="1.5"
                          strokeDasharray="3,3"
                          opacity="0.6"
                          markerEnd="url(#parent-direction-arrow)"
                          className="transition-all duration-300"
                        />

                        {/* Метка с названием свёрнутого раздела */}
                        <foreignObject
                          x={adjustedX + 8}
                          y={fromY + 30}
                          width="120"
                          height="40"
                          className="pointer-events-none"
                        >
                          <div className="flex items-center">
                            <div className="bg-muted/80 border border-border/50 rounded px-2 py-0.5 text-xs text-muted-foreground font-normal truncate max-w-full shadow-sm">
                              {sectionName}
                            </div>
                          </div>
                        </foreignObject>
                      </g>
                    )
                  })}
                </>
              )
            })()}
          </g>
        )
      })}
    </svg>
  )
}

export default CheckpointVerticalLinks
