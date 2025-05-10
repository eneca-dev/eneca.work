"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Roadmap } from "@/components/roadmap/index"
import { LoadingForm } from "@/components/loading-form"
import type { Project, Task, Loading, SectionResponsible, Department } from "@/types/project-types"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { mockProjects } from "@/data/mock-data"
import { useToast } from "@/components/ui/use-toast"
import { LoadingSuccessToast } from "@/components/loading-success-toast"
import type { UserRole } from "@/components/user-role-badge"
import type { DetailFilterState } from "@/components/detail-filter-popover"
import { mockProfiles, getFullName, getProfileById } from "@/data/mock-profiles"
// Import the ViewMode type
import type { ViewMode } from "@/components/mode-switcher"
import { mockDepartments } from "@/data/mock-profiles"

// Add viewMode and selectedModeId to the state
export function ProjectPlanner() {
  const [projects, setProjects] = useState<Project[]>(mockProjects)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const [isLoadingFormOpen, setIsLoadingFormOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [selectedLoading, setSelectedLoading] = useState<Loading | null>(null)
  const [dialogTitle, setDialogTitle] = useState("Add New Loading")
  const [userRole, setUserRole] = useState<UserRole>("Пользователь")
  const { toast } = useToast()

  // Add these new state variables
  const [viewMode, setViewMode] = useState<ViewMode>("manager")
  const [selectedModeId, setSelectedModeId] = useState<string | null>(null)

  // Разделяем фильтры на проекты и детали
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(projects.length > 0 ? [projects[0].id] : [])

  const [detailFilters, setDetailFilters] = useState<DetailFilterState>({
    departments: [],
    teams: [],
    employees: [],
  })

  // Получаем выбранные проекты
  const selectedProjects = useMemo(() => {
    return projects.filter((project) => selectedProjectIds.includes(project.id))
  }, [projects, selectedProjectIds])

  // Применяем фильтры к проектам
  const filteredProjects = useMemo(() => {
    // Фильтруем проекты по ID
    let result = projects.filter((project) => selectedProjectIds.includes(project.id))

    // Фильтрация по отделам, командам и сотрудникам
    if (
      detailFilters.departments.length > 0 ||
      detailFilters.teams.length > 0 ||
      detailFilters.employees.length > 0 ||
      (viewMode === "department" && selectedModeId)
    ) {
      result = result.map((project) => {
        // Создаем копию проекта для фильтрации
        const filteredProject = { ...project }

        // Фильтруем разделы
        filteredProject.sections = project.sections.filter((section) => {
          // Проверяем отдел раздела
          const sectionProfile = section.responsible
            ? mockProfiles.find((p) => p.user_id === section.responsible?.id)
            : null

          // Фильтр по выбранному отделу в режиме отдела
          const selectedDepartmentMatch =
            !(viewMode === "department" && selectedModeId) ||
            (section.department &&
              mockDepartments.find((d) => d.department_id === selectedModeId)?.department_name === section.department)

          // Фильтр по отделу
          const departmentMatch =
            detailFilters.departments.length === 0 ||
            (sectionProfile && detailFilters.departments.includes(sectionProfile.department_id))

          // Фильтр по команде
          const teamMatch =
            detailFilters.teams.length === 0 || (sectionProfile && detailFilters.teams.includes(sectionProfile.team_id))

          // Фильтр по сотруднику
          const employeeMatch =
            detailFilters.employees.length === 0 ||
            (section.responsible && detailFilters.employees.includes(section.responsible.id))

          // Проверяем, есть ли задачи, соответствующие фильтрам сотрудников
          let hasMatchingTasks = false
          if (section.tasks) {
            hasMatchingTasks = section.tasks.some((task) => {
              return (
                task.loadings &&
                task.loadings.some((loading) => {
                  return detailFilters.employees.includes(loading.user_id)
                })
              )
            })
          }

          return selectedDepartmentMatch && departmentMatch && teamMatch && (employeeMatch || hasMatchingTasks)
        })

        return filteredProject
      })
    }

    return result
  }, [projects, selectedProjectIds, detailFilters, viewMode, selectedModeId])

  // Создаем объединенный проект, содержащий секции всех выбранных проектов
  const combinedProject = useMemo(() => {
    if (filteredProjects.length === 0) return null

    // Если выбран только один проект, возвращаем его
    if (filteredProjects.length === 1) return filteredProjects[0]

    // Создаем новый проект, объединяющий секции всех выбранных проектов
    const combined = {
      ...filteredProjects[0],
      id: "combined-project",
      name: `${filteredProjects.length} выбранных проектов`,
      sections: [],
    }

    // Добавляем секции из всех выбранных проектов
    filteredProjects.forEach((project) => {
      // Добавляем информацию о проекте к имени секции
      const projectSections = project.sections.map((section) => ({
        ...section,
        projectName: project.name,
      }))

      combined.sections = [...combined.sections, ...projectSections]
    })

    return combined
  }, [filteredProjects])

  // Используем объединенный проект вместо первого из отфильтрованных
  const selectedProject = combinedProject

  // Initialize all sections as expanded
  useEffect(() => {
    if (selectedProject) {
      const expanded: Record<string, boolean> = {}
      selectedProject.sections.forEach((section) => {
        expanded[section.id] = true
      })
      setExpandedSections(expanded)
    }
  }, [selectedProject])

  const toggleSectionExpand = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }))
  }

  // Функция для сворачивания всех разделов
  const collapseAllSections = useCallback(() => {
    if (selectedProject) {
      const collapsed: Record<string, boolean> = {}
      selectedProject.sections.forEach((section) => {
        collapsed[section.id] = false
      })
      setExpandedSections(collapsed)
    }
  }, [selectedProject])

  const handleAddLoading = (taskId: string) => {
    if (!selectedProject) return

    // Find the task
    let targetTask: Task | null = null

    for (const section of selectedProject.sections) {
      if (section.tasks) {
        const task = section.tasks.find((t) => t.id === taskId)
        if (task) {
          targetTask = task
          break
        }
      }
    }

    if (targetTask) {
      setSelectedTask(targetTask)
      setSelectedLoading(null)
      setDialogTitle("Add New Loading")
      setIsLoadingFormOpen(true)
    }
  }

  const handleEditLoading = (loading: Loading, taskId: string) => {
    if (!selectedProject) return

    // Find the task
    let targetTask: Task | null = null

    for (const section of selectedProject.sections) {
      if (section.tasks) {
        const task = section.tasks.find((t) => t.id === taskId)
        if (task) {
          targetTask = task
          break
        }
      }
    }

    if (targetTask) {
      setSelectedTask(targetTask)
      setSelectedLoading(loading)
      setDialogTitle("Edit Loading")
      setIsLoadingFormOpen(true)
    }
  }

  // Update the handleLoadingSubmit function to work with the new data structure
  const handleLoadingSubmit = (loading: Loading) => {
    if (!selectedProject || !selectedTask) return

    const isEditing = !!selectedLoading

    const updatedProjects = projects.map((project) => {
      // Check if this project contains the task
      let containsTask = false
      project.sections.forEach((section) => {
        if (section.tasks && section.tasks.some((task) => task.id === selectedTask.id)) {
          containsTask = true
        }
      })

      if (!containsTask) return project

      const updatedSections = project.sections.map((section) => {
        if (!section.tasks) return section

        const updatedTasks = section.tasks.map((task) => {
          if (task.id !== selectedTask.id) return task

          if (isEditing) {
            // Update existing loading
            return {
              ...task,
              loadings: task.loadings.map((l) => (l.id === loading.id ? loading : l)),
            }
          } else {
            // Add new loading
            return {
              ...task,
              loadings: [...task.loadings, loading],
            }
          }
        })

        return {
          ...section,
          tasks: updatedTasks,
        }
      })

      return {
        ...project,
        sections: updatedSections,
      }
    })

    setProjects(updatedProjects)
    setIsLoadingFormOpen(false)
    setSelectedTask(null)
    setSelectedLoading(null)

    // Get executor name for the notification
    const profile = getProfileById(loading.user_id)
    const executorName = profile ? getFullName(profile) : "Unknown"

    // Show success toast
    toast({
      description: <LoadingSuccessToast executor={executorName} stageName={selectedTask.name} isEditing={isEditing} />,
      duration: 3000,
    })
  }

  const handleLoadingDelete = (loadingId: string) => {
    if (!selectedProject || !selectedTask) return

    const updatedProjects = projects.map((project) => {
      // Check if this project contains the task
      let containsTask = false
      project.sections.forEach((section) => {
        if (section.tasks && section.tasks.some((task) => task.id === selectedTask.id)) {
          containsTask = true
        }
      })

      if (!containsTask) return project

      const updatedSections = project.sections.map((section) => {
        if (!section.tasks) return section

        const updatedTasks = section.tasks.map((task) => {
          if (task.id !== selectedTask.id) return task

          return {
            ...task,
            loadings: task.loadings.filter((l) => l.id !== loadingId),
          }
        })

        return {
          ...section,
          tasks: updatedTasks,
        }
      })

      return {
        ...project,
        sections: updatedSections,
      }
    })

    setProjects(updatedProjects)
    setIsLoadingFormOpen(false)
    setSelectedTask(null)
    setSelectedLoading(null)

    // Show delete toast
    toast({
      description: (
        <div className="flex items-start gap-3 p-1">
          <div className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0">🗑️</div>
          <div>
            <h4 className="font-medium text-gray-900">Loading Deleted</h4>
            <p className="text-sm text-gray-600">Loading has been removed from {selectedTask.name}</p>
          </div>
        </div>
      ),
      duration: 3000,
    })
  }

  // Update the responsible change handler
  const handleResponsibleChange = (sectionId: string, responsible: SectionResponsible) => {
    if (!selectedProject) return

    const updatedProjects = projects.map((project) => {
      if (!project.sections.some((section) => section.id === sectionId)) return project

      const updatedSections = project.sections.map((section) => {
        if (section.id !== sectionId) return section

        return {
          ...section,
          responsible: responsible,
        }
      })

      return {
        ...project,
        sections: updatedSections,
      }
    })

    setProjects(updatedProjects)

    // Show success toast
    toast({
      description: (
        <div className="flex items-start gap-3 p-1">
          <div className="h-5 w-5 text-primary mt-0.5 flex-shrink-0">✓</div>
          <div>
            <h4 className="font-medium text-gray-900">Ответственный изменен</h4>
            <p className="text-sm text-gray-600">{responsible.name} назначен ответственным за раздел</p>
          </div>
        </div>
      ),
      duration: 3000,
    })
  }

  // Update the department change handler
  const handleDepartmentChange = (sectionId: string, department: Department) => {
    if (!selectedProject) return

    const updatedProjects = projects.map((project) => {
      if (!project.sections.some((section) => section.id === sectionId)) return project

      const updatedSections = project.sections.map((section) => {
        if (section.id !== sectionId) return section

        return {
          ...section,
          department: department,
        }
      })

      return {
        ...project,
        sections: updatedSections,
      }
    })

    setProjects(updatedProjects)

    // Show success toast
    toast({
      description: (
        <div className="flex items-start gap-3 p-1">
          <div className="h-5 w-5 text-primary mt-0.5 flex-shrink-0">✓</div>
          <div>
            <h4 className="font-medium text-gray-900">Отдел изменен</h4>
            <p className="text-sm text-gray-600">Отдел {department} назначен для раздела</p>
          </div>
        </div>
      ),
      duration: 3000,
    })
  }

  // Обработчик изменения выбранных проектов
  const handleProjectsChange = (projectIds: string[]) => {
    setSelectedProjectIds(projectIds)
  }

  // Обработчик изменения детальных фильтров
  const handleDetailFiltersChange = (filters: DetailFilterState) => {
    setDetailFilters(filters)
  }

  // Pass the new props to the Roadmap component
  return (
    <div className="h-screen w-screen overflow-auto">
      {selectedProject && (
        <Roadmap
          project={selectedProject}
          expandedSections={expandedSections}
          onToggleSection={toggleSectionExpand}
          onAddLoading={handleAddLoading}
          onEditLoading={handleEditLoading}
          onResponsibleChange={handleResponsibleChange}
          onDepartmentChange={handleDepartmentChange}
          projects={projects}
          selectedProjectIds={selectedProjectIds}
          onProjectsChange={handleProjectsChange}
          detailFilters={detailFilters}
          onDetailFiltersChange={handleDetailFiltersChange}
          userRole={userRole}
          onCollapseAll={collapseAllSections}
          viewMode={viewMode}
          selectedModeId={selectedModeId}
          onModeChange={setViewMode}
          onModeSelect={setSelectedModeId}
        />
      )}

      <Dialog open={isLoadingFormOpen} onOpenChange={setIsLoadingFormOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-xl p-0 overflow-hidden">
          <DialogHeader className="p-6 bg-primary/5 border-b">
            <DialogTitle className="text-xl font-semibold text-primary">{dialogTitle}</DialogTitle>
          </DialogHeader>
          <div className="p-6">
            <LoadingForm
              task={selectedTask}
              project={selectedProject}
              loading={selectedLoading}
              onSubmit={handleLoadingSubmit}
              onCancel={() => setIsLoadingFormOpen(false)}
              onDelete={handleLoadingDelete}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

