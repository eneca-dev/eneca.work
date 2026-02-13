/**
 * StageSelect - Выбор этапа декомпозиции (улучшенный дизайн)
 *
 * Вертикальный timeline с radio buttons для выбора этапа
 * Visual style: dark/amber theme с улучшенными линиями и выделением
 */

'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Circle, CircleDot } from 'lucide-react'

interface Stage {
  id: string
  name: string
  order: number | null
}

interface StageSelectProps {
  stages: Stage[]
  selectedStageId: string | null
  onChange: (stageId: string | null) => void
  className?: string
}

export function StageSelect({
  stages,
  selectedStageId,
  onChange,
  className,
}: StageSelectProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  // Сортируем stages по order
  const sortedStages = [...stages].sort((a, b) => {
    if (a.order === null) return 1
    if (b.order === null) return -1
    return a.order - b.order
  })

  const hasStages = sortedStages.length > 0

  return (
    <div className={cn('relative flex flex-col h-full', className)}>
      {/* Background grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(251, 191, 36, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(251, 191, 36, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px',
        }}
      />

      {/* Header */}
      <div className="px-4 py-3 border-b border-border/50 flex-shrink-0">
        <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <span className="inline-block w-1 h-1 rounded-full bg-emerald-500/60" />
          Привязка к этапу
        </h3>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="py-4 px-2 space-y-0.5 relative">
          {/* Опция "Без этапа" - отдельно */}
          <label
            className={cn(
              'relative flex items-center gap-3 px-2 py-3 rounded-md cursor-pointer transition-all duration-200 mb-3',
              'hover:bg-muted/50',
              selectedStageId === null && 'bg-emerald-500/10 hover:bg-emerald-500/15',
              'group border border-dashed',
              selectedStageId === null ? 'border-emerald-500/50' : 'border-border/30'
            )}
            onMouseEnter={() => setHoveredId(null)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <input
              type="radio"
              name="stage-select"
              checked={selectedStageId === null}
              onChange={() => onChange(null)}
              className="sr-only"
            />

            {/* Icon для "Без этапа" */}
            <div className="relative flex-shrink-0">
              <Circle
                className={cn(
                  'w-5 h-5 transition-all duration-300',
                  selectedStageId === null
                    ? 'text-emerald-500 fill-emerald-500/20'
                    : 'text-muted-foreground/40'
                )}
              />
            </div>

            {/* Label */}
            <span
              className={cn(
                'text-sm font-medium transition-colors duration-200',
                selectedStageId === null
                  ? 'text-emerald-500'
                  : 'text-muted-foreground group-hover:text-foreground'
              )}
            >
              Без этапа
            </span>

            {/* Selection indicator */}
            {selectedStageId === null && (
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-transparent via-emerald-500 to-transparent rounded-l-full animate-in slide-in-from-right duration-300" />
            )}
          </label>

          {/* Разделитель */}
          {hasStages && (
            <div className="flex items-center gap-2 px-2 py-2">
              <div className="h-px flex-1 bg-border/30" />
              <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">
                Этапы
              </span>
              <div className="h-px flex-1 bg-border/30" />
            </div>
          )}

          {/* Этапы без вертикальной линии */}
          {hasStages && (
            <div className="relative">

              {sortedStages.map((stage) => {
                const isSelected = selectedStageId === stage.id
                const isHovered = hoveredId === stage.id
                const isActive = isSelected || isHovered

                return (
                  <label
                    key={stage.id}
                    className={cn(
                      'relative flex items-center gap-3 px-2 py-2.5 rounded-md cursor-pointer transition-all duration-200',
                      'hover:bg-muted/50',
                      isSelected && 'bg-emerald-500/10 hover:bg-emerald-500/15',
                      'group'
                    )}
                    onMouseEnter={() => setHoveredId(stage.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <input
                      type="radio"
                      name="stage-select"
                      checked={isSelected}
                      onChange={() => onChange(stage.id)}
                      className="sr-only"
                    />

                    {/* Radio button */}
                    <div className="relative flex-shrink-0 z-10">
                      {/* Outer ring */}
                      <div
                        className={cn(
                          'relative w-5 h-5 rounded-full border-2 transition-all duration-300 bg-background',
                          isSelected
                            ? 'border-emerald-500 bg-emerald-500/20'
                            : 'border-border',
                          isHovered && !isSelected && 'border-emerald-500/60 scale-110'
                        )}
                      >
                        {/* Inner dot */}
                        {isSelected && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-in zoom-in duration-200" />
                          </div>
                        )}

                        {/* Pulse effect on hover */}
                        {isHovered && !isSelected && (
                          <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-in zoom-in duration-200" />
                        )}
                      </div>
                    </div>

                    {/* Label - только название этапа */}
                    <div className="flex-1 min-w-0">
                      <span
                        className={cn(
                          'text-sm font-medium truncate block transition-colors duration-200',
                          isSelected
                            ? 'text-emerald-400'
                            : 'text-foreground group-hover:text-foreground'
                        )}
                      >
                        {stage.name}
                      </span>
                    </div>

                    {/* Selection indicator */}
                    {isSelected && (
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-transparent via-emerald-500 to-transparent rounded-l-full animate-in slide-in-from-right duration-300" />
                    )}
                  </label>
                )
              })}
            </div>
          )}

          {/* Footer hint если нет этапов */}
          {!hasStages && (
            <div className="px-4 py-3 mt-2">
              <p className="text-xs text-muted-foreground/60 italic text-center">
                В разделе нет этапов декомпозиции
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
