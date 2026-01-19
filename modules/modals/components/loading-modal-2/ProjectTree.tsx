'use client'

/**
 * Loading Modal 2 - Дерево проектов (левая панель)
 *
 * Компонент для навигации по проектам и выбора раздела
 * Включает:
 * - Переключатель "Мои проекты" / "Все проекты"
 * - Список проектов с поиском
 * - Иерархическое дерево: проект → стадия → объект → раздел → этап
 */

import { useState, useMemo } from 'react'
import { ChevronRight, ChevronDown, Folder, Target, Box, FileText, Search, Loader2, ListChecks } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useProjectsList, useProjectTree } from '../../hooks'
import type { ProjectTreeNodeWithChildren } from '../../hooks/useProjectTree'
import type { ProjectListItem } from '../../hooks'

/**
 * Компонент для отображения одного проекта и его дерева
 */
interface ProjectItemProps {
  project: ProjectListItem
  selectedSectionId: string | null
  onSectionSelect: (sectionId: string, sectionName?: string) => void
}

function ProjectItem({ project, selectedSectionId, onSectionSelect }: ProjectItemProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

  // Загружаем дерево только для раскрытого проекта
  const { data: tree = [], isLoading } = useProjectTree({
    projectId: project.id,
    enabled: isExpanded,
  })

  // Переключение раскрытия узла
  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }

  // Выбор раздела или этапа декомпозиции
  const handleSectionClick = (node: ProjectTreeNodeWithChildren) => {
    if (node.type === 'section' || node.type === 'decomposition_stage') {
      onSectionSelect(node.id, node.name)
    }
  }

  // Рекурсивный рендер узла дерева
  const renderTreeNode = (node: ProjectTreeNodeWithChildren, depth: number = 1): React.ReactNode => {
    const isNodeExpanded = expandedNodes.has(node.id)
    const hasChildren = node.children && node.children.length > 0
    const isClickable = node.type === 'section' || node.type === 'decomposition_stage'
    const isSelected = isClickable && node.id === selectedSectionId

    const Icon =
      node.type === 'stage'
        ? Target
        : node.type === 'object'
          ? Box
          : node.type === 'section'
            ? FileText
            : node.type === 'decomposition_stage'
              ? ListChecks
              : Folder

    return (
      <div key={node.id}>
        <button
          type="button"
          onClick={() => {
            if (hasChildren) {
              toggleNode(node.id)
            }
            if (isClickable) {
              handleSectionClick(node)
            }
          }}
          className={cn(
            'flex items-center gap-1.5 w-full py-1 text-sm transition-colors',
            isSelected
              ? 'bg-primary text-primary-foreground font-medium'
              : 'hover:bg-accent hover:text-accent-foreground',
            isClickable && 'cursor-pointer',
            !isClickable && !hasChildren && 'cursor-default'
          )}
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
        >
          {hasChildren ? (
            <span className="shrink-0">
              {isNodeExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </span>
          ) : (
            <span className="w-3.5" />
          )}
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate text-xs">{node.name}</span>
        </button>

        {/* Рекурсивно рендерим детей */}
        {isNodeExpanded && hasChildren && (
          <div>
            {node.children!.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Заголовок проекта */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 w-full py-1 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
        style={{ paddingLeft: '4px' }}
      >
        <span className="shrink-0">
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </span>
        <Folder className="h-3.5 w-3.5 shrink-0 text-green-600" />
        <span className="truncate text-xs font-medium">{project.name}</span>
        {isLoading && <Loader2 className="h-3 w-3 animate-spin ml-auto" />}
      </button>

      {/* Дерево проекта */}
      {isExpanded && !isLoading && tree.length > 0 && (
        <div>
          {tree.map((node) => renderTreeNode(node))}
        </div>
      )}

      {isExpanded && !isLoading && tree.length === 0 && (
        <div className="text-xs text-muted-foreground py-1" style={{ paddingLeft: '20px' }}>
          Пусто
        </div>
      )}
    </div>
  )
}

export interface ProjectTreeProps {
  /** Текущий режим: мои проекты или все */
  mode: 'my' | 'all'
  /** Callback при изменении режима */
  onModeChange: (mode: 'my' | 'all') => void
  /** ID текущего выбранного раздела/этапа */
  selectedSectionId: string | null
  /** Callback при выборе раздела/этапа */
  onSectionSelect: (sectionId: string, sectionName?: string) => void
  /** ID пользователя для фильтра "Мои проекты" */
  userId: string
  /** Класс для кастомизации */
  className?: string
}

export function ProjectTree({
  mode,
  onModeChange,
  selectedSectionId,
  onSectionSelect,
  userId,
  className,
}: ProjectTreeProps) {
  const [search, setSearch] = useState('')
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

  // Загрузка списка проектов
  const { data: projects = [], isLoading: isLoadingProjects } = useProjectsList({
    mode,
    userId,
  })

  console.log('🌳 ProjectTree render:', {
    mode,
    userId,
    projectsCount: projects.length,
    isLoadingProjects,
  })

  // Фильтрация проектов по поиску
  const filteredProjects = useMemo(() => {
    if (!search.trim()) return projects

    const query = search.toLowerCase()
    return projects.filter((project) => project.name.toLowerCase().includes(query))
  }, [projects, search])

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Переключатель "Мои проекты" / "Все проекты" */}
      <div className="p-4 border-b">
        <Tabs value={mode} onValueChange={(value) => onModeChange(value as 'my' | 'all')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="my">Мои проекты</TabsTrigger>
            <TabsTrigger value="all">Все проекты</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Поиск */}
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Поиск проекта..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Список проектов с деревом */}
      <ScrollArea className="flex-1">
        <div className="py-1">
          {isLoadingProjects && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoadingProjects && filteredProjects.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              {search ? 'Проекты не найдены' : 'Нет доступных проектов'}
            </div>
          )}

          {!isLoadingProjects &&
            filteredProjects.map((project) => (
              <ProjectItem
                key={project.id}
                project={project}
                selectedSectionId={selectedSectionId}
                onSectionSelect={onSectionSelect}
              />
            ))}
        </div>
      </ScrollArea>
    </div>
  )
}
