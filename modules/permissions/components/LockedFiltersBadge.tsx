'use client'

import { Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { FilterScopeLevel } from '../types'

/**
 * Упрощённый тип для locked фильтров (совместим с getLockedFilters)
 */
interface LockedFilterInfo {
  key: string
  displayName: string
}

/**
 * Локализованные названия уровней scope
 */
const SCOPE_LEVEL_LABELS: Record<FilterScopeLevel, string> = {
  all: 'Полный доступ',
  subdivision: 'Подразделение',
  department: 'Отдел',
  team: 'Команда',
  projects: 'Проекты',
}

/**
 * Локализованные названия ролей по scope level
 */
const ROLE_BY_SCOPE: Record<FilterScopeLevel, string> = {
  all: 'Администратор',
  subdivision: 'Начальник подразделения',
  department: 'Начальник отдела',
  team: 'Тимлид / Сотрудник',
  projects: 'Руководитель проекта',
}

interface LockedFiltersBadgeProps {
  /** Заблокированные фильтры (результат getLockedFilters) */
  filters: LockedFilterInfo[]
  /** Уровень scope для tooltip */
  scopeLevel?: FilterScopeLevel | null
  /** Название роли для tooltip (переопределяет автоматическое) */
  roleName?: string
  /** CSS классы */
  className?: string
}

/**
 * Badge, показывающий заблокированные фильтры пользователя.
 * Отображается inline слева от InlineFilter.
 *
 * @example
 * ```tsx
 * <LockedFiltersBadge
 *   filters={[{ key: 'команда', value: 'team-123', displayName: 'Разработка' }]}
 *   scopeLevel="team"
 * />
 * ```
 */
export function LockedFiltersBadge({
  filters,
  scopeLevel,
  roleName,
  className,
}: LockedFiltersBadgeProps) {
  // Не показываем badge для admin или если нет фильтров
  if (!scopeLevel || scopeLevel === 'all' || filters.length === 0) {
    return null
  }

  // Формируем текст badge
  const badgeText = formatBadgeText(filters, scopeLevel)

  // Формируем текст tooltip
  const tooltipText = formatTooltipText(filters, scopeLevel, roleName)

  // Формируем aria-label для screen readers
  const ariaLabel = `Ограничение области видимости: ${tooltipText}`

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            role="status"
            aria-label={ariaLabel}
            tabIndex={0}
            className={cn(
              'cursor-default select-none gap-1 whitespace-nowrap',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              className
            )}
          >
            <Info className="h-3 w-3" aria-hidden="true" />
            <span>{badgeText}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start">
          <p className="text-sm">{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Форматирует текст badge
 */
function formatBadgeText(filters: LockedFilterInfo[], scopeLevel: FilterScopeLevel): string {
  const levelLabel = SCOPE_LEVEL_LABELS[scopeLevel]

  // Для projects показываем количество или название
  if (scopeLevel === 'projects') {
    if (filters.length === 1) {
      return `Проект: ${filters[0].displayName}`
    }
    return `Проекты: ${filters.length}`
  }

  // Для остальных - название уровня и значение
  const mainFilter = filters[0]
  if (mainFilter) {
    return `${levelLabel}: ${mainFilter.displayName}`
  }

  return levelLabel
}

/**
 * Форматирует текст tooltip
 */
function formatTooltipText(
  filters: LockedFilterInfo[],
  scopeLevel: FilterScopeLevel,
  roleName?: string
): string {
  const role = roleName || ROLE_BY_SCOPE[scopeLevel]
  const filterNames = filters.map((f) => f.displayName).join(', ')

  return `Роль: ${role}. Доступ: ${filterNames}`
}
