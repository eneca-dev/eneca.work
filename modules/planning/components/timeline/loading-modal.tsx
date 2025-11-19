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
import { ChevronRight, ChevronDown, Folder, FolderOpen, File, FilePlus, RefreshCw, Search } from "lucide-react"
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { DatePicker } from "@/modules/projects/components/DatePicker"

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

const RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
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
  const [viewMode, setViewMode] = useState<"my" | "all">("my")

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
  const { statuses } = useSectionStatuses()

  // State for creating stages
  const [isCreatingStage, setIsCreatingStage] = useState(false)

  // State for refresh operations
  const [refreshingProjects, setRefreshingProjects] = useState<Set<string>>(new Set())
  const [isRefreshingAll, setIsRefreshingAll] = useState(false)

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
    // Prevent concurrent calls
    if (isLoadingTreeRef.current) {
      console.log("[LoadingModal] buildFileTree уже выполняется, пропуск...")
      return
    }
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

          console.log("[LoadingModal] Загрузка списка проектов...")

          // Fetch projects with department information
          const { data: projects, error: projectsError } = await supabase
            .from("view_projects_with_department_info")
            .select("*")
            .order("project_name")

          if (projectsError) throw projectsError

          console.log(`[LoadingModal] Загружено проектов: ${projects?.length || 0}`)

          // Filter projects by department in "my" mode
          let filteredProjects = projects as ProjectWithDepartmentInfo[] | null
          if (viewMode === "my" && userDepartmentId) {
            console.log(`[LoadingModal] Фильтрация проектов по отделу: ${userDepartmentId}`)
            filteredProjects = projects?.filter(
              (p) => p.department_ids && p.department_ids.includes(userDepartmentId)
            ) || null
            console.log(`[LoadingModal] После фильтрации осталось проектов: ${filteredProjects?.length || 0}`)
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

          setTreeData(tree)
          console.log("[LoadingModal] Список проектов загружен")
        } catch (error) {
          span.setAttribute("db.success", false)
          span.setAttribute("db.error", error instanceof Error ? error.message : "Unknown error")

          console.error("[LoadingModal] Ошибка при загрузке проектов:", error)

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
        }
      },
    )
  }, [mode, setNotification, clearNotification, viewMode, userDepartmentId])

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
  const loadNodeChildren = useCallback(async (node: FileTreeNode, forceRefresh = false) => {
    if (!node.projectId || loadingNodes.has(node.id)) {
      return
    }

    setLoadingNodes((prev) => new Set(prev).add(node.id))

    try {
      console.log(`[LoadingModal] Загрузка данных для проекта: ${node.name}`)

      // Check cache first (unless forceRefresh is true)
      let projectData = forceRefresh ? null : projectDataCache.get(node.projectId)

      if (!projectData) {
        // Fetch all project data from view in ONE query
        const { data, error } = await supabase
          .from("view_project_tree_with_loadings")
          .select("*")
          .eq("project_id", node.projectId)

        if (error) throw error

        let fetchedData = (data as ProjectTreeViewRow[]) || []

        // Apply department filter in "my projects" mode
        if (viewMode === "my" && userDepartmentId) {
          console.log(`[LoadingModal] Фильтрация по отделу: ${userDepartmentId}`)
          fetchedData = fetchedData.filter(row =>
            row.section_id && row.responsible_department_id === userDepartmentId
          )
          console.log(`[LoadingModal] После фильтрации осталось ${fetchedData.length} строк`)
        }

        projectData = fetchedData

        // Cache the filtered result
        setProjectDataCache((prev) => new Map(prev).set(node.projectId!, projectData!))
        console.log(`[LoadingModal] Загружено ${projectData.length} строк из view для проекта`)

        // DEBUG: Show sample rows
        if (projectData.length > 0) {
          console.log(`[LoadingModal] DEBUG: Первая строка из view:`, {
            decomposition_stage_id: projectData[0].decomposition_stage_id,
            decomposition_stage_name: projectData[0].decomposition_stage_name,
            loading_id: projectData[0].loading_id,
            loading_responsible_full_name: projectData[0].loading_responsible_full_name,
            section_id: projectData[0].section_id,
            section_name: projectData[0].section_name,
          })

          // Show rows with loading_id if any
          const rowsWithLoadings = projectData.filter(r => r.loading_id)
          console.log(`[LoadingModal] DEBUG: Строк с loading_id: ${rowsWithLoadings.length}`)
          if (rowsWithLoadings.length > 0) {
            console.log(`[LoadingModal] DEBUG: Первая строка с loading:`, rowsWithLoadings[0])
          }
        }
      } else {
        console.log(`[LoadingModal] Используются кэшированные данные (${projectData.length} строк)`)
      }

      // Build tree structure from cached data
      const stageNodes = buildStageNodes(projectData, node.projectId)

      // Build full hierarchy
      for (const stageNode of stageNodes) {
        const objectNodes = buildObjectNodes(projectData, stageNode.stageId!, node.projectId)

        for (const objectNode of objectNodes) {
          const sectionNodes = buildSectionNodes(projectData, objectNode.objectId!, stageNode.stageId!, node.projectId)

          for (const sectionNode of sectionNodes) {
            const decompNodes = buildDecompositionStageNodes(
              projectData,
              sectionNode.sectionId!,
              objectNode.objectId!,
              stageNode.stageId!,
              node.projectId
            )

            sectionNode.children = decompNodes
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

      console.log(`[LoadingModal] Дерево построено для проекта "${node.name}"`)
    } catch (error) {
      console.error(`[LoadingModal] Ошибка при загрузке данных проекта:`, error)
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
      next.delete(projectId)
      return next
    })
    console.log(`[LoadingModal] Кэш очищен для проекта: ${projectId}`)
  }, [])

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
      console.log(`[LoadingModal] Принудительное обновление проекта: ${projectNode.name}`)
      setProjectDataCache((prev) => {
        const next = new Map(prev)
        next.delete(projectNode.projectId!)
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
      console.log("[LoadingModal] Полное обновление: очистка всего кэша и перезагрузка списка проектов")
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
    if (!hasLoadedTreeRef.current) {
      console.log("[LoadingModal] Первая загрузка - запуск buildFileTree и fetchEmployees")
      buildFileTree()
      fetchEmployees()
    }
  }, [buildFileTree, fetchEmployees])

  // Clear cache and reload when view mode changes
  useEffect(() => {
    if (hasLoadedTreeRef.current) {
      console.log(`[LoadingModal] Режим отображения изменен на: ${viewMode}`)
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
    if (treeData.length === 0) return

    let targetStageId: string | undefined
    let targetProjectId: string | undefined

    if (mode === "edit" && loading?.stageId) {
      targetStageId = loading.stageId
      // Try to get project ID from loading or section
      targetProjectId = loading.projectId || section?.projectId

      console.log("[LoadingModal] Режим редактирования - автовыбор этапа:", {
        targetStageId,
        targetProjectId,
        loadingData: {
          id: loading.id,
          projectId: loading.projectId,
          sectionId: loading.sectionId,
          stageId: loading.stageId,
        },
      })
    } else if (mode === "create" && stageId) {
      targetStageId = stageId
      targetProjectId = section?.projectId

      console.log("[LoadingModal] Режим создания - автовыбор этапа:", {
        targetStageId,
        targetProjectId,
      })
    }

    if (targetStageId && targetProjectId) {
      // Find the project node
      const projectNodeId = `project-${targetProjectId}`
      const projectNode = treeData.find((n) => n.id === projectNodeId)

      if (projectNode) {
        console.log(`[LoadingModal] Найден проект: ${projectNode.name} (${projectNodeId})`)

        // Установить название проекта в поиск, чтобы проект отображался в дереве
        setProjectSearchTerm(projectNode.name)

        // Load project data if not loaded yet
        if (projectNode.children?.length === 0) {
          console.log(`[LoadingModal] Загрузка данных проекта для stageId: ${targetStageId}`)
          loadNodeChildren(projectNode).then(() => {
            // After loading, find and select the target node
            setTimeout(() => {
              findAndSelectNode(targetStageId!)
            }, 100)
          })
        } else {
          console.log(`[LoadingModal] Данные проекта уже загружены, поиск этапа...`)
          // Data already loaded, just find and select
          findAndSelectNode(targetStageId)
        }
      } else {
        console.warn(`[LoadingModal] Проект не найден: ${projectNodeId}`)
      }
    } else if (targetStageId && !targetProjectId) {
      console.warn("[LoadingModal] targetProjectId отсутствует, попытка получить из sectionId...")

      // Fallback: fetch projectId from sectionId if missing
      if (loading?.sectionId) {
        supabase
          .from("view_section_hierarchy")
          .select("project_id")
          .eq("section_id", loading.sectionId)
          .limit(1)
          .maybeSingle()
          .then(({ data, error }) => {
            if (error) {
              console.error("[LoadingModal] Ошибка при получении project_id:", error)
              return
            }
            if (data?.project_id) {
              console.log(`[LoadingModal] Получен project_id из БД: ${data.project_id}`)
              targetProjectId = data.project_id

              // Retry auto-expand with fetched projectId
              const projectNodeId = `project-${targetProjectId}`
              const projectNode = treeData.find((n) => n.id === projectNodeId)

              if (projectNode) {
                // Установить название проекта в поиск
                setProjectSearchTerm(projectNode.name)

                if (projectNode.children?.length === 0) {
                  loadNodeChildren(projectNode).then(() => {
                    setTimeout(() => findAndSelectNode(targetStageId!), 100)
                  })
                } else {
                  findAndSelectNode(targetStageId!)
                }
              }
            }
          })
      }
    }

    function findAndSelectNode(decompositionStageId: string) {
      console.log(`[LoadingModal] Поиск этапа декомпозиции: ${decompositionStageId}`)

      const findNodeById = (nodes: FileTreeNode[], id: string): FileTreeNode | null => {
        for (const node of nodes) {
          if (node.decompositionStageId === id) return node
          if (node.children) {
            const found = findNodeById(node.children, id)
            if (found) return found
          }
        }
        return null
      }

      const targetNode = findNodeById(treeData, decompositionStageId)
      if (targetNode) {
        console.log(`[LoadingModal] Этап найден: ${targetNode.name} (${targetNode.id})`)
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
        console.log(`[LoadingModal] Раскрытие папок: ${pathToExpand.length} уровней`)
        // Also expand the target node itself to show its loadings
        const foldersToExpand = new Set([...pathToExpand, targetNode.id])
        setExpandedFolders(foldersToExpand)
        setSelectedNode(targetNode)
        console.log(`[LoadingModal] Этап успешно выбран и развёрнут: ${targetNode.name}`)

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

        setBreadcrumbs(buildBreadcrumbs(targetNode))
      } else {
        console.warn(`[LoadingModal] Этап декомпозиции не найден: ${decompositionStageId}`)
        console.warn("[LoadingModal] Доступные узлы дерева:", treeData)
      }
    }
  }, [treeData, mode, loading, stageId, section, loadNodeChildren])

  // Pre-fill employee for edit mode
  useEffect(() => {
    if (mode === "edit" && loading && employees.length > 0) {
      console.log("[LoadingModal] Предзаполнение сотрудника для режима редактирования:", {
        responsibleId: loading.responsibleId,
        employeesCount: employees.length,
      })

      const emp = employees.find((e) => e.user_id === loading.responsibleId)
      if (emp) {
        console.log(`[LoadingModal] Сотрудник найден: ${emp.full_name}`)
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
        console.log("[LoadingModal] ✅ Исходные значения сохранены (все данные готовы):", originalValuesRef.current)
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

      console.log("[LoadingModal] 🔄 formData сброшен к исходным значениям из loading при открытии")
    }

    // Reset originalValuesRef when modal closes (for both modes)
    if (!isOpen) {
      originalValuesRef.current = {
        startDate: "",
        endDate: "",
        rate: 0,
        comment: "",
        employeeId: "",
        stageId: "",
      }
      console.log("[LoadingModal] 🔄 originalValuesRef сброшен при закрытии модалки")

      // Сбросить formData к исходным значениям из loading (для edit mode)
      // Это отменяет все несохранённые изменения
      if (mode === "edit" && loading) {
        setFormData({
          startDate: normalizeDateValue(loading.startDate) || formatLocalYMD(new Date())!,
          endDate: normalizeDateValue(loading.endDate) || formatLocalYMD(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))!,
          rate: loading.rate ?? 1,
          comment: loading.comment || "",
        })
        console.log("[LoadingModal] 🔄 formData сброшен к исходным значениям из loading")
      }
    }
  }, [isOpen, mode, loading?.id, loading?.startDate, loading?.endDate, loading?.rate, loading?.comment, normalizeDateValue, formatLocalYMD])

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

  // Toggle folder expansion
  const toggleFolder = (folderId: string) => {
    const isExpanding = !expandedFolders.has(folderId)

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
        loadNodeChildren(node)
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

  // Check if any field has changed in edit mode
  const hasChanges = useMemo(() => {
    // In create mode, always allow saving (if validation passes)
    if (mode === "create") return true

    // Если originalValues еще не инициализированы (данные еще загружаются), считаем что изменений нет
    if (originalValuesRef.current.employeeId === "") {
      console.log("[LoadingModal] ⚠️ originalValues еще не инициализированы, кнопка неактивна")
      return false
    }

    // In edit mode, check if any field differs from original
    const startDateChanged = formData.startDate !== originalValuesRef.current.startDate
    const endDateChanged = formData.endDate !== originalValuesRef.current.endDate
    const rateChanged = formData.rate !== originalValuesRef.current.rate
    const commentChanged = (formData.comment || "") !== (originalValuesRef.current.comment || "")
    const employeeChanged = (selectedEmployee?.user_id || "") !== (originalValuesRef.current.employeeId || "")
    const stageChanged = (selectedNode?.decompositionStageId || "") !== (originalValuesRef.current.stageId || "")

    const changed = startDateChanged || endDateChanged || rateChanged || commentChanged || employeeChanged || stageChanged

    console.log("[LoadingModal] Проверка изменений:", {
      startDateChanged,
      endDateChanged,
      rateChanged,
      commentChanged,
      employeeChanged,
      stageChanged,
      hasChanges: changed,
      current: {
        startDate: formData.startDate,
        endDate: formData.endDate,
        rate: formData.rate,
        comment: formData.comment,
        employeeId: selectedEmployee?.user_id,
        stageId: selectedNode?.decompositionStageId,
      },
      original: originalValuesRef.current,
    })

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

  // Render FileTree node
  const renderNode = (node: FileTreeNode, depth = 0): React.ReactNode => {
    const isExpanded = expandedFolders.has(node.id)
    const isDecompositionStageNode = node.type === "file" && node.decompositionStageId
    const isSelected = selectedNode?.id === node.id
    const hasChildren = node.children && node.children.length > 0
    const isLoading = loadingNodes.has(node.id)
    const isSectionNode = node.type === "folder" && node.sectionId && !node.decompositionStageId
    const isProjectNode = node.type === "folder" && node.projectId && !node.stageId
    const isRefreshingProject = refreshingProjects.has(node.id)

    const isDisabledStage = !isSelected && selectedNode && isDecompositionStageNode

    const nodeContent = (
      <div
        className={cn(
          "group flex items-center gap-1 py-1 px-2 text-sm rounded-sm select-none transition-colors duration-150",
          isSelected && "bg-primary/10 text-primary border-l-2 border-primary cursor-pointer",
          !isSelected && !selectedNode && "hover:bg-accent hover:text-accent-foreground cursor-pointer",
          !isSelected && selectedNode && isDecompositionStageNode && "opacity-50 cursor-not-allowed",
          !isSelected && selectedNode && !isDecompositionStageNode && "hover:bg-accent hover:text-accent-foreground cursor-pointer",
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => {
          if (node.type === "folder") {
            toggleFolder(node.id)
          } else if (node.type === "file" && node.decompositionStageId) {
            // Если уже выбран этап, блокируем выбор другого
            if (!selectedNode) {
              handleNodeSelect(node)
            }
          }
        }}
      >
        {node.type === "folder" ? (
          <>
            <button className="h-4 w-4 p-0">
              {isLoading ? (
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
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
            {isExpanded ? <FolderOpen className="h-4 w-4 text-blue-500" /> : <Folder className="h-4 w-4 text-blue-500" />}
          </>
        ) : (
          <>
            <div className="h-4 w-4" />
            <File className="h-4 w-4 text-gray-500" />
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
                  <RefreshCw className={cn("h-4 w-4 text-primary", isRefreshingProject && "animate-spin")} />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Обновить проект</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Hover action icons for section nodes */}
        {isSectionNode && (
          <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Navigate to decomposition */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedNode(node)
                    setShowSectionPanel(true)
                  }}
                  className="h-6 w-6 flex items-center justify-center rounded hover:bg-primary/10 transition-colors"
                >
                  <ChevronRight className="h-4 w-4 text-primary" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Перейти к декомпозиции</p>
              </TooltipContent>
            </Tooltip>

            {/* Create basic stage */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => handleCreateBasicStage(node, e)}
                  disabled={isCreatingStage}
                  className="h-6 w-6 flex items-center justify-center rounded hover:bg-primary/10 transition-colors disabled:opacity-50"
                >
                  <FilePlus className="h-4 w-4 text-primary" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Создать базовый этап</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    )

    return (
      <div key={node.id}>
        {isDisabledStage ? (
          <Tooltip>
            <TooltipTrigger asChild>
              {nodeContent}
            </TooltipTrigger>
            <TooltipContent>
              <p>Нажмите &quot;Сменить этап&quot; для выбора другого этапа</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          nodeContent
        )}

        {node.type === "folder" && hasChildren && isExpanded && (
          <div>{node.children!.map((child) => renderNode(child, depth + 1))}</div>
        )}

        {/* Show message for empty folders (only if not loading) */}
        {node.type === "folder" && !hasChildren && isExpanded && !isLoading && (
          <div
            className="text-xs text-muted-foreground italic px-2 py-1"
            style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
          >
            {node.sectionId && !node.decompositionStageId
              ? "Этапы декомпозиции отсутствуют"
              : node.objectId && !node.sectionId
              ? "Разделы отсутствуют"
              : node.stageId && !node.objectId
              ? "Объекты отсутствуют"
              : node.projectId && !node.stageId
              ? "Стадии отсутствуют"
              : "Нет данных"}
          </div>
        )}
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

  // Handle form changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === "rate" ? (value === "" ? 0 : Number.parseFloat(value) || 0) : value,
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

  const navigateToDecomposition = () => {
    if (!selectedNode?.sectionId) return
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
          if (e.target === e.currentTarget && !isSaving && !isDeleting) {
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
            disabled={isSaving || isDeleting}
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
                theme === "dark" ? "bg-amber-900 border-amber-700" : "bg-amber-50 border-amber-200",
              )}
            >
              <div className="flex items-start space-x-3">
                <div className={cn("flex-shrink-0 w-5 h-5 mt-0.5", theme === "dark" ? "text-amber-400" : "text-amber-600")}>
                  <svg fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <h4 className={cn("text-sm font-medium", theme === "dark" ? "text-amber-200" : "text-amber-800")}>
                    Внимание! Удаление загрузки
                  </h4>
                  <div className={cn("mt-2 text-sm", theme === "dark" ? "text-amber-300" : "text-amber-700")}>
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

        {/* Main content */}
        {!showDeleteConfirm && (
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
                  <div className="flex gap-1 p-1 bg-muted rounded-lg">
                    <button
                      onClick={() => setViewMode("my")}
                      className={cn(
                        "flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors",
                        viewMode === "my"
                          ? "bg-background shadow-sm"
                          : "hover:bg-background/50"
                      )}
                    >
                      Мои проекты
                    </button>
                    <button
                      onClick={() => setViewMode("all")}
                      className={cn(
                        "flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors",
                        viewMode === "all"
                          ? "bg-background shadow-sm"
                          : "hover:bg-background/50"
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
                      className="h-8 pl-8 text-sm"
                    />
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
              {selectedNode ? (
                <div className="space-y-6">
                  {/* Breadcrumbs with change stage button */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2 text-sm flex-wrap flex-1">
                      {breadcrumbs.map((item, index) => (
                        <div key={item.id} className="flex items-center gap-2">
                          {index > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          <span className="text-muted-foreground">{item.name}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        // Reset selection to allow choosing a new stage
                        setSelectedNode(null)
                        setBreadcrumbs([])
                      }}
                      className={cn(
                        "px-3 py-1.5 text-sm rounded border transition-colors flex-shrink-0",
                        theme === "dark"
                          ? "border-teal-600 text-teal-400 hover:bg-teal-900 hover:bg-opacity-20"
                          : "border-teal-500 text-teal-600 hover:bg-teal-50"
                      )}
                    >
                      Сменить этап
                    </button>
                  </div>

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
                        disabled={isSaving || isLoadingEmployees}
                        className={cn(
                          "w-full text-sm rounded border px-3 py-2",
                          theme === "dark"
                            ? "bg-slate-700 border-slate-600 text-slate-200"
                            : "bg-white border-slate-300 text-slate-800",
                          errors.employee ? "border-red-500" : "",
                          isSaving || isLoadingEmployees ? "opacity-50 cursor-not-allowed" : "",
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
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, rate }))
                            if (errors.rate) {
                              setErrors((prev) => {
                                const newErrors = { ...prev }
                                delete newErrors.rate
                                return newErrors
                              })
                            }
                          }}
                          className={cn(
                            "px-3 py-1 rounded-full text-sm font-medium border transition-colors",
                            formData.rate === rate
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background text-foreground border-input hover:bg-accent",
                          )}
                        >
                          {rate}
                        </button>
                      ))}
                    </div>
                    {errors.rate && <p className="text-xs text-red-500 mt-1">{errors.rate}</p>}
                  </div>

                  {/* Date Range Picker */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1 dark:text-slate-300">Дата начала</label>
                      <DatePicker
                        value={formData.startDate ? new Date(formData.startDate) : null}
                        onChange={(date) => {
                          const formatted = formatLocalYMD(date)
                          if (formatted) {
                            setFormData((prev) => ({ ...prev, startDate: formatted }))
                            if (errors.startDate) {
                              setErrors((prev) => {
                                const newErrors = { ...prev }
                                delete newErrors.startDate
                                return newErrors
                              })
                            }
                          }
                        }}
                        placeholder="дд.мм.гггг"
                        inputClassName={cn(
                          "w-full text-sm rounded border px-3 py-2",
                          theme === "dark"
                            ? "bg-slate-700 border-slate-600 text-slate-200"
                            : "bg-white border-slate-300 text-slate-800",
                          errors.startDate ? "border-red-500" : "",
                          isSaving ? "opacity-50 cursor-not-allowed pointer-events-none" : "",
                        )}
                      />
                      {errors.startDate && <p className="text-xs text-red-500 mt-1">{errors.startDate}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1 dark:text-slate-300">Дата окончания</label>
                      <DatePicker
                        value={formData.endDate ? new Date(formData.endDate) : null}
                        onChange={(date) => {
                          const formatted = formatLocalYMD(date)
                          if (formatted) {
                            setFormData((prev) => ({ ...prev, endDate: formatted }))
                            if (errors.endDate) {
                              setErrors((prev) => {
                                const newErrors = { ...prev }
                                delete newErrors.endDate
                                return newErrors
                              })
                            }
                          }
                        }}
                        placeholder="дд.мм.гггг"
                        inputClassName={cn(
                          "w-full text-sm rounded border px-3 py-2",
                          theme === "dark"
                            ? "bg-slate-700 border-slate-600 text-slate-200"
                            : "bg-white border-slate-300 text-slate-800",
                          errors.endDate ? "border-red-500" : "",
                          isSaving ? "opacity-50 cursor-not-allowed pointer-events-none" : "",
                        )}
                      />
                      {errors.endDate && <p className="text-xs text-red-500 mt-1">{errors.endDate}</p>}
                    </div>
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
                      disabled={isSaving}
                      className={cn(
                        "w-full text-sm rounded border px-3 py-2 resize-y min-h-[72px]",
                        theme === "dark"
                          ? "bg-slate-700 border-slate-600 text-slate-200 placeholder:text-slate-400"
                          : "bg-white border-slate-300 text-slate-800 placeholder:text-slate-400",
                        isSaving ? "opacity-50 cursor-not-allowed" : "",
                      )}
                    />
                  </div>

                  {/* Action buttons */}
                  <div className={cn("flex gap-2 pt-4", mode === "edit" ? "justify-between" : "justify-end")}>
                    {mode === "edit" && (
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        disabled={isSaving}
                        className={cn(
                          "px-4 py-2 text-sm rounded border",
                          theme === "dark"
                            ? "border-red-600 text-red-400 hover:bg-red-900 hover:bg-opacity-20"
                            : "border-red-300 text-red-600 hover:bg-red-50",
                          isSaving ? "opacity-50 cursor-not-allowed" : "",
                        )}
                      >
                        Удалить
                      </button>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={handleClose}
                        disabled={isSaving}
                        className={cn(
                          "px-4 py-2 text-sm rounded border",
                          theme === "dark"
                            ? "border-slate-600 text-slate-300 hover:bg-slate-700"
                            : "border-slate-300 text-slate-600 hover:bg-slate-50",
                          isSaving ? "opacity-50 cursor-not-allowed" : "",
                        )}
                      >
                        Отмена
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={
                          isSaving ||
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
                        Выберите этап из дерева слева для создания загрузки на сотрудника{" "}
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
      {showSectionPanel && selectedNode?.sectionId && (
        <SectionPanel
          isOpen={showSectionPanel}
          onClose={() => {
            setShowSectionPanel(false)
            // Clear cache and reload project tree after decomposition changes
            if (selectedNode?.projectId) {
              console.log(`[LoadingModal] Обновление дерева после изменений в декомпозиции проекта: ${selectedNode.projectId}`)
              setProjectDataCache((prev) => {
                const next = new Map(prev)
                next.delete(selectedNode.projectId!)
                return next
              })
              // Find and reload the project node
              const projectNode = treeData.find(n => n.id === `project-${selectedNode.projectId}`)
              if (projectNode) {
                // Small delay to ensure state update
                setTimeout(() => {
                  loadNodeChildren(projectNode, true)
                }, 0)
              }
            }
          }}
          sectionId={selectedNode.sectionId}
          initialTab="decomposition"
          statuses={statuses}
        />
      )}
    </>
  )
}
