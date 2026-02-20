'use client'

import type { KanbanStage } from '../../types'
import { CircularProgress } from './CircularProgress'

interface CompactCircularProgressProps {
  progress: number
  stage?: KanbanStage
}

/**
 * Compact circular progress with stage calculation tooltip
 *
 * Wrapper around CircularProgress that adds stage-specific tooltip
 * showing detailed progress calculation breakdown.
 */
export function CompactCircularProgress({
  progress,
  stage
}: CompactCircularProgressProps) {
  const getTooltipContent = () => {
    if (!stage || !stage.tasks.length) {
      return <p>Прогресс: {progress}%</p>
    }

    // REPORTING DISABLED: hours-based progress calculation tooltip
    // const totalPlannedHours = stage.tasks.reduce((sum, t) => sum + t.plannedHours, 0)
    // const completedHours = stage.tasks.reduce(
    //   (sum, t) => sum + (t.plannedHours * t.progress) / 100,
    //   0
    // )

    return (
      <div className="text-xs space-y-1">
        <div className="font-semibold">Прогресс этапа:</div>
        {/* REPORTING DISABLED: hours breakdown */}
        {/* <div>Выполнено: {completedHours.toFixed(1)} ч</div> */}
        {/* <div>Всего плановых: {totalPlannedHours} ч</div> */}
        <div>
          Прогресс: {progress}%
        </div>
        {/* REPORTING DISABLED: calculation explanation */}
        {/* <div className="text-muted-foreground text-[10px] pt-1">
          Рассчитывается как сумма произведений плановых часов каждой задачи на её процент готовности
        </div> */}
      </div>
    )
  }

  return (
    <CircularProgress
      progress={progress}
      variant="compact"
      tooltip={getTooltipContent()}
    />
  )
}
