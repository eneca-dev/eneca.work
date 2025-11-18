"use client"

import type React from "react"
import * as Sentry from "@sentry/nextjs"
import { cn } from "@/lib/utils"
import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import type { Loading, Employee, Section } from "../../types"
import { useUiStore } from "@/stores/useUiStore"
import { usePlanningStore } from "../../stores/usePlanningStore"
import { useProjectsStore } from "@/modules/projects/store"
import { supabase } from "@/lib/supabase-client"
import { Avatar } from "../avatar"
import { SectionPanel } from "@/components/modals/SectionPanel"
import { useSectionStatuses } from "@/modules/statuses-tags/statuses/hooks/useSectionStatuses"
import { ChevronRight, ChevronDown, Folder, FolderOpen, File, FilePlus, RefreshCw, Users } from "lucide-react"
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"

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
  const formatLocalYMD = (date: Date): string | null => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  const normalizeDateValue = (val?: Date | string) => {
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
  }

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

  // State for editing loading from tree
  const [editingLoadingFromTree, setEditingLoadingFromTree] = useState<Loading | null>(null)

  // Employee state
  const [employees, setEmployees] = useState<EmployeeSearchResult[]>([])
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false)
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("")
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeSearchResult | null>(
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

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current)
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current)
      if (dropdownTimeoutRef.current) clearTimeout(dropdownTimeoutRef.current)
    }
  }, [])

  // Sync form data when editingLoadingFromTree changes
  useEffect(() => {
    if (editingLoadingFromTree) {
      setFormData({
        startDate: normalizeDateValue(editingLoadingFromTree.startDate) || formatLocalYMD(new Date())!,
        endDate: normalizeDateValue(editingLoadingFromTree.endDate) || formatLocalYMD(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))!,
        rate: editingLoadingFromTree.rate ?? 1,
        comment: editingLoadingFromTree.comment || "",
      })
    }
  }, [editingLoadingFromTree])

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

          // Fetch only projects initially
          const { data: projects, error: projectsError } = await supabase
            .from("projects")
            .select("project_id, project_name")
            .eq("project_status", "active")
            .order("project_name")

          if (projectsError) throw projectsError

          console.log(`[LoadingModal] Загружено проектов: ${projects?.length || 0}`)

          // Create tree with projects only (no children loaded yet)
          const tree: FileTreeNode[] = (projects || []).map((project) => ({
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
  }, [mode, setNotification, clearNotification])

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
          type: "folder",
          parentId: `section-${sectionId}`,
          children: [],
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

  // Helper: Build loading nodes from view data
  const buildLoadingNodes = useCallback((data: ProjectTreeViewRow[], decompositionStageId: string, sectionId: string, objectId: string, stageId: string, projectId: string): FileTreeNode[] => {
    const loadingList: FileTreeNode[] = []

    data.forEach((row) => {
      if (row.decomposition_stage_id === decompositionStageId && row.loading_id) {
        const loading: Loading = {
          id: row.loading_id,
          responsibleId: row.loading_responsible_id!,
          responsibleName: row.loading_responsible_full_name || "Без ответственного",
          responsibleAvatarUrl: row.loading_responsible_avatar || undefined,
          responsibleTeamName: row.loading_responsible_team_name || undefined,
          sectionId,
          stageId: decompositionStageId,
          startDate: new Date(row.loading_start!),
          endDate: new Date(row.loading_finish!),
          rate: row.loading_rate!,
          status: row.loading_status as any,
          comment: row.loading_comment || undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        loadingList.push({
          id: `loading-${row.loading_id}`,
          name: `${row.loading_responsible_full_name || "Без ответственного"} (${row.loading_rate})`,
          type: "file",
          parentId: `decomp-${decompositionStageId}`,
          loadingId: row.loading_id,
          loading,
          decompositionStageId,
          sectionId,
          objectId,
          stageId,
          projectId,
        })
      }
    })

    return loadingList.sort((a, b) => a.name.localeCompare(b.name))
  }, [])

  // Load children for a specific node using optimized view
  const loadNodeChildren = useCallback(async (node: FileTreeNode) => {
    if (!node.projectId || loadingNodes.has(node.id)) {
      return
    }

    setLoadingNodes((prev) => new Set(prev).add(node.id))

    try {
      console.log(`[LoadingModal] Загрузка данных для проекта: ${node.name}`)

      // Check cache first
      let projectData = projectDataCache.get(node.projectId)

      if (!projectData) {
        // Fetch all project data from view in ONE query
        const { data, error } = await supabase
          .from("view_project_tree_with_loadings")
          .select("*")
          .eq("project_id", node.projectId)

        if (error) throw error

        projectData = (data as ProjectTreeViewRow[]) || []

        // Cache the result
        setProjectDataCache((prev) => new Map(prev).set(node.projectId!, projectData!))
        console.log(`[LoadingModal] Загружено ${projectData.length} строк из view для проекта`)
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

            for (const decompNode of decompNodes) {
              const loadingNodesForStage = buildLoadingNodes(
                projectData,
                decompNode.decompositionStageId!,
                sectionNode.sectionId!,
                objectNode.objectId!,
                stageNode.stageId!,
                node.projectId
              )
              decompNode.children = loadingNodesForStage
            }

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
  }, [loadingNodes, projectDataCache, buildStageNodes, buildObjectNodes, buildSectionNodes, buildDecompositionStageNodes, buildLoadingNodes])

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
        // Clear cache and reload the project's children to show the new stage
        clearProjectCache(sectionNode.projectId)
        await loadNodeChildren(projectNode)

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

  // Handle creating a new loading from tree (by selecting decomposition stage)
  const handleCreateLoadingFromTree = useCallback((decompositionStageNode: FileTreeNode, e: React.MouseEvent) => {
    e.stopPropagation()

    if (!decompositionStageNode.decompositionStageId) return

    // Select the decomposition stage node to show the form on the right
    setSelectedNode(decompositionStageNode)

    // Build breadcrumbs
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

    setBreadcrumbs(buildBreadcrumbs(decompositionStageNode))
  }, [treeData])

  // Refresh a single project
  const handleRefreshProject = useCallback(async (projectNode: FileTreeNode, e: React.MouseEvent) => {
    e.stopPropagation()

    if (!projectNode.projectId) return

    const projectId = projectNode.id
    if (refreshingProjects.has(projectId)) return

    setRefreshingProjects((prev) => new Set(prev).add(projectId))
    try {
      await loadNodeChildren(projectNode)
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
        setExpandedFolders(new Set(pathToExpand))
        setSelectedNode(targetNode)
        console.log(`[LoadingModal] Этап успешно выбран: ${targetNode.name}`)

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
    // Use either external loading prop or internal editingLoadingFromTree
    const loadingToEdit = editingLoadingFromTree || loading

    if ((mode === "edit" || editingLoadingFromTree) && loadingToEdit && employees.length > 0) {
      console.log("[LoadingModal] Предзаполнение сотрудника для режима редактирования:", {
        responsibleId: loadingToEdit.responsibleId,
        employeesCount: employees.length,
        source: editingLoadingFromTree ? "tree" : "prop",
      })

      const emp = employees.find((e) => e.user_id === loadingToEdit.responsibleId)
      if (emp) {
        console.log(`[LoadingModal] Сотрудник найден: ${emp.full_name}`)
        setSelectedEmployee(emp)
      } else {
        console.warn(`[LoadingModal] Сотрудник не найден с ID: ${loadingToEdit.responsibleId}`)
      }
    }
  }, [mode, loading, editingLoadingFromTree, employees])

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
    if (node.type === "file") {
      // If it's a loading node with full loading object, open edit mode
      if (node.loadingId && node.loading) {
        // Set editing state
        setEditingLoadingFromTree(node.loading)

        // Select the loading node itself (not the parent)
        setSelectedNode(node)

        // Build breadcrumbs for the loading node
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

        setBreadcrumbs(buildBreadcrumbs(node))
      } else {
        // Regular file node (not a loading) - just select it for create mode
        setEditingLoadingFromTree(null)
        setSelectedNode(node)

        // Build breadcrumbs
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

        setBreadcrumbs(buildBreadcrumbs(node))
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

  // Render FileTree node
  const renderNode = (node: FileTreeNode, depth = 0): React.ReactNode => {
    const isExpanded = expandedFolders.has(node.id)
    const isLoadingNode = node.type === "file" && node.loadingId
    const isSelected = selectedNode?.id === node.id ||
      (isLoadingNode && editingLoadingFromTree && node.loadingId === editingLoadingFromTree.id)
    const hasChildren = node.children && node.children.length > 0
    const isLoading = loadingNodes.has(node.id)
    const isSectionNode = node.type === "folder" && node.sectionId && !node.decompositionStageId
    const isProjectNode = node.type === "folder" && node.projectId && !node.stageId
    const isDecompositionStageNode = node.type === "folder" && node.decompositionStageId
    const isRefreshingProject = refreshingProjects.has(node.id)

    return (
      <div key={node.id}>
        <div
          className={cn(
            "group flex items-center gap-1 py-1 px-2 text-sm cursor-pointer rounded-sm select-none transition-colors duration-150",
            isSelected && "bg-primary/10 text-primary border-l-2 border-primary",
            !isSelected && "hover:bg-accent hover:text-accent-foreground",
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => {
            if (node.type === "folder") {
              toggleFolder(node.id)
            } else {
              handleNodeSelect(node)
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
          ) : isLoadingNode ? (
            <>
              <div className="h-4 w-4" />
              <Users className="h-4 w-4 text-teal-500" />
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

          {/* Hover action icons for decomposition stage nodes */}
          {isDecompositionStageNode && (
            <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {/* Create loading */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => handleCreateLoadingFromTree(node, e)}
                    className="h-6 w-6 flex items-center justify-center rounded hover:bg-primary/10 transition-colors"
                  >
                    <FilePlus className="h-4 w-4 text-primary" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Создать загрузку</p>
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        {node.type === "folder" && hasChildren && isExpanded && (
          <div>{node.children!.map((child) => renderNode(child, depth + 1))}</div>
        )}

        {/* Show message for empty folders (only if not loading) */}
        {node.type === "folder" && !hasChildren && isExpanded && !isLoading && (
          <div
            className="text-xs text-muted-foreground italic px-2 py-1"
            style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
          >
            {node.decompositionStageId
              ? "Загрузки отсутствуют"
              : node.sectionId && !node.decompositionStageId
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

    // Determine if we're in edit mode (either from prop or internal state)
    const isEditMode = mode === "edit" || editingLoadingFromTree !== null
    const loadingToEdit = editingLoadingFromTree || loading

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
            // Get decomposition stage name (if selectedNode is loading node, get it from parent)
            let decompositionStageName = selectedNode!.name
            if (selectedNode!.loadingId) {
              // If it's a loading node, we need to find the parent decomposition stage for the name
              const findParentDecompStage = (nodes: FileTreeNode[], childId: string): FileTreeNode | null => {
                for (const n of nodes) {
                  if (n.children) {
                    for (const child of n.children) {
                      if (child.id === childId && n.decompositionStageId) return n
                    }
                    const found = findParentDecompStage(n.children, childId)
                    if (found) return found
                  }
                }
                return null
              }
              const parentStage = findParentDecompStage(treeData, selectedNode!.id)
              if (parentStage) {
                decompositionStageName = parentStage.name
              }
            }

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
            setEditingLoadingFromTree(null)
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

              // Get decomposition stage name (if selectedNode is loading node, get it from parent)
              let decompositionStageName = selectedNode!.name
              if (selectedNode!.loadingId) {
                const findParentDecompStage = (nodes: FileTreeNode[], childId: string): FileTreeNode | null => {
                  for (const n of nodes) {
                    if (n.children) {
                      for (const child of n.children) {
                        if (child.id === childId && n.decompositionStageId) return n
                      }
                      const found = findParentDecompStage(n.children, childId)
                      if (found) return found
                    }
                  }
                  return null
                }
                const parentStage = findParentDecompStage(treeData, selectedNode!.id)
                if (parentStage) {
                  decompositionStageName = parentStage.name
                }
              }

              updatedLoading.stageName = decompositionStageName
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

            // Clear cache and reload tree if editing from tree
            if (editingLoadingFromTree && selectedNode?.projectId) {
              clearProjectCache(selectedNode.projectId)
              const projectNodeId = `project-${selectedNode.projectId}`
              const projectNode = treeData.find(n => n.id === projectNodeId)
              if (projectNode) {
                await loadNodeChildren(projectNode)
              }
            }

            setEditingLoadingFromTree(null)
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
    const loadingToDelete = editingLoadingFromTree || loading
    if ((mode !== "edit" && !editingLoadingFromTree) || !loadingToDelete) return

    setIsDeleting(true)

    try {
      const result = await deleteLoadingInStore(loadingToDelete.id)

      if (!result.success) {
        throw new Error(result.error || "Ошибка при удалении загрузки")
      }

      setNotification("Загрузка успешно удалена")
      successTimeoutRef.current = setTimeout(() => clearNotification(), 3000)

      // Clear cache and reload tree if deleting from tree
      if (editingLoadingFromTree && selectedNode?.projectId) {
        clearProjectCache(selectedNode.projectId)
        const projectNodeId = `project-${selectedNode.projectId}`
        const projectNode = treeData.find(n => n.id === projectNodeId)
        if (projectNode) {
          await loadNodeChildren(projectNode)
        }
      }

      setEditingLoadingFromTree(null)
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

  // Wrapper for onClose to clear editing state
  const handleClose = () => {
    setEditingLoadingFromTree(null)
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
            {editingLoadingFromTree ? "Редактирование загрузки" : mode === "create" ? "Создание загрузки" : "Редактирование загрузки"}
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
                <div className="p-2">
                  <div className="flex items-center justify-between p-2 mb-2">
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
                  ) : (
                    <div className="p-1">{treeData.map((node) => renderNode(node))}</div>
                  )}
                </div>
              </TooltipProvider>
            </div>

            {/* Right side - Form */}
            <div className="flex-1 overflow-y-auto p-6">
              {selectedNode ? (
                <div className="space-y-6">
                  {/* Breadcrumbs */}
                  <div className="flex items-center gap-2 text-sm flex-wrap">
                    {breadcrumbs.map((item, index) => (
                      <div key={item.id} className="flex items-center gap-2">
                        <span className="text-muted-foreground">{item.name}</span>
                        {index < breadcrumbs.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    ))}
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
                      <input
                        type="date"
                        name="startDate"
                        value={formData.startDate}
                        onChange={handleChange}
                        disabled={isSaving}
                        className={cn(
                          "w-full text-sm rounded border px-3 py-2",
                          theme === "dark"
                            ? "bg-slate-700 border-slate-600 text-slate-200"
                            : "bg-white border-slate-300 text-slate-800",
                          errors.startDate ? "border-red-500" : "",
                          isSaving ? "opacity-50 cursor-not-allowed" : "",
                        )}
                      />
                      {errors.startDate && <p className="text-xs text-red-500 mt-1">{errors.startDate}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1 dark:text-slate-300">Дата окончания</label>
                      <input
                        type="date"
                        name="endDate"
                        value={formData.endDate}
                        onChange={handleChange}
                        disabled={isSaving}
                        className={cn(
                          "w-full text-sm rounded border px-3 py-2",
                          theme === "dark"
                            ? "bg-slate-700 border-slate-600 text-slate-200"
                            : "bg-white border-slate-300 text-slate-800",
                          errors.endDate ? "border-red-500" : "",
                          isSaving ? "opacity-50 cursor-not-allowed" : "",
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
                        disabled={isSaving}
                        className={cn(
                          "px-4 py-2 text-sm rounded flex items-center justify-center min-w-[100px]",
                          theme === "dark"
                            ? "bg-teal-600 text-white hover:bg-teal-700"
                            : "bg-teal-500 text-white hover:bg-teal-600",
                          isSaving ? "opacity-70 cursor-not-allowed" : "",
                        )}
                      >
                        {isSaving ? "Сохранение..." : mode === "create" ? "Создать" : "Сохранить"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Выберите этап из дерева слева
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
          onClose={() => setShowSectionPanel(false)}
          sectionId={selectedNode.sectionId}
          initialTab="decomposition"
          statuses={statuses}
        />
      )}
    </>
  )
}
