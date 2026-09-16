/**
 * LoadingBarButton — общая кнопка-бар для широкой сетки (неделя/месяц).
 *
 * WeeklyLoadingBars и MonthlyLoadingBars рендерят один и тот же бар 1:1
 * (WeeklyBarLoading = MonthlyBarLoading, см. WeeklyLoadingBars.tsx) — раньше
 * JSX был продублирован в двух файлах (bug-AB-08 добавил sticky-подпись
 * в оба места по отдельности). Вынесено сюда одним компонентом.
 *
 * Отдельный компонент (не инлайн в `.map()`) — useStickyBarLabel требует
 * стабильной позиции хука в дереве, вызвать его прямо в `.map()` нельзя.
 */

'use client'

import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getSectionColor } from './loading-bars-utils'
import { useStickyBarLabel } from './useStickyBarLabel'
import type { MonthlyBarLoading } from './MonthlyLoadingBars'

export const BAR_HEIGHT = 24
export const BAR_GAP = 3
export const BAR_TOP_OFFSET = 4

export interface BarPosition {
  left: number
  width: number
}

export interface BarRender {
  loading: MonthlyBarLoading
  position: BarPosition
  row: number // вертикальный ряд (для стекинга)
}

interface LoadingBarButtonProps {
  bar: BarRender
  onLoadingClick?: (loadingId: string) => void
}

export function LoadingBarButton({ bar, onLoadingClick }: LoadingBarButtonProps) {
  // 8px запаса справа, чтобы подпись не упиралась в самый край бара
  const labelRef = useStickyBarLabel<HTMLSpanElement>(bar.position.left, bar.position.width, 8)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={cn(
            'absolute rounded-sm flex items-center gap-1 px-1.5 cursor-pointer',
            'hover:brightness-110 transition-all pointer-events-auto',
            'text-white text-[10px] font-medium leading-none truncate'
          )}
          style={{
            left: bar.position.left,
            width: bar.position.width,
            height: BAR_HEIGHT,
            top: BAR_TOP_OFFSET + bar.row * (BAR_HEIGHT + BAR_GAP),
            backgroundColor: getSectionColor(bar.loading.projectId, bar.loading.sectionId, bar.loading.stageId, true),
          }}
          onClick={() => onLoadingClick?.(bar.loading.id)}
        >
          <span className="shrink-0 font-semibold">{bar.loading.rate}</span>
          {bar.position.width > 50 && (
            <span ref={labelRef} className="inline-block truncate opacity-80">
              {bar.loading.projectName || bar.loading.sectionName || ''}
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px]">
        <div className="text-xs space-y-1">
          {bar.loading.projectName && (
            <p className="font-medium">{bar.loading.projectName}</p>
          )}
          {bar.loading.sectionName && (
            <p className="text-muted-foreground">{bar.loading.sectionName}</p>
          )}
          <p>
            Ставка: {bar.loading.rate} · {bar.loading.startDate} → {bar.loading.endDate}
          </p>
          {bar.loading.comment && (
            <p className="text-muted-foreground italic">{bar.loading.comment}</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
