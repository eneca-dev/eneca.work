"use client"

import React, { useState, useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { ChevronDown, ChevronRight, User, FolderOpen, Building, Package, PlusCircle, Edit, Trash2, Expand, Minimize, List, Search, Calendar, Loader2, AlertTriangle, Settings, Filter, Users, SquareStack } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useTaskTransferStore } from '@/modules/task-transfer/store'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import { useProjectsStore } from '../store'
import { Avatar, Tooltip } from './Avatar'
import { AssignResponsibleModal } from './AssignResponsibleModal'
import { EditProjectModal } from './EditProjectModal'
import { EditStageModal } from './EditStageModal'
import { CreateStageModal } from './CreateStageModal'
import { EditObjectModal } from './EditObjectModal'
import { CreateObjectModal } from './CreateObjectModal'
import { CreateSectionModal } from './CreateSectionModal'
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

interface ProjectNode {
  id: string
  name: string
  type: 'manager' | 'project' | 'stage' | 'object' | 'section' | 'client'
  managerId?: string
  projectId?: string
  stageId?: string
  objectId?: string
  clientId?: string
  children?: ProjectNode[]
  dates?: {
    start?: string
    end?: string
  }
  responsibleName?: string
  responsibleAvatarUrl?: string
  projectName?: string
  stageName?: string
  departmentName?: string
  clientName?: string
  // Поля для статуса секции
  statusId?: string
  statusName?: string
  statusColor?: string
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
  onDeleteProject: (project: ProjectNode, e: React.MouseEvent) => void
  onOpenStatusManagement: () => void
  statuses: Array<{id: string, name: string, color: string, description?: string}>
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
  onDeleteProject,
  onOpenStatusManagement,
  statuses
}) => {
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
    <div className="group/row select-none">
      <div
        className={cn(
          "flex items-center transition-colors border-b",
          "dark:border-slate-700 border-slate-200",
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
                      currentStatusName={node.statusName}
                      currentStatusColor={node.statusColor}
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
                      {formatDate(node.dates?.start) || '—'}
                      {node.dates?.start && node.dates?.end && <span className="text-blue-500 dark:text-blue-400 mx-1">-</span>}
                      {node.dates?.end && formatDate(node.dates?.end)}
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
            <span className={cn(
              "font-medium text-sm dark:text-slate-200 text-slate-800",
              node.type === 'manager' && "font-semibold"
            )}>
              {node.name}
            </span>



            {/* Кнопки редактирования для проектов */}
            {node.type === 'project' && (
              <div className="flex items-center ml-2">
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
                <button
                  onClick={(e) => onDeleteProject(node, e)}
                  className="p-1 opacity-0 group-hover/row:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-all ml-1"
                  title="Удалить проект"
                >
                  <Trash2 className="h-3 w-3 text-red-600 dark:text-red-400" />
                </button>
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
          {/* Компактный режим: вкладки Контент / Комментарии (до 2xl) */}
          <div className="2xl:hidden mb-3">
            <div className="inline-flex h-9 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-700 p-1 text-slate-600 dark:text-slate-200">
              {[
                { key: 'content', label: 'Контент' },
                { key: 'comments', label: 'Комментарии' },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setMobileTab(t.key as 'content' | 'comments')}
                  className={cn('px-3 py-1.5 text-xs rounded-sm', mobileTab === t.key ? 'bg-white dark:bg-slate-900 shadow-sm' : 'hover:text-slate-900 dark:hover:text-slate-100')}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Компактный режим: показываем выбранную вкладку */}
          {mobileTab === 'content' && (
            <div className="2xl:hidden flex flex-col gap-4 h-[80vh] max-h-[80vh] overflow-hidden">
              {/* Описание сверху, естественная высота + аналитика */}
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">Описание</div>
                    <SectionDescriptionCompact sectionId={node.id} />
                  </div>
                  {/* Аналитические показатели */}
                  <div className="flex flex-col items-end gap-1 text-xs text-slate-600 dark:text-slate-300">
                    {sectionDue && (
                      <div className="inline-flex items-center gap-2">
                        <span className="whitespace-nowrap">Дней до завершения:</span>
                        <span className="font-semibold tabular-nums">
                          {Math.max(0, Math.ceil((new Date(sectionDue).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))}
                        </span>
                      </div>
                    )}
                    {sectionTotals && (
                      <div className="inline-flex items-center gap-2">
                        <span className="whitespace-nowrap">План/Факт, ч:</span>
                        <span className="font-semibold tabular-nums">
                          {sectionTotals.planned.toFixed(1)} / {sectionTotals.actual.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* Блоки ниже: высота по содержимому */}
              <div className="flex flex-col gap-4">
                <div className="flex-1 min-h-0 overflow-hidden">
                  <SectionDecompositionTab sectionId={node.id} compact />
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
                  <SectionTasksPreview sectionId={node.id} />
                </div>
              </div>
            </div>
          )}
          {mobileTab === 'comments' && (
            <div className="2xl:hidden h-[80vh] max-h-[80vh] overflow-hidden">
              <div className="h-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 flex flex-col">
                <div className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">Комментарии</div>
                <div className="flex-1 min-h-0">
                  <CommentsPanel sectionId={node.id} autoScrollOnMount={true} />
                </div>
              </div>
            </div>
          )}

          {/* Полная версия (>=2xl): две колонки, справа комментарии */}
          <div className="hidden 2xl:flex gap-4 items-stretch">
            {/* Левая колонка: вверху описание, ниже два блока по высоте, равные комментариям */}
            <div className="flex-1 min-w-0 flex flex-col gap-4 2xl:h-[80vh] 2xl:max-h-[80vh] 2xl:overflow-hidden">
            {/* Описание сверху + аналитика */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">Описание</div>
                  <SectionDescriptionCompact sectionId={node.id} />
                </div>
                {/* Аналитические показатели */}
                <div className="flex flex-col items-end gap-1 text-xs text-slate-600 dark:text-slate-300">
                  {sectionDue && (
                    <div className="inline-flex items-center gap-2">
                      <span className="whitespace-nowrap">Дней до завершения:</span>
                      <span className="font-semibold tabular-nums">
                        {Math.max(0, Math.ceil((new Date(sectionDue).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))}
                      </span>
                    </div>
                  )}
                  {sectionTotals && (
                    <div className="inline-flex items-center gap-2">
                      <span className="whitespace-nowrap">План/Факт, ч:</span>
                      <span className="font-semibold tabular-nums">
                        {sectionTotals.planned.toFixed(1)} / {sectionTotals.actual.toFixed(1)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

              {/* Блоки ниже: высота по содержимому */}
              <div className="flex flex-col gap-4">
                {/* Декомпозиция (верхняя половина) */}
                <div className="flex-1 min-h-0 overflow-hidden">
                  <SectionDecompositionTab sectionId={node.id} compact />
                </div>

                {/* Задания (нижняя половина) */}
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
                  <SectionTasksPreview sectionId={node.id} />
                </div>
              </div>
            </div>

            {/* Правая колонка: Комментарии на всю высоту блока */}
            <div className="w-[680px] self-stretch hidden 2xl:block">
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 flex flex-col h-[80vh] max-h-[80vh] overflow-hidden">
                <div className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">Комментарии</div>
                <div className="flex-1 min-h-0">
                  <CommentsPanel sectionId={node.id} autoScrollOnMount={true} />
                </div>
              </div>
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
              onDeleteProject={onDeleteProject}
              onOpenStatusManagement={onOpenStatusManagement}
              statuses={statuses}
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
  externalSearchQuery
}: ProjectsTreeProps) {
  const [treeData, setTreeData] = useState<ProjectNode[]>([])
  const { 
    expandedNodes, 
    toggleNode: toggleNodeInStore,
    highlightedSectionId,
    clearHighlight,
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
  

  // (Убрано) локальный выпадающий фильтр статусов перемещён в верхнее меню

  // Глобальные события от верхней панели
  useEffect(() => {
    const toggleGroup = () => toggleGroupByClient()
    const toggleManagers = () => toggleShowManagers()
    const expandAll = () => expandAllNodes()
    const collapseAll = () => collapseAllNodes()
    const onlySections = () => setShowOnlySections((v) => !v)
    const openStatusManagement = () => setShowStatusManagementModal(true)

    window.addEventListener('projectsTree:toggleGroupByClient', toggleGroup as EventListener)
    window.addEventListener('projectsTree:toggleShowManagers', toggleManagers as EventListener)
    window.addEventListener('projectsTree:expandAll', expandAll as EventListener)
    window.addEventListener('projectsTree:collapseAll', collapseAll as EventListener)
    window.addEventListener('projectsTree:toggleOnlySections', onlySections as EventListener)
    window.addEventListener('projectsTree:openStatusManagement', openStatusManagement as EventListener)

    return () => {
      window.removeEventListener('projectsTree:toggleGroupByClient', toggleGroup as EventListener)
      window.removeEventListener('projectsTree:toggleShowManagers', toggleManagers as EventListener)
      window.removeEventListener('projectsTree:expandAll', expandAll as EventListener)
      window.removeEventListener('projectsTree:collapseAll', collapseAll as EventListener)
      window.removeEventListener('projectsTree:toggleOnlySections', onlySections as EventListener)
      window.removeEventListener('projectsTree:openStatusManagement', openStatusManagement as EventListener)
    }
  }, [toggleGroupByClient, toggleShowManagers])

  // Загрузка данных
  useEffect(() => {
    loadTreeData()
  }, [selectedManagerId, selectedProjectId, selectedStageId, selectedObjectId, selectedDepartmentId, selectedTeamId, selectedEmployeeId, showManagers, groupByClient])

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
        try {
          // Используем новое представление view_project_tree
          let query = supabase
            .from('view_project_tree')
            .select('*')

          // Применяем фильтры по проектной иерархии
          if (selectedManagerId && selectedManagerId !== 'no-manager') {
            query = query.eq('manager_id', selectedManagerId)
          } else if (selectedManagerId === 'no-manager') {
            query = query.is('manager_id', null)
          }
          if (selectedProjectId) {
            query = query.eq('project_id', selectedProjectId)
          }
          if (selectedStageId) {
            query = query.eq('stage_id', selectedStageId)
          }
          if (selectedObjectId) {
            query = query.eq('object_id', selectedObjectId)
          }

          // Применяем фильтры по ответственным (отделы, команды, сотрудники)
          if (selectedDepartmentId) {
            query = query.eq('responsible_department_id', selectedDepartmentId)
          }
          if (selectedTeamId) {
            query = query.eq('responsible_team_id', selectedTeamId)
          }
          if (selectedEmployeeId) {
            query = query.eq('section_responsible_id', selectedEmployeeId)
          }

          const { data, error } = await query

          if (error) {
            span.setAttribute("load.success", false)
            span.setAttribute("load.error", error.message)
            Sentry.captureException(error, {
              tags: { 
                module: 'projects', 
                action: 'load_tree_data',
                error_type: 'db_error'
              },
              extra: { 
                component: 'ProjectsTree',
                filters: {
                  manager_id: selectedManagerId,
                  project_id: selectedProjectId,
                  stage_id: selectedStageId,
                  object_id: selectedObjectId,
                  department_id: selectedDepartmentId,
                  team_id: selectedTeamId,
                  employee_id: selectedEmployeeId
                },
                timestamp: new Date().toISOString()
              }
            })
            console.error('❌ Error loading tree data:', error)
            return
          }

          console.log('📊 Данные из view_project_tree с фильтрацией:', data)

      // Преобразуем данные в иерархическую структуру
      const tree = buildTreeStructureFromProjectTree(data || [], showManagers, groupByClient)
      console.log('🌳 Построенное дерево:', tree)
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
          children: []
        })
      }

      // 4. Стадии
      if (row.stage_id && !stages.has(row.stage_id)) {
        stages.set(row.stage_id, {
          id: row.stage_id,
          name: row.stage_name,
          type: 'stage',
          projectId: row.project_id,
          children: []
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
          children: []
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

    // Функция умной сортировки для названий с числами
    const smartSort = (a: ProjectNode, b: ProjectNode): number => {
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

  // Развернуть все узлы
  const expandAllNodes = () => {
    const allNodeIds = collectAllNodeIds(getFilteredTreeData())
    allNodeIds.forEach(nodeId => {
      if (!expandedNodes.has(nodeId)) {
        toggleNodeInStore(nodeId)
      }
    })
  }

  // Свернуть все узлы
  const collapseAllNodes = () => {
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

    // Затем применяем поиск
    return filterNodesBySearch(data, searchQuery)
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
                onDeleteProject={handleDeleteProject}
                onOpenStatusManagement={() => setShowStatusManagementModal(true)}
                statuses={statuses || []}
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

    </TooltipProvider>
  )
} 