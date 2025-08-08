import { create } from "zustand"
import { devtools } from "zustand/middleware"
import type { 
  Department, 
  Team, 
  Specialist, 
  Project, 
  Stage, 
  Object, 
  Assignment,
  Section,
  SectionHierarchy,
  OrganizationalStructure,
  Employee,
  TaskFilters,
  CreateAssignmentData,
  UpdateAssignmentData,
  AssignmentAuditRecord
} from "./types"
import {
  fetchAssignments,
  fetchProjectHierarchy, 
  fetchOrganizationalStructure, 
  fetchEmployees,
  fetchSections,
  createAssignment,
  updateAssignment,
  advanceAssignmentStatus,
  advanceAssignmentStatusWithDuration,
  revertAssignmentStatus,
  fetchAssignmentHistory,
  createAuditRecords
} from "./api/task-transfer"

interface TaskTransferStore {
  // Data
  departments: Department[]
  teams: Team[]
  specialists: Specialist[]
  projects: Project[]
  sections: Section[]
  stages: Stage[]
  objects: Object[]
  assignments: Assignment[]
  sectionHierarchy: SectionHierarchy[]
  
  // Новые поля для истории изменений
  assignmentHistory: Record<string, AssignmentAuditRecord[]>
  isLoadingHistory: boolean
  
  // Loading states
  isLoading: boolean
  isLoadingAssignments: boolean
  isLoadingHierarchy: boolean
  isLoadingOrganization: boolean

  // Actions
  loadInitialData: () => Promise<void>
  loadAssignments: (filters?: TaskFilters) => Promise<void>
  refreshData: () => Promise<void>
  createNewAssignment: (assignmentData: CreateAssignmentData) => Promise<{ success: boolean; error?: any }>
  updateAssignment: (assignmentId: string, updateData: UpdateAssignmentData) => Promise<{ success: boolean; error?: any }>
  advanceStatus: (assignmentId: string, currentStatus: any) => Promise<{ success: boolean; error?: any }>
  advanceStatusWithDuration: (assignmentId: string, currentStatus: any, duration?: number) => Promise<{ success: boolean; error?: any }>
  revertStatus: (assignmentId: string, currentStatus: any) => Promise<{ success: boolean; error?: any }>
  
  // Новые методы для истории изменений
  loadAssignmentHistory: (assignmentId: string) => Promise<void>
  clearAssignmentHistory: (assignmentId?: string) => void
  
  // Функции для получения заданий по направлению
  getAssignmentsByDirection: (direction: 'outgoing' | 'incoming' | 'all') => Assignment[]
}

export const useTaskTransferStore = create<TaskTransferStore>()(
  devtools(
    (set, get) => ({
  // Initial data
    departments: [],
    teams: [],
    specialists: [],
    projects: [],
      sections: [],
    stages: [],
    objects: [],
      assignments: [],
      sectionHierarchy: [],

      // Новые поля для истории изменений
      assignmentHistory: {},
      isLoadingHistory: false,

      // Loading states
      isLoading: false,
      isLoadingAssignments: false,
      isLoadingHierarchy: false,
      isLoadingOrganization: false,

      // Функция для получения заданий по направлению
      getAssignmentsByDirection: (direction) => {
        const state = get()
        
        switch (direction) {
          case 'outgoing':
            return state.assignments.filter(a => a.from_section_id !== null)
          case 'incoming':
            return state.assignments.filter(a => a.to_section_id !== null)
          case 'all':
          default:
            return state.assignments
        }
      },
      
      // Загрузка начальных данных
      loadInitialData: async () => {
        console.log('🚀 Загружаю начальные данные для task-transfer...')
        set({ isLoading: true })
        
        try {
          // Параллельная загрузка данных
          const [hierarchyData, organizationData, employeesData, sectionsData] = await Promise.all([
            fetchProjectHierarchy(),
            fetchOrganizationalStructure(),
            fetchEmployees(),
            fetchSections()
          ])
          
          // Обрабатываем иерархию проектов
          const projectsMap = new Map<string, Project>()
          const stagesMap = new Map<string, Stage>()
          const objectsMap = new Map<string, Object>()
          
          hierarchyData.forEach((item: SectionHierarchy) => {
            // Проекты
            if (!projectsMap.has(item.project_id)) {
              projectsMap.set(item.project_id, {
                id: item.project_id,
                name: item.project_name
              })
            }
            
            // Стадии
            if (item.stage_id && !stagesMap.has(item.stage_id)) {
              stagesMap.set(item.stage_id, {
                id: item.stage_id,
                projectId: item.project_id,
                name: item.stage_name
              })
            }
            
            // Объекты
            if (item.object_id && !objectsMap.has(item.object_id)) {
              objectsMap.set(item.object_id, {
                id: item.object_id,
                stageId: item.stage_id,
                name: item.object_name
              })
            }
          })
          
          // Обрабатываем организационную структуру
          const departmentsMap = new Map<string, Department>()
          const teamsMap = new Map<string, Team>()
          
          organizationData.forEach((item: OrganizationalStructure) => {
            // Отделы
            if (!departmentsMap.has(item.department_id)) {
              departmentsMap.set(item.department_id, {
                id: item.department_id,
                name: item.department_name
              })
            }
            
            // Команды
            if (item.team_id && !teamsMap.has(item.team_id)) {
              teamsMap.set(item.team_id, {
                id: item.team_id,
                departmentId: item.department_id,
                name: item.team_name || ''
              })
            }
          })
          
          // Обрабатываем сотрудников
          const specialists: Specialist[] = employeesData.map((emp: Employee) => ({
            id: emp.id,
            teamId: emp.teamId,
            name: emp.name,
            position: emp.position || 'Сотрудник',
            avatarUrl: emp.avatarUrl,
            responsibleForProjects: [] // TODO: добавить логику определения ответственности
          }))
          

          
          // Обрабатываем разделы
          const sections: Section[] = sectionsData.map((section: any) => ({
            id: section.id,
            name: section.name,
            projectIds: section.projectId ? [section.projectId] : []
          }))
          
          set({
            projects: Array.from(projectsMap.values()),
            stages: Array.from(stagesMap.values()),
            objects: Array.from(objectsMap.values()),
            sections,
            departments: Array.from(departmentsMap.values()),
            teams: Array.from(teamsMap.values()),
            specialists,
            sectionHierarchy: hierarchyData,
            isLoading: false
          })
          
          console.log('✅ Начальные данные загружены:', {
            projects: projectsMap.size,
            stages: stagesMap.size,
            objects: objectsMap.size,
            sections: sections.length,
            departments: departmentsMap.size,
            teams: teamsMap.size,
            specialists: specialists.length
          })
          
          // Загружаем задания
          try {
            await get().loadAssignments()
          } catch (assignmentError) {
            console.error('❌ Ошибка загрузки заданий (не критично):', assignmentError)
            // Не останавливаем выполнение, если задания не загружаются
          }
          
        } catch (error) {
          console.error('❌ Ошибка загрузки начальных данных:', error)
          console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'Unknown error')
          set({ isLoading: false })
        }
      },
      
      // Загрузка заданий с фильтрацией
      loadAssignments: async (filters = {}) => {
        console.log('🔍 Загружаю задания с фильтрами:', filters)
        set({ isLoadingAssignments: true })
        
        try {
          console.log('📞 Вызываю fetchAssignments...')
          const assignments = await fetchAssignments(filters)
          console.log('📦 Получены задания:', assignments)
          
          set({ assignments, isLoadingAssignments: false })
          console.log('✅ Задания загружены в store:', assignments.length)
        } catch (error) {
          console.error('❌ Ошибка загрузки заданий в store:', error)
          console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'Unknown error')
          set({ isLoadingAssignments: false })
          throw error // Пробрасываем ошибку дальше
        }
      },
      
      // Обновление всех данных
      refreshData: async () => {
        console.log('🔄 Обновляю все данные...')
        await get().loadInitialData()
      },

      // Создание нового задания
      createNewAssignment: async (assignmentData: CreateAssignmentData) => {
        try {
          console.log('🚀 Создаю новое задание...', assignmentData)
          const result = await createAssignment(assignmentData)
          
          if (result.success) {
            console.log('✅ Задание успешно создано, обновляю список...')
            // Перезагружаем задания после создания
            await get().loadAssignments()
            return { success: true }
          } else {
            console.error('❌ Ошибка создания задания:', result.error)
            return { success: false, error: result.error }
          }
        } catch (error) {
          console.error('❌ Неожиданная ошибка при создании задания:', error)
          return { success: false, error }
        }
      },

      // Обновление задания
      updateAssignment: async (assignmentId: string, updateData: UpdateAssignmentData) => {
        try {
          console.log('🚀 Обновляю задание...', assignmentId, updateData)
          
          // Обновляем задание (записи аудита создаются внутри функции updateAssignment)
          const result = await updateAssignment(assignmentId, updateData)
          
          if (result.success) {
            console.log('✅ Задание успешно обновлено, обновляю локально...')
            
            // Обновляем задание локально в store
            set((state) => ({
              assignments: state.assignments.map(assignment => 
                assignment.assignment_id === assignmentId 
                  ? { 
                      ...assignment, 
                      ...updateData,
                      updated_at: new Date().toISOString()
                    }
                  : assignment
              )
            }))
            
            // Автоматически обновляем историю изменений
            try {
              console.log('🔄 Автоматически обновляю историю изменений...')
              await get().loadAssignmentHistory(assignmentId)
              console.log('✅ История изменений обновлена')
            } catch (historyError) {
              console.error('❌ Ошибка обновления истории изменений:', historyError)
              // Не останавливаем выполнение, если история не загрузилась
            }
            
            return { success: true }
          } else {
            console.error('❌ Ошибка обновления задания:', result.error)
            return { success: false, error: result.error }
          }
        } catch (error) {
          console.error('❌ Неожиданная ошибка при обновлении задания:', error)
          return { success: false, error }
        }
      },

      // Обновление статуса задания
      advanceStatus: async (assignmentId: string, currentStatus: any) => {
        try {
          console.log('🚀 Обновляю статус задания:', assignmentId, 'текущий статус:', currentStatus)
          const result = await advanceAssignmentStatus(assignmentId, currentStatus)
          
          if (result.success) {
            console.log('✅ Статус задания успешно обновлен')
            // Перезагружаем задания после обновления статуса
            await get().loadAssignments()
            return { success: true }
          } else {
            console.error('❌ Ошибка обновления статуса задания:', result.error)
            return { success: false, error: result.error }
          }
        } catch (error) {
          console.error('❌ Неожиданная ошибка при обновлении статуса задания:', error)
          return { success: false, error }
        }
      },

      // Отмена статуса задания
      revertStatus: async (assignmentId: string, currentStatus: any) => {
        try {
          console.log('🚀 Отменяю статус задания:', assignmentId, 'текущий статус:', currentStatus)
          const result = await revertAssignmentStatus(assignmentId, currentStatus)
          
          if (result.success) {
            console.log('✅ Статус задания успешно отменен')
            // Перезагружаем задания после отмены статуса
            await get().loadAssignments()
            return { success: true }
          } else {
            console.error('❌ Ошибка отмены статуса задания:', result.error)
            return { success: false, error: result.error }
          }
        } catch (error) {
          console.error('❌ Неожиданная ошибка при отмене статуса задания:', error)
          return { success: false, error }
        }
      },

      // Обновление статуса задания с продолжительностью
      advanceStatusWithDuration: async (assignmentId: string, currentStatus: any, duration?: number) => {
        try {
          console.log('🚀 Обновляю статус задания:', assignmentId, 'текущий статус:', currentStatus, 'продолжительность:', duration)
          const result = await advanceAssignmentStatusWithDuration(assignmentId, currentStatus, duration)
          
          if (result.success) {
            console.log('✅ Статус задания успешно обновлен')
            // Перезагружаем задания после обновления статуса
            await get().loadAssignments()
            return { success: true }
          } else {
            console.error('❌ Ошибка обновления статуса задания:', result.error)
            return { success: false, error: result.error }
          }
        } catch (error) {
          console.error('❌ Неожиданная ошибка при обновлении статуса задания:', error)
          return { success: false, error }
        }
      },

      // Загрузка истории изменений задания
      loadAssignmentHistory: async (assignmentId: string) => {
        console.log('🔍 Загружаю историю изменений задания:', assignmentId)
        set({ isLoadingHistory: true })
        
        try {
          console.log('📞 Вызываю fetchAssignmentHistory...')
          const history = await fetchAssignmentHistory(assignmentId)
          console.log('📦 Получена история изменений:', history)
          
          set((state) => ({
            assignmentHistory: {
              ...state.assignmentHistory,
              [assignmentId]: history
            },
            isLoadingHistory: false
          }))
          console.log('✅ История изменений задания загружена:', history.length)
        } catch (error) {
          console.error('❌ Ошибка загрузки истории изменений задания:', error)
          console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'Unknown error')
          set({ isLoadingHistory: false })
          throw error // Пробрасываем ошибку дальше
        }
      },

      // Новые методы для истории изменений
      clearAssignmentHistory: (assignmentId?: string) => {
        set((state) => ({
          assignmentHistory: assignmentId ? {
            ...state.assignmentHistory,
            [assignmentId]: []
          } : {},
          isLoadingHistory: false
        }))
      }
    }),
    {
      name: 'task-transfer-store'
    }
  )
)
