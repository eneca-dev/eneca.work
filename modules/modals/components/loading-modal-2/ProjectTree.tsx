'use client'

/**
 * Loading Modal 2 - Дерево проектов (левая панель)
 *
 * Компонент для навигации по проектам и выбора раздела
 * Включает:
 * - Переключатель "Мои проекты" / "Все проекты"
 * - Список проектов с поиском
 * - Иерархическое дерево (4 уровня): проект (со стадией) → объект → раздел → этап
 */

import { useState, useMemo, useEffect } from 'react'
import { ChevronRight, ChevronDown, Folder, Box, CircleDashed, Search, Loader2, ListChecks, RefreshCw, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useProjectsList, useProjectTree } from '../../hooks'
import type { ProjectTreeNodeWithChildren } from '../../hooks/useProjectTree'
import type { ProjectListItem } from '../../hooks'
import { createDecompositionStage } from '../../actions/projects-tree'
import { useToast } from '@/hooks/use-toast'

/**
 * Breadcrumb item для отображения пути
 */
export interface BreadcrumbItem {
  id: string
  name: string
  type: 'project' | 'object' | 'section' | 'decomposition_stage'
}

/**
 * Компонент для отображения одного проекта и его дерева
 */
interface ProjectItemProps {
  project: ProjectListItem
  selectedSectionId: string | null
  onSectionSelect: (sectionId: string, sectionName?: string, breadcrumbs?: BreadcrumbItem[]) => void
  /** Нужно ли автоматически развернуть этот проект */
  shouldAutoExpand?: boolean
  /** Breadcrumbs для автоматического разворачивания пути */
  autoExpandBreadcrumbs?: BreadcrumbItem[] | null
  /** Режим "только просмотр" - блокирует взаимодействие */
  disabled?: boolean
}

function ProjectItem({ project, selectedSectionId, onSectionSelect, shouldAutoExpand, autoExpandBreadcrumbs, disabled = false }: ProjectItemProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [isProjectExpanded, setIsProjectExpanded] = useState(shouldAutoExpand || false)
  const [creatingStageForSection, setCreatingStageForSection] = useState<string | null>(null)
  const [hasAutoExpanded, setHasAutoExpanded] = useState(false)
  const { toast } = useToast()

  // Загружаем дерево только когда проект раскрыт
  const { data: tree = [], isLoading, refetch: refetchTree } = useProjectTree({
    projectId: project.id,
    enabled: isProjectExpanded,
  })

  // Автоматическое разворачивание пути по breadcrumbs
  useEffect(() => {
    if (
      shouldAutoExpand &&
      !hasAutoExpanded &&
      autoExpandBreadcrumbs &&
      autoExpandBreadcrumbs.length > 0 &&
      tree.length > 0 &&
      !isLoading
    ) {
      // Извлекаем ID всех узлов из breadcrumbs (кроме проекта)
      const nodeIdsToExpand = autoExpandBreadcrumbs
        .filter(b => b.type !== 'project')
        .map(b => b.id)

      if (nodeIdsToExpand.length > 0) {
        setExpandedNodes(new Set(nodeIdsToExpand))
        setHasAutoExpanded(true)
      }
    }
  }, [shouldAutoExpand, hasAutoExpanded, autoExpandBreadcrumbs, tree, isLoading])

  // Функция для сбора всех ID узлов рекурсивно
  const collectAllNodeIds = (nodes: ProjectTreeNodeWithChildren[]): string[] => {
    const ids: string[] = []
    for (const node of nodes) {
      ids.push(node.id)
      if (node.children && node.children.length > 0) {
        ids.push(...collectAllNodeIds(node.children))
      }
    }
    return ids
  }

  // Цвет чипа в зависимости от стадии проекта (стиль как в графике)
  const getStageColor = (stage: string | null | undefined) => {
    if (!stage) return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
    const s = stage.toUpperCase()

    // Сначала проверяем более специфичные комбинации
    if (s.includes('РД')) return 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:text-teal-300 dark:border-teal-700' // Рабочая документация
    if (s.includes('ПД')) return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-700' // Проектная документация
    if (s.includes('ИД')) return 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-900/20 dark:text-pink-300 dark:border-pink-700' // Исходные данные

    // Затем основные стадии А, С, Р, П
    if (s.includes(' А') || s === 'А' || s.endsWith('А')) return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700' // Архитектура
    if (s.includes(' С') || s === 'С' || s.endsWith('С')) return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-700' // Строительство
    if (s.includes(' Р') || s === 'Р' || s.endsWith('Р')) return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-700' // Рабочий проект
    if (s.includes(' П') || s === 'П' || s.endsWith('П')) return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700' // Проект

    return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-700' // Другие стадии
  }

  // Переключение раскрытия проекта (корневой уровень)
  const toggleProject = () => {
    if (disabled) return // Блокируем в режиме disabled

    setIsProjectExpanded((prev) => {
      const newState = !prev
      // Если сворачиваем - очищаем все раскрытые узлы
      if (!newState) {
        setExpandedNodes(new Set())
      }
      // Если разворачиваем - автораскрытие будет выполнено в useEffect
      return newState
    })
  }

  // Переключение раскрытия узла внутри дерева
  const toggleNode = (node: ProjectTreeNodeWithChildren) => {
    if (disabled) return // Блокируем в режиме disabled

    setExpandedNodes((prev) => {
      const next = new Set(prev)
      const isCurrentlyExpanded = next.has(node.id)

      if (isCurrentlyExpanded) {
        // Сворачиваем - убираем только этот узел
        next.delete(node.id)
      } else {
        // Разворачиваем
        next.add(node.id)
      }

      return next
    })
  }

  // Создание базового этапа для раздела
  const handleCreateBaseStage = async (section: ProjectTreeNodeWithChildren, e: React.MouseEvent) => {
    e.stopPropagation() // Предотвращаем выбор раздела

    if (disabled) return // Блокируем в режиме disabled

    if (!section.sectionId) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось определить ID раздела',
        variant: 'destructive',
      })
      return
    }

    setCreatingStageForSection(section.id)

    try {
      const stageName = `Этап ${section.name}`
      const result = await createDecompositionStage({
        sectionId: section.sectionId,
        name: stageName,
      })

      if (!result.success) {
        throw new Error(result.error)
      }

      toast({
        title: 'Этап создан',
        description: `Создан этап "${stageName}"`,
      })

      // Обновляем дерево проекта
      await refetchTree()

      // Автоматически выбираем созданный этап
      if (result.data) {
        // Строим breadcrumbs для нового этапа
        const breadcrumbs = buildBreadcrumbs(section)
        breadcrumbs.push({
          id: result.data.id,
          name: stageName,
          type: 'decomposition_stage',
        })

        onSectionSelect(result.data.id, stageName, breadcrumbs)
      }
    } catch (error) {
      console.error('Ошибка создания базового этапа:', error)
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Не удалось создать этап',
        variant: 'destructive',
      })
    } finally {
      setCreatingStageForSection(null)
    }
  }

  // Функция для сбора пути от корня до узла
  const buildBreadcrumbs = (targetNode: ProjectTreeNodeWithChildren): BreadcrumbItem[] => {
    const breadcrumbs: BreadcrumbItem[] = []

    // Добавляем проект
    breadcrumbs.push({
      id: project.id,
      name: project.name,
      type: 'project',
    })

    // Рекурсивный поиск пути к целевому узлу
    const findPath = (nodes: ProjectTreeNodeWithChildren[], path: BreadcrumbItem[]): boolean => {
      for (const node of nodes) {
        const currentPath = [...path, { id: node.id, name: node.name, type: node.type }]

        if (node.id === targetNode.id) {
          breadcrumbs.push(...currentPath)
          return true
        }

        if (node.children && node.children.length > 0) {
          if (findPath(node.children, currentPath)) {
            return true
          }
        }
      }
      return false
    }

    // Ищем путь в дереве (начинаем с детей проекта)
    const projectNodes = tree.find(n => n.type === 'project')
    if (projectNodes?.children) {
      findPath(projectNodes.children, [])
    }

    return breadcrumbs
  }

  // Выбор раздела или этапа декомпозиции
  const handleSectionClick = (node: ProjectTreeNodeWithChildren) => {
    if (disabled) return // Блокируем в режиме disabled

    if (node.type === 'section' || node.type === 'decomposition_stage') {
      const breadcrumbs = buildBreadcrumbs(node)
      onSectionSelect(node.id, node.name, breadcrumbs)
    }
  }

  // Цвет иконки и текста в зависимости от типа узла
  const getNodeColor = (nodeType: string) => {
    switch (nodeType) {
      case 'object':
        return 'text-blue-600 dark:text-blue-400' // Объекты - синий
      case 'section':
        return 'text-emerald-600 dark:text-emerald-400' // Разделы - зеленый
      case 'decomposition_stage':
        return '' // Этапы декомпозиции - стандартный цвет (белый/черный)
      default:
        return 'text-slate-600 dark:text-slate-400' // Проект - серый
    }
  }

  // Рекурсивный рендер узла дерева
  const renderTreeNode = (node: ProjectTreeNodeWithChildren, depth: number = 1): React.ReactNode => {
    const isNodeExpanded = expandedNodes.has(node.id)
    const hasChildren = node.children && node.children.length > 0
    const isClickable = node.type === 'section' || node.type === 'decomposition_stage'
    const isSelected = isClickable && node.id === selectedSectionId
    const isCreatingStage = creatingStageForSection === node.id

    // Проверяем, является ли узел разделом без этапов
    const isSectionWithoutStages = node.type === 'section' && !hasChildren

    const Icon =
      node.type === 'object'
        ? Box
        : node.type === 'section'
          ? CircleDashed
          : node.type === 'decomposition_stage'
            ? ListChecks
            : Folder // project

    const nodeColor = getNodeColor(node.type)

    return (
      <div key={node.id}>
        <button
          type="button"
          onClick={() => {
            if (hasChildren) {
              handleNodeClick(node)
            } else if (isSectionWithoutStages) {
              // Для раздела без этапов - переключаем раскрытие для показа кнопки
              toggleNode(node)
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
            isClickable && !disabled && 'cursor-pointer',
            (!isClickable && !hasChildren) || disabled ? 'cursor-default' : '',
            disabled && 'opacity-60'
          )}
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
        >
          {hasChildren || isSectionWithoutStages ? (
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
          <Icon className={cn('h-3.5 w-3.5 shrink-0', nodeColor)} />
          <span className={cn('truncate text-xs', nodeColor)}>{node.name}</span>
        </button>

        {/* Кнопка создания базового этапа для разделов без этапов */}
        {isSectionWithoutStages && isNodeExpanded && !disabled && (
          <div style={{ paddingLeft: `${(depth + 1) * 12 + 4}px` }} className="py-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(e) => handleCreateBaseStage(node, e)}
              disabled={isCreatingStage}
              className="h-6 text-xs gap-1.5 text-muted-foreground hover:text-foreground w-full justify-start"
            >
              {isCreatingStage ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Создание...</span>
                </>
              ) : (
                <>
                  <Plus className="h-3 w-3" />
                  <span>Создать базовый этап</span>
                </>
              )}
            </Button>
          </div>
        )}

        {/* Рекурсивно рендерим детей */}
        {isNodeExpanded && hasChildren && (
          <div>
            {node.children!.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  // При раскрытии проекта - автоматически разворачиваем всех детей
  useEffect(() => {
    if (!isLoading && tree.length > 0 && isProjectExpanded) {
      // Собираем все ID детей для автораскрытия
      const allIds = new Set<string>()
      tree.forEach((node) => {
        if (node.type === 'project' && node.children && node.children.length > 0) {
          const allChildIds = collectAllNodeIds(node.children)
          allChildIds.forEach(id => allIds.add(id))
        }
      })
      // Обновляем expandedNodes для полного раскрытия дерева
      if (allIds.size > 0) {
        setExpandedNodes(allIds)
      }
    }
  }, [tree, isLoading, isProjectExpanded])

  // Переопределяем toggleNode для узла проекта - используем toggleProject
  const handleNodeClick = (node: ProjectTreeNodeWithChildren) => {
    if (node.type === 'project') {
      toggleProject()
    } else {
      toggleNode(node)
    }
  }

  return (
    <div>
      {/* Кнопка проекта - всегда показываем */}
      <button
        type="button"
        onClick={toggleProject}
        disabled={disabled}
        className={cn(
          'flex items-center gap-1.5 w-full py-1 text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
          disabled && 'opacity-60 cursor-default'
        )}
        style={{ paddingLeft: '4px' }}
      >
        <span className="shrink-0">
          {isProjectExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </span>
        <Folder className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate text-xs font-medium">{project.name}</span>
        {project.stage_type && (
          <span className={cn(
            'px-1.5 py-0.5 text-[10px] font-medium rounded border whitespace-nowrap',
            getStageColor(project.stage_type)
          )}>
            {project.stage_type}
          </span>
        )}
      </button>

      {/* Дерево детей проекта */}
      {isProjectExpanded && (
        <div>
          {/* Показываем индикатор загрузки */}
          {isLoading && (
            <div className="flex items-center gap-1.5 py-1 text-xs text-muted-foreground" style={{ paddingLeft: '16px' }}>
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Загрузка...</span>
            </div>
          )}

          {/* Рендерим узлы из view (только детей проекта, не сам проект) */}
          {!isLoading && tree.length > 0 && (
            <div>
              {tree.map((node) => {
                // Пропускаем узел проекта, показываем только его детей
                if (node.type === 'project' && node.children) {
                  return node.children.map((child) => renderTreeNode(child, 0))
                }
                return renderTreeNode(node, 0)
              })}
            </div>
          )}

          {/* Пустое состояние */}
          {!isLoading && tree.length === 0 && (
            <div className="text-xs text-muted-foreground py-1" style={{ paddingLeft: '16px' }}>
              Проект пуст
            </div>
          )}
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
  onSectionSelect: (sectionId: string, sectionName?: string, breadcrumbs?: BreadcrumbItem[]) => void
  /** ID пользователя для фильтра "Мои проекты" */
  userId: string
  /** ID проекта для автоматического разворачивания (режим редактирования) */
  initialProjectId?: string | null
  /** Breadcrumbs для автоматического разворачивания пути (режим редактирования) */
  initialBreadcrumbs?: BreadcrumbItem[] | null
  /** Данные для автопереключения на "Все проекты" и фильтрации */
  autoSwitchProject?: { projectId: string; projectName: string } | null
  /** Класс для кастомизации */
  className?: string
  /** Режим "только просмотр" - блокирует взаимодействие */
  disabled?: boolean
}

export function ProjectTree({
  mode,
  onModeChange,
  selectedSectionId,
  onSectionSelect,
  userId,
  initialProjectId,
  initialBreadcrumbs,
  autoSwitchProject,
  className,
  disabled = false,
}: ProjectTreeProps) {
  const [search, setSearch] = useState('')
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [hasAutoSwitched, setHasAutoSwitched] = useState(false)

  // Загрузка списка проектов
  const { data: projects = [], isLoading: isLoadingProjects, refetch: refetchProjects } = useProjectsList({
    mode,
    userId,
  })

  // Функция перезагрузки с анимацией
  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refetchProjects()
    // Даем анимации завершиться
    setTimeout(() => setIsRefreshing(false), 500)
  }

  console.log('🌳 ProjectTree render:', {
    mode,
    userId,
    projectsCount: projects.length,
    isLoadingProjects,
  })

  // Автопереключение на "Все проекты" и установка фильтра, если проект не найден в "Мои проекты"
  useEffect(() => {
    if (
      !hasAutoSwitched &&
      !isLoadingProjects &&
      autoSwitchProject &&
      mode === 'my'
    ) {
      // Проверяем, есть ли проект в текущем списке
      const projectExists = projects.some(p => p.id === autoSwitchProject.projectId)

      if (!projectExists) {
        console.log('🔄 Проект не найден в "Мои проекты", переключаемся на "Все проекты"', {
          projectId: autoSwitchProject.projectId,
          projectName: autoSwitchProject.projectName,
        })

        // Переключаемся на "Все проекты"
        onModeChange('all')

        // Устанавливаем фильтр поиска
        setSearch(autoSwitchProject.projectName)

        setHasAutoSwitched(true)
      } else {
        // Проект найден в "Мои проекты", просто помечаем что проверка выполнена
        setHasAutoSwitched(true)
      }
    }
  }, [hasAutoSwitched, isLoadingProjects, autoSwitchProject, mode, projects, onModeChange])

  // Автоматическое заполнение поиска в режиме disabled (редактирование)
  useEffect(() => {
    if (disabled && autoSwitchProject && !search) {
      setSearch(autoSwitchProject.projectName)
    }
  }, [disabled, autoSwitchProject, search])

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
        <div className="flex items-center gap-2">
          <Tabs value={mode} onValueChange={(value) => !disabled && onModeChange(value as 'my' | 'all')} className="flex-1">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="my" disabled={disabled}>Мои проекты</TabsTrigger>
              <TabsTrigger value="all" disabled={disabled}>Все проекты</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Кнопка перезагрузки */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoadingProjects || disabled}
            title="Обновить список"
            className={cn(
              'flex items-center justify-center h-9 w-9 shrink-0',
              'rounded-md border transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Поиск */}
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Поиск проекта..."
            value={search}
            onChange={(e) => !disabled && setSearch(e.target.value)}
            className="pl-8"
            disabled={disabled}
          />
        </div>
      </div>

      {/* Список проектов с деревом */}
      <ScrollArea className="flex-1">
        <div className="py-1">
          {/* Индикатор загрузки */}
          {isLoadingProjects && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Загрузка проектов...</p>
            </div>
          )}

          {/* Пустое состояние */}
          {!isLoadingProjects && filteredProjects.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <div className="text-4xl">📁</div>
              <p className="text-sm font-medium">
                {search ? 'Проекты не найдены' : 'Нет доступных проектов'}
              </p>
              {!search && (
                <p className="text-xs text-muted-foreground">
                  {mode === 'my'
                    ? 'У вас пока нет проектов'
                    : 'В системе пока нет проектов'}
                </p>
              )}
            </div>
          )}

          {/* Список проектов */}
          {!isLoadingProjects &&
            filteredProjects.map((project) => (
              <ProjectItem
                key={project.id}
                project={project}
                selectedSectionId={selectedSectionId}
                onSectionSelect={onSectionSelect}
                shouldAutoExpand={initialProjectId === project.id}
                autoExpandBreadcrumbs={initialProjectId === project.id ? initialBreadcrumbs : null}
                disabled={disabled}
              />
            ))}
        </div>
      </ScrollArea>
    </div>
  )
}
