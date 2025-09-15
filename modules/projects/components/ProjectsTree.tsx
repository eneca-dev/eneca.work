"use client"

import React, { useState, useEffect, useRef } from 'react'
import * as Sentry from '@sentry/nextjs'
import { useUserStore } from '@/stores/useUserStore'
import { ChevronDown, ChevronRight, User, FolderOpen, Building, Package, PlusCircle, Edit, Trash2, Expand, Minimize, List, Search, Calendar, Loader2, AlertTriangle, Settings, Filter, Users, SquareStack, Star } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { useTaskTransferStore } from '@/modules/task-transfer/store'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import { useProjectsStore } from '../store'
import { Avatar, Tooltip } from './Avatar'
import { AssignResponsibleModal } from './AssignResponsibleModal'
import { usePermissionsStore } from '@/modules/permissions/store/usePermissionsStore'
import { EditProjectModal } from './EditProjectModal'
import { EditStageModal } from './EditStageModal'
import { CreateStageModal } from './CreateStageModal'
import { EditObjectModal } from './EditObjectModal'
import { CreateObjectModal } from './CreateObjectModal'
import { CreateSectionModal } from './CreateSectionModal'
import { CreateObjectAssignmentModal } from './CreateObjectAssignmentModal'
import { DeleteProjectModal } from './DeleteProjectModal'
import { SectionPanel } from '@/components/modals'
import { useSectionStatuses } from '@/modules/statuses-tags/statuses/hooks/useSectionStatuses'
import { StatusSelector } from '@/modules/statuses-tags/statuses/components/StatusSelector'
import { StatusManagementModal } from '@/modules/statuses-tags/statuses/components/StatusManagementModal'
import { CompactStatusSelector } from './CompactStatusSelector'
import { Tooltip as UiTooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import SectionDecompositionTab from './SectionDecompositionTab'
import SectionTasksPreview from './SectionTasksPreview'
import SectionDescriptionCompact from './SectionDescriptionCompact'
import { CommentsPanel } from '@/modules/comments/components/CommentsPanel'
import { updateProject } from '@/lib/supabase-client'
import {
  getProjectStatusBadgeClasses,
  getProjectStatusLabel,
  normalizeProjectStatus,
  PROJECT_STATUS_OPTIONS,
} from '../constants/project-status'

import { SectionDetailTabs } from './SectionDetailTabs'

interface ProjectNode {
  id: string
  name: string
  type: 'client' | 'manager' | 'project' | 'stage' | 'object' | 'section'
  children?: ProjectNode[]
  // Доп. поля
  type: 'client' | 'manager' | 'project' | 'stage' | 'object' | 'section'
  children?: ProjectNode[]
  // Доп. поля
  projectId?: string
  stageId?: string
  objectId?: string
  projectName?: string
  stageName?: string
  departmentName?: string
  dates?: { start?: string; end?: string}
  responsibleName?: string
  responsibleAvatarUrl?: string
  statusId?: string | null
  statusName?: string
  statusColor?: string 
  managerId?: string | null
  clientId?: string | null
  // Поле статуса проекта (DB value)
  projectStatus?:
    | 'draft'
    | 'active'
    | 'completed'
    | 'paused'
    | 'waiting for input data'
    | 'author supervision'
    | 'actual calculation'
    | 'customer approval'
  // Признак избранного проекта (только для узлов типа 'project')
  isFavorite?: boolean
}

interface ProjectsTreeProps {
  selectedManagerId?: string | null
  selectedProjectId?: string | null
  selectedStageId?: string | null
  selectedObjectId?: string | null
  selectedDepartmentId?: string | null
  selectedTeamId?: string | null
  selectedEmployeeId?: string | null
  selectedStatusIds?: string[]
  urlSectionId?: string | null
  urlTab?: 'overview' | 'details' | 'comments'
  externalSearchQuery?: string
  onOpenProjectDashboard?: (project: ProjectNode, e: React.MouseEvent) => void
}

interface TreeNodeProps {
  node: ProjectNode
  level: number
  expandedNodes: Set<string>
  onToggleNode: (nodeId: string) => void
  onAssignResponsible: (section: ProjectNode, e: React.MouseEvent) => void
  onEditProject: (project: ProjectNode, e: React.MouseEvent) => void
  onEditStage: (stage: ProjectNode, e: React.MouseEvent) => void
  onEditObject: (object: ProjectNode, e: React.MouseEvent) => void
  onOpenSection: (section: ProjectNode, e: React.MouseEvent) => void
  onCreateStage: (project: ProjectNode, e: React.MouseEvent) => void
  onCreateObject: (stage: ProjectNode, e: React.MouseEvent) => void
  onCreateSection: (object: ProjectNode, e: React.MouseEvent) => void
  onCreateAssignment: (object: ProjectNode, e: React.MouseEvent) => void
  onDeleteProject: (project: ProjectNode, e: React.MouseEvent) => void
  onOpenProjectDashboard?: (project: ProjectNode, e: React.MouseEvent) => void
  onOpenStatusManagement: () => void
  statuses: Array<{id: string, name: string, color: string, description?: string}>
  onToggleFavorite?: (project: ProjectNode, e: React.MouseEvent) => void
}

const supabase = createClient()

// Отдельный компонент для узла дерева
const TreeNode: React.FC<TreeNodeProps> = ({ 
  node, 
  level, 
  expandedNodes, 
  onToggleNode, 
  onAssignResponsible,
  onEditProject,
  onEditStage,
  onEditObject,
  onOpenSection,
  onCreateStage,
  onCreateObject,
  onCreateSection,
  onCreateAssignment,
  onDeleteProject,
  onOpenProjectDashboard,
  onOpenStatusManagement,
  statuses,
  onToggleFavorite
}) => {
  const { focusSectionId, highlightedSectionId, focusProjectId } = useProjectsStore()
  const { assignments } = useTaskTransferStore()
  const incomingCount = node.type === 'section' ? assignments.filter(a => a.to_section_id === node.id).length : 0
  const outgoingCount = node.type === 'section' ? assignments.filter(a => a.from_section_id === node.id).length : 0
  const [hoveredResponsible, setHoveredResponsible] = useState(false)
  const [hoveredAddButton, setHoveredAddButton] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [statusSearchQuery, setStatusSearchQuery] = useState('')
  const statusDropdownRef = React.useRef<HTMLDivElement>(null)

  // Разворачиваемое содержимое для раздела
  const [innerTab, setInnerTab] = useState<'decomposition' | 'tasks'>('decomposition')
  const [miniDecomp, setMiniDecomp] = useState<Array<{ id: string; desc: string; catId: string; hours: number; due: string | null }>>([])
  const [miniDecompLoading, setMiniDecompLoading] = useState(false)
  const [catMap, setCatMap] = useState<Map<string, string>>(new Map())
  // Мобильный режим: переключатель между контентом и комментариями
  const [mobileTab, setMobileTab] = useState<'content' | 'comments'>('content')
  const [sectionTotals, setSectionTotals] = useState<{ planned: number; actual: number } | null>(null)
  const [sectionDue, setSectionDue] = useState<string | null>(null)
  const hasPermission = usePermissionsStore(state => state.hasPermission)
  const canDeleteProject = hasPermission('projects.delete')
  const canChangeProjectStatus = hasPermission('projects.change_project_statuses')

  const [updatingProjectStatus, setUpdatingProjectStatus] = useState(false)

  // Вспомогательные функции отображения статуса проекта
  const getProjectStatusText = (status?: ProjectNode['projectStatus']) => {
    return getProjectStatusLabel(status)
  }

  const getProjectStatusClasses = (status?: ProjectNode['projectStatus']) => {
    return getProjectStatusBadgeClasses(status)
  }

  const handleUpdateProjectStatus = async (newStatusInput: ProjectNode['projectStatus']) => {
    if (node.type !== 'project') return
    if (!canChangeProjectStatus) return
    setUpdatingProjectStatus(true)
    try {
      const normalized = normalizeProjectStatus(newStatusInput) || 'active'
      const res = await updateProject(node.id, { project_status: normalized })
      if (!res.success) throw new Error(res.error || 'Не удалось обновить статус проекта')

      // Локально обновим узел и оповестим дерево
      node.projectStatus = normalized
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('projectsTree:projectStatusUpdated', {
          detail: { projectId: node.id, projectStatus: normalized }
        }))
      }
    } catch (e) {
      console.error('Ошибка смены статуса проекта:', e)
    } finally {
      setUpdatingProjectStatus(false)
    }
  }

  const loadMiniDecomposition = async () => {
    try {
      setMiniDecompLoading(true)
      const [itemsRes, catsRes] = await Promise.all([
        supabase
          .from('decomposition_items')
          .select('decomposition_item_id, decomposition_item_description, decomposition_item_work_category_id, decomposition_item_planned_hours, decomposition_item_planned_due_date')
          .eq('decomposition_item_section_id', node.id)
          .order('decomposition_item_order', { ascending: true }),
        supabase
          .from('work_categories')
          .select('work_category_id, work_category_name')
      ])
      let plannedSum = 0
      if (!itemsRes.error && itemsRes.data) {
        const mapped = itemsRes.data.map((r: any) => ({
          id: r.decomposition_item_id,
          desc: r.decomposition_item_description,
          catId: r.decomposition_item_work_category_id,
          hours: Number(r.decomposition_item_planned_hours || 0),
          due: r.decomposition_item_planned_due_date,
        }))
        plannedSum = mapped.reduce((acc, i) => acc + (i.hours || 0), 0)
        setMiniDecomp(mapped)
      }
      if (!catsRes.error && catsRes.data) {
        const m = new Map<string, string>()
        for (const c of catsRes.data as any[]) m.set(c.work_category_id, c.work_category_name)
        setCatMap(m)
      }
      // Дополнительно тянем агрегаты план/факт и крайний срок секции
      try {
        const [totals, dates] = await Promise.all([
          supabase
            .from('view_section_decomposition_totals')
            .select('planned_hours, actual_hours')
            .eq('section_id', node.id)
            .single(),
          supabase
            .from('sections')
            .select('section_end_date')
            .eq('section_id', node.id)
            .single(),
        ])
        if (!totals.error && totals.data) {
          setSectionTotals({
            planned: plannedSum, // план считаем как сумму из декомпозиции
            actual: Number(totals.data.actual_hours || 0),
          })
        } else {
          // даже если totals не пришел, сохраним план по декомпозиции
          setSectionTotals({ planned: plannedSum, actual: 0 })
        }
        if (!dates.error && dates.data) {
          setSectionDue(dates.data.section_end_date || null)
        }
      } catch (e) {
        // не критично
      }
    } finally {
      setMiniDecompLoading(false)
    }
  }

  const hasChildren = node.children && node.children.length > 0

  const isExpanded = expandedNodes.has(node.id)

  const getNodeIcon = (type: string, nodeName?: string) => {
    // Специальная иконка для категории "Руководитель проекта не назначен"
    if (type === 'manager' && nodeName === 'Руководитель проекта не назначен') {
      return <User className="h-4 w-4 text-gray-500" />
    }
    
    // Специальная иконка для категории "Без заказчика"
    if (type === 'client' && nodeName === 'Без заказчика') {
      return <Building className="h-4 w-4 text-gray-500" />
    }
    
    switch (type) {
      case 'client':
        return <Building className="h-4 w-4 text-indigo-600" />
      case 'manager':
        return <User className="h-4 w-4 text-blue-600" />
      case 'project':
        return <FolderOpen className="h-4 w-4 text-green-600" />
      case 'stage':
        return <SquareStack className="h-4 w-4 text-purple-600" />
      case 'object':
        return <Package className="h-4 w-4 text-orange-600" />
      case 'section':
        return <div className="h-3 w-3 rounded bg-teal-500" />
      default:
        return null
    }
  }

  const formatDate = (date: string | undefined): string => {
    if (!date) return "-"
    try {
      const dateObj = new Date(date)
      const day = dateObj.getDate().toString().padStart(2, "0")
      const month = (dateObj.getMonth() + 1).toString().padStart(2, "0")
      return `${day}.${month}`
    } catch (error) {
      return "-"
    }
  }

  // Развернуть текущий узел и все дочерние
  const expandAllFromNode = (target: ProjectNode) => {
    const expandRecursively = (n: ProjectNode) => {
      if (n.children && n.children.length > 0) {
        if (!expandedNodes.has(n.id)) {
          onToggleNode(n.id)
        }
        n.children.forEach(child => expandRecursively(child))
      }
    }
    expandRecursively(target)
  }

  const updateSectionStatus = async (statusId: string | null) => {
    if (node.type !== 'section') return
    
    setUpdatingStatus(true)
    try {
      const { error } = await supabase
        .from('sections')
        .update({ section_status_id: statusId })
        .eq('section_id', node.id)

      if (error) throw error

      // Обновляем локальные данные узла
      const updatedStatus = statuses.find(s => s.id === statusId)
      node.statusId = statusId || undefined
      node.statusName = updatedStatus?.name || undefined
      node.statusColor = updatedStatus?.color || undefined

      // Создаем событие для уведомления других компонентов об изменении
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sectionPanel:statusUpdated', {
          detail: {
            sectionId: node.id,
            statusId: statusId,
            statusName: updatedStatus?.name || null,
            statusColor: updatedStatus?.color || null
          }
        }))
      }

      console.log('Статус обновлен:', statusId ? 'установлен' : 'снят')
    } catch (error) {
      console.error('Ошибка обновления статуса:', error)
    } finally {
      setUpdatingStatus(false)
    }
  }

  const countSections = (node: ProjectNode): number => {
    if (!node.children) return 0;
    
    let count = 0;
    const traverse = (nodes: ProjectNode[]) => {
      nodes.forEach(child => {
        if (child.type === 'section') {
          count++;
        }
        if (child.children) {
          traverse(child.children);
        }
      });
    };
    
    traverse(node.children);
    return count;
  };

  return (
    <div className="group/row select-none" data-tree-node-id={node.id}>
      <div
        className={cn(
          // Базовая строка
          "flex items-center border-b transition-colors duration-500",
          // Базовые границы
          "dark:border-slate-700 border-slate-200",
          // Подсветка активного раздела
          node.type === 'section' && (node.id === focusSectionId || node.id === highlightedSectionId)
            ? "bg-emerald-50 dark:bg-emerald-900/30 border-b-transparent"
            : undefined,
          // Подсветка активного проекта при фокусе
          node.type === 'project' && node.id === focusProjectId
            ? "bg-emerald-50 dark:bg-emerald-900/30 border-b-transparent"
            : undefined,
          hasChildren ? "cursor-pointer" : "cursor-default",
          // Hover эффекты как в планировании
          "dark:hover:bg-emerald-900/20 hover:bg-emerald-50"
        )}
        style={{ 
          paddingLeft: `${level * 20 + 12}px`,
          minHeight: node.type === 'section' ? '72px' : '40px' // Увеличиваем высоту для разделов
        }}
        onClick={() => hasChildren && onToggleNode(node.id)}
      >
        {/* Для разделов - особая структура как в планировании */}
        {node.type === 'section' ? (
          <div className="flex items-center w-full py-2">
            {/* Аватар или кнопка добавления (слева как в планировании) */}
            <div className="flex-shrink-0 mr-3">
              {node.responsibleName ? (
                <div
                  className="flex items-center justify-center"
                  onMouseEnter={() => setHoveredResponsible(true)}
                  onMouseLeave={() => setHoveredResponsible(false)}
                >
                  <Tooltip content={node.responsibleName} isVisible={hoveredResponsible}>
                    <Avatar
                      name={node.responsibleName}
                      avatarUrl={node.responsibleAvatarUrl}
                      size="md"
                    />
                  </Tooltip>
                </div>
              ) : (
                <div
                  className="cursor-pointer w-9 h-9 flex items-center justify-center rounded-full border-2 border-dashed transition-colors"
                  onClick={(e) => onAssignResponsible(node, e)}
                  onMouseEnter={() => setHoveredAddButton(true)}
                  onMouseLeave={() => setHoveredAddButton(false)}
                  style={{
                    borderColor: hoveredAddButton 
                      ? 'rgb(20, 184, 166)' // teal-500
                      : 'rgb(148, 163, 184)' // slate-400
                  }}
                >
                  <Tooltip content="Назначить ответственного" isVisible={hoveredAddButton} position="bottom">
                    <PlusCircle
                      size={16}
                      className={cn(
                        "transition-colors",
                        hoveredAddButton 
                          ? "text-teal-500" 
                          : "text-slate-400"
                      )}
                    />
                  </Tooltip>
                </div>
              )}
            </div>

            {/* Иконка раскрытия и название */}
            <div className="flex items-center min-w-0 flex-1 gap-2">
              <button
                className="flex-shrink-0 w-4 h-4 flex items-center justify-center mr-2"
                onClick={async (e) => {
                  e.stopPropagation()
                  onToggleNode(node.id)
                  if (node.type === 'section' && !expandedNodes.has(node.id)) {
                    await loadMiniDecomposition()
                  }
                }}
                aria-label={isExpanded ? 'Свернуть' : 'Развернуть'}
              >
                {(node.type === 'section' || hasChildren) ? (
                  isExpanded ? (
                    <ChevronDown className="h-3 w-3 text-teal-500" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-teal-500" />
                  )
                ) : null}
              </button>
              <span 
                className="font-semibold text-sm dark:text-slate-200 text-slate-800 cursor-pointer hover:text-teal-600 dark:hover:text-teал-400 transition-colors truncate max-w-[900px] xl:max-w-[1100px]"
                onClick={(e) => onOpenSection(node, e)}
                title={node.name}
              >
                {node.name}
              </span>
              {node.type === 'section' && (incomingCount > 0 || outgoingCount > 0) && (
                <div
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 cursor-default"
                  title={`Исходящие: ${outgoingCount} • Входящие: ${incomingCount}`}
                >
                  <span className="text-primary font-semibold">{outgoingCount}</span>
                  <span className="opacity-60">/</span>
                  <span className="text-secondary-foreground font-semibold">{incomingCount}</span>
                </div>
              )}
            </div>

            {/* Информация справа с адаптивными ширинами */}
            <div className="flex items-center text-xs ml-auto mr-8">
              {/* Статус секции - скрывается последним (>= 600px) */}
              <div className="hidden min-[600px]:flex items-center w-32 justify-end mr-4 relative">
                {updatingStatus ? (
                  <div className="flex items-center gap-1 px-2 py-1">
                    <Loader2 className="w-3 h-3 animate-spin text-gray-500" />
                    <span className="text-xs text-gray-500">Обновление...</span>
                  </div>
                ) : (
                  <div className="w-full" onClick={(e) => e.stopPropagation()}>
                    <CompactStatusSelector
                      value={node.statusId || ''}
                      onChange={(statusId) => updateSectionStatus(statusId || null)}
                      disabled={updatingStatus}
                      currentStatusName={node.statusName ?? undefined}
                      currentStatusColor={node.statusColor ?? undefined}
                    />
                  </div>
                )}
              </div>
              
              {/* Даты - скрывается третьими (>= 800px) */}
              <div className="hidden min-[800px]:flex items-center gap-1 w-28 justify-end flex-shrink-0">
                <Calendar className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                <span className="text-blue-700 dark:text-blue-300">
                  {(node.dates?.start || node.dates?.end) ? (
                    <>
                      {formatDate(node.dates?.start ?? undefined) || '—'}
                      {node.dates?.start && node.dates?.end && <span className="text-blue-500 dark:text-blue-400 mx-1">-</span>}
                      {node.dates?.end && formatDate(node.dates?.end ?? undefined)}
                    </>
                  ) : (
                    '— — —'
                  )}
                </span>
              </div>

              {/* Отдел - скрывается вторым (>= 1000px) */}
              <div className="hidden min-[1000px]:flex w-32 justify-end flex-shrink-0 min-w-0">
                {node.departmentName && (
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded px-2 py-1 max-w-full">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs text-emerald-700 dark:text-emerald-300 truncate max-w-[84px]">
                        {node.departmentName}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Проект, стадия и ответственный - скрывается первым (>= 1200px) */}
              <div className="hidden min-[1200px]:flex w-36 flex-col gap-1 text-right ml-4">
                {node.projectName && (
                  <span className="dark:text-slate-500 text-slate-400 truncate">
                    {node.projectName}
                  </span>
                )}
                {node.stageName && (
                  <span className="dark:text-slate-500 text-slate-400 truncate">
                    Стадия: {node.stageName}
                  </span>
                )}
                {node.responsibleName && (
                  <span className="dark:text-slate-400 text-slate-500 truncate">
                    {node.responsibleName}
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Для остальных типов узлов - стандартная структура */
          <>
            {/* Иконка раскрытия */}
            <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center mr-2">
              {hasChildren ? (
                isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                )
              ) : (
                <div className="h-4 w-4" />
              )}
            </div>
            
            {/* Иконка типа */}
            <div className="flex-shrink-0 mr-2">
              {getNodeIcon(node.type, node.name)}
            </div>
            
            {/* Название */}
            {node.type === 'project' && onOpenProjectDashboard ? (
              <span 
                className={cn(
                  "font-medium text-sm dark:text-slate-200 text-slate-800 cursor-pointer hover:text-green-600 dark:hover:text-green-400 transition-colors"
                )}
                onClick={(e) => onOpenProjectDashboard(node, e)}
                title="Открыть дашборд проекта"
              >
                {node.name}
              </span>
            ) : (
              <span className={cn(
                "font-medium text-sm dark:text-slate-200 text-slate-800",
                node.type === 'manager' && "font-semibold"
              )}>
                {node.name}
              </span>
            )}

            {/* Звёздочка избранного для проектов */}
            {node.type === 'project' && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleFavorite && onToggleFavorite(node, e) }}
                className={cn(
                  "ml-2 p-0.5 rounded transition-opacity",
                  node.isFavorite ? "opacity-100" : "opacity-60 hover:opacity-100"
                )}
                title={node.isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
                aria-pressed={node.isFavorite ? 'true' : 'false'}
              >
                <Star
                  className={cn(
                    "h-4 w-4",
                    node.isFavorite ? "text-yellow-500" : "text-slate-300 dark:text-slate-600"
                  )}
                  // Для заливки используем текущий цвет
                  fill={node.isFavorite ? 'currentColor' : 'none'}
                />
              </button>
            )}



            {/* Кнопки редактирования для проектов */}
            {node.type === 'project' && (
              <div className="flex items-center ml-2">
                {/* Статус проекта */}
                <div className="mr-2">
                  {canChangeProjectStatus ? (
                    <div onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className={`px-2 py-0.5 text-[11px] border rounded-md transition-colors ${getProjectStatusClasses(node.projectStatus)}`}
                            disabled={updatingProjectStatus}
                            title="Изменить статус проекта"
                          >
                            {updatingProjectStatus ? (
                              <span className="inline-flex items-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Обновление...
                              </span>
                            ) : (
                              getProjectStatusText(node.projectStatus)
                            )}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-40 p-0">
                          {PROJECT_STATUS_OPTIONS.map((opt) => (
                            <DropdownMenuItem key={opt} onClick={() => handleUpdateProjectStatus(opt)}>
                              {getProjectStatusLabel(opt)}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ) : (
                    <span className={`px-2 py-0.5 text-[11px] border rounded-md ${getProjectStatusClasses(node.projectStatus)}`}>
                      {getProjectStatusText(node.projectStatus)}
                    </span>
                  )}
                </div>
                {/* Развернуть весь проект */}
                <button
                  onClick={(e) => { e.stopPropagation(); expandAllFromNode(node) }}
                  className="p-1 opacity-0 group-hover/row:opacity-100 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded transition-all mr-1"
                  title="Развернуть всю структуру проекта"
                >
                  <Expand className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                </button>
                <button
                  onClick={(e) => onCreateStage(node, e)}
                  className="p-1 opacity-0 group-hover/row:opacity-100 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-all mr-1"
                  title="Создать стадию"
                >
                  <PlusCircle className="h-3 w-3 text-green-600 dark:text-green-400" />
                </button>
                <button
                  onClick={(e) => onEditProject(node, e)}
                  className="p-1 opacity-0 group-hover/row:opacity-100 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-all"
                  title="Редактировать проект"
                >
                  <Edit className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                </button>
                {canDeleteProject && (
                  <button
                    onClick={(e) => onDeleteProject(node, e)}
                    className="p-1 opacity-0 group-hover/row:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-all ml-1"
                    title="Удалить проект"
                  >
                    <Trash2 className="h-3 w-3 text-red-600 dark:text-red-400" />
                  </button>
                )}
              </div>
            )}


            
            {node.type === 'stage' && (
              <div className="flex items-center ml-2">
                <button
                  onClick={(e) => onCreateObject(node, e)}
                  className="p-1 opacity-0 group-hover/row:opacity-100 hover:bg-orange-100 dark:hover:bg-orange-900/30 rounded transition-all mr-1"
                  title="Создать объект"
                >
                  <PlusCircle className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                </button>
                <button
                  onClick={(e) => onEditStage(node, e)}
                  className="p-1 opacity-0 group-hover/row:opacity-100 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded transition-all"
                  title="Редактировать стадию"
                >
                  <Edit className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                </button>
              </div>
            )}
            
            {node.type === 'object' && (
              <div className="flex items-center ml-2">
                <button
                  onClick={(e) => onCreateSection(node, e)}
                  className="p-1 opacity-0 group-hover/row:opacity-100 hover:bg-teal-100 dark:hover:bg-teal-900/30 rounded transition-all mr-1"
                  title="Создать раздел"
                >
                  <PlusCircle className="h-3 w-3 text-teal-600 dark:text-teal-400" />
                </button>
                <button
                  onClick={(e) => onEditObject(node, e)}
                  className="p-1 opacity-0 group-hover/row:opacity-100 hover:bg-orange-100 dark:hover:bg-orange-900/30 rounded transition-all"
                  title="Редактировать объект"
                >
                  <Edit className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                </button>
              </div>
            )}

            {/* Суммарная информация для объектов */}
            {node.type === 'object' && (
              <div className="flex items-center gap-3 ml-auto text-xs mr-8">
                {/* Количество разделов */}
                <div className="flex items-center gap-1">
                  <span className="text-amber-600 dark:text-amber-400">
                    {countSections(node)}
                  </span>
                  <span className="dark:text-slate-400 text-slate-500">
                    разделов
                  </span>
                </div>
                
                {/* Даты */}
                {node.dates && (node.dates.start || node.dates.end) && (
                  <span className="dark:text-slate-400 text-slate-500">
                    {node.dates.start && node.dates.end && 
                      `${formatDate(node.dates.start)} - ${formatDate(node.dates.end)}`
                    }
                  </span>
                )}
              </div>
            )}

            {/* Суммарная информация для стадий */}
            {node.type === 'stage' && (
              <div className="flex items-center ml-auto text-xs mr-8">
                {/* Даты */}
                {node.dates && (node.dates.start || node.dates.end) && (
                  <span className="dark:text-slate-400 text-slate-500">
                    {node.dates.start && node.dates.end && 
                      `${formatDate(node.dates.start)} - ${formatDate(node.dates.end)}`
                    }
                  </span>
                )}
              </div>
            )}

            {/* Даты для остальных типов узлов */}
            {node.type !== 'stage' && node.type !== 'object' && node.dates && (node.dates.start || node.dates.end) && (
              <span className="text-xs dark:text-slate-400 text-slate-500 ml-auto mr-8">
                {node.dates.start && node.dates.end && 
                  `${formatDate(node.dates.start)} - ${formatDate(node.dates.end)}`
                }
              </span>
            )}
          </>
        )}
      </div>

      {(node.type === 'section' && isExpanded) && (
        <div className="pl-14 pr-6 py-3 bg-slate-50 dark:bg-slate-800/40 border-b dark:border-slate-700">
          {/* Заглушка аналитики раздела */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
            <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Аналитика по разделу</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Здесь будет аналитика по разделу (заглушка).
            </div>
          </div>
        </div>
      )}

      {hasChildren && isExpanded && node.type !== 'section' && (
        <div>
          {node.children!.map((child, index) => (
            <TreeNode
              key={`child-${child.id}-${index}`}
              node={child}
              level={level + 1}
              expandedNodes={expandedNodes}
              onToggleNode={onToggleNode}
              onAssignResponsible={onAssignResponsible}
              onEditProject={onEditProject}
              onEditStage={onEditStage}
              onEditObject={onEditObject}
              onOpenSection={onOpenSection}
              onCreateStage={onCreateStage}
              onCreateObject={onCreateObject}
              onCreateSection={onCreateSection}
              onCreateAssignment={onCreateAssignment}
              onDeleteProject={onDeleteProject}
              onOpenProjectDashboard={onOpenProjectDashboard}
              onOpenStatusManagement={onOpenStatusManagement}
              statuses={statuses}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function ProjectsTree({ 
  selectedManagerId, 
  selectedProjectId, 
  selectedStageId, 
  selectedObjectId,
  selectedDepartmentId,
  selectedTeamId,
  selectedEmployeeId,
  selectedStatusIds = [],
  urlSectionId,
  urlTab,
  externalSearchQuery,
  onOpenProjectDashboard
}: ProjectsTreeProps) {
  const [treeData, setTreeData] = useState<ProjectNode[]>([])
  const latestTreeRef = useRef<ProjectNode[]>([])
  const { 
    expandedNodes, 
    toggleNode: toggleNodeInStore,
    highlightedSectionId,
    clearHighlight,
    focusSectionId,
    clearFocus,
    focusProjectId,
    clearProjectFocus,
    showManagers,
    toggleShowManagers,
    groupByClient,
    toggleGroupByClient
  } = useProjectsStore()
  const { statuses } = useSectionStatuses()
  const [loading, setLoading] = useState(true)
  const [showOnlySections, setShowOnlySections] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  // Удалены локальные refs и dropdown для статусов; управление сверху
  const [showStatusManagementModal, setShowStatusManagementModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedSection, setSelectedSection] = useState<ProjectNode | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedProject, setSelectedProject] = useState<ProjectNode | null>(null)
  const [showEditStageModal, setShowEditStageModal] = useState(false)
  const [selectedStage, setSelectedStage] = useState<ProjectNode | null>(null)
  const [showEditObjectModal, setShowEditObjectModal] = useState(false)
  const [selectedObject, setSelectedObject] = useState<ProjectNode | null>(null)
  const [showSectionPanel, setShowSectionPanel] = useState(false)
  const [selectedSectionForPanel, setSelectedSectionForPanel] = useState<ProjectNode | null>(null)
  const [showCreateStageModal, setShowCreateStageModal] = useState(false)
  const [selectedProjectForStage, setSelectedProjectForStage] = useState<ProjectNode | null>(null)
  const [showCreateObjectModal, setShowCreateObjectModal] = useState(false)
  const [selectedStageForObject, setSelectedStageForObject] = useState<ProjectNode | null>(null)
  const [showCreateSectionModal, setShowCreateSectionModal] = useState(false)
  const [selectedObjectForSection, setSelectedObjectForSection] = useState<ProjectNode | null>(null)
  // Локальный фильтр: отображать только избранные проекты
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false)


  // Закрытие выпадающего списка статусов при клике вне его
  const [showCreateAssignmentModal, setShowCreateAssignmentModal] = useState(false)
  const [selectedObjectForAssignment, setSelectedObjectForAssignment] = useState<ProjectNode | null>(null)
  
  // Храним актуальные данные дерева для синхронного доступа в обработчиках событий
  useEffect(() => {
    latestTreeRef.current = treeData
  }, [treeData])


  // (Убрано) локальный выпадающий фильтр статусов перемещён в верхнее меню

  // Глобальные события от верхней панели
  useEffect(() => {
    const toggleGroup = () => toggleGroupByClient()
    const toggleManagers = () => toggleShowManagers()
    const collapseAll = () => collapseAllNodes()
    const onlySections = () => setShowOnlySections((v) => v) // отключено, держим состояние как есть
    const openStatusManagement = () => setShowStatusManagementModal(true)
    const toggleOnlyFavorites = () => setShowOnlyFavorites(v => !v)
    const resetOnlyFavorites = () => setShowOnlyFavorites(false)

    window.addEventListener('projectsTree:toggleGroupByClient', toggleGroup as EventListener)
    window.addEventListener('projectsTree:toggleShowManagers', toggleManagers as EventListener)
    window.addEventListener('projectsTree:collapseAll', collapseAll as EventListener)
    // обработчик toggleOnlySections оставлен на будущее, но логика отключена
    // window.addEventListener('projectsTree:toggleOnlySections', onlySections as EventListener)
    window.addEventListener('projectsTree:openStatusManagement', openStatusManagement as EventListener)
    window.addEventListener('projectsTree:toggleOnlyFavorites', toggleOnlyFavorites as EventListener)
    window.addEventListener('projectsTree:resetOnlyFavorites', resetOnlyFavorites as EventListener)

    return () => {
      window.removeEventListener('projectsTree:toggleGroupByClient', toggleGroup as EventListener)
      window.removeEventListener('projectsTree:toggleShowManagers', toggleManagers as EventListener)
      window.removeEventListener('projectsTree:collapseAll', collapseAll as EventListener)
      // window.removeEventListener('projectsTree:toggleOnlySections', onlySections as EventListener)
      window.removeEventListener('projectsTree:openStatusManagement', openStatusManagement as EventListener)
      window.removeEventListener('projectsTree:toggleOnlyFavorites', toggleOnlyFavorites as EventListener)
      window.removeEventListener('projectsTree:resetOnlyFavorites', resetOnlyFavorites as EventListener)
    }
  }, [toggleGroupByClient, toggleShowManagers, collapseAllNodes, showOnlySections, groupByClient, expandedNodes])

  // Загрузка данных
  useEffect(() => {
    loadTreeData()
  }, [selectedManagerId, selectedProjectId, selectedStageId, selectedObjectId, selectedDepartmentId, selectedTeamId, selectedEmployeeId, showManagers, groupByClient])

  // Глобальное событие для принудительной перезагрузки дерева (после создания проекта и т.п.)
  useEffect(() => {
    const reload = () => loadTreeData()
    const handleCreated = async (e: any) => {
      // После создания сразу перезагружаем дерево и фокусируемся на созданном узле
      const prevExpanded = new Set(expandedNodes)
      await loadTreeData()
      try {
        const detail = e?.detail
        if (!detail?.id) return
        // Найдём путь к узлу и развернём все родительские узлы
        const findPath = (nodes: ProjectNode[], targetId: string, path: string[] = []): string[] | null => {
          for (const node of nodes) {
            const newPath = [...path, node.id]
            if (node.id === targetId) return newPath
            if (node.children && node.children.length > 0) {
              const found = findPath(node.children, targetId, newPath)
              if (found) return found
            }
          }
          return null
        }
        const path = findPath(latestTreeRef.current || [], detail.id) || []
        if (path.length > 0) {
          // Разворачиваем все узлы на пути, кроме самого целевого узла
          path.slice(0, -1).forEach((id) => {
            if (!expandedNodes.has(id)) {
              toggleNodeInStore(id)
            }
          })
        }
        // Сохраняем разворот родителя/ветки при возможности
        // Ничего не сворачиваем — пользовательский контекст должен сохраниться
        // Разворачиваем путь к созданному узлу и скроллим к нему
        requestAnimationFrame(() => {
          const el = document.querySelector(`[data-tree-node-id="${detail.id}"]`)
          if (el && 'scrollIntoView' in el) {
            (el as HTMLElement).scrollIntoView({ block: 'center', behavior: 'smooth' })
          }
        })
      } catch (_) {}
    }
    const handleFocusNode = (e: any) => {
      try {
        const detail = e?.detail
        if (!detail?.id) return
        requestAnimationFrame(() => {
          const el = document.querySelector(`[data-tree-node-id="${detail.id}"]`)
          if (el && 'scrollIntoView' in el) {
            (el as HTMLElement).scrollIntoView({ block: 'center', behavior: 'smooth' })
          }
        })
      } catch (_) {}
    }

    window.addEventListener('projectsTree:reload', reload as EventListener)
    window.addEventListener('projectsTree:created', handleCreated as EventListener)
    window.addEventListener('projectsTree:focusNode', handleFocusNode as EventListener)
    return () => {
      window.removeEventListener('projectsTree:reload', reload as EventListener)
      window.removeEventListener('projectsTree:created', handleCreated as EventListener)
      window.removeEventListener('projectsTree:focusNode', handleFocusNode as EventListener)
    }
  }, [])

  // Если приходит внешний поиск из верхней панели — используем его как источник правды
  useEffect(() => {
    setSearchQuery(externalSearchQuery ?? '')
  }, [externalSearchQuery])

  // Функция поиска раздела по ID в дереве
  const findSectionById = (sectionId: string): ProjectNode | null => {
    const findInNodes = (nodes: ProjectNode[]): ProjectNode | null => {
      for (const node of nodes) {
        if (node.type === 'section' && node.id === sectionId) {
          return node
        }
        if (node.children && node.children.length > 0) {
          const found = findInNodes(node.children)
          if (found) return found
        }
      }
      return null
    }
    return findInNodes(treeData)
  }

  // Слушаем события обновления статуса секции
  useEffect(() => {
    const handleSectionStatusUpdate = (event: CustomEvent) => {
      const { sectionId, statusId, statusName, statusColor } = event.detail

      // Рекурсивно обновляем статус узла в дереве
      const updateNodeStatus = (nodes: ProjectNode[]): ProjectNode[] => {
        return nodes.map(node => {
          if (node.type === 'section' && node.id === sectionId) {
            return {
              ...node,
              statusId: statusId || undefined,
              statusName: statusName || undefined,
              statusColor: statusColor || undefined
            }
          }
          if (node.children) {
            return {
              ...node,
              children: updateNodeStatus(node.children)
            }
          }
          return node
        })
      }

      setTreeData(currentTreeData => updateNodeStatus(currentTreeData))
    }

    // Обработчик изменения статуса (обновление названия, цвета, описания)
    const handleStatusUpdate = (event: CustomEvent) => {
      const { statusId, statusName, statusColor } = event.detail
      console.log('📥 Получили событие statusUpdated в ProjectsTree:', { statusId, statusName, statusColor });

      // Рекурсивно обновляем все узлы с этим статусом
      const updateStatusInNodes = (nodes: ProjectNode[]): ProjectNode[] => {
        return nodes.map(node => {
          if (node.type === 'section' && node.statusId === statusId) {
            return {
              ...node,
              statusName: statusName,
              statusColor: statusColor
            }
          }
          if (node.children) {
            return {
              ...node,
              children: updateStatusInNodes(node.children)
            }
          }
          return node
        })
      }

      setTreeData(currentTreeData => {
        const updatedData = updateStatusInNodes(currentTreeData)
        console.log('🔄 Обновили статус в дереве:', updatedData);
        return updatedData
      })
      
      // Убираем полную перезагрузку - достаточно обновить статусы в памяти
    }

    // Обработчик создания нового статуса
    const handleStatusCreate = (event: CustomEvent) => {
      const { statusId, statusName, statusColor } = event.detail
      console.log('📥 Получили событие statusCreated в ProjectsTree:', { statusId, statusName, statusColor });
      
      // При создании нового статуса просто обновляем статусы в useSectionStatuses
      // Никаких изменений в существующих узлах не требуется
      console.log('✅ Новый статус создан, список статусов обновится автоматически');
    }

    // Обработчик удаления статуса
    const handleStatusDelete = (event: CustomEvent) => {
      const { statusId } = event.detail

      // Рекурсивно убираем удаленный статус у всех узлов
      const removeStatusFromNodes = (nodes: ProjectNode[]): ProjectNode[] => {
        return nodes.map(node => {
          if (node.type === 'section' && node.statusId === statusId) {
            return {
              ...node,
              statusId: undefined,
              statusName: undefined,
              statusColor: undefined
            }
          }
          if (node.children) {
            return {
              ...node,
              children: removeStatusFromNodes(node.children)
            }
          }
          return node
        })
      }

      setTreeData(currentTreeData => removeStatusFromNodes(currentTreeData))
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('sectionPanel:statusUpdated', handleSectionStatusUpdate as EventListener)
      window.addEventListener('statusCreated', handleStatusCreate as EventListener)
      window.addEventListener('statusUpdated', handleStatusUpdate as EventListener)
      window.addEventListener('statusDeleted', handleStatusDelete as EventListener)
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('sectionPanel:statusUpdated', handleSectionStatusUpdate as EventListener)
        window.removeEventListener('statusCreated', handleStatusCreate as EventListener)
        window.removeEventListener('statusUpdated', handleStatusUpdate as EventListener)
        window.removeEventListener('statusDeleted', handleStatusDelete as EventListener)
      }
    }
  }, [])

  // Слушаем обновление статуса проекта (локальное обновление дерева)
  useEffect(() => {
    const handleProjectStatusUpdated = (event: CustomEvent) => {
      const { projectId, projectStatus } = event.detail || {}
      if (!projectId) return

      const updateProjectStatusInNodes = (nodes: ProjectNode[]): ProjectNode[] => {
        return nodes.map(node => {
          if (node.type === 'project' && node.id === projectId) {
            return { ...node, projectStatus }
          }
          if (node.children) {
            return { ...node, children: updateProjectStatusInNodes(node.children) }
          }
          return node
        })
      }

      setTreeData(current => updateProjectStatusInNodes(current))
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('projectsTree:projectStatusUpdated', handleProjectStatusUpdated as EventListener)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('projectsTree:projectStatusUpdated', handleProjectStatusUpdated as EventListener)
      }
    }
  }, [])

  // Обработка подсвеченного раздела для навигации к комментариям
  useEffect(() => {
    if (!loading && highlightedSectionId && treeData.length > 0) {
      console.log('🎯 Открываем раздел с комментариями:', highlightedSectionId)
      
      const section = findSectionById(highlightedSectionId)
      if (section) {
        console.log('✅ Найден раздел:', section)
        setSelectedSectionForPanel(section)
        setShowSectionPanel(true)
        
        // Очищаем подсветку через 3 секунды
        setTimeout(() => {
          clearHighlight()
        }, 3000)
      } else {
        console.warn('⚠️ Раздел не найден:', highlightedSectionId)
      }
    }
  }, [loading, highlightedSectionId, treeData, clearHighlight])

  // Обработка фокусировки раздела в дереве (без открытия панели)
  useEffect(() => {
    if (!loading && focusSectionId && treeData.length > 0) {
      console.log('🎯 Фокусируем раздел в дереве:', focusSectionId)
      const section = findSectionById(focusSectionId)
      if (section) {
        // Развернём путь к разделу
        const expandPath = (nodes: ProjectNode[], targetId: string, path: string[] = []): string[] | null => {
          for (const node of nodes) {
            const newPath = [...path, node.id]
            if (node.type === 'section' && node.id === targetId) return newPath
            if (node.children) {
              const found = expandPath(node.children, targetId, newPath)
              if (found) return found
            }
          }
          return null
        }
        const path = expandPath(treeData, focusSectionId) || []
        // Развернём все узлы по пути кроме самого раздела
        path.slice(0, -1).forEach(nodeId => {
          if (!expandedNodes.has(nodeId)) {
            toggleNodeInStore(nodeId)
          }
        })
        // Прокрутим к элементу, если он в DOM
        requestAnimationFrame(() => {
          const el = document.querySelector(`[data-tree-node-id="${focusSectionId}"]`)
          if (el && 'scrollIntoView' in el) {
            (el as HTMLElement).scrollIntoView({ block: 'center', behavior: 'smooth' })
          }
        })
        setTimeout(() => clearFocus(), 1200)
      }
    }
  }, [loading, focusSectionId, treeData, expandedNodes, toggleNodeInStore, clearFocus])

  // Обработка фокусировки проекта в дереве (без открытия панели)
  useEffect(() => {
    if (!loading && focusProjectId && treeData.length > 0) {
      console.log(' Фокусируем проект в дереве:', focusProjectId)
      const findProjectById = (nodes: ProjectNode[], projectId: string): ProjectNode | null => {
        for (const node of nodes) {
          if (node.type === 'project' && node.id === projectId) return node
          if (node.children) {
            const found = findProjectById(node.children, projectId)
            if (found) return found
          }
        }
        return null
      }
      
      const project = findProjectById(treeData, focusProjectId)
      if (project) {
        // Развернём путь к проекту
        const expandPath = (nodes: ProjectNode[], targetId: string, path: string[] = []): string[] | null => {
          for (const node of nodes) {
            const newPath = [...path, node.id]
            if (node.type === 'project' && node.id === targetId) return newPath
            if (node.children) {
              const found = expandPath(node.children, targetId, newPath)
              if (found) return found
            }
          }
          return null
        }
        const path = expandPath(treeData, focusProjectId) || []
        // Развернём все узлы по пути кроме самого проекта
        path.slice(0, -1).forEach(nodeId => {
          if (!expandedNodes.has(nodeId)) {
            toggleNodeInStore(nodeId)
          }
        })
        // Прокрутим к элементу, если он в DOM
        requestAnimationFrame(() => {
          const el = document.querySelector(`[data-tree-node-id="${focusProjectId}"]`) as HTMLElement | null
          if (el) {
            const HEADER_OFFSET = 88
            const rect = el.getBoundingClientRect()
            const targetTop = Math.max(window.scrollY + rect.top - HEADER_OFFSET, 0)
            window.scrollTo({ top: targetTop, behavior: 'smooth' })
          }
        })
        // Сбросим фокус
        setTimeout(() => clearProjectFocus(), 1200)
      }
    }
  }, [loading, focusProjectId, treeData, expandedNodes, toggleNodeInStore, clearProjectFocus])

  // Обработка URL параметров для прямой навигации к разделу (fallback)
  useEffect(() => {
    if (!loading && urlSectionId && urlTab && treeData.length > 0 && !highlightedSectionId) {
      console.log('🎯 Обрабатываем URL навигацию (fallback):', { urlSectionId, urlTab })
      
      const section = findSectionById(urlSectionId)
      if (section) {
        console.log('✅ Найден раздел по URL:', section)
        setSelectedSectionForPanel(section)
        setShowSectionPanel(true)
      } else {
        console.warn('⚠️ Раздел не найден по URL:', urlSectionId)
      }
    }
  }, [loading, urlSectionId, urlTab, treeData, highlightedSectionId])

  const loadTreeData = async () => {
    return Sentry.startSpan(
      {
        op: "projects.load_tree_data",
        name: "Load Projects Tree Data",
      },
      async (span: any) => {
        console.log('🌳 Загружаю данные дерева проектов...')
        console.log('🔍 Фильтры:', { 
          selectedManagerId, 
          selectedProjectId, 
          selectedStageId, 
          selectedObjectId,
          selectedDepartmentId,
          selectedTeamId,
          selectedEmployeeId
        })
        
        span.setAttribute("filters.manager_id", selectedManagerId || "none")
        span.setAttribute("filters.project_id", selectedProjectId || "none")
        span.setAttribute("filters.stage_id", selectedStageId || "none")
        span.setAttribute("filters.object_id", selectedObjectId || "none")
        span.setAttribute("filters.department_id", selectedDepartmentId || "none")
        span.setAttribute("filters.team_id", selectedTeamId || "none")
        span.setAttribute("filters.employee_id", selectedEmployeeId || "none")
        
        setLoading(true)
        // [DEBUG:PROJECTS] входные фильтры загрузки дерева
        console.log('[DEBUG:PROJECTS] tree:load:inputs', {
          selectedManagerId,
          selectedProjectId,
          selectedStageId,
          selectedObjectId,
          selectedDepartmentId,
          selectedTeamId,
          selectedEmployeeId,
          externalSearchQuery,
          selectedStatusIds,
        })
        try {
          // Функция построения базового запроса с фильтрами
          const buildQuery = () => {
            let q = supabase
              .from('view_project_tree')
              .select('*')
            if (selectedManagerId && selectedManagerId !== 'no-manager') {
              q = q.eq('manager_id', selectedManagerId)
            } else if (selectedManagerId === 'no-manager') {
              q = q.is('manager_id', null)
            }
            if (selectedProjectId) {
              q = q.eq('project_id', selectedProjectId)
            }
            if (selectedStageId) {
              q = q.eq('stage_id', selectedStageId)
            }
            if (selectedObjectId) {
              q = q.eq('object_id', selectedObjectId)
            }
            if (selectedDepartmentId) {
              q = q.eq('responsible_department_id', selectedDepartmentId)
            }
            if (selectedTeamId) {
              q = q.eq('responsible_team_id', selectedTeamId)
            }
            if (selectedEmployeeId) {
              q = q.eq('section_responsible_id', selectedEmployeeId)
            }
            return q
          }

          // [DEBUG:PROJECTS] перед выполнением запроса фиксируем активные where-флаги
          console.log('[DEBUG:PROJECTS] tree:query:where', {
            manager:
              selectedManagerId && selectedManagerId !== 'no-manager'
                ? { op: 'eq', value: selectedManagerId }
                : selectedManagerId === 'no-manager'
                ? { op: 'is', value: null }
                : null,
            project: selectedProjectId ? { op: 'eq', value: selectedProjectId } : null,
            stage: selectedStageId ? { op: 'eq', value: selectedStageId } : null,
            object: selectedObjectId ? { op: 'eq', value: selectedObjectId } : null,
            dept: selectedDepartmentId ? { op: 'eq', value: selectedDepartmentId } : null,
            team: selectedTeamId ? { op: 'eq', value: selectedTeamId } : null,
            employee: selectedEmployeeId ? { op: 'eq', value: selectedEmployeeId } : null,
          })

          // Постраничная загрузка (лимит Supabase ~1000 строк)
          const pageSize = 1000
          let offset = 0
          let aggregated: any[] = []
          while (true) {
            const { data: page, error: pageError } = await buildQuery().range(offset, offset + pageSize - 1)
            if (pageError) {
              throw pageError
            }
            aggregated = aggregated.concat(page || [])
            console.log('[DEBUG:PROJECTS] tree:paginate', { offset, fetched: (page || []).length, total: aggregated.length })
            if (!page || page.length < pageSize) break
            offset += pageSize
            // На всякий случай ограничим до 20000
            if (offset > 20000) break
          }

          let data = aggregated

          console.log('📊 Данные из view_project_tree с фильтрацией:', data)

          // Дополнительно включаем проекты текущего менеджера без разделов, если активны орг-фильтры
          try {
            const currentUserId = useUserStore.getState().id || null
            const orgFiltersActive = Boolean(selectedDepartmentId || selectedTeamId || selectedEmployeeId)
            const managerFilterAllowsSelf = !selectedManagerId || selectedManagerId === currentUserId
            if (currentUserId && orgFiltersActive && managerFilterAllowsSelf) {
              const { data: ownProjectsNoSections, error: extraErr } = await supabase
                .from('view_project_tree')
                .select('*')
                .eq('manager_id', currentUserId)
                .is('section_id', null)

              if (!extraErr && ownProjectsNoSections && ownProjectsNoSections.length > 0) {
                const seen = new Set((data || []).map((r: any) => `${r.project_id}:${r.section_id || 'null'}`))
                ownProjectsNoSections.forEach((r: any) => {
                  const key = `${r.project_id}:${r.section_id || 'null'}`
                  if (!seen.has(key)) {
                    data.push(r)
                    seen.add(key)
                  }
                })
                console.log('[DEBUG:PROJECTS] tree:merged_with_own_projects_without_sections', { added: ownProjectsNoSections.length })
              }
            }
          } catch (e) {
            console.warn('[DEBUG:PROJECTS] tree:merge own projects failed', e)
          }

      // [DEBUG:PROJECTS] итоги сырого ответа
      const dbgUniqueProjects = new Set<string>()
      const dbgUniqueManagers = new Set<string>()
      ;(data || []).forEach((r: any) => {
        if (r.project_id) dbgUniqueProjects.add(r.project_id)
        if (r.manager_id) dbgUniqueManagers.add(r.manager_id)
      })
      console.log('[DEBUG:PROJECTS] tree:raw', {
        rows: (data || []).length,
        uniqueProjects: Array.from(dbgUniqueProjects),
        uniqueManagers: Array.from(dbgUniqueManagers),
      })

      // [DEBUG:PROJECTS] итоги сырого ответа
      const uniqueProjects = new Set<string>()
      const uniqueManagers = new Set<string>()
      ;(data || []).forEach((r: any) => {
        if (r.project_id) uniqueProjects.add(r.project_id)
        if (r.manager_id) uniqueManagers.add(r.manager_id)
      })
      console.log('[DEBUG:PROJECTS] tree:raw', {
        rows: (data || []).length,
        uniqueProjects: Array.from(uniqueProjects),
        uniqueManagers: Array.from(uniqueManagers),
      })

      // Преобразуем данные в иерархическую структуру
      const tree = buildTreeStructureFromProjectTree(data || [], showManagers, groupByClient)
      // [DEBUG:PROJECTS] размер дерева после сборки
      console.log('[DEBUG:PROJECTS] tree:built', { nodes: (tree || []).length })
      setTreeData(tree)
    } catch (error) {
      console.error('❌ Error:', error)
    } finally {
      setLoading(false)
    }
    }
    );
  }

  const buildTreeStructureFromProjectTree = (data: any[], showManagers: boolean, groupByClient: boolean): ProjectNode[] => {
    const clients = new Map<string, ProjectNode>()
    const managers = new Map<string, ProjectNode>()
    const projects = new Map<string, ProjectNode>()
    const stages = new Map<string, ProjectNode>()
    const objects = new Map<string, ProjectNode>()

    // Создаем специальную категорию для проектов без руководителя
    const NO_MANAGER_ID = 'no-manager'
    const noManagerCategory: ProjectNode = {
      id: NO_MANAGER_ID,
      name: 'Руководитель проекта не назначен',
      type: 'manager',
      children: []
    }

    // Создаем специальную категорию для проектов без заказчика
    const NO_CLIENT_ID = 'no-client'
    const noClientCategory: ProjectNode = {
      id: NO_CLIENT_ID,
      name: 'Без заказчика',
      type: 'client',
      children: []
    }

    // Обрабатываем все записи из view_project_tree
    data.forEach(row => {
      // 1. Заказчики (если включена группировка по заказчикам)
      const clientId = row.client_id || NO_CLIENT_ID
      if (groupByClient) {
        if (row.client_id && !clients.has(row.client_id)) {
          clients.set(row.client_id, {
            id: row.client_id,
            name: row.client_name || 'Неизвестный заказчик',
            type: 'client',
            children: []
          })
        }
      }

      // 2. Менеджеры
      const managerId = row.manager_id || NO_MANAGER_ID
      if (row.manager_id && !managers.has(row.manager_id)) {
        managers.set(row.manager_id, {
          id: row.manager_id,
          name: row.manager_name || 'Неизвестный руководитель проекта',
          type: 'manager',
          children: []
        })
      }

      // 3. Проекты
      if (!projects.has(row.project_id)) {
        projects.set(row.project_id, {
          id: row.project_id,
          name: row.project_name,
          type: 'project',
          managerId: managerId,
          clientId: clientId,
          projectStatus: normalizeProjectStatus(row.project_status),
          children: [],
          // Признак избранного приходит из view_project_tree
          isFavorite: Boolean(row.is_favorite)
        })
      } else {
        // Если проект уже есть, но пришёл флаг is_favorite=true — обновим
        if (row.is_favorite) {
          const p = projects.get(row.project_id)!
          if (!p.isFavorite) p.isFavorite = true
        }
      }

      // 4. Стадии
      if (row.stage_id && !stages.has(row.stage_id)) {
        stages.set(row.stage_id, {
          id: row.stage_id,
          name: row.stage_name,
          type: 'stage',
          projectId: row.project_id,
          children: [],
          children: [],
        })
      }

      // 5. Объекты
      if (row.object_id && !objects.has(row.object_id)) {
        objects.set(row.object_id, {
          id: row.object_id,
          name: row.object_name,
          type: 'object',
          stageId: row.stage_id,
          projectId: row.project_id,
          projectName: row.project_name,
          stageName: row.stage_name,
          children: [],
          children: [],
        })
      }

      // 6. Разделы
      if (row.section_id) {
        const section: ProjectNode = {
          id: row.section_id,
          name: row.section_name,
          type: 'section',
          objectId: row.object_id,
          dates: {
            start: row.section_start_date,
            end: row.section_end_date
          },
          responsibleName: row.section_responsible_name,
          responsibleAvatarUrl: row.section_responsible_avatar,
          projectName: row.project_name,
          stageName: row.stage_name,
          departmentName: row.responsible_department_name,
          // Поля статуса секции
          statusId: row.section_status_id,
          statusName: row.section_status_name,
          statusColor: row.section_status_color
        }

        // Добавляем раздел к объекту
        if (row.object_id && objects.has(row.object_id)) {
          objects.get(row.object_id)!.children!.push(section)
        }
      }
    })

    // Строим иерархию
    // Добавляем объекты к стадиям
    objects.forEach(object => {
      if (object.stageId && stages.has(object.stageId)) {
        stages.get(object.stageId)!.children!.push(object)
      }
    })

    // Добавляем стадии к проектам
    stages.forEach(stage => {
      if (stage.projectId && projects.has(stage.projectId)) {
        projects.get(stage.projectId)!.children!.push(stage)
      }
    })

    // Функция сортировки: избранные проекты первыми, затем умная сортировка по названию
    const smartSort = (a: ProjectNode, b: ProjectNode): number => {
      // 0) Избранные проекты всегда выше обычных
      const aFav = a.type === 'project' && a.isFavorite ? 1 : 0
      const bFav = b.type === 'project' && b.isFavorite ? 1 : 0
      if (aFav !== bFav) return bFav - aFav

      // Извлекаем числа из названий
      const aNumbers = a.name.match(/\d+/g)
      const bNumbers = b.name.match(/\d+/g)
      
      // Если оба содержат числа, сортируем по числам
      if (aNumbers && bNumbers) {
        const aFirstNumber = parseInt(aNumbers[0])
        const bFirstNumber = parseInt(bNumbers[0])
        if (aFirstNumber !== bFirstNumber) {
          return aFirstNumber - bFirstNumber
        }
      }
      
      // Если только одно содержит число, число идёт первым
      if (aNumbers && !bNumbers) return -1
      if (!aNumbers && bNumbers) return 1
      
      // Иначе сортируем по алфавиту
      return a.name.localeCompare(b.name, 'ru', { numeric: true })
    }

    // Рекурсивно сортируем все дочерние элементы в дереве
    const sortTreeRecursively = (nodes: ProjectNode[]): ProjectNode[] => {
      return nodes
        .sort(smartSort)
        .map(node => ({
          ...node,
          children: node.children ? sortTreeRecursively(node.children) : undefined
        }))
    }

    // Строим иерархию в зависимости от настроек группировки
    if (groupByClient) {
      // Группировка по заказчикам
      let hasProjectsWithoutClient = false

      // Добавляем проекты к заказчикам
      projects.forEach(project => {
        if (project.clientId === NO_CLIENT_ID) {
          noClientCategory.children!.push(project)
          hasProjectsWithoutClient = true
        } else if (project.clientId && clients.has(project.clientId)) {
          clients.get(project.clientId)!.children!.push(project)
        }
      })

      const result = Array.from(clients.values())
      
      // Добавляем категорию "Без заказчика" в конец списка, если есть такие проекты
      if (hasProjectsWithoutClient) {
        result.push(noClientCategory)
      }

      return sortTreeRecursively(result)
    } else {
      // Обычная группировка по менеджерам или без группировки
      let hasProjectsWithoutManager = false

      // Добавляем проекты к менеджерам
      projects.forEach(project => {
        if (project.managerId === NO_MANAGER_ID) {
          noManagerCategory.children!.push(project)
          hasProjectsWithoutManager = true
        } else if (project.managerId && managers.has(project.managerId)) {
          managers.get(project.managerId)!.children!.push(project)
        }
      })

      // Собираем результат в зависимости от showManagers
      if (!showManagers) {
        // Если не показываем менеджеров, возвращаем проекты напрямую
        const allProjects = Array.from(projects.values())
        return sortTreeRecursively(allProjects)
      }

      // Если показываем менеджеров, строим полную иерархию
      const result = Array.from(managers.values())
      
      // Добавляем категорию "Руководитель проекта не назначен" в начало списка, если есть такие проекты
      if (hasProjectsWithoutManager) {
        result.unshift(noManagerCategory)
      }

      return sortTreeRecursively(result)
    }
  }

  // Тоггл избранного проекта: insert/delete в user_favorite_projects + оптимистичное обновление
  const handleToggleFavorite = async (project: ProjectNode) => {
    try {
      const currentUserId = useUserStore.getState().id
      if (!currentUserId) {
        console.warn('Не удалось получить user_id для тоггла избранного')
        return
      }

      // Оптимистично обновим локально
      setTreeData(prev => {
        const update = (nodes: ProjectNode[]): ProjectNode[] => nodes.map(n => {
          if (n.type === 'project' && n.id === project.id) {
            return { ...n, isFavorite: !n.isFavorite }
          }
          return { ...n, children: n.children ? update(n.children) : n.children }
        })
        // Легкая пересортировка после переключения
        const sortNodes = (nodes2: ProjectNode[]): ProjectNode[] => nodes2
          .sort((a, b) => {
            const aFav = a.type === 'project' && a.isFavorite ? 1 : 0
            const bFav = b.type === 'project' && b.isFavorite ? 1 : 0
            if (aFav !== bFav) return bFav - aFav
            return a.name.localeCompare(b.name, 'ru', { numeric: true })
          })
          .map(n => ({ ...n, children: n.children ? sortNodes(n.children) : n.children }))
        return sortNodes(update(prev))
      })

      if (project.isFavorite) {
        // Был избранным -> удаляем
        const { error } = await supabase
          .from('user_favorite_projects')
          .delete()
          .eq('user_id', currentUserId)
          .eq('project_id', project.id)
        if (error) throw error
      } else {
        // Не был избранным -> добавляем
        const { error } = await supabase
          .from('user_favorite_projects')
          .insert({ user_id: currentUserId, project_id: project.id })
        if (error) throw error
      }

      // Перезагрузим данные для консистентности с БД
      await loadTreeData()
    } catch (e) {
      console.error('Ошибка переключения избранного проекта:', e)
      // В случае ошибки — перезагрузим данные из БД, чтобы не зависнуть в неверном состоянии
      await loadTreeData()
    }
  }

  const toggleNode = (nodeId: string) => {
    toggleNodeInStore(nodeId)
  }

  // Функция для сбора всех ID узлов рекурсивно
  const collectAllNodeIds = (nodes: ProjectNode[]): string[] => {
    const ids: string[] = []
    
    const traverse = (node: ProjectNode) => {
      ids.push(node.id)
      if (node.children && node.children.length > 0) {
        node.children.forEach(traverse)
      }
    }
    
    nodes.forEach(traverse)
    return ids
  }

  // Свернуть все узлы
  function collapseAllNodes() {
    // Гарантируем целевое состояние верхнего уровня: список руководителей
    // 1) выключаем группировку по заказчикам
    if (groupByClient) toggleGroupByClient()
    // 2) выключаем режим "только разделы"
    if (showOnlySections) setShowOnlySections(false)
    // 3) включаем отображение руководителей
    if (!showManagers) toggleShowManagers()
    // Закрываем все открытые узлы
    Array.from(expandedNodes).forEach(nodeId => {
      toggleNodeInStore(nodeId)
    })
  }

  // Переключить режим "только разделы"
  const toggleOnlySections = () => {
    setShowOnlySections(!showOnlySections)
  }

  // Поиск по структуре
  const filterNodesBySearch = (nodes: ProjectNode[], query: string): ProjectNode[] => {
    if (!query.trim()) {
      return nodes
    }

    const matchesQuery = (node: ProjectNode): boolean => {
      const lowerQuery = query.toLowerCase()
      return (
        node.name.toLowerCase().includes(lowerQuery) ||
        (node.responsibleName?.toLowerCase().includes(lowerQuery) ?? false) ||
        (node.projectName?.toLowerCase().includes(lowerQuery) ?? false) ||
        (node.stageName?.toLowerCase().includes(lowerQuery) ?? false) ||
        (node.departmentName?.toLowerCase().includes(lowerQuery) ?? false)
      )
    }

    const filterRecursive = (nodeList: ProjectNode[]): ProjectNode[] => {
      const filtered: ProjectNode[] = []

      for (const node of nodeList) {
        const nodeMatches = matchesQuery(node)
        let filteredChildren: ProjectNode[] = []

        if (node.children && node.children.length > 0) {
          filteredChildren = filterRecursive(node.children)
        }

        // Включаем узел если он соответствует запросу или у него есть подходящие дети
        if (nodeMatches || filteredChildren.length > 0) {
          filtered.push({
            ...node,
            children: filteredChildren
          })
        }
      }

      return filtered
    }

    return filterRecursive(nodes)
  }

  // Фильтрация по статусам (снизу вверх)
  const filterNodesByStatus = (nodes: ProjectNode[], statusIds: string[]): ProjectNode[] => {
    if (!statusIds || statusIds.length === 0) {
      return nodes // Если статусы не выбраны, возвращаем все узлы
    }

    const filterRecursive = (nodeList: ProjectNode[]): ProjectNode[] => {
      const filtered: ProjectNode[] = []

      for (const node of nodeList) {
        let shouldInclude = false
        let filteredChildren: ProjectNode[] = []

        // Если это раздел, проверяем его статус
        if (node.type === 'section') {
          shouldInclude = node.statusId ? statusIds.includes(node.statusId) : false
        } else {
          // Для остальных типов узлов фильтруем детей
          if (node.children && node.children.length > 0) {
            filteredChildren = filterRecursive(node.children)
            shouldInclude = filteredChildren.length > 0
          }
        }

        // Включаем узел если он подходит по критериям
        if (shouldInclude) {
          filtered.push({
            ...node,
            children: node.type === 'section' ? node.children : filteredChildren
          })
        }
      }

      return filtered
    }

    return filterRecursive(nodes)
  }

  // Фильтрация данных для отображения только разделов и применение поиска
  const getFilteredTreeData = (): ProjectNode[] => {
    let data = treeData
    // [DEBUG:PROJECTS] фильтрация: старт
    console.log('[DEBUG:PROJECTS] tree:filter:start', {
      treeNodes: treeData.length,
      statusFilter: selectedStatusIds,
      showOnlySections,
      searchQuery,
    })

    // Сначала применяем фильтр по статусам
    data = filterNodesByStatus(data, selectedStatusIds)

    // Затем применяем фильтр "только разделы"
    if (showOnlySections) {
      const sections: ProjectNode[] = []
      
      const traverseAndCollectSections = (nodes: ProjectNode[]) => {
        nodes.forEach(node => {
          if (node.type === 'section') {
            sections.push(node)
          }
          if (node.children && node.children.length > 0) {
            traverseAndCollectSections(node.children)
          }
        })
      }

      traverseAndCollectSections(data)
      data = sections
    }

    // Фильтр: только избранные проекты
    if (showOnlyFavorites) {
      // Оставляем только те ветки, где есть избранные проекты.
      const filterFavorites = (nodes: ProjectNode[]): ProjectNode[] => {
        const result: ProjectNode[] = []
        for (const n of nodes) {
          if (n.type === 'project') {
            if (n.isFavorite) {
              // Сохраняем проект как есть, с полным поддеревом
              result.push(n)
            }
          } else if (n.children && n.children.length > 0) {
            const filteredChildren = filterFavorites(n.children)
            if (filteredChildren.length > 0) {
              result.push({ ...n, children: filteredChildren })
            }
          }
        }
        return result
      }
      data = filterFavorites(data)
    }

    // Затем применяем поиск
    const result = filterNodesBySearch(data, searchQuery)
    // [DEBUG:PROJECTS] фильтрация: результат
    console.log('[DEBUG:PROJECTS] tree:filter:result', { nodes: result.length })
    return result
  }

  const handleAssignResponsible = (section: ProjectNode, e: React.MouseEvent) => {
    e.stopPropagation() // Предотвращаем раскрытие узла
    setSelectedSection(section)
    setShowAssignModal(true)
  }

  const handleEditProject = (project: ProjectNode, e: React.MouseEvent) => {
    e.stopPropagation() // Предотвращаем раскрытие узла
    setSelectedProject(project)
    setShowEditModal(true)
  }

  const handleDeleteProject = (project: ProjectNode, e: React.MouseEvent) => {
    e.stopPropagation() // Предотвращаем раскрытие узла
    setSelectedProject(project)
    setShowDeleteModal(true)
  }

  const handleEditStage = (stage: ProjectNode, e: React.MouseEvent) => {
    e.stopPropagation() // Предотвращаем раскрытие узла
    setSelectedStage(stage)
    setShowEditStageModal(true)
  }

  const handleEditObject = (object: ProjectNode, e: React.MouseEvent) => {
    e.stopPropagation() // Предотвращаем раскрытие узла
    setSelectedObject(object)
    setShowEditObjectModal(true)
  }

  const handleOpenSection = (section: ProjectNode, e: React.MouseEvent) => {
    e.stopPropagation() // Предотвращаем раскрытие узла
    setSelectedSectionForPanel(section)
    setShowSectionPanel(true)
  }

  const handleCreateStage = (project: ProjectNode, e: React.MouseEvent) => {
    e.stopPropagation() // Предотвращаем раскрытие узла
    setSelectedProjectForStage(project)
    setShowCreateStageModal(true)
  }

  const handleCreateObject = (stage: ProjectNode, e: React.MouseEvent) => {
    e.stopPropagation() // Предотвращаем раскрытие узла
    setSelectedStageForObject(stage)
    setShowCreateObjectModal(true)
  }

  const handleCreateSection = (object: ProjectNode, e: React.MouseEvent) => {
    e.stopPropagation() // Предотвращаем раскрытие узла
    setSelectedObjectForSection(object)
    setShowCreateSectionModal(true)
  }



  const handleCreateAssignment = (object: ProjectNode, e: React.MouseEvent) => {
    e.stopPropagation() // Предотвращаем раскрытие узла
    setSelectedObjectForAssignment(object)
    setShowCreateAssignmentModal(true)
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 border-b dark:border-b-slate-700 border-b-slate-200 overflow-hidden">
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500 mx-auto"></div>
          <p className="text-sm dark:text-slate-400 text-slate-500 mt-3">Загрузка...</p>
        </div>
      </div>
    )
  }

  const filteredData = getFilteredTreeData();

  return (
    <TooltipProvider>
      <div className="bg-white dark:bg-slate-900 border-b dark:border-b-slate-700 border-b-slate-200 overflow-hidden">
        <div>
          {filteredData.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Package className="w-6 h-6 dark:text-slate-400 text-slate-500" />
              </div>
              <p className="dark:text-slate-300 text-slate-700 font-medium">Нет данных для отображения</p>
              <p className="text-sm dark:text-slate-400 text-slate-500 mt-1">Попробуйте изменить фильтры</p>
            </div>
          ) : (
            filteredData.map((node, index) => (
              <TreeNode
                key={`root-${node.id}-${index}`}
                node={node}
                level={0}
                expandedNodes={expandedNodes}
                onToggleNode={toggleNode}
                onAssignResponsible={handleAssignResponsible}
                onEditProject={handleEditProject}
                onEditStage={handleEditStage}
                onEditObject={handleEditObject}
                onOpenSection={handleOpenSection}
                onCreateStage={handleCreateStage}
                onCreateObject={handleCreateObject}
                onCreateSection={handleCreateSection}
                onCreateAssignment={handleCreateAssignment}
                onDeleteProject={handleDeleteProject}
                onOpenProjectDashboard={onOpenProjectDashboard}
                onOpenStatusManagement={() => setShowStatusManagementModal(true)}
                statuses={statuses || []}
                onToggleFavorite={(project, e) => { e.stopPropagation(); handleToggleFavorite(project) }}
              />
            ))
          )}
        </div>
      </div>

      {/* Модальное окно назначения ответственного */}
      {showAssignModal && selectedSection && (
        <AssignResponsibleModal
          section={selectedSection}
          setShowAssignModal={setShowAssignModal}
          theme="light" // Можно сделать динамическим
        />
      )}

      {/* Модальное окно редактирования проекта */}
      {showEditModal && selectedProject && (
        <EditProjectModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false)
            setSelectedProject(null)
          }}
          projectId={selectedProject.id}
          onProjectUpdated={() => {
            loadTreeData() // Перезагружаем данные после обновления
          }}
        />
      )}

      {/* Модальное окно удаления проекта */}
      {showDeleteModal && selectedProject && (
        <DeleteProjectModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false)
            setSelectedProject(null)
          }}
          projectId={selectedProject.id}
          projectName={selectedProject.name}
          onSuccess={() => {
            setShowDeleteModal(false)
            setSelectedProject(null)
            loadTreeData() // Перезагружаем данные после удаления проекта
          }}
        />
      )}

      {/* Модальное окно редактирования стадии */}
      {showEditStageModal && selectedStage && (
        <EditStageModal
          isOpen={showEditStageModal}
          onClose={() => {
            setShowEditStageModal(false)
            setSelectedStage(null)
          }}
          stageId={selectedStage.id}
          onStageUpdated={() => {
            loadTreeData() // Перезагружаем данные после обновления
          }}
        />
      )}

      {/* Модальное окно редактирования объекта */}
      {showEditObjectModal && selectedObject && (
        <EditObjectModal
          isOpen={showEditObjectModal}
          onClose={() => {
            setShowEditObjectModal(false)
            setSelectedObject(null)
          }}
          objectId={selectedObject.id}
          onObjectUpdated={() => {
            loadTreeData() // Перезагружаем данные после обновления
          }}
        />
      )}

      {/* Боковая панель раздела */}
      {showSectionPanel && selectedSectionForPanel && (
        <SectionPanel
          isOpen={showSectionPanel}
          onClose={() => {
            setShowSectionPanel(false)
            setSelectedSectionForPanel(null)
          }}
          sectionId={selectedSectionForPanel.id}
          initialTab={highlightedSectionId ? 'comments' : (urlTab || 'overview')}
        />
      )}

      {/* Модальное окно создания стадии */}
      {showCreateStageModal && selectedProjectForStage && (
        <CreateStageModal
          isOpen={showCreateStageModal}
          onClose={() => {
            setShowCreateStageModal(false)
            setSelectedProjectForStage(null)
          }}
          projectId={selectedProjectForStage.id}
          projectName={selectedProjectForStage.name}
          onSuccess={() => {
            loadTreeData() // Перезагружаем данные после создания стадии
          }}
        />
      )}

      {/* Модальное окно создания объекта */}
      {showCreateObjectModal && selectedStageForObject && (
        <CreateObjectModal
          isOpen={showCreateObjectModal}
          onClose={() => {
            setShowCreateObjectModal(false)
            setSelectedStageForObject(null)
          }}
          stageId={selectedStageForObject.id}
          stageName={selectedStageForObject.name}
          onSuccess={() => {
            loadTreeData() // Перезагружаем данные после создания объекта
          }}
        />
      )}

      {/* Модальное окно создания раздела */}
      {showCreateSectionModal && selectedObjectForSection && (
        <CreateSectionModal
          isOpen={showCreateSectionModal}
          onClose={() => {
            setShowCreateSectionModal(false)
            setSelectedObjectForSection(null)
          }}
          objectId={selectedObjectForSection.id}
          objectName={selectedObjectForSection.name}
          projectId={selectedObjectForSection.projectId}
          onSuccess={() => {
            loadTreeData() // Перезагружаем данные после создания раздела
          }}
        />
      )}

      {/* Модальное окно управления статусами */}
      <StatusManagementModal
        isOpen={showStatusManagementModal}
        onClose={() => setShowStatusManagementModal(false)}
      />



      {/* Модальное окно создания задания для объекта */}
      {showCreateAssignmentModal && selectedObjectForAssignment && (
        <CreateObjectAssignmentModal
          isOpen={showCreateAssignmentModal}
          onClose={() => {
            setShowCreateAssignmentModal(false)
            setSelectedObjectForAssignment(null)
          }}
          objectId={selectedObjectForAssignment.id}
          objectName={selectedObjectForAssignment.name}
          projectId={selectedObjectForAssignment.projectId || ''}
          projectName={selectedObjectForAssignment.projectName || ''}
          stageId={selectedObjectForAssignment.stageId || ''}
        />
      )}

    </TooltipProvider>
  )
} 