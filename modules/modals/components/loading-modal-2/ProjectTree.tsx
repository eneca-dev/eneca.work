'use client'

/**
 * Loading Modal 2 - Дерево проектов (левая панель)
 *
 * Компонент для навигации по проектам и выбора раздела
 * Включает:
 * - Переключатель "Мои проекты" / "Все проекты"
 * - Список проектов с поиском
 * - Иерархическое дерево: стадия → объект → раздел
 * - Хлебные крошки для текущего пути
 */

import { useState, useMemo } from 'react'
import { ChevronRight, ChevronDown, Folder, Target, Box, FileText, Search, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useProjectsList, useProjectTree } from '../../hooks'
import { ProjectTreeBreadcrumbs } from './ProjectTreeBreadcrumbs'
import type { ProjectTreeNode } from '../../actions/projects-tree'

export interface ProjectTreeProps {
  /** Текущий режим: мои проекты или все */
  mode: 'my' | 'all'
  /** Callback при изменении режима */
  onModeChange: (mode: 'my' | 'all') => void
  /** ID текущего выбранного проекта */
  selectedProjectId: string | null
  /** Callback при выборе проекта */
  onProjectSelect: (projectId: string) => void
  /** ID текущего выбранного раздела */
  selectedSectionId: string | null
  /** Callback при выборе раздела */
  onSectionSelect: (sectionId: string, path: ProjectTreeNode[]) => void
  /** ID пользователя для фильтра "Мои проекты" */
  userId: string
  /** Класс для кастомизации */
  className?: string
}

export function ProjectTree({
  mode,
  onModeChange,
  selectedProjectId,
  onProjectSelect,
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

  // Загрузка дерева выбранного проекта
  const { data: tree = [], isLoading: isLoadingTree } = useProjectTree({
    projectId: selectedProjectId,
    enabled: Boolean(selectedProjectId),
  })

  // Фильтрация проектов по поиску
  const filteredProjects = useMemo(() => {
    if (!search.trim()) return projects

    const query = search.toLowerCase()
    return projects.filter((project) =>
      project.name.toLowerCase().includes(query) ||
      project.cipher?.toLowerCase().includes(query)
    )
  }, [projects, search])

  // Построение пути до текущего раздела (для хлебных крошек)
  const currentPath = useMemo(() => {
    if (!selectedSectionId || tree.length === 0) return []

    const path: ProjectTreeNode[] = []

    // Находим раздел в дереве рекурсивно
    const findSection = (nodes: ProjectTreeNode[]): boolean => {
      for (const node of nodes) {
        path.push(node)

        if (node.type === 'section' && node.id === selectedSectionId) {
          return true
        }

        if (node.children && node.children.length > 0) {
          if (findSection(node.children)) {
            return true
          }
        }

        path.pop()
      }
      return false
    }

    findSection(tree)
    return path
  }, [tree, selectedSectionId])

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

  // Выбор раздела
  const handleSectionClick = (node: ProjectTreeNode, path: ProjectTreeNode[]) => {
    if (node.type === 'section') {
      onSectionSelect(node.id, path)
    }
  }

  // Рекурсивный рендер узла дерева
  const renderTreeNode = (node: ProjectTreeNode, depth: number = 0, path: ProjectTreeNode[] = []) => {
    const currentPath = [...path, node]
    const isExpanded = expandedNodes.has(node.id)
    const hasChildren = node.children && node.children.length > 0
    const isSection = node.type === 'section'
    const isSelected = isSection && node.id === selectedSectionId

    const Icon =
      node.type === 'stage'
        ? Target
        : node.type === 'object'
          ? Box
          : node.type === 'section'
            ? FileText
            : Folder

    return (
      <div key={node.id}>
        <button
          type="button"
          onClick={() => {
            if (hasChildren) {
              toggleNode(node.id)
            }
            if (isSection) {
              handleSectionClick(node, currentPath)
            }
          }}
          className={cn(
            'flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm transition-colors',
            isSelected
              ? 'bg-primary text-primary-foreground font-medium'
              : 'hover:bg-accent hover:text-accent-foreground',
            isSection && 'cursor-pointer',
            !isSection && !hasChildren && 'cursor-default'
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {hasChildren && (
            <span className="shrink-0">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </span>
          )}
          {!hasChildren && <span className="w-4" />}
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{node.name}</span>
        </button>

        {hasChildren && isExpanded && (
          <div>
            {node.children!.map((child) => renderTreeNode(child, depth + 1, currentPath))}
          </div>
        )}
      </div>
    )
  }

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

      {/* Список проектов */}
      {!selectedProjectId && (
        <ScrollArea className="flex-1">
          <div className="p-2">
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
                <button
                  key={project.id}
                  type="button"
                  onClick={() => onProjectSelect(project.id)}
                  className="flex items-center gap-2 w-full px-2 py-2 rounded text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <Folder className="h-4 w-4 shrink-0 text-green-600" />
                  <div className="flex-1 text-left truncate">
                    <div className="font-medium truncate">{project.name}</div>
                    {project.cipher && (
                      <div className="text-xs text-muted-foreground">{project.cipher}</div>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
          </div>
        </ScrollArea>
      )}

      {/* Дерево проекта */}
      {selectedProjectId && (
        <div className="flex-1 flex flex-col">
          {/* Хлебные крошки */}
          {currentPath.length > 0 && (
            <div className="p-4 border-b">
              <ProjectTreeBreadcrumbs
                path={currentPath}
                onNavigate={(node) => {
                  // При клике на проект - вернуться к списку проектов
                  if (node.type === 'project') {
                    onProjectSelect('')
                    onSectionSelect('', [])
                  }
                  // При клике на другие узлы - раскрыть их
                  else {
                    setExpandedNodes((prev) => new Set(prev).add(node.id))
                  }
                }}
              />
            </div>
          )}

          {/* Кнопка "Назад к проектам" если нет выбранного раздела */}
          {currentPath.length === 0 && (
            <div className="p-4 border-b">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onProjectSelect('')
                  onSectionSelect('', [])
                }}
                className="w-full"
              >
                ← Назад к проектам
              </Button>
            </div>
          )}

          {/* Дерево */}
          <ScrollArea className="flex-1">
            <div className="p-2">
              {isLoadingTree && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}

              {!isLoadingTree && tree.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Дерево проекта пусто
                </div>
              )}

              {!isLoadingTree && tree.map((node) => renderTreeNode(node))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  )
}
