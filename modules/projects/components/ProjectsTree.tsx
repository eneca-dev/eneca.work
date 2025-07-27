"use client"

import React, { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, User, FolderOpen, Building, Package, PlusCircle, Edit, Trash2, Expand, Minimize, List, Search, Calendar } from 'lucide-react'
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

interface ProjectNode {
  id: string
  name: string
  type: 'manager' | 'project' | 'stage' | 'object' | 'section'
  managerId?: string
  projectId?: string
  stageId?: string
  objectId?: string
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
}

interface ProjectsTreeProps {
  selectedManagerId?: string | null
  selectedProjectId?: string | null
  selectedStageId?: string | null
  selectedObjectId?: string | null
  selectedDepartmentId?: string | null
  selectedTeamId?: string | null
  selectedEmployeeId?: string | null
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
  onDeleteProject
}) => {
  const [hoveredResponsible, setHoveredResponsible] = useState(false)
  const [hoveredAddButton, setHoveredAddButton] = useState(false)

  const hasChildren = node.children && node.children.length > 0
  const isExpanded = expandedNodes.has(node.id)

  const getNodeIcon = (type: string, nodeName?: string) => {
    // Специальная иконка для категории "Руководитель проекта не назначен"
    if (type === 'manager' && nodeName === 'Руководитель проекта не назначен') {
      return <User className="h-4 w-4 text-gray-500" />
    }
    
    switch (type) {
      case 'manager':
        return <User className="h-4 w-4 text-blue-600" />
      case 'project':
        return <FolderOpen className="h-4 w-4 text-green-600" />
      case 'stage':
        return <Building className="h-4 w-4 text-purple-600" />
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
            <div className="flex items-center" style={{ maxWidth: 'calc(100% - 360px)' }}>
              <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center mr-2">
                {hasChildren ? (
                  isExpanded ? (
                    <ChevronDown className="h-3 w-3 text-teal-500" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-teal-500" />
                  )
                ) : (
                  <div className="h-3 w-3 rounded bg-teal-500" />
                )}
              </div>
              <span 
                className="font-semibold text-sm dark:text-slate-200 text-slate-800 cursor-pointer hover:text-teal-600 dark:hover:text-teal-400 transition-colors break-words"
                onClick={(e) => onOpenSection(node, e)}
                style={{ wordBreak: 'break-word', hyphens: 'auto' }}
              >
                {node.name}
              </span>
            </div>

            {/* Информация справа с фиксированными ширинами */}
            <div className="flex items-center text-xs ml-auto mr-8">
              {/* Даты - фиксированная ширина */}
              <div className="flex items-center gap-1 w-24 justify-end">
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

              {/* Отдел - фиксированная ширина */}
              <div className="w-20 flex justify-end ml-4">
                {node.departmentName && (
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded px-2 py-1">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs text-emerald-700 dark:text-emerald-300 truncate">
                        {node.departmentName}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Проект, стадия и ответственный - фиксированная ширина */}
              <div className="w-36 flex flex-col gap-1 text-right ml-4">
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

      {hasChildren && isExpanded && (
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
  selectedEmployeeId
}: ProjectsTreeProps) {
  const [treeData, setTreeData] = useState<ProjectNode[]>([])
  const { expandedNodes, toggleNode: toggleNodeInStore } = useProjectsStore()
  const [loading, setLoading] = useState(true)
  const [showOnlySections, setShowOnlySections] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
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

  // Загрузка данных
  useEffect(() => {
    loadTreeData()
  }, [selectedManagerId, selectedProjectId, selectedStageId, selectedObjectId, selectedDepartmentId, selectedTeamId, selectedEmployeeId])

  const loadTreeData = async () => {
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
        console.error('❌ Error loading tree data:', error)
        return
      }

      console.log('📊 Данные из view_project_tree с фильтрацией:', data)

      // Преобразуем данные в иерархическую структуру
      const tree = buildTreeStructureFromProjectTree(data || [])
      console.log('🌳 Построенное дерево:', tree)
      setTreeData(tree)
    } catch (error) {
      console.error('❌ Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const buildTreeStructureFromProjectTree = (data: any[]): ProjectNode[] => {
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

    // Обрабатываем все записи из view_project_tree
    data.forEach(row => {
      // 1. Менеджеры
      const managerId = row.manager_id || NO_MANAGER_ID
      if (row.manager_id && !managers.has(row.manager_id)) {
        managers.set(row.manager_id, {
          id: row.manager_id,
          name: row.manager_name || 'Неизвестный руководитель проекта',
          type: 'manager',
          children: []
        })
      }

      // 2. Проекты
      if (!projects.has(row.project_id)) {
        projects.set(row.project_id, {
          id: row.project_id,
          name: row.project_name,
          type: 'project',
          managerId: managerId,
          children: []
        })
      }

      // 3. Стадии
      if (row.stage_id && !stages.has(row.stage_id)) {
        stages.set(row.stage_id, {
          id: row.stage_id,
          name: row.stage_name,
          type: 'stage',
          projectId: row.project_id,
          children: []
        })
      }

      // 4. Объекты
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

      // 5. Разделы
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
          departmentName: row.responsible_department_name
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

    // Добавляем проекты к менеджерам
    let hasProjectsWithoutManager = false

    projects.forEach(project => {
      if (project.managerId === NO_MANAGER_ID) {
        noManagerCategory.children!.push(project)
        hasProjectsWithoutManager = true
      } else if (project.managerId && managers.has(project.managerId)) {
        managers.get(project.managerId)!.children!.push(project)
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

    // Собираем результат
    const result = Array.from(managers.values())
    
    // Добавляем категорию "Руководитель проекта не назначен" в начало списка, если есть такие проекты
    if (hasProjectsWithoutManager) {
      result.unshift(noManagerCategory)
    }

    // Применяем сортировку ко всему дереву
    return sortTreeRecursively(result)
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

  // Фильтрация данных для отображения только разделов и применение поиска
  const getFilteredTreeData = (): ProjectNode[] => {
    let data = treeData

    // Сначала применяем фильтр "только разделы"
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
      <div className="bg-white dark:bg-slate-900 rounded-lg border dark:border-slate-700 border-slate-200 overflow-hidden">
        <div className="p-4 border-b dark:border-slate-700 border-slate-200 bg-slate-50 dark:bg-slate-800">
          <h3 className="text-lg font-semibold dark:text-slate-200 text-slate-800">
            Структура проектов
          </h3>
        </div>
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500 mx-auto"></div>
          <p className="text-sm dark:text-slate-400 text-slate-500 mt-3">Загрузка структуры проектов...</p>
        </div>
      </div>
    )
  }

  const filteredData = getFilteredTreeData();

  return (
    <>
      <div className="bg-white dark:bg-slate-900 rounded-lg border dark:border-slate-700 border-slate-200 overflow-hidden">
        <div className="p-4 border-b dark:border-slate-700 border-slate-200 bg-slate-50 dark:bg-slate-800">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold dark:text-slate-200 text-slate-800">
              Структура проектов
            </h3>
            <div className="flex items-center gap-3">
              {/* Поиск по структуре */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Поиск по структуре..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-sm border rounded-md w-64 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
                <Search 
                  size={16} 
                  className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                  >
                    ×
                  </button>
                )}
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={toggleOnlySections}
                  title={showOnlySections ? "Показать всю структуру" : "Только разделы"}
                  className={cn(
                    "flex items-center justify-center p-2 rounded-md h-8 w-8 transition-colors",
                    showOnlySections
                      ? "bg-purple-500/20 text-purple-600 hover:bg-purple-500/30 dark:bg-purple-500/30 dark:text-purple-400 dark:hover:bg-purple-500/40"
                      : "bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 dark:bg-purple-500/20 dark:text-purple-400 dark:hover:bg-purple-500/30"
                  )}
                >
                  <List size={14} />
                </button>
                <button
                  onClick={expandAllNodes}
                  title="Развернуть все"
                  className="flex items-center justify-center p-2 rounded-md h-8 w-8 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400 dark:hover:bg-emerald-500/30 transition-colors"
                >
                  <Expand size={14} />
                </button>
                <button
                  onClick={collapseAllNodes}
                  title="Свернуть все"
                  className="flex items-center justify-center p-2 rounded-md h-8 w-8 bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 dark:bg-orange-500/20 dark:text-orange-400 dark:hover:bg-orange-500/30 transition-colors"
                >
                  <Minimize size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
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

    </>
  )
} 