'use client'

/**
 * Loading Modal 2 - Хлебные крошки для дерева проектов
 *
 * Отображает путь: Проект > Стадия > Котельная > АР > Раздел
 * С иконками для каждого уровня
 */

import { ChevronRight, Folder, Target, Box, FileText, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProjectTreeNode } from '../../actions/projects-tree'

export interface ProjectTreeBreadcrumbsProps {
  /** Узлы дерева от корня до текущего */
  path: ProjectTreeNode[]
  /** Callback при клике на элемент */
  onNavigate?: (node: ProjectTreeNode) => void
  /** Класс для кастомизации */
  className?: string
}

const TYPE_ICONS = {
  project: Folder,
  stage: Target,
  object: Box,
  section: FileText,
} as const

const TYPE_COLORS = {
  project: 'text-green-600',
  stage: 'text-purple-600',
  object: 'text-orange-600',
  section: 'text-blue-600',
} as const

export function ProjectTreeBreadcrumbs({
  path,
  onNavigate,
  className,
}: ProjectTreeBreadcrumbsProps) {
  if (path.length === 0) {
    return null
  }

  return (
    <nav className={cn('flex items-center gap-1 text-sm flex-wrap', className)}>
      {path.map((node, index) => {
        const Icon = TYPE_ICONS[node.type] || Layers
        const colorClass = TYPE_COLORS[node.type] || 'text-gray-600'
        const isLast = index === path.length - 1

        return (
          <div key={node.id} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onNavigate?.(node)}
              disabled={isLast || !onNavigate}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded transition-colors',
                isLast
                  ? 'font-medium text-foreground cursor-default'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className={cn('h-4 w-4', isLast ? colorClass : '')} />
              <span className="truncate max-w-[200px]">{node.name}</span>
            </button>

            {!isLast && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
          </div>
        )
      })}
    </nav>
  )
}
