import { useTaskTransferStore } from "./store"
import type { 
  Specialist, 
  Project, 
  Stage, 
  Object, 
  Assignment,
  TaskFilters,
  AssignmentStatus,
  AssignmentDirection 
} from "./types"



// Get filtered assignments based on filters
export const getFilteredAssignments = (
  filters: TaskFilters = {}
): Assignment[] => {
  const { assignments, specialists, teams, objects, stages, sectionHierarchy } = useTaskTransferStore.getState()

  let filteredAssignments = assignments

  // Фильтрация по направлению не требуется, так как мы показываем все задания

  // Фильтрация по проекту
  if (filters.projectId) {
    filteredAssignments = filteredAssignments.filter(assignment => 
      assignment.project_id === filters.projectId
    )
  }

  // Фильтрация по стадии
  if (filters.stageId) {
    // Получаем разделы, которые принадлежат этой стадии
    const sectionsInStage = sectionHierarchy
      .filter(sh => sh.stage_id === filters.stageId)
      .map(sh => sh.section_id)
    
    filteredAssignments = filteredAssignments.filter(assignment => 
      sectionsInStage.includes(assignment.from_section_id) || 
      sectionsInStage.includes(assignment.to_section_id)
    )
}

  // Фильтрация по объекту
  if (filters.objectId) {
    // Получаем разделы, которые принадлежат этому объекту
    const sectionsInObject = sectionHierarchy
      .filter(sh => sh.object_id === filters.objectId)
      .map(sh => sh.section_id)
    
    filteredAssignments = filteredAssignments.filter(assignment => 
      sectionsInObject.includes(assignment.from_section_id) || 
      sectionsInObject.includes(assignment.to_section_id)
    )
  }

  // Фильтрация по статусу
  if (filters.status) {
    filteredAssignments = filteredAssignments.filter(assignment => 
      assignment.status === filters.status
    )
  }

  // Фильтрация по отделу - используем данные из view_section_hierarchy
  if (filters.departmentId && !filters.teamId && !filters.specialistId) {
    // Получаем разделы, за которые отвечают сотрудники данного отдела
    const sectionsInDepartment = sectionHierarchy
      .filter(sh => sh.responsible_department_id === filters.departmentId)
      .map(sh => sh.section_id)
    
    filteredAssignments = filteredAssignments.filter(assignment => 
      sectionsInDepartment.includes(assignment.from_section_id) || 
      sectionsInDepartment.includes(assignment.to_section_id)
    )
  }

  // Фильтрация по команде - используем данные из view_section_hierarchy
  if (filters.teamId && !filters.specialistId) {
    // Получаем разделы, за которые отвечают сотрудники данной команды
    const sectionsInTeam = sectionHierarchy
      .filter(sh => {
        // Ищем команду по имени, так как в view_section_hierarchy только название команды
        const team = teams.find(t => t.id === filters.teamId)
        return team && sh.responsible_team_name === team.name
      })
      .map(sh => sh.section_id)
    
    filteredAssignments = filteredAssignments.filter(assignment => 
      sectionsInTeam.includes(assignment.from_section_id) || 
      sectionsInTeam.includes(assignment.to_section_id)
    )
  }

  // Фильтрация по специалисту
  if (filters.specialistId) {
    // Получаем специалиста
    const specialist = specialists.find(s => s.id === filters.specialistId)
    
    if (specialist) {
      // Получаем разделы, за которые отвечает данный специалист
      const sectionsResponsibleBy = sectionHierarchy
        .filter(sh => {
          // Проверяем по имени ответственного в view_section_hierarchy
          return sh.section_responsible_name === specialist.name
        })
        .map(sh => sh.section_id)
        .filter(Boolean) // Убираем null значения
      
      filteredAssignments = filteredAssignments.filter(assignment => {
        const isCreatedBy = assignment.created_by === filters.specialistId
        const isUpdatedBy = assignment.updated_by === filters.specialistId
        const isResponsibleForFrom = sectionsResponsibleBy.includes(assignment.from_section_id)
        const isResponsibleForTo = sectionsResponsibleBy.includes(assignment.to_section_id)
        
        return isCreatedBy || isUpdatedBy || isResponsibleForFrom || isResponsibleForTo
      })
    }
  }

  return filteredAssignments
}

// Get all assignments without any filtering
export const getAllAssignments = (): Assignment[] => {
  const { assignments } = useTaskTransferStore.getState()
  return assignments
}

// Group assignments by sections with filtering support
export const getGroupedAssignments = (
  filters: TaskFilters = {}
) => {
  const { sections, projects, sectionHierarchy } = useTaskTransferStore.getState()
  const filteredAssignments = getFilteredAssignments(filters)

  const result: {
    section: any
    outgoingAssignments: Assignment[]
    incomingAssignments: Assignment[]
  }[] = []

  // Получаем информацию о разделах из иерархии для более полных данных
  const sectionInfoMap = new Map()
  sectionHierarchy.forEach(sh => {
    sectionInfoMap.set(sh.section_id, sh)
  })

  // Group by sections
  sections.forEach((section) => {
    const outgoingAssignments = filteredAssignments.filter(
      assignment => assignment.from_section_id === section.id
    )

    const incomingAssignments = filteredAssignments.filter(
      assignment => assignment.to_section_id === section.id
    )

    if (outgoingAssignments.length > 0 || incomingAssignments.length > 0) {
      // Обогащаем данные раздела информацией из иерархии
      const sectionInfo = sectionInfoMap.get(section.id)
      const enrichedSection = {
        ...section,
        projectName: sectionInfo?.project_name,
        stageName: sectionInfo?.stage_name,
        objectName: sectionInfo?.object_name,
        responsibleDepartmentName: sectionInfo?.responsible_department_name,
        responsibleTeamName: sectionInfo?.responsible_team_name,
        responsibleName: sectionInfo?.section_responsible_name
      }

      result.push({
        section: enrichedSection,
        outgoingAssignments,
        incomingAssignments
      })
    }
  })

  return result
}

// Get specialist name by ID
export const getSpecialistName = (specialistId: string): string => {
  const { specialists } = useTaskTransferStore.getState()
  const specialist = specialists.find((s) => s.id === specialistId)
  return specialist ? specialist.name : "Неизвестный специалист"
}

// Get specialist avatar by ID
export const getSpecialistAvatar = (specialistId: string): string | undefined => {
  const { specialists } = useTaskTransferStore.getState()
  const specialist = specialists.find((s) => s.id === specialistId)
  return specialist?.avatarUrl
}

export const getStatusColor = (status: AssignmentStatus): string => {
  switch (status) {
    case "Создано":
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
    case "Передано":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400"
    case "Принято":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
    case "Выполнено":
      return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
    case "Согласовано":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400"
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
  }
}

// Format date
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString("ru-RU")
}

// Get department name by ID
export const getDepartmentName = (departmentId: string): string => {
  const { departments } = useTaskTransferStore.getState()
  const department = departments.find((d) => d.id === departmentId)
  return department ? department.name : "Неизвестный отдел"
}

// Get team name by ID
export const getTeamName = (teamId: string): string => {
  const { teams } = useTaskTransferStore.getState()
  const team = teams.find((t) => t.id === teamId)
  return team ? team.name : "Неизвестная команда"
}

// Get project name by ID
export const getProjectName = (projectId: string): string => {
  const { projects } = useTaskTransferStore.getState()
  const project = projects.find((p) => p.id === projectId)
  return project ? project.name : "Неизвестный проект"
}

// Get stage name by ID
export const getStageName = (stageId: string): string => {
  const { stages } = useTaskTransferStore.getState()
  const stage = stages.find((s) => s.id === stageId)
  return stage ? stage.name : "Неизвестная стадия"
}

// Get object name by ID
export const getObjectName = (objectId: string): string => {
  const { objects } = useTaskTransferStore.getState()
  const object = objects.find((o) => o.id === objectId)
  return object ? object.name : "Неизвестный объект"
}

// Get section name by ID
export const getSectionName = (sectionId: string): string => {
  const { sections } = useTaskTransferStore.getState()
  const section = sections.find((s) => s.id === sectionId)
  return section ? section.name : "Неизвестный раздел"
}

// Устаревшие функции для совместимости (будут удалены позже)
export const getFilteredTasks = getFilteredAssignments
export const getAllTasks = getAllAssignments
