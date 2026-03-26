'use client'

/**
 * Loading Modal New - Дерево проектов (левая панель)
 *
 * Компонент для навигации по проектам и выбора раздела
 * Включает:
 * - Переключатель "Мои проекты" / "Все проекты"
 * - Список проектов с поиском
 * - Иерархическое дерево (3 уровня): проект (со стадией) → объект → раздел
 * Этапы декомпозиции теперь не показываются в дереве - выбираются опционально в форме
 */

import { useState, useMemo, useEffect, useDeferredValue } from 'react'
import { ChevronRight, ChevronDown, Folder, Box, CircleDashed, Search, Loader2, RefreshCw, X, Filter } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useProjectsList, useProjectTree } from '../../hooks'
import type { ProjectTreeNodeWithChildren } from '../../hooks/useProjectTree'
import type { ProjectListItem } from '../../hooks'

/**
 * Breadcrumb item для отображения пути
 */
export interface BreadcrumbItem {
  id: string
  name: string
  type: 'project' | 'object' | 'section' | 'decomposition_stage'
}

// ============================================================================
// Pure helpers (hoisted: не пересоздаются на каждом рендере)
// ============================================================================

/** Рекурсивный сбор всех ID узлов дерева */
function collectAllNodeIds(nodes: ProjectTreeNodeWithChildren[]): string[] {
  const ids: string[] = []
  for (const node of nodes) {
    ids.push(node.id)
    if (node.children && node.children.length > 0) {
      ids.push(...collectAllNodeIds(node.children))
    }
  }
  return ids
}

/** Рекурсивный фильтр узлов дерева по тексту (только по разделам) */
function filterTreeNodes(
  nodes: ProjectTreeNodeWithChildren[],
  query: string
): ProjectTreeNodeWithChildren[] {
  if (!query) return nodes

  const result: ProjectTreeNodeWithChildren[] = []

  for (const node of nodes) {
    if (node.type === 'decomposition_stage') continue

    if (node.type === 'section') {
      // Фильтруем только разделы по имени
      if (node.name.toLowerCase().includes(query)) {
        result.push(node)
      }
    } else if (node.children && node.children.length > 0) {
      // Объекты — не матчим по имени, только проверяем детей
      const filteredChildren = filterTreeNodes(node.children, query)
      if (filteredChildren.length > 0) {
        result.push({ ...node, children: filteredChildren })
      }
    }
  }

  return result
}

/** Цвет чипа стадии проекта */
function getStageColor(stage: string | null | undefined) {
  if (!stage) return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
  const s = stage.toUpperCase()

  // Сначала проверяем более специфичные комбинации
  if (s.includes('РД')) return 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:text-teal-300 dark:border-teal-700'
  if (s.includes('ПД')) return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-700'
  if (s.includes('ИД')) return 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-900/20 dark:text-pink-300 dark:border-pink-700'

  // Затем основные стадии А, С, Р, П
  if (s.includes(' А') || s === 'А' || s.endsWith('А')) return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700'
  if (s.includes(' С') || s === 'С' || s.endsWith('С')) return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-700'
  if (s.includes(' Р') || s === 'Р' || s.endsWith('Р')) return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-700'
  if (s.includes(' П') || s === 'П' || s.endsWith('П')) return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700'

  return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-700'
}

/** Цвет иконки и текста узла дерева */
function getNodeColor(nodeType: string) {
  switch (nodeType) {
    case 'object':
      return 'text-blue-600 dark:text-blue-400'
    case 'section':
      return 'text-emerald-600 dark:text-emerald-400'
    case 'decomposition_stage':
      return ''
    default:
      return 'text-slate-600 dark:text-slate-400'
  }
}

// ============================================================================
// ProjectItem Component
// ============================================================================

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
  /** Режим работы модалки (create/edit) */
  modalMode?: 'create' | 'edit'
  /** Callback для закрытия модалки */
  onClose?: () => void
  /** Текстовый фильтр для дочерних узлов дерева */
  subtaskFilter?: string
}

function ProjectItem({ project, selectedSectionId, onSectionSelect, shouldAutoExpand, autoExpandBreadcrumbs, disabled = false, modalMode = 'create', onClose, subtaskFilter = '' }: ProjectItemProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [isProjectExpanded, setIsProjectExpanded] = useState(shouldAutoExpand || false)
  const [hasAutoExpanded, setHasAutoExpanded] = useState(false)
  const [hasAutoExpandedAll, setHasAutoExpandedAll] = useState(false) // Флаг для автораскрытия всех узлов

  // Загружаем дерево только когда проект раскрыт
  const { data: tree = [], isLoading, refetch: refetchTree } = useProjectTree({
    projectId: project.id,
    enabled: isProjectExpanded,
  })

  // Сброс флагов автораскрытия при изменении shouldAutoExpand
  useEffect(() => {
    if (shouldAutoExpand) {
      setHasAutoExpanded(false)
      setHasAutoExpandedAll(false)
      setIsProjectExpanded(true) // Раскрываем проект
    }
  }, [shouldAutoExpand])

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

  // Переключение раскрытия проекта (корневой уровень)
  const toggleProject = () => {
    if (disabled) return // Блокируем в режиме disabled

    setIsProjectExpanded((prev) => {
      const newState = !prev
      // Если сворачиваем - очищаем все раскрытые узлы и сбрасываем флаги
      if (!newState) {
        setExpandedNodes(new Set())
        setHasAutoExpandedAll(false)
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

    // Дедупликация: удаляем элементы с одинаковыми ID
    const seen = new Set<string>()
    const uniqueBreadcrumbs = breadcrumbs.filter(item => {
      if (seen.has(item.id)) {
        console.warn('[buildBreadcrumbs] Дублирующийся ID в breadcrumbs:', item.id, item.name)
        return false
      }
      seen.add(item.id)
      return true
    })

    return uniqueBreadcrumbs
  }

  // Выбор раздела
  const handleSectionClick = (node: ProjectTreeNodeWithChildren) => {
    if (disabled) return // Блокируем в режиме disabled

    if (node.type === 'section') {
      const breadcrumbs = buildBreadcrumbs(node)
      onSectionSelect(node.id, node.name, breadcrumbs)
    }
  }


  // Рекурсивный рендер узла дерева
  const renderTreeNode = (node: ProjectTreeNodeWithChildren, depth: number = 1): React.ReactNode => {
    // Пропускаем этапы декомпозиции - они больше не отображаются в дереве
    if (node.type === 'decomposition_stage') {
      return null
    }

    const isNodeExpanded = subtaskFilter ? true : expandedNodes.has(node.id)

    // Фильтруем детей: показываем только не-этапы
    const filteredChildren = node.children?.filter(child => child.type !== 'decomposition_stage') ?? []
    const hasChildren = filteredChildren.length > 0

    // Раздел теперь всегда кликабельный (в обоих режимах)
    const isClickable = node.type === 'section'

    const isSelected = isClickable && node.id === selectedSectionId

    const Icon =
      node.type === 'object'
        ? Box
        : node.type === 'section'
          ? CircleDashed
          : Folder // project

    const nodeColor = getNodeColor(node.type)

    return (
      <div key={node.id}>
        <button
          type="button"
          onClick={() => {
            if (hasChildren) {
              handleNodeClick(node)
            }
            if (isClickable) {
              handleSectionClick(node)
            }
          }}
          className={cn(
            'flex items-start gap-1.5 w-full py-1 text-sm transition-colors',
            isSelected
              ? 'bg-primary text-primary-foreground font-medium'
              : !disabled && 'hover:bg-accent hover:text-accent-foreground',
            isClickable && !disabled && 'cursor-pointer',
            (!isClickable && !hasChildren) || disabled ? 'cursor-default' : '',
            disabled && 'opacity-60'
          )}
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
        >
          {hasChildren ? (
            <span className="shrink-0 mt-0.5">
              {isNodeExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </span>
          ) : (
            <span className="w-3.5 mt-0.5" />
          )}
          <Icon className={cn('h-3.5 w-3.5 shrink-0 mt-0.5', nodeColor)} />
          <span className={cn('text-xs text-left break-words min-w-0', nodeColor)}>{node.name}</span>
        </button>

        {/* Рекурсивно рендерим детей (уже отфильтрованных) */}
        {isNodeExpanded && hasChildren && (
          <div>
            {filteredChildren.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}

        {/* Пустое состояние для объекта без разделов */}
        {isNodeExpanded && !hasChildren && node.type === 'object' && (
          <div className="text-xs text-muted-foreground py-1" style={{ paddingLeft: `${(depth + 1) * 12 + 4}px` }}>
            Объект не содержит разделов
          </div>
        )}
      </div>
    )
  }

  // Отфильтрованные дети дерева (мемоизировано)
  const filteredTreeChildren = useMemo(() => {
    const children: ProjectTreeNodeWithChildren[] = []
    for (const node of tree) {
      if (node.type === 'project' && node.children) {
        children.push(...node.children)
      } else {
        children.push(node)
      }
    }
    return subtaskFilter ? filterTreeNodes(children, subtaskFilter) : children
  }, [tree, subtaskFilter])

  // При раскрытии проекта - автоматически разворачиваем всех детей (только один раз)
  useEffect(() => {
    if (!isLoading && tree.length > 0 && isProjectExpanded && !hasAutoExpandedAll) {
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
        setHasAutoExpandedAll(true) // Помечаем что автораскрытие выполнено
      }
    }
  }, [tree, isLoading, isProjectExpanded, hasAutoExpandedAll])

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
          'flex items-start gap-1.5 w-full py-1 text-sm transition-colors',
          !disabled && 'hover:bg-accent hover:text-accent-foreground',
          disabled && 'opacity-60 cursor-default'
        )}
        style={{ paddingLeft: '4px' }}
      >
        <span className="shrink-0 mt-0.5">
          {isProjectExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </span>
        <Folder className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span className="text-xs font-medium text-left break-words min-w-0">{project.name}</span>
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
          {!isLoading && tree.length > 0 && filteredTreeChildren.length > 0 && (
            <div>
              {filteredTreeChildren.map((child) => renderTreeNode(child, 0))}
            </div>
          )}

          {/* Ничего не найдено по подфильтру */}
          {!isLoading && tree.length > 0 && filteredTreeChildren.length === 0 && subtaskFilter && (
            <div className="text-xs text-muted-foreground py-1" style={{ paddingLeft: '16px' }}>
              Ничего не найдено
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
  /** ID текущего выбранного раздела */
  selectedSectionId: string | null
  /** Callback при выборе раздела */
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
  /** Режим работы модалки (create/edit) */
  modalMode?: 'create' | 'edit'
  /** Callback для закрытия модалки */
  onClose?: () => void
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
  modalMode = 'create',
  onClose,
}: ProjectTreeProps) {
  const [search, setSearch] = useState('')
  const [subtaskSearch, setSubtaskSearch] = useState('')
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

  // Сброс флага автопереключения при изменении autoSwitchProject
  useEffect(() => {
    if (autoSwitchProject) {
      setHasAutoSwitched(false)
    }
  }, [autoSwitchProject?.projectId])

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
        // Переключаемся на "Все проекты"
        onModeChange('all')

        // Устанавливаем фильтр поиска
        setSearch(autoSwitchProject.projectName)

        setHasAutoSwitched(true)
      } else {
        // Проект найден в "Мои проекты", просто помечаем что проверка выполнена
        // и устанавливаем название проекта в поиск
        setSearch(autoSwitchProject.projectName)
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

  // Строка подфильтра для разделов внутри дерева (deferred для плавного ввода)
  const subtaskFilter = useMemo(() => subtaskSearch.trim().toLowerCase(), [subtaskSearch])
  const deferredSubtaskFilter = useDeferredValue(subtaskFilter)

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

      {/* Поиск проекта */}
      <div className="px-4 pt-4 pb-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Поиск проекта..."
            value={search}
            onChange={(e) => !disabled && setSearch(e.target.value)}
            className="pl-8 pr-8"
            disabled={disabled}
          />
          {search && !disabled && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
              title="Очистить"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Подфильтр по разделам */}
      <div className="px-4 pb-4 border-b">
        <div className="relative">
          <Filter className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Фильтр по разделам..."
            value={subtaskSearch}
            onChange={(e) => !disabled && setSubtaskSearch(e.target.value)}
            className="pl-8 pr-8 h-8 text-xs"
            disabled={disabled}
          />
          {subtaskSearch && !disabled && (
            <button
              type="button"
              onClick={() => setSubtaskSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
              title="Очистить"
            >
              <X className="h-4 w-4" />
            </button>
          )}
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
                modalMode={modalMode}
                onClose={onClose}
                subtaskFilter={deferredSubtaskFilter}
              />
            ))}
        </div>
      </ScrollArea>
    </div>
  )
}
