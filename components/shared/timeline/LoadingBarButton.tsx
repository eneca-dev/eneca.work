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
import { ProspectiveLoadingBadge } from './ProspectiveLoadingBadge'
import { PROSPECTIVE_LOADING_DESCRIPTION } from './prospective-loading'

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
  const isProspective = bar.loading.isProspective === true
  const tinyBadge = isProspective && bar.position.width < 16
  const compactBadge = bar.position.width < 200
  const stackedBadge = isProspective && bar.position.width < 52
  // 8px запаса справа, чтобы подпись не упиралась в самый край бара
  const labelRef = useStickyBarLabel<HTMLSpanElement>(
    bar.position.left,
    bar.position.width,
    isProspective ? (stackedBadge ? 28 : compactBadge ? 48 : 118) : 8,
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={cn(
            'absolute rounded-sm flex items-center gap-1 px-1.5 cursor-pointer',
            'hover:brightness-110 transition-all pointer-events-auto',
            'text-white text-[10px] font-medium leading-none truncate',
            stackedBadge && 'flex-col justify-center gap-0 px-0',
            tinyBadge && 'ring-2 ring-inset ring-amber-200',
          )}
          style={{
            left: bar.position.left,
            width: bar.position.width,
            height: BAR_HEIGHT,
            top: BAR_TOP_OFFSET + bar.row * (BAR_HEIGHT + BAR_GAP),
            backgroundColor: getSectionColor(bar.loading.projectId, bar.loading.sectionId, bar.loading.stageId, true),
          }}
          onClick={() => onLoadingClick?.(bar.loading.id)}
          title={isProspective ? `Перспектива. ${PROSPECTIVE_LOADING_DESCRIPTION}` : undefined}
          aria-label={tinyBadge ? `Перспектива. ${PROSPECTIVE_LOADING_DESCRIPTION}` : undefined}
        >
          {tinyBadge ? null : isProspective ? (
            <span ref={labelRef} className={cn('inline-flex min-w-0 items-center', stackedBadge ? 'flex-col gap-0' : 'gap-1')}>
              <span className="shrink-0 font-semibold">{bar.loading.rate}</span>
              <ProspectiveLoadingBadge compact={compactBadge} />
              {bar.position.width > 80 && (
                <span className="truncate opacity-80">{bar.loading.projectName || bar.loading.sectionName || ''}</span>
              )}
            </span>
          ) : (
            <>
              <span className="shrink-0 font-semibold">{bar.loading.rate}</span>
              {bar.position.width > 50 && (
                <span ref={labelRef} className="inline-block truncate opacity-80">
                  {bar.loading.projectName || bar.loading.sectionName || ''}
                </span>
              )}
            </>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px]">
        <div className="text-xs space-y-1">
          {isProspective && <p>Перспектива. {PROSPECTIVE_LOADING_DESCRIPTION}</p>}
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
