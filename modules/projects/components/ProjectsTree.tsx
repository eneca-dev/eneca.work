"use client"

import React, { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, User, FolderOpen, Building, Package, PlusCircle, Edit } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import { Avatar, Tooltip } from './Avatar'
import { AssignResponsibleModal } from './AssignResponsibleModal'
import { EditProjectModal } from './EditProjectModal'

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
}

interface TreeNodeProps {
  node: ProjectNode
  level: number
  expandedNodes: Set<string>
  onToggleNode: (nodeId: string) => void
  onAssignResponsible: (section: ProjectNode, e: React.MouseEvent) => void
  onEditProject: (project: ProjectNode, e: React.MouseEvent) => void
}

const supabase = createClient()

// Отдельный компонент для узла дерева
const TreeNode: React.FC<TreeNodeProps> = ({ 
  node, 
  level, 
  expandedNodes, 
  onToggleNode, 
  onAssignResponsible,
  onEditProject 
}) => {
  const [hoveredResponsible, setHoveredResponsible] = useState(false)
  const [hoveredAddButton, setHoveredAddButton] = useState(false)

  const hasChildren = node.children && node.children.length > 0
  const isExpanded = expandedNodes.has(node.id)

  const getNodeIcon = (type: string, nodeName?: string) => {
    // Специальная иконка для категории "Менеджер не назначен"
    if (type === 'manager' && nodeName === 'Менеджер не назначен') {
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
                      size="sm"
                    />
                  </Tooltip>
                </div>
              ) : (
                <div
                  className="cursor-pointer w-7 h-7 flex items-center justify-center rounded-full border-2 border-dashed transition-colors"
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
                      size={14}
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
            <div className="flex items-center mr-2">
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
              <span className="font-semibold text-sm dark:text-slate-200 text-slate-800">
                {node.name}
              </span>
            </div>

            {/* Дополнительная информация справа */}
            <div className="flex flex-col gap-1 ml-auto text-xs min-w-0 pr-4">
              {/* Первая строка - даты */}
              {(node.dates?.start || node.dates?.end) && (
                <div className="flex items-center gap-1 justify-end">
                  <span className="dark:text-slate-400 text-slate-500">
                    {formatDate(node.dates?.start)}
                  </span>
                  {node.dates?.start && node.dates?.end && (
                    <span className="dark:text-slate-500 text-slate-400">-</span>
                  )}
                  <span className="dark:text-slate-400 text-slate-500">
                    {formatDate(node.dates?.end)}
                  </span>
                </div>
              )}
              
              {/* Вторая строка - проект */}
              {node.projectName && (
                <div className="flex items-center justify-end">
                  <span className="dark:text-slate-500 text-slate-400 text-right">
                    {node.projectName}
                  </span>
                </div>
              )}

              {/* Третья строка - стадия */}
              {node.stageName && (
                <div className="flex items-center justify-end">
                  <span className="dark:text-slate-500 text-slate-400 text-right">
                    Стадия: {node.stageName}
                  </span>
                </div>
              )}

              {/* Четвертая строка - отдел */}
              {node.departmentName && (
                <div className="flex items-center justify-end">
                  <span className="dark:text-slate-500 text-slate-400 text-right">
                    Отдел: {node.departmentName}
                  </span>
                </div>
              )}

              {/* Пятая строка - ответственный (если есть) */}
              {node.responsibleName && (
                <div className="flex items-center justify-end">
                  <span className="dark:text-slate-400 text-slate-500 text-right">
                    {node.responsibleName}
                  </span>
                </div>
              )}
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

            {/* Кнопка редактирования для проектов */}
            {node.type === 'project' && (
              <button
                onClick={(e) => onEditProject(node, e)}
                className="ml-2 p-1 opacity-0 group-hover/row:opacity-100 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-all"
                title="Редактировать проект"
              >
                <Edit className="h-3 w-3 text-blue-600 dark:text-blue-400" />
              </button>
            )}

            {/* Даты для не-разделов */}
            {node.dates && (node.dates.start || node.dates.end) && (
              <span className="text-xs dark:text-slate-400 text-slate-500 ml-auto">
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
  selectedObjectId 
}: ProjectsTreeProps) {
  const [treeData, setTreeData] = useState<ProjectNode[]>([])
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedSection, setSelectedSection] = useState<ProjectNode | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedProject, setSelectedProject] = useState<ProjectNode | null>(null)

  // Загрузка данных
  useEffect(() => {
    loadTreeData()
  }, [selectedManagerId, selectedProjectId, selectedStageId, selectedObjectId])

  const loadTreeData = async () => {
    console.log('🌳 Загружаю данные дерева проектов...')
    console.log('🔍 Фильтры:', { selectedManagerId, selectedProjectId, selectedStageId, selectedObjectId })
    setLoading(true)
    try {
      // Используем новое представление view_project_tree
      let query = supabase
        .from('view_project_tree')
        .select('*')

      // Применяем фильтры
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

      const { data, error } = await query

      if (error) {
        console.error('❌ Error loading tree data:', error)
        return
      }

      console.log('📊 Данные из view_project_tree:', data)

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

    // Создаем специальную категорию для проектов без менеджера
    const NO_MANAGER_ID = 'no-manager'
    const noManagerCategory: ProjectNode = {
      id: NO_MANAGER_ID,
      name: 'Менеджер не назначен',
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
          name: row.manager_name || 'Неизвестный менеджер',
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

    // Собираем результат
    const result = Array.from(managers.values())
    
    // Добавляем категорию "Менеджер не назначен" в начало списка, если есть такие проекты
    if (hasProjectsWithoutManager) {
      result.unshift(noManagerCategory)
    }

    return result
  }

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId)
    } else {
      newExpanded.add(nodeId)
    }
    setExpandedNodes(newExpanded)
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

  if (treeData.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-lg border dark:border-slate-700 border-slate-200 overflow-hidden">
        <div className="p-4 border-b dark:border-slate-700 border-slate-200 bg-slate-50 dark:bg-slate-800">
          <h3 className="text-lg font-semibold dark:text-slate-200 text-slate-800">
            Структура проектов
          </h3>
        </div>
        <div className="p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <Package className="w-6 h-6 dark:text-slate-400 text-slate-500" />
          </div>
          <p className="dark:text-slate-300 text-slate-700 font-medium">Нет данных для отображения</p>
          <p className="text-sm dark:text-slate-400 text-slate-500 mt-1">Попробуйте изменить фильтры</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white dark:bg-slate-900 rounded-lg border dark:border-slate-700 border-slate-200 overflow-hidden">
        <div className="p-4 border-b dark:border-slate-700 border-slate-200 bg-slate-50 dark:bg-slate-800">
          <h3 className="text-lg font-semibold dark:text-slate-200 text-slate-800">
            Структура проектов
          </h3>
        </div>
        <div>
          {treeData.map((node, index) => (
            <TreeNode
              key={`root-${node.id}-${index}`}
              node={node}
              level={0}
              expandedNodes={expandedNodes}
              onToggleNode={toggleNode}
              onAssignResponsible={handleAssignResponsible}
              onEditProject={handleEditProject}
            />
          ))}
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
    </>
  )
} 