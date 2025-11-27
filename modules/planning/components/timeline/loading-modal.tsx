"use client"

import type React from "react"
import * as Sentry from "@sentry/nextjs"
import { cn } from "@/lib/utils"
import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import type { Loading, Employee, Section } from "../../types"
import { useUiStore } from "@/stores/useUiStore"
import { useUserStore } from "@/stores/useUserStore"
import { usePlanningStore } from "../../stores/usePlanningStore"
import { useProjectsStore } from "@/modules/projects/store"
import { supabase } from "@/lib/supabase-client"
import { Avatar } from "../avatar"
import { SectionPanel } from "@/components/modals/SectionPanel"
import { useSectionStatuses } from "@/modules/statuses-tags/statuses/hooks/useSectionStatuses"
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileUser, FilePlus, RefreshCw, Search, SquareStack, Package, CircleDashed, ExternalLink, Trash2, FilePenLine, X } from "lucide-react"
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { DateRangePicker, type DateRange } from "@/modules/projects/components/DateRangePicker"
import { useCalendarEvents } from "@/modules/calendar/hooks/useCalendarEvents"
import { calculateWorkingDays } from "../../utils/working-days"

// Project with department info (from view_projects_with_department_info)
interface ProjectWithDepartmentInfo {
  project_id: string
  project_name: string
  project_description: string | null
  project_status: string
  project_created: string
  project_updated: string
  department_ids: string[] | null
  sections_count: number
}

// View row structure
interface ProjectTreeViewRow {
  project_id: string
  project_name: string
  project_description: string | null
  project_status: string
  stage_id: string | null
  stage_name: string | null
  object_id: string | null
  object_name: string | null
  section_id: string | null
  section_name: string | null
  section_responsible_id: string | null
  responsible_department_id: string | null
  responsible_department_name: string | null
  decomposition_stage_id: string | null
  decomposition_stage_name: string | null
  decomposition_stage_order: number | null
  loading_id: string | null
  loading_start: string | null
  loading_finish: string | null
  loading_rate: number | null
  loading_status: string | null
  loading_comment: string | null
  loading_responsible_id: string | null
  loading_responsible_full_name: string | null
  loading_responsible_avatar: string | null
  loading_responsible_team_name: string | null
  loading_responsible_department_id: string | null
  loading_responsible_department_name: string | null
}

// FileTree node structure
interface FileTreeNode {
  id: string
  name: string
  type: "file" | "folder"
  children?: FileTreeNode[]
  parentId?: string
  // Metadata for reconstruction
  projectId?: string
  stageId?: string
  objectId?: string
  sectionId?: string
  decompositionStageId?: string
  loadingId?: string // For loading nodes
  loading?: Loading // Full loading object for edit mode
  isUnsaved?: boolean // Flag for unsaved loading node
  isNavigationNode?: boolean // Flag for navigation node (e.g., "Перейти к декомпозиции")
}

interface LoadingModalProps {
  isOpen: boolean
  onClose: () => void
  theme: string
  mode: "create" | "edit"
  // For create mode
  employee?: Employee
  section?: Section
  stageId?: string
  stageName?: string
  defaultStartDate?: Date | string
  defaultEndDate?: Date | string
  defaultRate?: number
  // For edit mode
  loading?: Loading
}

interface EmployeeSearchResult {
  user_id: string
  first_name: string
  last_name: string
  full_name: string
  email: string
  position_name: string | null
  avatar_url: string | null
  team_name: string | null
  department_name: string | null
  employment_rate: number | null
}

const RATES = [0.2, 0.25, 0.5, 0.75, 1]
const DROPDOWN_MAX_HEIGHT_PX = 256

export function LoadingModal({
  isOpen,
  onClose,
  theme,
  mode,
  employee,
  section,
  stageId,
  stageName,
  defaultStartDate,
  defaultEndDate,
  defaultRate,
  loading,
}: LoadingModalProps) {
  const router = useRouter()
  const selectSection = useProjectsStore((state) => state.selectSection)

  // Get current user's department for filtering
  const userDepartmentId = useUserStore((state) =>
    state.profile?.departmentId || state.profile?.department_id
  )

  // State tracking
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Refs for timeouts
  const successTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Store functions
  const setNotification = useUiStore((state) => state.setNotification)
  const clearNotification = useUiStore((state) => state.clearNotification)
  const createLoadingInStore = usePlanningStore((state) => state.createLoading)
  const updateLoadingInStore = usePlanningStore((state) => state.updateLoading)
  const deleteLoadingInStore = usePlanningStore((state) => state.deleteLoading)
  const archiveLoadingInStore = usePlanningStore((state) => state.archiveLoading)
  const toggleSectionExpanded = usePlanningStore((state) => state.toggleSectionExpanded)

  // Helper function for date formatting
  const formatLocalYMD = useCallback((date: Date): string | null => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }, [])

  const normalizeDateValue = useCallback((val?: Date | string) => {
    if (!val) return null
    try {
      if (typeof val === "string") {
        if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val
        const d = new Date(val)
        return formatLocalYMD(d)
      }
      return formatLocalYMD(val)
    } catch {
      return null
    }
  }, [formatLocalYMD])

  // Helper function to format date string to DD.MM.YYYY
  const formatDateDisplay = useCallback((dateString: string): string => {
    if (!dateString) return ""
    // dateString is in format YYYY-MM-DD
    const [year, month, day] = dateString.split("-")
    return `${day}.${month}.${year}`
  }, [])

  // Form data initialization
  const [formData, setFormData] = useState({
    startDate:
      mode === "edit" && loading
        ? normalizeDateValue(loading.startDate) || formatLocalYMD(new Date())!
        : normalizeDateValue(defaultStartDate) || formatLocalYMD(new Date())!,
    endDate:
      mode === "edit" && loading
        ? normalizeDateValue(loading.endDate) || formatLocalYMD(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))!
        : normalizeDateValue(defaultEndDate) || formatLocalYMD(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))!,
    rate: mode === "edit" && loading ? loading.rate ?? 1 : defaultRate ?? 1,
    comment: mode === "edit" && loading ? loading.comment || "" : "",
  })

  // Separate state for manual rate input field
  const [manualRateInput, setManualRateInput] = useState("")
  const [manualRateError, setManualRateError] = useState("")

  // FileTree state
  const [treeData, setTreeData] = useState<FileTreeNode[]>([])
  const [isLoadingTree, setIsLoadingTree] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [selectedNode, setSelectedNode] = useState<FileTreeNode | null>(null)
  const [breadcrumbs, setBreadcrumbs] = useState<FileTreeNode[]>([])

  // Cache for project data from view
  const [projectDataCache, setProjectDataCache] = useState<Map<string, ProjectTreeViewRow[]>>(new Map())

  // Employee state
  const [employees, setEmployees] = useState<EmployeeSearchResult[]>([])
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false)
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("")
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false)

  // Project search state
  const [projectSearchTerm, setProjectSearchTerm] = useState("")

  // View mode state: "my" (Мои проекты) or "all" (Все проекты)
  // Edit mode always starts with "all" to avoid unnecessary filtering
  const [viewMode, setViewMode] = useState<"my" | "all">(mode === "edit" ? "all" : "my")

  // Очередь для отложенных вызовов buildFileTree
  const [pendingBuildQueue, setPendingBuildQueue] = useState<Array<{ viewMode: "my" | "all" }>>([])

  // Store original employee from props for restoration after creation
  const originalEmployeeRef = useRef<EmployeeSearchResult | null>(
    mode === "create" && employee
      ? {
          user_id: employee.id,
          first_name: employee.firstName || "",
          last_name: employee.lastName || "",
          full_name: employee.fullName || employee.name || "",
          email: employee.email || "",
          position_name: employee.position ?? null,
          avatar_url: employee.avatarUrl ?? null,
          team_name: employee.teamName ?? null,
          department_name: null,
          employment_rate: null,
        }
      : null,
  )

  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeSearchResult | null>(
    originalEmployeeRef.current
  )

  // Dropdown positioning
  const inputWrapperRef = useRef<HTMLDivElement>(null)
  const [dropdownPosition, setDropdownPosition] = useState<{
    left: number
    top: number
    width: number
    openUp: boolean
  } | null>(null)

  // SectionPanel state
  const [showSectionPanel, setShowSectionPanel] = useState(false)
  const [sectionPanelSectionId, setSectionPanelSectionId] = useState<string | null>(null)
  const [sectionPanelProjectId, setSectionPanelProjectId] = useState<string | null>(null)
  const { statuses } = useSectionStatuses()

  // Calendar events for working days calculation
  const { events: calendarEvents, fetchEvents } = useCalendarEvents()

  // State for creating stages
  const [isCreatingStage, setIsCreatingStage] = useState(false)

  // State for refresh operations
  const [refreshingProjects, setRefreshingProjects] = useState<Set<string>>(new Set())
  const [isRefreshingAll, setIsRefreshingAll] = useState(false)

  // State for controlling stage change in edit mode
  const [isChangingStage, setIsChangingStage] = useState(false)

  // State for controlling form display in create mode (two-step process)
  const [showCreateForm, setShowCreateForm] = useState(false)
  // Flag for tracking when user is selecting a new stage (keeps form visible, unlocks tree)
  const [isSelectingNewStage, setIsSelectingNewStage] = useState(false)

  // Ref to prevent concurrent buildFileTree calls
  const isLoadingTreeRef = useRef(false)
  const hasLoadedTreeRef = useRef(false)

  // Ref to store original values in edit mode for change detection
  const originalValuesRef = useRef({
    startDate: "",
    endDate: "",
    rate: 0,
    comment: "",
    employeeId: "",
    stageId: "",
  })

  // State for tracking pending stage selection after viewMode switch
  const [pendingStageSelection, setPendingStageSelection] = useState<{
    stageId: string
    projectId: string
  } | null>(null)

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current)
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current)
      if (dropdownTimeoutRef.current) clearTimeout(dropdownTimeoutRef.current)
    }
  }, [])


  // Track which nodes are currently loading
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set())

  // Build initial FileTree with projects only
  const buildFileTree = useCallback(async () => {
    // Prevent concurrent calls - добавить в очередь вместо отклонения
    if (isLoadingTreeRef.current) {
      // Добавить в очередь только если там ещё нет задачи с таким же viewMode
      setPendingBuildQueue((prev) => {
        const hasSameTask = prev.some((task) => task.viewMode === viewMode)
        if (hasSameTask) {
          return prev
        }
        return [...prev, { viewMode }]
      })
      return
    }

    console.log("[LoadingModal] buildFileTree started:", viewMode)

    isLoadingTreeRef.current = true
    setIsLoadingTree(true)

    await Sentry.startSpan(
      {
        op: "db.query",
        name: "Загрузка списка проектов для модального окна",
      },
      async (span) => {
        try {
          span.setAttribute("modal_mode", mode)

          // Fetch projects with department information
          const { data: projects, error: projectsError } = await supabase
            .from("view_projects_with_department_info")
            .select("*")
            .order("project_name")

          if (projectsError) throw projectsError

          // Filter projects by department in "my" mode
          let filteredProjects = projects as ProjectWithDepartmentInfo[] | null
          if (viewMode === "my" && userDepartmentId) {
            filteredProjects = projects?.filter(
              (p) => Array.isArray(p.department_ids) && p.department_ids.includes(userDepartmentId)
            ) || null
          }

          // Create tree with projects only (no children loaded yet)
          const tree: FileTreeNode[] = (filteredProjects || []).map((project) => ({
            id: `project-${project.project_id}`,
            name: project.project_name,
            type: "folder" as const,
            children: [], // Empty initially, will be loaded on expand
            projectId: project.project_id,
          }))

          span.setAttribute("db.success", true)
          span.setAttribute("projects_count", tree.length)

          console.log("[LoadingModal] buildFileTree completed:", tree.length, "projects")

          setTreeData(tree)
        } catch (error) {
          span.setAttribute("db.success", false)
          span.setAttribute("db.error", error instanceof Error ? error.message : "Unknown error")

          console.warn("[LoadingModal] Ошибка при загрузке проектов:", error)

          Sentry.captureException(error, {
            tags: {
              module: "planning",
              action: "build_file_tree",
              modal: "loading_modal",
            },
            extra: {
              mode,
              employee_id: employee?.id,
              section_id: section?.id,
              loading_id: loading?.id,
              timestamp: new Date().toISOString(),
            },
          })

          setNotification("Ошибка при загрузке списка проектов")
          errorTimeoutRef.current = setTimeout(() => clearNotification(), 5000)
        } finally {
          setIsLoadingTree(false)
          isLoadingTreeRef.current = false
          hasLoadedTreeRef.current = true

          // Обработка очереди - выполнить следующую задачу
          setPendingBuildQueue((currentQueue) => {
            if (currentQueue.length > 0) {
              const nextTask = currentQueue[0]
              const remainingQueue = currentQueue.slice(1)

              console.log("[LoadingModal] Processing queued task:", nextTask.viewMode)

              // Выполнить следующую задачу асинхронно
              setTimeout(() => {
                // Временно изменить viewMode для выполнения задачи
                setViewMode(nextTask.viewMode)
              }, 0)

              return remainingQueue
            }

            return currentQueue
          })
        }
      },
    )
  }, [mode, setNotification, clearNotification, viewMode, userDepartmentId, employee, section, loading])

  // Helper: Build stage nodes from view data
  const buildStageNodes = useCallback((data: ProjectTreeViewRow[], projectId: string): FileTreeNode[] => {
    const stageMap = new Map<string, FileTreeNode>()

    data.forEach((row) => {
      if (row.stage_id && !stageMap.has(row.stage_id)) {
        stageMap.set(row.stage_id, {
          id: `stage-${row.stage_id}`,
          name: row.stage_name!,
          type: "folder",
          parentId: `project-${projectId}`,
          children: [],
          stageId: row.stage_id,
          projectId,
        })
      }
    })

    return Array.from(stageMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [])

  // Helper: Build object nodes from view data
  const buildObjectNodes = useCallback((data: ProjectTreeViewRow[], stageId: string, projectId: string): FileTreeNode[] => {
    const objectMap = new Map<string, FileTreeNode>()

    data.forEach((row) => {
      if (row.stage_id === stageId && row.object_id && !objectMap.has(row.object_id)) {
        objectMap.set(row.object_id, {
          id: `object-${row.object_id}`,
          name: row.object_name!,
          type: "folder",
          parentId: `stage-${stageId}`,
          children: [],
          objectId: row.object_id,
          stageId,
          projectId,
        })
      }
    })

    return Array.from(objectMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [])

  // Helper: Build section nodes from view data
  const buildSectionNodes = useCallback((data: ProjectTreeViewRow[], objectId: string, stageId: string, projectId: string): FileTreeNode[] => {
    const sectionMap = new Map<string, FileTreeNode>()

    data.forEach((row) => {
      if (row.object_id === objectId && row.section_id && !sectionMap.has(row.section_id)) {
        sectionMap.set(row.section_id, {
          id: `section-${row.section_id}`,
          name: row.section_name!,
          type: "folder",
          parentId: `object-${objectId}`,
          children: [],
          sectionId: row.section_id,
          objectId,
          stageId,
          projectId,
        })
      }
    })

    return Array.from(sectionMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [])

  // Helper: Build decomposition stage nodes from view data
  const buildDecompositionStageNodes = useCallback((data: ProjectTreeViewRow[], sectionId: string, objectId: string, stageId: string, projectId: string): FileTreeNode[] => {
    const decompMap = new Map<string, FileTreeNode>()

    data.forEach((row) => {
      if (row.section_id === sectionId && row.decomposition_stage_id && !decompMap.has(row.decomposition_stage_id)) {
        decompMap.set(row.decomposition_stage_id, {
          id: `decomp-${row.decomposition_stage_id}`,
          name: row.decomposition_stage_name!,
          type: "file",
          parentId: `section-${sectionId}`,
          decompositionStageId: row.decomposition_stage_id,
          sectionId,
          objectId,
          stageId,
          projectId,
        })
      }
    })

    return Array.from(decompMap.values()).sort((a, b) => (a.name || "").localeCompare(b.name || ""))
  }, [])


  // Load children for a specific node using optimized view
  // Returns: true if children were loaded successfully, false if no children after filtering
  const loadNodeChildren = useCallback(async (node: FileTreeNode, forceRefresh = false): Promise<boolean> => {
    console.log(`🔵 loadNodeChildren ВЫЗВАН: node.id="${node.id}", node.name="${node.name}", projectId="${node.projectId}", forceRefresh=${forceRefresh}`)

    if (!node.projectId || loadingNodes.has(node.id)) {
      console.log(`🔴 loadNodeChildren РАННИЙ ВЫХОД: projectId=${!!node.projectId}, isLoading=${loadingNodes.has(node.id)}`)
      return false
    }

    setLoadingNodes((prev) => new Set(prev).add(node.id))

    try {
      // Check cache first (unless forceRefresh is true)
      const cacheKey = `${node.projectId}-${viewMode}`
      let projectData = forceRefresh ? null : projectDataCache.get(cacheKey)

      if (!projectData) {
        console.log(`💾 Кеш ПУСТОЙ, загружаем данные из БД для проекта ${node.projectId}`)
        // Fetch all project data from view in ONE query
        const { data, error } = await supabase
          .from("view_project_tree_with_loadings")
          .select("*")
          .eq("project_id", node.projectId)

        if (error) throw error

        let fetchedData = (data as ProjectTreeViewRow[]) || []

        console.log('┌─────────────────────────────────────────────────────────────')
        console.log('│ 🔍 loadNodeChildren - ФИЛЬТРАЦИЯ ДАННЫХ')
        console.log('├─────────────────────────────────────────────────────────────')
        console.log(`│ Проект: ${node.name} (${node.projectId})`)
        console.log(`│ Режим viewMode: ${viewMode}`)
        console.log(`│ User Department ID: ${userDepartmentId}`)
        console.log(`│ Всего строк из БД: ${fetchedData.length}`)
        console.log('├─────────────────────────────────────────────────────────────')

        // Group sections for logging
        const uniqueSections = new Map<string, { name: string; dept_id: string | null }>()
        fetchedData.forEach(row => {
          if (row.section_id && !uniqueSections.has(row.section_id)) {
            uniqueSections.set(row.section_id, {
              name: row.section_name || 'Unnamed',
              dept_id: row.responsible_department_id
            })
          }
        })

        console.log(`│ Уникальных разделов ДО фильтрации: ${uniqueSections.size}`)
        uniqueSections.forEach((info, sectionId) => {
          console.log(`│   - ${info.name} (dept: ${info.dept_id})`)
        })
        console.log('├─────────────────────────────────────────────────────────────')

        // Apply department filter in "my projects" mode
        if (viewMode === "my" && userDepartmentId) {
          const beforeCount = fetchedData.length

          fetchedData = fetchedData.filter(row =>
            row.section_id && row.responsible_department_id === userDepartmentId
          )

          const afterCount = fetchedData.length

          console.log(`│ 🔍 ФИЛЬТРАЦИЯ "МОИ ПРОЕКТЫ"`)
          console.log(`│   Строк ДО фильтрации: ${beforeCount}`)
          console.log(`│   Строк ПОСЛЕ фильтрации: ${afterCount}`)
          console.log(`│   Отфильтровано строк: ${beforeCount - afterCount}`)
          console.log('├─────────────────────────────────────────────────────────────')

          // Group sections after filtering
          const filteredSections = new Map<string, { name: string; dept_id: string | null }>()
          fetchedData.forEach(row => {
            if (row.section_id && !filteredSections.has(row.section_id)) {
              filteredSections.set(row.section_id, {
                name: row.section_name || 'Unnamed',
                dept_id: row.responsible_department_id
              })
            }
          })

          console.log(`│ Уникальных разделов ПОСЛЕ фильтрации: ${filteredSections.size}`)
          filteredSections.forEach((info, sectionId) => {
            console.log(`│   ✅ ${info.name} (dept: ${info.dept_id})`)
          })

          // Show which sections were filtered out
          const removedSections: string[] = []
          uniqueSections.forEach((info, sectionId) => {
            if (!filteredSections.has(sectionId)) {
              removedSections.push(`${info.name} (dept: ${info.dept_id})`)
            }
          })

          if (removedSections.length > 0) {
            console.log('├─────────────────────────────────────────────────────────────')
            console.log(`│ ❌ ОТФИЛЬТРОВАННЫЕ РАЗДЕЛЫ: ${removedSections.length}`)
            removedSections.forEach(section => {
              console.log(`│   ❌ ${section}`)
            })
          }
        }

        console.log('└─────────────────────────────────────────────────────────────')

        projectData = fetchedData

        // Cache the filtered result
        setProjectDataCache((prev) => new Map(prev).set(cacheKey, projectData!))
      } else {
        console.log(`💾 Используем данные из КЕША для проекта ${node.projectId} (${projectData.length} строк)`)
      }

      // Build tree structure from cached data
      console.log(`📊 projectData rows перед buildStageNodes: ${projectData.length}`)
      if (projectData.length > 0) {
        console.log(`📊 Первая строка projectData:`, {
          stage_id: projectData[0].stage_id,
          stage_name: projectData[0].stage_name,
          object_id: projectData[0].object_id,
          section_id: projectData[0].section_id,
          section_name: projectData[0].section_name,
          decomposition_stage_id: projectData[0].decomposition_stage_id
        })
      }
      const stageNodes = buildStageNodes(projectData, node.projectId)
      console.log(`📊 stageNodes построено: ${stageNodes.length}`)

      // Build full hierarchy
      let totalObjectNodes = 0
      let totalSectionNodes = 0
      let totalDecompNodes = 0

      for (const stageNode of stageNodes) {
        const objectNodes = buildObjectNodes(projectData, stageNode.stageId!, node.projectId)
        totalObjectNodes += objectNodes.length

        for (const objectNode of objectNodes) {
          const sectionNodes = buildSectionNodes(projectData, objectNode.objectId!, stageNode.stageId!, node.projectId)
          totalSectionNodes += sectionNodes.length

          for (const sectionNode of sectionNodes) {
            const decompNodes = buildDecompositionStageNodes(
              projectData,
              sectionNode.sectionId!,
              objectNode.objectId!,
              stageNode.stageId!,
              node.projectId
            )
            totalDecompNodes += decompNodes.length

            // Create navigation node to open SectionPanel
            const navigationNode: FileTreeNode = {
              id: `nav-${sectionNode.sectionId}`,
              name: "Перейти к декомпозиции",
              type: "file",
              parentId: sectionNode.id,
              sectionId: sectionNode.sectionId,
              objectId: sectionNode.objectId,
              stageId: sectionNode.stageId,
              projectId: sectionNode.projectId,
              isNavigationNode: true,
            }

            // Add navigation node BEFORE decomposition stages
            sectionNode.children = [navigationNode, ...decompNodes]
          }

          objectNode.children = sectionNodes
        }

        stageNode.children = objectNodes
      }

      // Update tree with loaded children
      setTreeData((prevTree) => {
        const updateNode = (nodes: FileTreeNode[]): FileTreeNode[] => {
          return nodes.map((n) => {
            if (n.id === node.id) {
              return { ...n, children: stageNodes }
            }
            if (n.children) {
              return { ...n, children: updateNode(n.children) }
            }
            return n
          })
        }
        return updateNode(prevTree)
      })

      // Return true if we have children, false otherwise
      const hasChildren = stageNodes.length > 0
      console.log(`📊 loadNodeChildren ВОЗВРАЩАЕТ hasChildren: ${hasChildren} (stageNodes.length = ${stageNodes.length})`)
      return hasChildren
    } catch (error) {
      console.error("[LoadingModal] Ошибка при загрузке данных проекта:", error)
      console.log(`🔴 loadNodeChildren ВОЗВРАЩАЕТ false из-за ОШИБКИ`)
      Sentry.captureException(error, {
        tags: {
          module: "planning",
          action: "load_node_children_optimized",
          modal: "loading_modal",
        },
        extra: {
          node_id: node.id,
          project_id: node.projectId,
        },
      })
      return false
    } finally {
      setLoadingNodes((prev) => {
        const next = new Set(prev)
        next.delete(node.id)
        return next
      })
    }
  }, [loadingNodes, projectDataCache, buildStageNodes, buildObjectNodes, buildSectionNodes, buildDecompositionStageNodes, viewMode, userDepartmentId])

  // Clear cache for a project and reload its data
  const clearProjectCache = useCallback((projectId: string) => {
    setProjectDataCache((prev) => {
      const next = new Map(prev)
      // Очистить ОБА варианта ключа (my и all)
      next.delete(`${projectId}-my`)
      next.delete(`${projectId}-all`)
      return next
    })
  }, [])

  // Switch to "All Projects" mode when stage not found in "My Projects"
  const switchToAllProjects = useCallback((targetStageId: string, projectId: string) => {
    // НЕ очищаем кеш - теперь у нас разные ключи для "my" и "all"
    // Это позволит избежать конфликтов при переключении режимов

    // Сохраняем информацию о том, что нужно выбрать после переключения
    setPendingStageSelection({ stageId: targetStageId, projectId })

    // Переключаем режим (это триггернет useEffect для перезагрузки)
    setViewMode("all")

    // Показываем уведомление
    setNotification("Этап не найден в ваших проектах. Переключение на 'Все проекты'...")
    setTimeout(() => clearNotification(), 3000)
  }, [setNotification, clearNotification])


  // Helper function to find and select a decomposition stage node by ID
  const findAndSelectNode = useCallback((decompositionStageId: string, projectId?: string) => {
    console.log('┌─────────────────────────────────────────────────────────────')
    console.log('│ 🔎 findAndSelectNode')
    console.log('├─────────────────────────────────────────────────────────────')
    console.log(`│ Ищем decompositionStageId: ${decompositionStageId}`)
    console.log(`│ В проекте: ${projectId}`)
    console.log(`│ TreeData nodes: ${treeData.length}`)

    // НОВЫЙ ЛОГ: Проверяем состояние проектного узла
    if (projectId) {
      const projectNode = treeData.find(n => n.projectId === projectId)
      console.log(`│ 📊 Project node found: ${!!projectNode}`)
      if (projectNode) {
        console.log(`│ 📊 Project node children: ${projectNode.children?.length ?? 'undefined'}`)
      }
    }

    console.log('└─────────────────────────────────────────────────────────────')

    const findNodeById = (nodes: FileTreeNode[], id: string): FileTreeNode | null => {
      for (const node of nodes) {
        if (node.decompositionStageId === id) {
          console.log(`✅ НАЙДЕН узел: ${node.name} (${node.id})`)
          return node
        }
        if (node.children) {
          const found = findNodeById(node.children, id)
          if (found) return found
        }
      }
      return null
    }

    const targetNode = findNodeById(treeData, decompositionStageId)

    if (!targetNode) {
      console.log('❌ Узел НЕ НАЙДЕН в дереве')
      console.log(`   ViewMode: ${viewMode}`)
      console.log(`   Будет переключение на "Все проекты"...`)
    }

    if (targetNode) {

      // Expand all parent folders
      const expandPath = (node: FileTreeNode) => {
        const path: string[] = []
        let current: FileTreeNode | undefined = node

        while (current) {
          if (current.parentId) {
            path.push(current.parentId)
          }
          // Find parent in tree
          const findParent = (nodes: FileTreeNode[], childId: string): FileTreeNode | undefined => {
            for (const n of nodes) {
              if (n.id === childId) return undefined
              if (n.children) {
                for (const child of n.children) {
                  if (child.id === childId) return n
                }
                const found = findParent(n.children, childId)
                if (found) return found
              }
            }
            return undefined
          }
          current = findParent(treeData, current.id)
        }

        return path
      }

      const pathToExpand = expandPath(targetNode)
      // Also expand the target node itself to show its loadings
      const foldersToExpand = new Set([...pathToExpand, targetNode.id])
      setExpandedFolders(foldersToExpand)
      setSelectedNode(targetNode)

      // Build breadcrumbs
      const buildBreadcrumbs = (node: FileTreeNode): FileTreeNode[] => {
        const path: FileTreeNode[] = [node]
        let current = node

        const findParentNode = (nodes: FileTreeNode[], childId: string): FileTreeNode | null => {
          for (const n of nodes) {
            if (n.children) {
              for (const child of n.children) {
                if (child.id === childId) return n
              }
              const found = findParentNode(n.children, childId)
              if (found) return found
            }
          }
          return null
        }

        while (current.parentId) {
          const parent = findParentNode(treeData, current.id)
          if (parent) {
            path.unshift(parent)
            current = parent
          } else {
            break
          }
        }

        return path
      }

      const breadcrumbs = buildBreadcrumbs(targetNode)
      setBreadcrumbs(breadcrumbs)

    } else {
      // Если не найден в режиме "Мои проекты" - переключаемся на "Все проекты"
      // Edit mode starts in "all", so only switch in create mode
      if (viewMode === "my" && projectId && mode !== "edit") {
        switchToAllProjects(decompositionStageId, projectId)
      }
    }
  }, [treeData, viewMode, switchToAllProjects, mode])

  // Fetch employees
  const fetchEmployees = useCallback(async () => {
    setIsLoadingEmployees(true)
    try {
      const { data, error } = await supabase
        .from("view_users")
        .select(
          `user_id, first_name, last_name, full_name, email, position_name, avatar_url, team_name, department_name, employment_rate`,
        )
        .order("full_name")

      if (error) throw error
      setEmployees(data || [])
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          module: "planning",
          action: "fetch_employees",
          modal: "loading_modal",
        },
      })
    } finally {
      setIsLoadingEmployees(false)
    }
  }, [])

  // Update dropdown position
  const updateDropdownPosition = useCallback(() => {
    if (!inputWrapperRef.current) return
    const rect = inputWrapperRef.current.getBoundingClientRect()
    const viewportSpaceBelow = window.innerHeight - rect.bottom
    const openUp = viewportSpaceBelow < DROPDOWN_MAX_HEIGHT_PX / 2 && rect.top > viewportSpaceBelow
    setDropdownPosition({
      left: rect.left,
      top: openUp ? rect.top : rect.bottom,
      width: rect.width,
      openUp,
    })
  }, [])

  // Create basic decomposition stage
  const handleCreateBasicStage = useCallback(async (sectionNode: FileTreeNode, e: React.MouseEvent) => {
    e.stopPropagation()

    if (!sectionNode.sectionId || isCreatingStage) return

    setIsCreatingStage(true)
    try {
      // Get the count of existing stages
      const { data: existingStages, error: countError } = await supabase
        .from("decomposition_stages")
        .select("decomposition_stage_id")
        .eq("decomposition_stage_section_id", sectionNode.sectionId)

      if (countError) throw countError

      const stageOrder = (existingStages?.length || 0)

      // Create new stage
      const { data: newStage, error: createError } = await supabase
        .from("decomposition_stages")
        .insert({
          decomposition_stage_section_id: sectionNode.sectionId,
          decomposition_stage_name: `Этап ${sectionNode.name}`,
          decomposition_stage_order: stageOrder,
        })
        .select()
        .single()

      if (createError) throw createError

      setNotification(`Этап "${newStage.decomposition_stage_name}" успешно создан`)

      // Find the parent project node to reload its children
      const findProjectNode = (nodes: FileTreeNode[]): FileTreeNode | null => {
        for (const node of nodes) {
          if (node.id === `project-${sectionNode.projectId}`) {
            return node
          }
          if (node.children) {
            const found = findProjectNode(node.children)
            if (found) return found
          }
        }
        return null
      }

      const projectNode = findProjectNode(treeData)
      if (projectNode && sectionNode.projectId) {
        // Clear cache synchronously and reload the project's children to show the new stage
        setProjectDataCache((prev) => {
          const next = new Map(prev)
          next.delete(sectionNode.projectId!)
          return next
        })
        // Small delay to ensure state update
        await new Promise(resolve => setTimeout(resolve, 0))
        await loadNodeChildren(projectNode, true)

        // Expand the section to show the new stage
        setExpandedFolders((prev) => new Set(prev).add(sectionNode.id))
      }

      successTimeoutRef.current = setTimeout(() => clearNotification(), 3000)
    } catch (error) {
      console.error("Ошибка создания этапа:", error)
      Sentry.captureException(error, {
        tags: {
          module: "planning",
          action: "create_basic_stage",
          modal: "loading_modal",
        },
        extra: {
          section_id: sectionNode.sectionId,
          section_name: sectionNode.name,
        },
      })
      setNotification(`Ошибка при создании этапа: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`)
      errorTimeoutRef.current = setTimeout(() => clearNotification(), 5000)
    } finally {
      setIsCreatingStage(false)
    }
  }, [isCreatingStage, treeData, loadNodeChildren, clearProjectCache, setNotification, clearNotification])


  // Refresh a single project
  const handleRefreshProject = useCallback(async (projectNode: FileTreeNode, e: React.MouseEvent) => {
    e.stopPropagation()

    if (!projectNode.projectId) return

    const projectId = projectNode.id
    if (refreshingProjects.has(projectId)) return

    setRefreshingProjects((prev) => new Set(prev).add(projectId))
    try {
      // Clear cache synchronously before reloading
      setProjectDataCache((prev) => {
        const next = new Map(prev)
        next.delete(`${projectNode.projectId!}-my`)
        next.delete(`${projectNode.projectId!}-all`)
        return next
      })
      // Small delay to ensure state update
      await new Promise(resolve => setTimeout(resolve, 0))
      await loadNodeChildren(projectNode, true)
      setNotification(`Проект "${projectNode.name}" обновлён`)
      successTimeoutRef.current = setTimeout(() => clearNotification(), 3000)
    } catch (error) {
      console.error("Ошибка обновления проекта:", error)
      Sentry.captureException(error, {
        tags: {
          module: "planning",
          action: "refresh_project",
          modal: "loading_modal",
        },
        extra: {
          project_id: projectNode.projectId,
          project_name: projectNode.name,
        },
      })
      setNotification(`Ошибка при обновлении проекта: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`)
      errorTimeoutRef.current = setTimeout(() => clearNotification(), 5000)
    } finally {
      setRefreshingProjects((prev) => {
        const next = new Set(prev)
        next.delete(projectId)
        return next
      })
    }
  }, [refreshingProjects, loadNodeChildren, setNotification, clearNotification])

  // Refresh all projects
  const handleRefreshAllProjects = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()

    if (isRefreshingAll) return

    setIsRefreshingAll(true)
    try {
      // Clear entire cache to force fresh data on next expand
      setProjectDataCache(new Map())
      // Reset expanded folders so they reload when re-expanded
      setExpandedFolders(new Set())
      // Rebuild project list
      await buildFileTree()
      setNotification("Список проектов обновлён")
      successTimeoutRef.current = setTimeout(() => clearNotification(), 3000)
    } catch (error) {
      console.error("Ошибка обновления списка проектов:", error)
      Sentry.captureException(error, {
        tags: {
          module: "planning",
          action: "refresh_all_projects",
          modal: "loading_modal",
        },
      })
      setNotification(`Ошибка при обновлении списка проектов: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`)
      errorTimeoutRef.current = setTimeout(() => clearNotification(), 5000)
    } finally {
      setIsRefreshingAll(false)
    }
  }, [isRefreshingAll, buildFileTree, setNotification, clearNotification])

  // Load tree and employees on mount
  useEffect(() => {
    if (!hasLoadedTreeRef.current && isOpen) {
      buildFileTree()
      fetchEmployees()
    }
  }, [buildFileTree, fetchEmployees, isOpen, mode])

  // Force viewMode to "all" in edit mode when modal opens
  useEffect(() => {
    if (isOpen && mode === "edit" && viewMode !== "all") {
      console.log('🔄 Forcing viewMode to "all" for edit mode')
      setViewMode("all")
    }
  }, [isOpen, mode, viewMode])

  // Fetch calendar events when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchEvents()
    }
  }, [isOpen, fetchEvents])

  // Clear cache and reload when view mode changes
  useEffect(() => {
    if (hasLoadedTreeRef.current) {
      // Clear all cached data to force reload with new filter
      setProjectDataCache(new Map())
      // Collapse all expanded folders
      setExpandedFolders(new Set())

      // Reload project list with new filter
      buildFileTree()
    }
  }, [viewMode, buildFileTree])

  // Pre-fill employee search term
  useEffect(() => {
    if (selectedEmployee) {
      setEmployeeSearchTerm(selectedEmployee.full_name)
    }
  }, [selectedEmployee])

  // Auto-expand and select node for edit mode or when stageId is provided
  useEffect(() => {
    if (treeData.length === 0) {
      return
    }

    // In edit mode, wait until viewMode is "all" before proceeding
    if (mode === "edit" && viewMode === "my") {
      console.log('⏸️ Edit mode: waiting for viewMode to switch to "all"...')
      return
    }

    // In edit mode, skip auto-select if user is actively changing stage
    if (mode === "edit" && isChangingStage) {
      console.log('⏸️ Edit mode: user is changing stage, skipping auto-select')
      return
    }

    // In edit mode, if user manually selected a DIFFERENT stage, block auto-revert
    if (mode === "edit" && selectedNode && loading?.stageId) {
      if (selectedNode.decompositionStageId !== loading.stageId) {
        console.log('⏸️ Edit mode: user changed to different stage, blocking auto-revert')
        console.log(`   Current: ${selectedNode.decompositionStageId}`)
        console.log(`   Original: ${loading.stageId}`)
        return
      }
    }

    let targetStageId: string | undefined
    let targetProjectId: string | undefined

    if (mode === "edit" && loading?.stageId) {
      targetStageId = loading.stageId
      // Try to get project ID from loading or section
      targetProjectId = loading.projectId || section?.projectId

      console.log('┌─────────────────────────────────────────────────────────────')
      console.log('│ 🎯 AUTO-SELECT в режиме EDIT')
      console.log('├─────────────────────────────────────────────────────────────')
      console.log(`│ Target Stage ID: ${targetStageId}`)
      console.log(`│ Target Project ID: ${targetProjectId}`)
      console.log(`│ Loading Section ID: ${loading.sectionId}`)
      console.log(`│ Loading Section Name: ${loading.sectionName}`)
      console.log(`│ User Department ID: ${userDepartmentId}`)
      console.log(`│ View Mode: ${viewMode}`)
      console.log(`│ TreeData length: ${treeData.length}`)
      console.log('└─────────────────────────────────────────────────────────────')
    } else if (mode === "create" && stageId) {
      targetStageId = stageId
      targetProjectId = section?.projectId
    }

    if (targetStageId && targetProjectId) {
      // Проверяем, не выбран ли уже нужный узел (чтобы избежать бесконечного цикла)
      if (selectedNode?.decompositionStageId === targetStageId) {
        console.log('✅ Нужный узел уже выбран, пропускаем повторную загрузку')
        return
      }

      // Find the project node
      const projectNodeId = `project-${targetProjectId}`
      const projectNode = treeData.find((n) => n.id === projectNodeId)

      if (projectNode) {
        // Установить название проекта в поиск, чтобы проект отображался в дереве
        setProjectSearchTerm(projectNode.name)

        // Check if project children are already loaded to prevent infinite loops
        if (projectNode.children && projectNode.children.length > 0) {
          console.log('✅ Дети проекта уже загружены, пропускаем loadNodeChildren')
          console.log(`📊 projectNode.children.length: ${projectNode.children.length}`)

          // Children already loaded, try to find and select the node directly
          setPendingStageSelection({
            stageId: targetStageId!,
            projectId: targetProjectId!
          })
          return
        }

        // ВСЕГДА загружаем иерархию перед поиском (проще и надёжнее)
        console.log('⏳ Загружаем иерархию проекта перед поиском...')
        console.log(`📊 treeData.length ДО loadNodeChildren: ${treeData.length}`)
        console.log(`📊 projectNode.children ДО loadNodeChildren: ${projectNode.children?.length ?? 'undefined'}`)

        // Используем async IIFE для корректного ожидания результата
        ;(async () => {
          const hasChildren = await loadNodeChildren(projectNode)

          console.log(`📊 hasChildren результат ПОСЛЕ await: ${hasChildren}`)

          if (hasChildren) {
            console.log(`✅ Иерархия загружена успешно`)
            setPendingStageSelection({
              stageId: targetStageId!,
              projectId: targetProjectId!
            })
          } else {
            console.log('⚠️ После загрузки и фильтрации нет детей в проекте')

            // Edit mode starts in "all", so only switch in create mode
            if (viewMode === "my" && mode !== "edit") {
              console.log('⚠️ Переключаюсь на режим "Все проекты"...')
              switchToAllProjects(targetStageId!, targetProjectId!)
            } else {
              console.log('❌ Уже в режиме "Все проекты", но этап не найден. Возможно, данные отсутствуют.')
            }
          }
        })()
      } else {
        // Если проект не найден в "Мои проекты" - переключиться на "Все проекты"
        // Edit mode starts in "all", so only switch in create mode
        if (viewMode === "my" && mode !== "edit") {
          switchToAllProjects(targetStageId!, targetProjectId!)
        }
      }
    }
  }, [treeData, mode, loading, stageId, section, loadNodeChildren, findAndSelectNode, viewMode, userDepartmentId, switchToAllProjects, selectedNode, isChangingStage])

  // Handle pending stage selection after viewMode switch
  useEffect(() => {
    if (!pendingStageSelection || treeData.length === 0) {
      return
    }

    const { stageId: pendingStageId, projectId: pendingProjectId } = pendingStageSelection

    const projectNodeId = `project-${pendingProjectId}`
    const projectNode = treeData.find((n) => n.id === projectNodeId)

    if (!projectNode) {
      console.log("Project node not found after viewMode switch")
      setPendingStageSelection(null)
      return
    }

    setProjectSearchTerm(projectNode.name)

    // Проверяем, загружены ли уже дети этого проекта
    if (projectNode.children && projectNode.children.length > 0) {
      // Дети уже загружены, можем искать узел
      console.log("Дети проекта уже загружены, ищем узел...")
      findAndSelectNode(pendingStageId, pendingProjectId)
      setPendingStageSelection(null)
    } else if (!loadingNodes.has(projectNode.id)) {
      // Нужно загрузить дети, ТОЛЬКО если они еще не загружаются
      console.log("Загружаем дети проекта для pending selection...")
      loadNodeChildren(projectNode, true).then((hasChildren) => {
        if (hasChildren) {
          // НЕ вызываем findAndSelectNode здесь!
          // Просто ждём следующего рендера, когда treeData обновится
          // и этот useEffect запустится снова
          console.log("Дети загружены, ожидаем следующего рендера...")
        } else {
          console.log("Нет детей после загрузки")
          setPendingStageSelection(null)
        }
      })
    } else {
      // Узел уже загружается, ждём следующего рендера
      console.log("Узел уже загружается, ждём обновления treeData...")
    }
  }, [pendingStageSelection, treeData, viewMode, loadNodeChildren, findAndSelectNode, setProjectSearchTerm, loadingNodes])

  // Pre-fill employee for edit mode
  useEffect(() => {
    if (mode === "edit" && loading && employees.length > 0) {
      const emp = employees.find((e) => e.user_id === loading.responsibleId)
      if (emp) {
        setSelectedEmployee(emp)
      } else {
        console.warn(`[LoadingModal] Сотрудник не найден с ID: ${loading.responsibleId}`)
      }
    }
  }, [mode, loading, employees])

  // Initialize original values in edit mode for change detection
  // ВАЖНО: Выполняется ПОСЛЕ того, как selectedEmployee и selectedNode установлены
  useEffect(() => {
    if (mode === "edit" && loading && selectedEmployee && selectedNode) {
      // Инициализируем только один раз, когда все данные готовы и ref еще пуст
      if (originalValuesRef.current.employeeId === "") {
        originalValuesRef.current = {
          startDate: normalizeDateValue(loading.startDate) || "",
          endDate: normalizeDateValue(loading.endDate) || "",
          rate: loading.rate ?? 1,
          comment: loading.comment || "",
          employeeId: selectedEmployee.user_id,
          stageId: selectedNode.decompositionStageId || "",
        }
        console.log('📝 originalValuesRef initialized:', {
          stageId: originalValuesRef.current.stageId,
          employeeId: originalValuesRef.current.employeeId,
          selectedNodeId: selectedNode.decompositionStageId
        })
      }
    }
  }, [mode, loading?.id, loading?.startDate, loading?.endDate, loading?.rate, loading?.comment, loading?.responsibleId, loading?.stageId, selectedEmployee?.user_id, selectedNode?.decompositionStageId, normalizeDateValue])

  // Reset modal state when reopening in create mode
  useEffect(() => {
    if (isOpen && mode === "create") {
      // Clear selected node and breadcrumbs
      setSelectedNode(null)
      setBreadcrumbs([])

      // Reset expanded folders to empty
      setExpandedFolders(new Set())

      // Reset employee to original from props
      setSelectedEmployee(originalEmployeeRef.current)
      if (originalEmployeeRef.current) {
        setEmployeeSearchTerm(originalEmployeeRef.current.full_name)
      }

      // Reset form data to defaults
      setFormData({
        startDate: normalizeDateValue(defaultStartDate) || formatLocalYMD(new Date())!,
        endDate: normalizeDateValue(defaultEndDate) || formatLocalYMD(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))!,
        rate: defaultRate ?? 1,
        comment: "",
      })

      // Clear project search
      setProjectSearchTerm("")

      // Clear errors
      setErrors({})

      // Reset isChangingStage (in create mode, tree is always unlocked)
      setIsChangingStage(false)

      // Reset showCreateForm (start with stage selection screen)
      setShowCreateForm(false)

      // Reset isSelectingNewStage flag
      setIsSelectingNewStage(false)

      // Clear section panel IDs
      setSectionPanelSectionId(null)
      setSectionPanelProjectId(null)
    }

    // Reset modal state when reopening in edit mode
    if (isOpen && mode === "edit" && loading) {
      // Reset formData to original values from loading (discarding any unsaved changes)
      setFormData({
        startDate: normalizeDateValue(loading.startDate) || formatLocalYMD(new Date())!,
        endDate: normalizeDateValue(loading.endDate) || formatLocalYMD(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))!,
        rate: loading.rate ?? 1,
        comment: loading.comment || "",
      })

      // Clear errors
      setErrors({})

      // Reset isChangingStage (in edit mode, tree starts locked)
      setIsChangingStage(false)

      // Clear section panel IDs
      setSectionPanelSectionId(null)
      setSectionPanelProjectId(null)
    }

    // Reset originalValuesRef when modal closes (for both modes)
    if (!isOpen) {
      // Очистить старое дерево и сбросить состояние
      setTreeData([])
      // Reset to mode-appropriate initial state
      setViewMode(mode === "edit" ? "all" : "my")
      setPendingBuildQueue([])
      hasLoadedTreeRef.current = false

      originalValuesRef.current = {
        startDate: "",
        endDate: "",
        rate: 0,
        comment: "",
        employeeId: "",
        stageId: "",
      }

      // Сбросить formData к исходным значениям из loading (для edit mode)
      // Это отменяет все несохранённые изменения
      if (mode === "edit" && loading) {
        setFormData({
          startDate: normalizeDateValue(loading.startDate) || formatLocalYMD(new Date())!,
          endDate: normalizeDateValue(loading.endDate) || formatLocalYMD(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))!,
          rate: loading.rate ?? 1,
          comment: loading.comment || "",
        })
      }

      // Reset isChangingStage when modal closes
      setIsChangingStage(false)

      // Reset showCreateForm when modal closes
      setShowCreateForm(false)

      // Clear section panel IDs
      setSectionPanelSectionId(null)
      setSectionPanelProjectId(null)

      // Reset isSelectingNewStage when modal closes
      setIsSelectingNewStage(false)

      // Clear pending stage selection when modal closes
      setPendingStageSelection(null)
    }
  }, [isOpen, mode, loading?.id, loading?.startDate, loading?.endDate, loading?.rate, loading?.comment, normalizeDateValue, formatLocalYMD])

  // Initialize manualRateInput for custom rates in edit mode
  useEffect(() => {
    if (mode === "edit" && isOpen && formData.rate) {
      // Check if rate is a custom rate (not in predefined RATES)
      if (!RATES.includes(formData.rate)) {
        // Set manual input to the custom rate value
        setManualRateInput(formData.rate.toString())
      } else {
        // Clear manual input if using predefined rate
        setManualRateInput("")
      }
    }
  }, [mode, formData.rate, isOpen])

  // Update dropdown position on scroll/resize
  useEffect(() => {
    if (!showEmployeeDropdown) return
    updateDropdownPosition()
    const handlers = [
      ['scroll', updateDropdownPosition, true],
      ['resize', updateDropdownPosition, false],
    ] as const
    handlers.forEach(([event, fn, capture]) =>
      window.addEventListener(event, fn as EventListener, capture))
    return () => handlers.forEach(([event, fn, capture]) =>
      window.removeEventListener(event, fn as EventListener, capture))
  }, [showEmployeeDropdown, updateDropdownPosition])

  // Helper function to collect all folder IDs in a project hierarchy
  const expandAllProjectFolders = useCallback((nodes: FileTreeNode[], targetProjectId: string): string[] => {
    const foldersToExpand: string[] = []

    const collectFolders = (items: FileTreeNode[]) => {
      for (const node of items) {
        // Only expand folder nodes belonging to this project
        if (node.projectId === targetProjectId && node.type === "folder") {
          foldersToExpand.push(node.id)
        }
        // Recursively check children
        if (node.children) {
          collectFolders(node.children)
        }
      }
    }

    collectFolders(nodes)
    return foldersToExpand
  }, [])

  // Toggle folder expansion
  const toggleFolder = async (folderId: string) => {
    const isExpanding = !expandedFolders.has(folderId)
    console.log(`[LoadingModal] 📁 toggleFolder(): ${isExpanding ? 'Раскрытие' : 'Сворачивание'} папки ${folderId}`)

    setExpandedFolders((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(folderId)) {
        newSet.delete(folderId)
      } else {
        newSet.add(folderId)
      }
      return newSet
    })

    // Load children if expanding a project node
    if (isExpanding && folderId.startsWith("project-")) {
      const findNode = (nodes: FileTreeNode[], id: string): FileTreeNode | null => {
        for (const node of nodes) {
          if (node.id === id) return node
          if (node.children) {
            const found = findNode(node.children, id)
            if (found) return found
          }
        }
        return null
      }

      const node = findNode(treeData, folderId)
      if (node && node.children?.length === 0) {
        // Children not loaded yet, load them
        await loadNodeChildren(node)

        // After loading, expand all folders in this project hierarchy
        // Use setTimeout to ensure state updates have propagated
        setTimeout(() => {
          setTreeData((currentTree) => {
            const updatedNode = findNode(currentTree, folderId)
            if (updatedNode && updatedNode.children && updatedNode.projectId) {
              const foldersToExpand = expandAllProjectFolders(updatedNode.children, updatedNode.projectId)
              setExpandedFolders((prev) => {
                const newSet = new Set(prev)
                foldersToExpand.forEach((id) => newSet.add(id))
                return newSet
              })
            }
            return currentTree
          })
        }, 0)
      }
    }
  }


  // Handle node selection
  const handleNodeSelect = (node: FileTreeNode) => {
    // Helper function to build breadcrumbs
    const buildBreadcrumbs = (targetNode: FileTreeNode): FileTreeNode[] => {
      const path: FileTreeNode[] = [targetNode]
      let current = targetNode

      const findParentNode = (nodes: FileTreeNode[], childId: string): FileTreeNode | null => {
        for (const n of nodes) {
          if (n.children) {
            for (const child of n.children) {
              if (child.id === childId) return n
            }
            const found = findParentNode(n.children, childId)
            if (found) return found
          }
        }
        return null
      }

      while (current.parentId) {
        const parent = findParentNode(treeData, current.id)
        if (parent) {
          path.unshift(parent)
          current = parent
        } else {
          break
        }
      }

      return path
    }

    // If it's a decomposition stage file node
    if (node.type === "file" && node.decompositionStageId) {
      setSelectedNode(node)
      setBreadcrumbs(buildBreadcrumbs(node))

      // Reset changing stage flag (lock the tree again in edit mode)
      if (mode === "edit") {
        setIsChangingStage(false)
      }

      // In create mode: if we were selecting a new stage, lock tree again
      if (mode === "create" && isSelectingNewStage) {
        setIsSelectingNewStage(false)
      }

      // Clear error
      if (errors.decompositionStageId) {
        setErrors((prev) => {
          const newErrors = { ...prev }
          delete newErrors.decompositionStageId
          return newErrors
        })
      }
    }
  }

  // Calculate working days in the selected period
  const workingDaysCount = useMemo(() => {
    if (!formData.startDate || !formData.endDate) {
      return 0
    }

    return calculateWorkingDays(formData.startDate, formData.endDate, calendarEvents)
  }, [formData.startDate, formData.endDate, calendarEvents])

  // Calculate working hours (working days × 8 hours × rate)
  const workingHoursCount = useMemo(() => {
    const value = workingDaysCount * 8 * formData.rate
    return Math.round(value * 100) / 100
  }, [workingDaysCount, formData.rate])
  

  // Check if any field has changed in edit mode
  const hasChanges = useMemo(() => {
    // In create mode, always allow saving (if validation passes)
    if (mode === "create") return true

    // Если originalValues еще не инициализированы (данные еще загружаются), считаем что изменений нет
    if (originalValuesRef.current.employeeId === "") {
      return false
    }

    // In edit mode, check if any field differs from original
    const startDateChanged = formData.startDate !== originalValuesRef.current.startDate
    const endDateChanged = formData.endDate !== originalValuesRef.current.endDate
    const rateChanged = formData.rate !== originalValuesRef.current.rate
    const commentChanged = (formData.comment || "") !== (originalValuesRef.current.comment || "")
    const employeeChanged = (selectedEmployee?.user_id || "") !== (originalValuesRef.current.employeeId || "")
    const stageChanged = (selectedNode?.decompositionStageId || "") !== (originalValuesRef.current.stageId || "")

    console.log('🔍 hasChanges check:', {
      current: selectedNode?.decompositionStageId,
      original: originalValuesRef.current.stageId,
      stageChanged,
      startDateChanged,
      endDateChanged,
      rateChanged,
      commentChanged,
      employeeChanged
    })

    const changed = startDateChanged || endDateChanged || rateChanged || commentChanged || employeeChanged || stageChanged

    return changed
  }, [mode, formData, selectedEmployee, selectedNode])

  // Filter projects by search term
  // Note: Department filtering is already done in buildFileTree() using view_projects_with_department_info
  const filteredTreeData = useMemo(() => {
    const searchLower = projectSearchTerm.trim().toLowerCase()

    // If no search term, show all projects (already filtered by department in buildFileTree)
    if (!searchLower) {
      return treeData
    }

    // Apply search filter
    return treeData.filter((node) => {
      if (node.projectId && !node.stageId) {
        return node.name.toLowerCase().includes(searchLower)
      }
      return false
    })
  }, [treeData, projectSearchTerm])

  // Get node icon based on hierarchy level
  const getNodeIcon = (node: FileTreeNode, isExpanded: boolean) => {
    // Decomposition stage - файл
    if (node.type === "file" && node.decompositionStageId) {
      return <FileUser className="h-4 w-4 text-gray-500" />
    }

    // Project level
    if (node.projectId && !node.stageId) {
      const IconComponent = isExpanded ? FolderOpen : Folder
      return <IconComponent className="h-4 w-4 text-green-600 dark:text-green-400" />
    }

    // Stage level
    if (node.stageId && !node.objectId) {
      return <SquareStack className="h-4 w-4 text-purple-600" />
    }

    // Object level
    if (node.objectId && !node.sectionId) {
      return <Package className="h-4 w-4 text-orange-600" />
    }

    // Section level
    if (node.sectionId && !node.decompositionStageId) {
      return <CircleDashed className="h-4 w-4 text-teal-500" />
    }

    // Fallback
    const IconComponent = isExpanded ? FolderOpen : Folder
    return <IconComponent className="h-4 w-4 text-blue-500" />
  }

  // In edit mode: lock entire tree until user clicks "Сменить этап"
  const isStageLockedInEdit = mode === "edit" && !isChangingStage
  // In create mode: lock ENTIRE tree when form is shown AND not selecting new stage
  const isNodeLockedInCreate = mode === "create" && showCreateForm && !isSelectingNewStage
  const isTreeLocked = isStageLockedInEdit || isNodeLockedInCreate

  // Render FileTree node
  const renderNode = (node: FileTreeNode, depth = 0): React.ReactNode => {
    const isExpanded = expandedFolders.has(node.id)
    const isNavigationNode = node.isNavigationNode === true
    const isSelected = selectedNode?.id === node.id
    const hasChildren = node.children && node.children.length > 0
    const isLoading = loadingNodes.has(node.id)
    const isSectionNode = node.type === "folder" && node.sectionId && !node.decompositionStageId
    const isProjectNode = node.type === "folder" && node.projectId && !node.stageId
    const isRefreshingProject = refreshingProjects.has(node.id)

    const nodeContent = (
      <div
        className={cn(
          "group flex items-center gap-1 py-1 px-2 text-sm rounded-sm select-none transition-colors duration-150",
          isNavigationNode && "text-primary/80 dark:text-emerald-300 hover:bg-primary/5 hover:text-primary dark:hover:text-emerald-200 cursor-pointer italic",
          !isNavigationNode && isTreeLocked && !isSelected && "opacity-50 cursor-not-allowed",
          !isNavigationNode && isTreeLocked && isSelected && "cursor-not-allowed",
          !isNavigationNode && isSelected && "bg-primary/10 text-primary dark:text-emerald-300 border-l-2 border-primary dark:border-emerald-400",
          !isNavigationNode && !isTreeLocked && !isSelected && "hover:bg-accent hover:text-accent-foreground cursor-pointer",
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      
        onClick={async () => {
          // Handle navigation node click
          if (isNavigationNode && node.sectionId) {
            // Find the parent section node
            const findSectionNode = (nodes: FileTreeNode[], sectionId: string): FileTreeNode | null => {
              for (const n of nodes) {
                if (n.sectionId === sectionId && n.type === "folder" && !n.decompositionStageId) {
                  return n
                }
                if (n.children) {
                  const found = findSectionNode(n.children, sectionId)
                  if (found) return found
                }
              }
              return null
            }
            const sectionNode = findSectionNode(treeData, node.sectionId)
            if (sectionNode) {
              setSectionPanelSectionId(sectionNode.sectionId!)
              setSectionPanelProjectId(sectionNode.projectId!)
              setShowSectionPanel(true)
            }
            return
          }

          // Prevent interactions only for locked decomposition stages
          if (isTreeLocked) return

          if (node.type === "folder") {
            await toggleFolder(node.id)
          } else if (node.type === "file" && node.decompositionStageId) {
            handleNodeSelect(node)
          }
        }}
      >
        {isNavigationNode ? (
          <>
            <div className="h-4 w-4" />
            <ExternalLink className="h-4 w-4 text-primary dark:text-emerald-300" />
          </>
        ) : node.type === "folder" ? (
          <>
            <button className="h-4 w-4 p-0">
              {isLoading ? (
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary dark:border-primary/80 border-t-transparent" />
              ) : hasChildren ? (
                isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )
              ) : (
                <ChevronRight className="h-3 w-3 opacity-30" />
              )}
            </button>
            {getNodeIcon(node, isExpanded)}
          </>
        ) : (
          <>
            <div className="h-4 w-4" />
            {getNodeIcon(node, isExpanded)}
          </>
        )}
        <span className="truncate flex-1">{node.name}</span>
        {isLoading && <span className="text-xs text-muted-foreground">Загрузка...</span>}

        {/* Refresh icon for project nodes */}
        {isProjectNode && (
          <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => handleRefreshProject(node, e)}
                  disabled={isRefreshingProject}
                  className="h-6 w-6 flex items-center justify-center rounded hover:bg-primary/10 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={cn("h-4 w-4 text-primary dark:text-primary/90", isRefreshingProject && "animate-spin")} />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Обновить проект</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    )

    return (
      <div key={node.id}>
        {isTreeLocked && !isNavigationNode ? (
          <Tooltip>
            <TooltipTrigger asChild>
              {nodeContent}
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {mode === "edit"
                  ? "Нажмите \"Сменить этап\" для изменения этапа декомпозиции"
                  : "Нажмите \"Сменить этап\" для изменения этапа декомпозиции"}
              </p>
            </TooltipContent>
          </Tooltip>
        ) : (
          nodeContent
        )}

        {node.type === "folder" && hasChildren && isExpanded && (
          <div>{node.children!.map((child) => renderNode(child, depth + 1))}</div>
        )}

        {/* Show message for empty folders (only if not loading) */}
        {(() => {
          // For section nodes: check if there are decomposition stages (excluding navigation node)
          const decompStageChildren = node.children?.filter(child => !child.isNavigationNode) || []
          const hasDecompStages = decompStageChildren.length > 0
          const isSectionWithoutDecomp = node.type === "folder" && node.sectionId && !node.decompositionStageId && !hasDecompStages
          const shouldShowEmptyMessage = node.type === "folder" && !hasChildren && isExpanded && !isLoading

          return (isSectionWithoutDecomp || shouldShowEmptyMessage) && isExpanded && !isLoading ? (
            <div
              className="px-2 py-1"
              style={{ paddingLeft: `${(depth) * 12 + 40}px` }}
            >
              {node.sectionId && !node.decompositionStageId ? (
                <div className="space-y-1">
                  <button
                    onClick={(e) => handleCreateBasicStage(node, e)}
                    disabled={isCreatingStage}
                    className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-50 py-1 rounded hover:bg-primary/5"
                  >
                    <FilePlus className="h-4 w-4" />
                    <span>Создать базовый этап</span>
                  </button>
                  <div className="text-xs text-muted-foreground italic">
                    Этапы декомпозиции отсутствуют
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic">
                  {node.objectId && !node.sectionId
                    ? "Разделы отсутствуют"
                    : node.stageId && !node.objectId
                    ? "Объекты отсутствуют"
                    : node.projectId && !node.stageId
                    ? "Стадии отсутствуют"
                    : "Нет данных"}
                </div>
              )}
            </div>
          ) : null
        })()}
      </div>
    )
  }

  // Filtered employees
  const filteredEmployees = employees
    .filter((emp) => {
      if (employeeSearchTerm.trim() === "") return true
      return (
        emp.full_name.toLowerCase().includes(employeeSearchTerm.toLowerCase()) ||
        emp.email.toLowerCase().includes(employeeSearchTerm.toLowerCase())
      )
    })
    .slice(0, 10)

  // Handle employee selection
  const handleEmployeeSelect = (emp: EmployeeSearchResult) => {
    setSelectedEmployee(emp)
    setEmployeeSearchTerm(emp.full_name)
    setShowEmployeeDropdown(false)

    if (errors.employee) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors.employee
        return newErrors
      })
    }
  }

  // Handle manual rate input
  const handleManualRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // Replace comma with period for decimal separator
    const normalizedValue = value.replace(/,/g, ".")

    // Update the input field with normalized value
    setManualRateInput(normalizedValue)

    // Parse and validate
    if (normalizedValue === "") {
      setFormData((prev) => ({ ...prev, rate: 0 }))
      setManualRateError("")
    } else {
      const numericValue = Number.parseFloat(normalizedValue)
      if (!Number.isNaN(numericValue)) {
        setFormData((prev) => ({ ...prev, rate: numericValue }))

        // Validate range
        if (numericValue <= 0) {
          setManualRateError("Ставка должна быть больше 0")
        } else if (numericValue > 2) {
          setManualRateError("Ставка должна быть не более 2")
        } else {
          setManualRateError("")
        }
      }
    }

    // Clear rate error if exists
    if (errors.rate) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors.rate
        return newErrors
      })
    }
  }

  // Handle form changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))

    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.startDate) {
      newErrors.startDate = "Дата начала обязательна"
    }

    if (!formData.endDate) {
      newErrors.endDate = "Дата окончания обязательна"
    } else if (formData.startDate && new Date(formData.startDate) > new Date(formData.endDate)) {
      newErrors.endDate = "Дата окончания должна быть позже даты начала"
    }

    if (Number.isNaN(formData.rate) || formData.rate <= 0) {
      newErrors.rate = "Ставка должна быть больше 0"
    } else if (formData.rate > 2) {
      newErrors.rate = "Ставка не может быть больше 2"
    }

    if (!selectedEmployee) {
      newErrors.employee = "Необходимо выбрать сотрудника"
    }

    if (!selectedNode || (!selectedNode.decompositionStageId && !selectedNode.loadingId)) {
      newErrors.decompositionStageId = "Необходимо выбрать этап декомпозиции"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle save (create or update)
  const handleSave = async () => {
    if (!validateForm()) return

    const isEditMode = mode === "edit"
    const loadingToEdit = loading

    await Sentry.startSpan(
      {
        op: "ui.action",
        name: isEditMode ? "Обновление загрузки" : "Создание загрузки",
      },
      async (span) => {
        setIsSaving(true)

        try {
          span.setAttribute("mode", isEditMode ? "edit" : "create")
          span.setAttribute("employee.id", selectedEmployee!.user_id)
          span.setAttribute("employee.name", selectedEmployee!.full_name)
          span.setAttribute("decomposition_stage.id", selectedNode!.decompositionStageId!)
          span.setAttribute("loading.start_date", formData.startDate)
          span.setAttribute("loading.end_date", formData.endDate)
          span.setAttribute("loading.rate", formData.rate)

          if (!isEditMode) {
            // Get decomposition stage name
            const decompositionStageName = selectedNode!.name

            // Fetch project and section names
            const { data: sectionData } = await supabase
              .from("view_section_hierarchy")
              .select("project_id, project_name, section_id, section_name")
              .eq("section_id", selectedNode!.sectionId!)
              .limit(1)
              .maybeSingle()

            const result = await createLoadingInStore({
              responsibleId: selectedEmployee!.user_id,
              sectionId: selectedNode!.sectionId!,
              stageId: selectedNode!.decompositionStageId!,
              startDate: new Date(formData.startDate),
              endDate: new Date(formData.endDate),
              rate: formData.rate,
              projectName: sectionData?.project_name,
              sectionName: sectionData?.section_name,
              decompositionStageId: selectedNode!.decompositionStageId!,
              decompositionStageName,
              responsibleName: selectedEmployee!.full_name,
              responsibleAvatarUrl: selectedEmployee!.avatar_url || undefined,
              responsibleTeamName: selectedEmployee!.team_name || undefined,
              comment: formData.comment?.trim() || undefined,
            })

            if (!result.success) {
              throw new Error(result.error || "Неизвестная ошибка при создании загрузки")
            }

            span.setAttribute("operation.success", true)
            span.setAttribute("loading.id", result.loadingId || "unknown")

            setNotification(`Загрузка для сотрудника ${selectedEmployee!.full_name} успешно создана`)

            // Expand section
            const { expandedSections } = usePlanningStore.getState()
            if (selectedNode!.sectionId && !expandedSections[selectedNode!.sectionId]) {
              toggleSectionExpanded(selectedNode!.sectionId)
            }

            successTimeoutRef.current = setTimeout(() => clearNotification(), 3000)

            // Close modal after successful creation
            onClose()
          } else {
            // Edit mode
            const updatedLoading: Partial<Loading> = {
              startDate: new Date(formData.startDate),
              endDate: new Date(formData.endDate),
              rate: formData.rate,
              comment: formData.comment,
            }

            // Update stage if changed
            if (selectedNode!.decompositionStageId !== loadingToEdit!.stageId) {
              updatedLoading.stageId = selectedNode!.decompositionStageId
              updatedLoading.stageName = selectedNode!.name
            }

            // Update employee if changed
            if (selectedEmployee!.user_id !== loadingToEdit!.responsibleId) {
              updatedLoading.responsibleId = selectedEmployee!.user_id
              updatedLoading.responsibleName = selectedEmployee!.full_name
              updatedLoading.responsibleAvatarUrl = selectedEmployee!.avatar_url || undefined
              updatedLoading.responsibleTeamName = selectedEmployee!.team_name || undefined
            }

            const result = await updateLoadingInStore(loadingToEdit!.id, updatedLoading)

            if (!result.success) {
              throw new Error(result.error || "Ошибка при обновлении загрузки")
            }

            span.setAttribute("operation.success", true)

            setNotification("Загрузка успешно обновлена")
            successTimeoutRef.current = setTimeout(() => clearNotification(), 3000)

            onClose()
          }
        } catch (error) {
          span.setAttribute("operation.success", false)
          span.setAttribute("operation.error", error instanceof Error ? error.message : "Неизвестная ошибка")

          Sentry.captureException(error, {
            tags: {
              module: "planning",
              action: mode === "create" ? "create_loading" : "update_loading",
              modal: "loading_modal",
            },
            extra: {
              mode,
              employee_id: selectedEmployee?.user_id,
              decomposition_stage_id: selectedNode?.decompositionStageId,
              start_date: formData.startDate,
              end_date: formData.endDate,
              rate: formData.rate,
              loading_id: loading?.id,
              timestamp: new Date().toISOString(),
            },
          })

          setNotification(`Ошибка: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`)
          errorTimeoutRef.current = setTimeout(() => clearNotification(), 5000)
        } finally {
          setIsSaving(false)
        }
      },
    )
  }

  // Handle delete
  const handleDelete = async () => {
    if (mode !== "edit" || !loading) return
    const loadingToDelete = loading

    setIsDeleting(true)

    try {
      const result = await deleteLoadingInStore(loadingToDelete.id)

      if (!result.success) {
        throw new Error(result.error || "Ошибка при удалении загрузки")
      }

      setNotification("Загрузка успешно удалена")
      successTimeoutRef.current = setTimeout(() => clearNotification(), 3000)

      onClose()
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          module: "planning",
          action: "delete_loading",
          modal: "loading_modal",
        },
        extra: {
          loading_id: loadingToDelete.id,
          timestamp: new Date().toISOString(),
        },
      })

      setNotification(`Ошибка при удалении загрузки: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`)
      errorTimeoutRef.current = setTimeout(() => clearNotification(), 5000)
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  // Handle archive
  const handleArchive = async () => {
    if (mode !== "edit" || !loading) return
    const loadingToArchive = loading

    setIsArchiving(true)

    try {
      const result = await archiveLoadingInStore(loadingToArchive.id)

      if (!result.success) {
        throw new Error(result.error || "Ошибка при архивировании загрузки")
      }

      setNotification("Загрузка успешно архивирована")
      successTimeoutRef.current = setTimeout(() => clearNotification(), 3000)

      onClose()
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          module: "planning",
          action: "archive_loading",
          modal: "loading_modal",
        },
        extra: {
          loading_id: loadingToArchive.id,
          timestamp: new Date().toISOString(),
        },
      })

      setNotification(`Ошибка при архивировании загрузки: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`)
      errorTimeoutRef.current = setTimeout(() => clearNotification(), 5000)
    } finally {
      setIsArchiving(false)
      setShowArchiveConfirm(false)
    }
  }

  const navigateToDecomposition = () => {
    if (!selectedNode?.sectionId) return
    setSectionPanelSectionId(selectedNode.sectionId)
    setSectionPanelProjectId(selectedNode.projectId || null)
    setShowSectionPanel(true)
  }

  // Wrapper for onClose
  const handleClose = () => {
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        onClick={(e) => {
          // Закрывать только при клике на overlay, не на содержимое модалки
          if (e.target === e.currentTarget && !isSaving && !isDeleting && !isArchiving) {
            handleClose();
          }
        }}
      >
      <div
        className="bg-white dark:bg-slate-800 rounded-lg w-11/12 h-5/6 max-w-6xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-slate-700">
          <h2 className="text-lg font-semibold dark:text-slate-200">
            {mode === "create" ? "Создание загрузки" : "Редактирование загрузки"}
          </h2>
          <button
            onClick={handleClose}
            disabled={isSaving || isDeleting || isArchiving}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        {/* Delete confirmation */}
        {showDeleteConfirm && (
          <div className="p-6 space-y-4">
            <div
              className={cn(
                "p-4 rounded-lg border",
                theme === "dark" ? "bg-red-900 border-red-700" : "bg-red-50 border-red-200",
              )}
            >
              <div className="flex items-start space-x-3">
                <div className={cn("flex-shrink-0 w-5 h-5 mt-2", theme === "dark" ? "text-red-400" : "text-red-600")}>
                  <svg fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  {/* <h4 className={cn("text-sm font-medium", theme === "dark" ? "text-red-200" : "text-red-800")}>
                    Внимание! Удаление загрузки
                  </h4> */}
                  <div className={cn("mt-2 text-sm", theme === "dark" ? "text-red-300" : "text-red-700")}>
                    <p className="mb-2"><strong>Загрузки нужно архивировать, а не удалять.</strong></p>
                    <p className="mb-2">Удалять можно только ошибочно созданные загрузки.</p>
                    <p>Вы уверены, что хотите удалить эту загрузку?</p>
                    {loading && (
                      <div className="mt-3 space-y-1.5 text-xs">
                        <p><strong>Этап:</strong> {loading.stageName || "Не указан"}</p>
                        <p><strong>Сотрудник:</strong> {loading.responsibleName || selectedEmployee?.full_name || "Не указан"}</p>
                        <p><strong>Даты:</strong> {formatDateDisplay(formData.startDate)} — {formatDateDisplay(formData.endDate)}</p>
                        <p><strong>Ставка:</strong> {formData.rate}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className={cn(
                  "px-4 py-2 text-sm rounded border",
                  theme === "dark"
                    ? "border-slate-600 text-slate-300 hover:bg-slate-700"
                    : "border-slate-300 text-slate-600 hover:bg-slate-50",
                  isDeleting ? "opacity-50 cursor-not-allowed" : "",
                )}
              >
                Отмена
              </button>
              <button
                onClick={async () => {
                  setShowDeleteConfirm(false)
                  await handleArchive()
                }}
                disabled={isDeleting}
                className={cn(
                  "px-4 py-2 text-sm rounded border",
                  theme === "dark"
                    ? "border-amber-600 text-amber-400 hover:bg-amber-900 hover:bg-opacity-20"
                    : "border-amber-500 text-amber-600 hover:bg-amber-50",
                  isDeleting ? "opacity-50 cursor-not-allowed" : "",
                )}
              >
                Архивировать эту загрузку
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className={cn(
                  "px-4 py-2 text-sm rounded flex items-center justify-center min-w-[120px]",
                  theme === "dark" ? "bg-red-600 text-white hover:bg-red-700" : "bg-red-500 text-white hover:bg-red-600",
                  isDeleting ? "opacity-70 cursor-not-allowed" : "",
                )}
              >
                {isDeleting ? "Удаление..." : "Да, удалить"}
              </button>
            </div>
          </div>
        )}

        {/* Archive confirmation */}
        {showArchiveConfirm && (
          <div className="p-6 space-y-4">
            <div
              className={cn(
                "p-4 rounded-lg border",
                theme === "dark" ? "bg-amber-900 border-amber-700" : "bg-amber-50 border-amber-200",
              )}
            >
              <div className="flex items-start space-x-3">
                <div className={cn("flex-shrink-0 w-5 h-5 mt-0.5", theme === "dark" ? "text-amber-400" : "text-amber-600")}>
                  <svg fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <h4 className={cn("text-sm font-medium", theme === "dark" ? "text-amber-200" : "text-amber-800")}>
                    Архивирование загрузки
                  </h4>
                  <div className={cn("mt-2 text-sm", theme === "dark" ? "text-amber-300" : "text-amber-700")}>
                    <p className="mb-2"><strong>Что означает архивирование?</strong></p>
                    <p className="mb-2">
                      Архивирование скрывает загрузку с графика планирования.
                    </p>
                    <p className="mb-2">
                      Архивированные загрузки можно восстановить при необходимости.
                    </p>
                    {loading && (
                      <div className="mt-3 space-y-1.5 text-xs">
                        <p><strong>Этап:</strong> {loading.stageName || "Не указан"}</p>
                        <p><strong>Сотрудник:</strong> {loading.responsibleName || selectedEmployee?.full_name || "Не указан"}</p>
                        <p><strong>Даты:</strong> {formatDateDisplay(formData.startDate)} — {formatDateDisplay(formData.endDate)}</p>
                        <p><strong>Ставка:</strong> {formData.rate}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowArchiveConfirm(false)}
                disabled={isArchiving}
                className={cn(
                  "px-4 py-2 text-sm rounded border",
                  theme === "dark"
                    ? "border-slate-600 text-slate-300 hover:bg-slate-700"
                    : "border-slate-300 text-slate-600 hover:bg-slate-50",
                  isArchiving ? "opacity-50 cursor-not-allowed" : "",
                )}
              >
                Отмена
              </button>
              <button
                onClick={handleArchive}
                disabled={isArchiving}
                className={cn(
                  "px-4 py-2 text-sm rounded flex items-center justify-center min-w-[140px]",
                  theme === "dark"
                    ? "bg-amber-600 text-white hover:bg-amber-700"
                    : "bg-amber-500 text-white hover:bg-amber-600",
                  isArchiving ? "opacity-70 cursor-not-allowed" : "",
                )}
              >
                {isArchiving ? "Архивирование..." : "Архивировать"}
              </button>
            </div>
          </div>
        )}

        {/* Main content */}
        {!showDeleteConfirm && !showArchiveConfirm && (
          <div className="flex-1 flex overflow-hidden">
            {/* Left side - Tree */}
            <div className="w-96 border-r dark:border-slate-700 overflow-y-auto">
              <TooltipProvider>
                <div className="p-2 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium dark:text-slate-300">Проекты</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={handleRefreshAllProjects}
                          disabled={isRefreshingAll}
                          className="h-6 w-6 flex items-center justify-center rounded hover:bg-primary/10 transition-colors disabled:opacity-50"
                        >
                          <RefreshCw className={cn("h-4 w-4 text-primary", isRefreshingAll && "animate-spin")} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Обновить список проектов</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  {/* View Mode Toggle */}
                  <div className={cn(
                    "flex gap-1 p-1 rounded-lg",
                    theme === "dark"
                      ? "bg-slate-700"
                      : "bg-muted",
                    isTreeLocked && "opacity-50 cursor-not-allowed"
                  )}>
                    <button
                      onClick={() => setViewMode("my")}
                      disabled={isTreeLocked}
                      className={cn(
                        "flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors",
                        viewMode === "my"
                          ? theme === "dark"
                            ? "bg-slate-600 shadow-sm"
                            : "bg-background shadow-sm"
                          : theme === "dark"
                          ? "hover:bg-slate-600/50"
                          : "hover:bg-background/50",
                        isTreeLocked && "cursor-not-allowed"
                      )}
                    >
                      Мои проекты
                    </button>
                    <button
                      onClick={() => setViewMode("all")}
                      disabled={isTreeLocked}
                      className={cn(
                        "flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors",
                        viewMode === "all"
                          ? theme === "dark"
                            ? "bg-slate-600 shadow-sm"
                            : "bg-background shadow-sm"
                          : theme === "dark"
                          ? "hover:bg-slate-600/50"
                          : "hover:bg-background/50",
                        isTreeLocked && "cursor-not-allowed"
                      )}
                    >
                      Все проекты
                    </button>
                  </div>

                  {/* Search input */}
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Поиск проектов..."
                      value={projectSearchTerm}
                      onChange={(e) => setProjectSearchTerm(e.target.value)}
                      disabled={isTreeLocked}
                      className={cn(
                        "h-8 pl-8 pr-8 text-sm",
                        isTreeLocked && "opacity-50 cursor-not-allowed"
                      )}
                    />
                    {projectSearchTerm && (
                      <button
                        onClick={() => setProjectSearchTerm("")}
                        disabled={isTreeLocked}
                        className={cn(
                          "absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors",
                          isTreeLocked && "cursor-not-allowed opacity-50"
                        )}
                        aria-label="Очистить поиск"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Search results count */}
                  {projectSearchTerm.trim() && (
                    <div className="text-xs text-muted-foreground px-2">
                      Найдено: {filteredTreeData.length}
                    </div>
                  )}

                  {isLoadingTree ? (
                    <div className="p-4 text-center text-sm text-gray-500">Загрузка...</div>
                  ) : treeData.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500">
                      <p className="mb-2">Нет доступных проектов</p>
                      <button
                        onClick={() => buildFileTree()}
                        className="text-xs text-teal-500 hover:text-teal-600 underline"
                      >
                        Повторить загрузку
                      </button>
                    </div>
                  ) : filteredTreeData.length === 0 && !projectSearchTerm.trim() && viewMode === "my" ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      {userDepartmentId
                        ? "Нет проектов с разделами из вашего отдела"
                        : "Ваш отдел не указан в профиле"}
                    </div>
                  ) : filteredTreeData.length === 0 && projectSearchTerm.trim() ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Проекты не найдены
                    </div>
                  ) : (
                    <div className="p-1">{filteredTreeData.map((node) => renderNode(node))}</div>
                  )}
                </div>
              </TooltipProvider>
            </div>

            {/* Right side - Form */}
            <div className="flex-1 overflow-y-auto p-6">
              {(selectedNode || (mode === "create" && showCreateForm && isSelectingNewStage)) && (mode === "edit" || (mode === "create" && showCreateForm)) ? (
                <div className="space-y-6">
                  {/* Breadcrumbs */}
                  <div className="flex items-center gap-2 text-sm flex-wrap pb-4 border-b dark:border-slate-700">
                    {selectedNode && !selectedNode.decompositionStageId ? (
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                      </div>
                    ) : (
                      breadcrumbs.map((item, index) => (
                        <div key={item.id} className="flex items-center gap-2">
                          {index > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          {getNodeIcon(item, false)}
                          <span className="text-muted-foreground truncate">{item.name}</span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Stage Title with change button */}
                  {selectedNode ? (
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-xl font-semibold dark:text-slate-200">
                        Загрузка для этапа{" "}
                        <span className={cn(
                          theme === "dark" ? "text-teal-400" : "text-teal-600"
                        )}>
                          {selectedNode.name}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          if (mode === "edit") {
                            setIsChangingStage(true)

                            // Auto-expand the current project if selectedNode exists
                            if (selectedNode && selectedNode.projectId) {
                              const projectNodeId = `project-${selectedNode.projectId}`
                              setExpandedFolders(prev => {
                                const newSet = new Set(prev)
                                newSet.add(projectNodeId)
                                return newSet
                              })
                            }
                          } else {
                            // In create mode, keep form visible but unlock tree for stage selection
                            setIsSelectingNewStage(true)
                          }
                          setSelectedNode(null)
                          setBreadcrumbs([])
                        }}
                        className={cn(
                          "inline-flex items-center px-3 py-1.5 text-sm rounded border transition-colors flex-shrink-0",
                          theme === "dark"
                            ? "border-teal-600 text-teal-400 hover:bg-teal-900 hover:bg-opacity-20"
                            : "border-teal-500 text-teal-600 hover:bg-teal-50"
                        )}
                      >
                        <FilePenLine className="w-4 h-4 mr-2" />
                        Сменить этап
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full space-y-6 px-8">
                      {/* Title */}
                      <div className="text-center space-y-2">
                        <div className="text-2xl font-bold dark:text-slate-200">
                          Смена этапа
                        </div>
                        <p className="text-base text-muted-foreground">
                          Выберите новый этап из дерева слева
                        </p>
                      </div>

                      {/* Current loading info */}
                      <div className="bg-muted/50 rounded-lg p-6 space-y-3 w-full max-w-md">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Сотрудник:</span>
                          <span className="text-sm font-medium text-foreground">
                            {selectedEmployee?.full_name || "Не выбран"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Ставка:</span>
                          <span className="text-sm font-medium text-foreground">{formData.rate}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Период:</span>
                          <span className="text-sm font-medium text-foreground">
                            {formData.startDate && formData.endDate
                              ? `${formatDateDisplay(formData.startDate)} — ${formatDateDisplay(formData.endDate)}`
                              : "Не указан"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Show form fields only when stage is selected */}
                  {selectedNode && (
                    <>
                  {/* Employee Selector */}
                  <div>
                    <label className="block text-sm font-medium mb-1 dark:text-slate-300">Сотрудник</label>
                    <div className="relative" ref={inputWrapperRef}>
                      <input
                        type="text"
                        value={employeeSearchTerm}
                        onChange={(e) => {
                          setEmployeeSearchTerm(e.target.value)
                          setShowEmployeeDropdown(true)
                          if (selectedEmployee && e.target.value !== selectedEmployee.full_name) {
                            setSelectedEmployee(null)
                          }
                        }}
                        onFocus={() => setShowEmployeeDropdown(true)}
                        onBlur={(e) => {
                          if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) {
                            setTimeout(() => setShowEmployeeDropdown(false), 200)
                          }
                        }}
                        placeholder="Поиск сотрудника..."
                        disabled={isSaving || isLoadingEmployees || isArchiving || isDeleting}
                        className={cn(
                          "w-full text-sm rounded border px-3 py-2",
                          theme === "dark"
                            ? "bg-slate-700 border-slate-600 text-slate-200"
                            : "bg-white border-slate-300 text-slate-800",
                          errors.employee ? "border-red-500" : "",
                          (isSaving || isLoadingEmployees || isArchiving || isDeleting) ? "opacity-50 cursor-not-allowed" : "",
                        )}
                      />

                      {showEmployeeDropdown && filteredEmployees.length > 0 && dropdownPosition && typeof document !== 'undefined' && (
                        (typeof window !== 'undefined' && typeof require !== 'undefined') && (
                          require('react-dom').createPortal(
                            <div
                              style={{
                                position: 'fixed',
                                left: dropdownPosition.left,
                                top: dropdownPosition.top,
                                width: dropdownPosition.width,
                                transform: dropdownPosition.openUp
                                  ? 'translateY(-8px) translateY(-100%)'
                                  : 'translateY(8px)',
                              }}
                              className="z-50"
                              onMouseDown={(e) => e.preventDefault()}
                            >
                              <div className={cn(
                                "border rounded shadow-xl ring-1 ring-black/5 overflow-hidden",
                                theme === "dark" ? "bg-slate-700 border-slate-600" : "bg-white border-gray-200"
                              )}>
                                <div className={cn(
                                  "sticky top-0 backdrop-blur px-3 py-2 border-b text-xs uppercase tracking-wide",
                                  theme === "dark"
                                    ? "bg-slate-700/90 border-slate-600 text-slate-400"
                                    : "bg-white/90 border-gray-100 text-slate-500"
                                )}>
                                  Сотрудник
                                </div>
                                <div
                                  className="overflow-y-auto overscroll-contain"
                                  style={{ maxHeight: DROPDOWN_MAX_HEIGHT_PX }}
                                >
                                  {filteredEmployees.map((emp) => {
                                    const isSelected = emp.user_id === selectedEmployee?.user_id
                                    return (
                                      <button
                                        key={emp.user_id}
                                        type="button"
                                        onMouseDown={(e) => {
                                          e.preventDefault()
                                          handleEmployeeSelect(emp)
                                        }}
                                        className={cn(
                                          "w-full text-left px-3 py-2 cursor-pointer flex items-center space-x-3",
                                          isSelected && (theme === "dark"
                                            ? "bg-teal-900/30 text-teal-200"
                                            : "bg-teal-50 text-teal-900"),
                                          !isSelected && (theme === "dark"
                                            ? "hover:bg-slate-600 text-slate-200"
                                            : "hover:bg-slate-50 text-slate-800")
                                        )}
                                      >
                                      <Avatar
                                        name={emp.full_name}
                                        avatarUrl={emp.avatar_url}
                                        theme={theme === "dark" ? "dark" : "light"}
                                        size="sm"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="font-medium truncate">{emp.full_name}</div>
                                        <div className={cn(
                                          "text-xs truncate",
                                          theme === "dark" ? "text-slate-400" : "text-slate-500"
                                        )}>
                                          {emp.position_name || "Должность не указана"}
                                        </div>
                                      </div>
                                    </button>
                                    )
                                  })}
                                </div>
                              </div>
                            </div>,
                            document.body
                          )
                        )
                      )}
                    </div>
                    {errors.employee && <p className="text-xs text-red-500 mt-1">{errors.employee}</p>}
                    {isLoadingEmployees && <p className="text-xs text-slate-500 mt-1">Загрузка сотрудников...</p>}
                  </div>

                  {/* Rate Selector */}
                  <div>
                    <label className="block text-sm font-medium mb-2 dark:text-slate-300">Ставка</label>
                    <div className="flex flex-wrap gap-2">
                      {RATES.map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, rate }))
                            setManualRateInput("") // Clear manual input when chip is clicked
                            setManualRateError("") // Clear manual rate error
                            if (errors.rate) {
                              setErrors((prev) => {
                                const newErrors = { ...prev }
                                delete newErrors.rate
                                return newErrors
                              })
                            }
                          }}
                          disabled={isSaving || isArchiving || isDeleting}
                          className={cn(
                            "px-3 py-1 rounded-full text-sm font-medium border transition-colors",
                            formData.rate === rate
                              ? "bg-primary text-primary-foreground border-primary"
                              : theme === "dark"
                              ? "bg-slate-700 text-slate-200 border-slate-600 hover:bg-slate-600"
                              : "bg-background text-foreground border-input hover:bg-accent",
                            (isSaving || isArchiving || isDeleting) ? "opacity-50 cursor-not-allowed" : "",
                          )}
                        >
                          {rate}
                        </button>
                      ))}
                    </div>

                    {/* Manual input for custom rate */}
                    <div className="mt-3">
                      <label className="block text-xs text-muted-foreground mb-1">Или введите своё значение:</label>
                      <input
                        type="text"
                        value={manualRateInput}
                        onChange={handleManualRateChange}
                        placeholder="1.25"
                        disabled={isSaving || isArchiving || isDeleting}
                        className={cn(
                          "w-20 text-sm rounded-full border px-3 py-1 outline-none focus:ring-2 focus:ring-offset-0 transition-all",
                          theme === "dark"
                            ? "bg-slate-700 border-slate-600 text-slate-200 placeholder:text-slate-500"
                            : "bg-white border-slate-300 text-slate-800 placeholder:text-slate-400",
                          manualRateError
                            ? "!border-red-500 focus:!ring-red-500 focus:!border-red-500"
                            : "focus:ring-primary focus:border-primary",
                          (isSaving || isArchiving || isDeleting) ? "opacity-50 cursor-not-allowed" : "",
                        )}
                      />
                      {manualRateError && <p className="text-xs text-red-500 mt-1">{manualRateError}</p>}
                    </div>
                    {errors.rate && <p className="text-xs text-red-500 mt-1">{errors.rate}</p>}
                  </div>

                  {/* Date Range Picker */}
                  <div>
                    <label className="block text-sm font-medium mb-1 dark:text-slate-300">Период работ</label>
                    <DateRangePicker
                      value={{
                        from: formData.startDate ? new Date(formData.startDate) : null,
                        to: formData.endDate ? new Date(formData.endDate) : null,
                      }}
                      onChange={(range: DateRange) => {
                        const startFormatted = range.from ? formatLocalYMD(range.from) : null
                        const endFormatted = range.to ? formatLocalYMD(range.to) : null

                        setFormData((prev) => ({
                          ...prev,
                          startDate: startFormatted || prev.startDate,
                          endDate: endFormatted || prev.endDate,
                        }))

                        // Clear errors when dates are selected
                        if (range.from && range.to) {
                          setErrors((prev) => {
                            const newErrors = { ...prev }
                            delete newErrors.startDate
                            delete newErrors.endDate
                            return newErrors
                          })
                        }
                      }}
                      placeholder="Выберите период"
                      hideSingleDateActions={true}
                      inputClassName={cn(
                        "w-full text-sm rounded border px-3 py-2",
                        theme === "dark"
                          ? "bg-slate-700 border-slate-600 text-slate-200"
                          : "bg-white border-slate-300 text-slate-800",
                        (errors.startDate || errors.endDate) ? "border-red-500" : "",
                        (isSaving || isArchiving || isDeleting) ? "opacity-50 cursor-not-allowed pointer-events-none" : "",
                      )}
                    />
                    {(errors.startDate || errors.endDate) && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors.startDate || errors.endDate}
                      </p>
                    )}
                    {/* Working days and hours counter */}
                    {formData.startDate && formData.endDate && (
                      <div className="text-sm text-slate-600 dark:text-slate-400 mt-2 space-y-1">
                        <div>Количество рабочих дней: {workingDaysCount}</div>
                        <div>Количество рабочих часов с учётом ставки: {workingHoursCount} ч</div>
                      </div>
                    )}
                  </div>

                  {/* Comment */}
                  <div>
                    <label className="block text-sm font-medium mb-1 dark:text-slate-300">Комментарий (необязательно)</label>
                    <textarea
                      name="comment"
                      value={formData.comment}
                      onChange={handleChange}
                      rows={3}
                      placeholder="Например: уточнение по задачам, договорённости и т.п."
                      disabled={isSaving || isArchiving || isDeleting}
                      className={cn(
                        "w-full text-sm rounded border px-3 py-2 resize-y min-h-[72px]",
                        theme === "dark"
                          ? "bg-slate-700 border-slate-600 text-slate-200 placeholder:text-slate-400"
                          : "bg-white border-slate-300 text-slate-800 placeholder:text-slate-400",
                        (isSaving || isArchiving || isDeleting) ? "opacity-50 cursor-not-allowed" : "",
                      )}
                    />
                  </div>

                  {/* Action buttons */}
                  <div className={cn("flex gap-2 pt-4", mode === "edit" ? "justify-between" : "justify-end")}>
                    {mode === "edit" && (
                      <div className="flex gap-2 items-center">
                        <button
                          onClick={() => setShowArchiveConfirm(true)}
                          disabled={isSaving || isArchiving}
                          className={cn(
                            "px-4 py-2 text-sm rounded border",
                            theme === "dark"
                              ? "border-amber-600 text-amber-400 hover:bg-amber-900 hover:bg-opacity-20"
                              : "border-amber-500 text-amber-600 hover:bg-amber-50",
                            (isSaving || isArchiving) ? "opacity-50 cursor-not-allowed" : "",
                          )}
                        >
                          В архив
                        </button>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => setShowDeleteConfirm(true)}
                                disabled={isSaving || isDeleting}
                                className={cn(
                                  "p-2 rounded border transition-colors",
                                  theme === "dark"
                                    ? "border-red-600 text-red-400 hover:bg-red-900 hover:bg-opacity-20"
                                    : "border-red-300 text-red-600 hover:bg-red-50",
                                  (isSaving || isDeleting) ? "opacity-50 cursor-not-allowed" : "",
                                )}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Удалить</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={handleClose}
                        disabled={isSaving || isArchiving || isDeleting}
                        className={cn(
                          "px-4 py-2 text-sm rounded border",
                          theme === "dark"
                            ? "border-slate-600 text-slate-300 hover:bg-slate-700"
                            : "border-slate-300 text-slate-600 hover:bg-slate-50",
                          (isSaving || isArchiving || isDeleting) ? "opacity-50 cursor-not-allowed" : "",
                        )}
                      >
                        Отмена
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={
                          isSaving ||
                          isArchiving ||
                          isDeleting ||
                          !selectedEmployee ||
                          !formData.startDate ||
                          !formData.endDate ||
                          new Date(formData.startDate) > new Date(formData.endDate) ||
                          formData.rate <= 0 ||
                          formData.rate > 2 ||
                          !selectedNode?.decompositionStageId ||
                          (mode === "edit" && !hasChanges)
                        }
                        className={cn(
                          "px-4 py-2 text-sm rounded flex items-center justify-center min-w-[100px]",
                          theme === "dark"
                            ? "bg-teal-600 text-white hover:bg-teal-700"
                            : "bg-teal-500 text-white hover:bg-teal-600",
                          (isSaving ||
                            isArchiving ||
                            isDeleting ||
                            !selectedEmployee ||
                            !formData.startDate ||
                            !formData.endDate ||
                            new Date(formData.startDate) > new Date(formData.endDate) ||
                            formData.rate <= 0 ||
                            formData.rate > 2 ||
                            !selectedNode?.decompositionStageId ||
                            (mode === "edit" && !hasChanges)) &&
                            "opacity-50 cursor-not-allowed",
                        )}
                      >
                        {isSaving ? "Сохранение..." : mode === "create" ? "Создать" : "Сохранить"}
                      </button>
                    </div>
                  </div>
                    </>
                  )}
                </div>
              ) : selectedNode && mode === "create" && !showCreateForm ? (
                // Create mode - Stage selected, show "Create Loading" button
                <div className="flex flex-col items-center justify-center h-full space-y-8 px-8">
                  {/* Breadcrumbs */}
                  <div className="flex items-center gap-2 text-sm flex-wrap justify-center">
                    {breadcrumbs.map((item, index) => (
                      <div key={item.id} className="flex items-center gap-2">
                        {index > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        {getNodeIcon(item, false)}
                        <span className="text-muted-foreground truncate">{item.name}</span>
                      </div>
                    ))}
                  </div>

                  {/* Stage name */}
                  <div className="text-center space-y-2">
                    <div className="text-2xl font-bold dark:text-slate-200">
                      {selectedNode.name}
                    </div>
                    {originalEmployeeRef.current && (
                      <p className="text-base text-muted-foreground">
                        Создание загрузки для{" "}
                        <span className="font-medium text-foreground">
                          {originalEmployeeRef.current.full_name}
                        </span>
                      </p>
                    )}
                  </div>

                  {/* Big Create Loading Button */}
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className={cn(
                      "px-8 py-4 text-lg font-semibold rounded-lg shadow-lg transition-all hover:scale-105 active:scale-95",
                      theme === "dark"
                        ? "bg-teal-600 text-white hover:bg-teal-700"
                        : "bg-teal-500 text-white hover:bg-teal-600"
                    )}
                  >
                    Создать загрузку
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  {mode === "edit" && originalValuesRef.current.employeeId === "" ? (
                    // Loading spinner for edit mode while data is being loaded
                    <div className="flex flex-col items-center gap-4">
                      <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                      <p className="text-sm text-muted-foreground">Загрузка данных...</p>
                    </div>
                  ) : (
                    // Message for create mode - select a stage
                    originalEmployeeRef.current && (
                      <p className="text-sm text-muted-foreground text-center max-w-md">
                        Выберите этап из дерева слева для создания в нем загрузки на сотрудника{" "}
                        <span className="font-medium text-foreground">
                          {originalEmployeeRef.current.full_name}
                        </span>
                      </p>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      </div>

      {/* SectionPanel for decomposition */}
      {showSectionPanel && sectionPanelSectionId && (
        <SectionPanel
          isOpen={showSectionPanel}
          onClose={() => {
            setShowSectionPanel(false)
            // Clear cache and reload project tree after decomposition changes
            if (sectionPanelProjectId) {
              // ВАЖНО: Сохраняем ID выбранного этапа перед перезагрузкой
              const savedDecompositionStageId = selectedNode?.decompositionStageId

              setProjectDataCache((prev) => {
                const next = new Map(prev)
                next.delete(sectionPanelProjectId)
                return next
              })
              // Find and reload the project node
              const projectNode = treeData.find(n => n.id === `project-${sectionPanelProjectId}`)
              if (projectNode) {
                // Small delay to ensure state update, then reload and restore selection
                setTimeout(async () => {
                  await loadNodeChildren(projectNode, true)

                  // После перезагрузки дерева восстанавливаем выбранный этап
                  if (savedDecompositionStageId) {
                    // Дополнительная небольшая задержка для гарантии обновления treeData
                    setTimeout(() => {
                      findAndSelectNode(savedDecompositionStageId, sectionPanelProjectId)
                    }, 100)
                  }
                }, 0)
              }
            }
            // Clear section panel IDs
            setSectionPanelSectionId(null)
            setSectionPanelProjectId(null)
          }}
          sectionId={sectionPanelSectionId}
          initialTab="decomposition"
          statuses={statuses}
        />
      )}
    </>
  )
}
