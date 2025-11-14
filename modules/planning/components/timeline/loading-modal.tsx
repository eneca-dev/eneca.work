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
import { ChevronRight, ChevronDown, Folder, FolderOpen, File } from "lucide-react"

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

  // Employee state
  const [employees, setEmployees] = useState<EmployeeSearchResult[]>([])
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false)
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("")
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeSearchResult | null>(
    mode === "create" && employee
      ? {
          user_id: employee.id,
          first_name: "",
          last_name: "",
          full_name: employee.fullName || employee.name,
          email: "",
          position_name: employee.position,
          avatar_url: employee.avatarUrl,
          team_name: employee.teamName,
          department_name: null,
          employment_rate: null,
        }
      : null,
  )

  // SectionPanel state
  const [showSectionPanel, setShowSectionPanel] = useState(false)
  const { statuses } = useSectionStatuses()

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

  // Load children for a specific node (project)
  const loadNodeChildren = useCallback(async (node: FileTreeNode) => {
    if (!node.projectId || loadingNodes.has(node.id)) {
      return
    }

    setLoadingNodes((prev) => new Set(prev).add(node.id))

    try {
      console.log(`[LoadingModal] Загрузка данных для проекта: ${node.name}`)

      // Fetch stages for this project
      const { data: stages } = await supabase
        .from("stages")
        .select("stage_id, stage_name")
        .eq("stage_project_id", node.projectId)
        .order("stage_name")

      const stageNodes: FileTreeNode[] = []

      for (const stage of stages || []) {
        // Fetch objects for this stage
        const { data: objectRows } = await supabase
          .from("view_section_hierarchy")
          .select("object_id, object_name")
          .eq("project_id", node.projectId)
          .eq("stage_id", stage.stage_id)
          .not("object_id", "is", null)
          .not("object_name", "is", null)

        // Deduplicate objects
        const objectMap = new Map<string, { object_id: string; object_name: string }>()
        ;(objectRows || []).forEach((r: any) => {
          if (r.object_id && r.object_name && !objectMap.has(r.object_id)) {
            objectMap.set(r.object_id, { object_id: r.object_id, object_name: r.object_name })
          }
        })
        const objects = Array.from(objectMap.values()).sort((a, b) => a.object_name.localeCompare(b.object_name))

        const objectNodes: FileTreeNode[] = []

        for (const obj of objects) {
          // Fetch sections for this object
          const { data: sections } = await supabase
            .from("view_section_hierarchy")
            .select("section_id, section_name")
            .eq("project_id", node.projectId)
            .eq("stage_id", stage.stage_id)
            .eq("object_id", obj.object_id)
            .order("section_name")

          const sectionNodes: FileTreeNode[] = []

          for (const sect of sections || []) {
            // Fetch decomposition stages for this section
            const { data: decompStages } = await supabase
              .from("decomposition_stages")
              .select("decomposition_stage_id, decomposition_stage_name")
              .eq("decomposition_stage_section_id", sect.section_id)
              .order("decomposition_stage_order")

            const decompNodes: FileTreeNode[] = (decompStages || []).map((ds: any) => ({
              id: `decomp-${ds.decomposition_stage_id}`,
              name: ds.decomposition_stage_name,
              type: "file" as const,
              parentId: `section-${sect.section_id}`,
              decompositionStageId: ds.decomposition_stage_id,
              sectionId: sect.section_id,
              objectId: obj.object_id,
              stageId: stage.stage_id,
              projectId: node.projectId,
            }))

            if (decompNodes.length > 0) {
              sectionNodes.push({
                id: `section-${sect.section_id}`,
                name: sect.section_name,
                type: "folder" as const,
                parentId: `object-${obj.object_id}`,
                children: decompNodes,
                sectionId: sect.section_id,
                objectId: obj.object_id,
                stageId: stage.stage_id,
                projectId: node.projectId,
              })
            }
          }

          if (sectionNodes.length > 0) {
            objectNodes.push({
              id: `object-${obj.object_id}`,
              name: obj.object_name,
              type: "folder" as const,
              parentId: `stage-${stage.stage_id}`,
              children: sectionNodes,
              objectId: obj.object_id,
              stageId: stage.stage_id,
              projectId: node.projectId,
            })
          }
        }

        if (objectNodes.length > 0) {
          stageNodes.push({
            id: `stage-${stage.stage_id}`,
            name: stage.stage_name,
            type: "folder" as const,
            parentId: `project-${node.projectId}`,
            children: objectNodes,
            stageId: stage.stage_id,
            projectId: node.projectId,
          })
        }
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

      console.log(`[LoadingModal] Данные для проекта "${node.name}" загружены`)
    } catch (error) {
      console.error(`[LoadingModal] Ошибка при загрузке данных проекта:`, error)
      Sentry.captureException(error, {
        tags: {
          module: "planning",
          action: "load_node_children",
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
  }, [loadingNodes])

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
    } else if (mode === "create" && stageId) {
      targetStageId = stageId
      targetProjectId = section?.projectId
    }

    if (targetStageId && targetProjectId) {
      // Find the project node
      const projectNodeId = `project-${targetProjectId}`
      const projectNode = treeData.find((n) => n.id === projectNodeId)

      if (projectNode) {
        // Load project data if not loaded yet
        if (projectNode.children?.length === 0) {
          console.log(`[LoadingModal] Автоматическая загрузка проекта для stageId: ${targetStageId}`)
          loadNodeChildren(projectNode).then(() => {
            // After loading, find and select the target node
            setTimeout(() => {
              findAndSelectNode(targetStageId!)
            }, 100)
          })
        } else {
          // Data already loaded, just find and select
          findAndSelectNode(targetStageId)
        }
      }
    }

    function findAndSelectNode(decompositionStageId: string) {
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
        setExpandedFolders(new Set(pathToExpand))
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

        setBreadcrumbs(buildBreadcrumbs(targetNode))
      }
    }
  }, [treeData, mode, loading, stageId, section, loadNodeChildren])

  // Pre-fill employee for edit mode
  useEffect(() => {
    if (mode === "edit" && loading && employees.length > 0) {
      const emp = employees.find((e) => e.user_id === loading.responsibleId)
      if (emp) {
        setSelectedEmployee(emp)
      }
    }
  }, [mode, loading, employees])

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
    const isSelected = selectedNode?.id === node.id
    const hasChildren = node.children && node.children.length > 0
    const isLoading = loadingNodes.has(node.id)

    return (
      <div key={node.id}>
        <div
          className={cn(
            "flex items-center gap-1 py-1 px-2 text-sm cursor-pointer rounded-sm select-none transition-colors duration-150",
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
          ) : (
            <>
              <div className="h-4 w-4" />
              <File className="h-4 w-4 text-gray-500" />
            </>
          )}
          <span className="truncate flex-1">{node.name}</span>
          {isLoading && <span className="text-xs text-muted-foreground">Загрузка...</span>}
        </div>

        {node.type === "folder" && hasChildren && isExpanded && (
          <div>{node.children!.map((child) => renderNode(child, depth + 1))}</div>
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

    if (!selectedNode || !selectedNode.decompositionStageId) {
      newErrors.decompositionStageId = "Необходимо выбрать этап декомпозиции"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle save (create or update)
  const handleSave = async () => {
    if (!validateForm()) return

    await Sentry.startSpan(
      {
        op: "ui.action",
        name: mode === "create" ? "Создание загрузки" : "Обновление загрузки",
      },
      async (span) => {
        setIsSaving(true)

        try {
          span.setAttribute("mode", mode)
          span.setAttribute("employee.id", selectedEmployee!.user_id)
          span.setAttribute("employee.name", selectedEmployee!.full_name)
          span.setAttribute("decomposition_stage.id", selectedNode!.decompositionStageId!)
          span.setAttribute("loading.start_date", formData.startDate)
          span.setAttribute("loading.end_date", formData.endDate)
          span.setAttribute("loading.rate", formData.rate)

          if (mode === "create") {
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
              decompositionStageName: selectedNode!.name,
              responsibleName: selectedEmployee!.full_name,
              responsibleAvatarUrl: selectedEmployee!.avatar_url,
              responsibleTeamName: selectedEmployee!.team_name,
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
            if (selectedNode!.decompositionStageId !== loading!.stageId) {
              updatedLoading.stageId = selectedNode!.decompositionStageId
              updatedLoading.stageName = selectedNode!.name
            }

            // Update employee if changed
            if (selectedEmployee!.user_id !== loading!.responsibleId) {
              updatedLoading.responsibleId = selectedEmployee!.user_id
              updatedLoading.responsibleName = selectedEmployee!.full_name
              updatedLoading.responsibleAvatarUrl = selectedEmployee!.avatar_url
              updatedLoading.responsibleTeamName = selectedEmployee!.team_name
            }

            const result = await updateLoadingInStore(loading!.id, updatedLoading)

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

    setIsDeleting(true)

    try {
      const result = await deleteLoadingInStore(loading.id)

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
          loading_id: loading.id,
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg w-11/12 h-5/6 max-w-6xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-slate-700">
          <h2 className="text-lg font-semibold dark:text-slate-200">
            {mode === "create" ? "Создание загрузки" : "Редактирование загрузки"}
          </h2>
          <button
            onClick={onClose}
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
              <div className="p-2">
                <div className="flex items-center justify-between p-2 mb-2">
                  <span className="text-sm font-medium dark:text-slate-300">Проекты</span>
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
                    <div className="relative">
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

                      {showEmployeeDropdown && filteredEmployees.length > 0 && !selectedEmployee && (
                        <div
                          className={cn(
                            "absolute z-10 w-full mt-1 max-h-60 overflow-auto rounded border",
                            theme === "dark" ? "bg-slate-800 border-slate-600" : "bg-white border-slate-300",
                          )}
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          {filteredEmployees.map((emp) => (
                            <div
                              key={emp.user_id}
                              onMouseDown={(e) => {
                                e.preventDefault()
                                handleEmployeeSelect(emp)
                              }}
                              className={cn(
                                "px-3 py-2 cursor-pointer text-sm flex items-center space-x-3",
                                theme === "dark" ? "hover:bg-slate-600 text-slate-200" : "hover:bg-slate-50 text-slate-800",
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
                                <div className={cn("text-xs truncate", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
                                  {emp.position_name || "Должность не указана"}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
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
                        onClick={onClose}
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
    </div>
  )
}
