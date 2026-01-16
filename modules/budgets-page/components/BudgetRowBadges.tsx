/**
 * Budget Row Badges Component
 *
 * Бейджи типа узла и стадии проекта.
 */

'use client'

import { cn } from '@/lib/utils'
import type { HierarchyNodeType } from '../types'

interface BudgetRowBadgesProps {
  /** Тип узла */
  nodeType: HierarchyNodeType
  /** Название стадии проекта (для project узлов) */
  stageName?: string | null
}

/** Полные названия типов узлов */
const NODE_LABELS: Record<HierarchyNodeType, string> = {
  project: 'Проект',
  object: 'Объект',
  section: 'Раздел',
  decomposition_stage: 'Этап',
  decomposition_item: '',
}

/** Цвета для бейджей типов */
const NODE_LABEL_COLORS: Record<HierarchyNodeType, string> = {
  project: 'bg-amber-500/20 text-amber-400',
  object: 'bg-violet-500/20 text-violet-400',
  section: 'bg-teal-500/20 text-teal-400',
  decomposition_stage: 'bg-slate-600/30 text-slate-400',
  decomposition_item: '',
}

/** Сокращения стадий проекта */
const STAGE_ABBREVIATIONS: Record<string, string> = {
  'Стадия А': 'А',
  'Стадия П': 'П',
  'Стадия ПП': 'ПП',
  'Стадия Р': 'Р',
  'Стадия С': 'С',
  'Э': 'Э',
  'Базовая стадия (РУО)': 'РУО',
  'Основные проекты': 'ОП',
  'Отпуск': 'ОТП',
  'Отчетная стадия': 'ОТЧ',
  'Прочие работы': 'ПР',
}

/** Получить сокращение стадии */
function getStageAbbreviation(stageName: string | null | undefined): string | null {
  if (!stageName) return null
  return STAGE_ABBREVIATIONS[stageName] || stageName.slice(0, 3).toUpperCase()
}

export function BudgetRowBadges({ nodeType, stageName }: BudgetRowBadgesProps) {
  const typeLabel = NODE_LABELS[nodeType]
  const labelColor = NODE_LABEL_COLORS[nodeType]
  const isProject = nodeType === 'project'

  return (
    <>
      {/* Type label badge (для всех кроме items) */}
      {typeLabel && (
        <span
          className={cn(
            'shrink-0 px-1.5 py-0.5 rounded text-[9px] font-medium',
            labelColor
          )}
        >
          {typeLabel}
        </span>
      )}

      {/* Stage badge for projects */}
      {isProject && stageName && (
        <span
          className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-medium bg-purple-500/20 text-purple-400"
          title={stageName}
        >
          ст. {getStageAbbreviation(stageName)}
        </span>
      )}
    </>
  )
}
