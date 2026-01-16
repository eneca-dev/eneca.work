'use client'

import { useMemo } from 'react'
import { format } from 'date-fns'
import { parseMinskDate } from '@/lib/timezone-utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import type { Loading } from '../../types'
import { getInitials } from '../../utils'

interface LoadingBadgesProps {
  /** Загрузки для этого этапа */
  loadings: Loading[]
  /** Максимум видимых аватаров */
  maxVisible?: number
}

/**
 * Компактные стек-аватары с загрузками
 * Glass-morphic дизайн с overlapping эффектом
 */
export function LoadingBadges({ loadings, maxVisible = 4 }: LoadingBadgesProps) {
  if (!loadings || loadings.length === 0) return null

  // Фильтруем только активные загрузки
  const activeLoadings = useMemo(() => {
    return loadings.filter(l => l.status === 'active' && !l.isShortage)
  }, [loadings])

  if (activeLoadings.length === 0) return null

  const visibleLoadings = activeLoadings.slice(0, maxVisible)
  const hiddenCount = activeLoadings.length - maxVisible

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex items-center">
        {/* Stacked avatars */}
        <div className="flex items-center -space-x-1.5">
          {visibleLoadings.map((loading, index) => (
            <LoadingAvatar
              key={loading.id}
              loading={loading}
              index={index}
            />
          ))}

          {/* Overflow indicator */}
          {hiddenCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="
                    relative flex items-center justify-center
                    w-[18px] h-[18px] rounded-full
                    bg-muted/50 dark:bg-gradient-to-b dark:from-white/[0.12] dark:to-white/[0.04]
                    border border-border dark:border-white/[0.15]
                    text-[9px] font-medium text-muted-foreground dark:text-white/70
                    cursor-default
                    hover:bg-muted dark:hover:from-white/[0.18] dark:hover:to-white/[0.08]
                    transition-all duration-200
                  "
                  style={{ zIndex: maxVisible + 1 }}
                >
                  +{hiddenCount}
                </div>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="
                  bg-popover backdrop-blur-xl
                  border border-border
                  shadow-xl
                  rounded-lg px-3 py-2
                "
              >
                <div className="space-y-1">
                  {activeLoadings.slice(maxVisible).map(l => (
                    <div key={l.id} className="text-[11px] text-muted-foreground">
                      {l.employee.name || 'Не назначен'} · {formatRate(l.rate)}
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

interface LoadingAvatarProps {
  loading: Loading
  index: number
}

/**
 * Отдельный аватар загрузки с rate badge
 */
function LoadingAvatar({ loading, index }: LoadingAvatarProps) {
  const initials = getInitials(loading.employee.firstName, loading.employee.lastName)
  const hasAvatar = !!loading.employee.avatarUrl

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="relative group cursor-default"
          style={{ zIndex: index + 1 }}
        >
          {/* Avatar container with glass border */}
          <div
            className="
              relative
              rounded-full
              p-[1px]
              bg-border dark:bg-gradient-to-b dark:from-white/[0.2] dark:to-white/[0.05]
              transition-all duration-200
              group-hover:bg-muted-foreground/30 dark:group-hover:from-white/[0.3] dark:group-hover:to-white/[0.1]
              dark:group-hover:shadow-[0_0_8px_rgba(255,255,255,0.15)]
            "
          >
            <Avatar className="w-[16px] h-[16px] border-0">
              {hasAvatar && (
                <AvatarImage
                  src={loading.employee.avatarUrl!}
                  alt={loading.employee.name || ''}
                />
              )}
              <AvatarFallback
                className="
                  text-[7px] font-medium
                  bg-muted text-muted-foreground
                  dark:bg-gradient-to-b dark:from-zinc-700 dark:to-zinc-800
                  dark:text-white/80
                "
              >
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Rate badge - only show if not 1 */}
          {loading.rate !== 1 && (
            <div
              className="
                absolute -bottom-0.5 -right-0.5
                min-w-[12px] h-[10px] px-0.5
                flex items-center justify-center
                rounded-full
                bg-gradient-to-b from-blue-400/90 to-blue-500/90
                border border-blue-300/30
                text-[6px] font-bold text-white
                shadow-sm
              "
            >
              {formatRateCompact(loading.rate)}
            </div>
          )}
        </div>
      </TooltipTrigger>

      <TooltipContent
        side="top"
        align="center"
        sideOffset={6}
        className="
          bg-popover backdrop-blur-xl
          border border-border
          shadow-xl
          rounded-lg px-3 py-2.5
          max-w-[200px]
        "
      >
        <div className="space-y-2">
          {/* Employee name */}
          <div className="flex items-center gap-2">
            <Avatar className="w-6 h-6">
              {hasAvatar && (
                <AvatarImage
                  src={loading.employee.avatarUrl!}
                  alt={loading.employee.name || ''}
                />
              )}
              <AvatarFallback className="text-[9px] bg-muted text-muted-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="text-sm font-medium text-popover-foreground">
                {loading.employee.name || 'Не назначен'}
              </div>
              <div className="text-[10px] text-muted-foreground">
                Ставка: {formatRate(loading.rate)}
              </div>
            </div>
          </div>

          {/* Period */}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="text-muted-foreground/70">Период:</span>
            <span className="tabular-nums">
              {formatDate(loading.startDate)} — {formatDate(loading.finishDate)}
            </span>
          </div>

          {/* Comment */}
          {loading.comment && (
            <div className="pt-1 border-t border-border">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {loading.comment}
              </p>
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * Форматирует ставку для отображения
 */
function formatRate(rate: number): string {
  if (rate === 1) return '100%'
  if (rate === 0.5) return '50%'
  if (rate === 0.25) return '25%'
  if (rate === 0.75) return '75%'
  return `${Math.round(rate * 100)}%`
}

/**
 * Компактный формат ставки для badge
 */
function formatRateCompact(rate: number): string {
  if (rate === 0.5) return '½'
  if (rate === 0.25) return '¼'
  if (rate === 0.75) return '¾'
  return rate.toString()
}

/**
 * Форматирует дату
 */
function formatDate(dateStr: string): string {
  try {
    return format(parseMinskDate(dateStr), 'dd.MM')
  } catch {
    return '—'
  }
}
