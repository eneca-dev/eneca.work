import { create } from "zustand"
import { devtools } from "zustand/middleware"
import * as Sentry from "@sentry/nextjs"
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
        return Sentry.startSpan(
          {
            op: "db.query",
            name: "Загрузка начальных данных task-transfer",
          },
          async (span) => {
            console.log('🚀 Загружаю начальные данные для task-transfer...')
            set({ isLoading: true })
            
            span.setAttribute("module", "task-transfer")
            span.setAttribute("action", "load_initial_data")
        
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
                name: item.stage_name || ""
              })
            }
            
                                  // Объекты
            if (item.object_id && !objectsMap.has(item.object_id)) {
              objectsMap.set(item.object_id, {
                id: item.object_id,
                stageId: item.stage_id || "",
                name: item.object_name || ""
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
            Sentry.captureException(assignmentError, {
              tags: {
                module: "task-transfer",
                action: "load_assignments_initial",
                severity: "warning"
              },
              extra: {
                context: "Не критичная ошибка при загрузке заданий после инициализации",
                error_message: assignmentError instanceof Error ? assignmentError.message : String(assignmentError)
              }
            })
            // Не останавливаем выполнение, если задания не загружаются
          }
          
        } catch (error) {
          span.setAttribute("db.success", false)
          Sentry.captureException(error, {
            tags: {
              module: "task-transfer",
              action: "load_initial_data",
              severity: "high"
            },
            extra: {
              context: "Критическая ошибка загрузки начальных данных",
              error_message: error instanceof Error ? error.message : String(error),
              stack_trace: error instanceof Error ? error.stack : undefined
            }
          })
          set({ isLoading: false })
        }
      }
    );
      },
      
      // Загрузка заданий с фильтрацией
      loadAssignments: async (filters = {}) => {
        return Sentry.startSpan(
          {
            op: "db.query",
            name: "Загрузка заданий task-transfer",
          },
          async (span) => {
            console.log('🔍 Загружаю задания с фильтрами:', filters)
            set({ isLoadingAssignments: true })
            
            span.setAttribute("module", "task-transfer")
            span.setAttribute("action", "load_assignments")
            span.setAttribute("filters_count", Object.keys(filters).length)
        
        try {
          console.log('📞 Вызываю fetchAssignments...')
          const assignments = await fetchAssignments(filters)
          console.log('📦 Получены задания:', assignments)
          
          set({ assignments, isLoadingAssignments: false })
          console.log('✅ Задания загружены в store:', assignments.length)
          span.setAttribute("assignments_loaded", assignments.length)
        } catch (error) {
          span.setAttribute("db.success", false)
          Sentry.captureException(error, {
            tags: {
              module: "task-transfer",
              action: "load_assignments",
              severity: "high"
            },
            extra: {
              filters,
              context: "Ошибка загрузки заданий в store",
              error_message: error instanceof Error ? error.message : String(error),
              stack_trace: error instanceof Error ? error.stack : undefined
            }
          })
          set({ isLoadingAssignments: false })
          throw error // Пробрасываем ошибку дальше
        }
      }
    );
      },
      
      // Обновление всех данных
      refreshData: async () => {
        return Sentry.startSpan(
          {
            op: "db.query",
            name: "Обновление всех данных task-transfer",
          },
          async (span) => {
            console.log('🔄 Обновляю все данные...')
            span.setAttribute("module", "task-transfer")
            span.setAttribute("action", "refresh_data")
            await get().loadInitialData()
          }
        );
      },

      // Создание нового задания
      createNewAssignment: async (assignmentData: CreateAssignmentData) => {
        return Sentry.startSpan(
          {
            op: "db.insert",
            name: "Создание нового задания task-transfer",
          },
          async (span) => {
            try {
              console.log('🚀 Создаю новое задание...', assignmentData)
              span.setAttribute("module", "task-transfer")
              span.setAttribute("action", "create_assignment")
              span.setAttribute("assignment_title", assignmentData.title || "Без названия")
              
              const result = await createAssignment(assignmentData)
          
              if (result.success) {
                console.log('✅ Задание успешно создано, обновляю список...')
                // Перезагружаем задания после создания
                await get().loadAssignments()
                return { success: true }
              } else {
                span.setAttribute("db.success", false)
                Sentry.captureException(new Error(String(result.error) || "Неизвестная ошибка создания задания"), {
                  tags: {
                    module: "task-transfer",
                    action: "create_assignment",
                    severity: "medium"
                  },
                  extra: {
                    assignment_data: assignmentData,
                    result_error: result.error,
                    context: "Ошибка API при создании задания"
                  }
                })
                return { success: false, error: result.error }
              }
            } catch (error) {
              span.setAttribute("db.success", false)
              Sentry.captureException(error, {
                tags: {
                  module: "task-transfer",
                  action: "create_assignment",
                  severity: "high"
                },
                extra: {
                  assignment_data: assignmentData,
                  error_message: error instanceof Error ? error.message : String(error),
                  context: "Неожиданная ошибка при создании задания"
                }
              })
              return { success: false, error }
            }
          }
        );
      },

      // Обновление задания
      updateAssignment: async (assignmentId: string, updateData: UpdateAssignmentData) => {
        return Sentry.startSpan(
          {
            op: "db.update",
            name: "Обновление задания task-transfer",
          },
          async (span) => {
            try {
              console.log('🚀 Обновляю задание...', assignmentId, updateData)
              span.setAttribute("module", "task-transfer")
              span.setAttribute("action", "update_assignment")
              span.setAttribute("assignment_id", assignmentId)
              span.setAttribute("update_fields", Object.keys(updateData).join(", "))
              
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
                Sentry.captureException(historyError, {
                  tags: {
                    module: "task-transfer",
                    action: "load_history_after_update",
                    severity: "low"
                  },
                  extra: {
                    assignment_id: assignmentId,
                    context: "Ошибка обновления истории изменений после обновления задания",
                    error_message: historyError instanceof Error ? historyError.message : String(historyError)
                  }
                })
                // Не останавливаем выполнение, если история не загрузилась
              }
              
              return { success: true }
            } else {
              span.setAttribute("db.success", false)
              Sentry.captureException(new Error(result.error || "Неизвестная ошибка обновления задания"), {
                tags: {
                  module: "task-transfer",
                  action: "update_assignment",
                  severity: "medium"
                },
                extra: {
                  assignment_id: assignmentId,
                  update_data: updateData,
                  result_error: result.error,
                  context: "Ошибка API при обновлении задания"
                }
              })
              return { success: false, error: result.error }
            }
          } catch (error) {
            span.setAttribute("db.success", false)
            Sentry.captureException(error, {
              tags: {
                module: "task-transfer",
                action: "update_assignment",
                severity: "high"
              },
              extra: {
                assignment_id: assignmentId,
                update_data: updateData,
                error_message: error instanceof Error ? error.message : String(error),
                context: "Неожиданная ошибка при обновлении задания"
              }
            })
            return { success: false, error }
          }
        }
      );
      },

      // Обновление статуса задания
      advanceStatus: async (assignmentId: string, currentStatus: any) => {
        return Sentry.startSpan(
          {
            op: "db.update",
            name: "Обновление статуса задания task-transfer",
          },
          async (span) => {
            try {
              console.log('🚀 Обновляю статус задания:', assignmentId, 'текущий статус:', currentStatus)
              span.setAttribute("module", "task-transfer")
              span.setAttribute("action", "advance_status")
              span.setAttribute("assignment_id", assignmentId)
              span.setAttribute("current_status", String(currentStatus))
              
              const result = await advanceAssignmentStatus(assignmentId, currentStatus)
              
              if (result.success) {
                console.log('✅ Статус задания успешно обновлен')
                // Перезагружаем задания после обновления статуса
                await get().loadAssignments()
                return { success: true }
              } else {
                span.setAttribute("db.success", false)
                Sentry.captureException(new Error(String(result.error) || "Неизвестная ошибка обновления статуса"), {
                  tags: {
                    module: "task-transfer",
                    action: "advance_status",
                    severity: "medium"
                  },
                  extra: {
                    assignment_id: assignmentId,
                    current_status: currentStatus,
                    result_error: result.error,
                    context: "Ошибка API при обновлении статуса задания"
                  }
                })
                return { success: false, error: result.error }
              }
            } catch (error) {
              span.setAttribute("db.success", false)
              Sentry.captureException(error, {
                tags: {
                  module: "task-transfer",
                  action: "advance_status",
                  severity: "high"
                },
                extra: {
                  assignment_id: assignmentId,
                  current_status: currentStatus,
                  error_message: error instanceof Error ? error.message : String(error),
                  context: "Неожиданная ошибка при обновлении статуса задания"
                }
              })
              return { success: false, error }
            }
          }
        );
      },

      // Отмена статуса задания
      revertStatus: async (assignmentId: string, currentStatus: any) => {
        return Sentry.startSpan(
          {
            op: "db.update",
            name: "Отмена статуса задания task-transfer",
          },
          async (span) => {
            try {
              console.log('🚀 Отменяю статус задания:', assignmentId, 'текущий статус:', currentStatus)
              span.setAttribute("module", "task-transfer")
              span.setAttribute("action", "revert_status")
              span.setAttribute("assignment_id", assignmentId)
              span.setAttribute("current_status", String(currentStatus))
              
              const result = await revertAssignmentStatus(assignmentId, currentStatus)
              
              if (result.success) {
                console.log('✅ Статус задания успешно отменен')
                // Перезагружаем задания после отмены статуса
                await get().loadAssignments()
                return { success: true }
              } else {
                span.setAttribute("db.success", false)
                Sentry.captureException(new Error(String(result.error) || "Неизвестная ошибка отмены статуса"), {
                  tags: {
                    module: "task-transfer",
                    action: "revert_status",
                    severity: "medium"
                  },
                  extra: {
                    assignment_id: assignmentId,
                    current_status: currentStatus,
                    result_error: result.error,
                    context: "Ошибка API при отмене статуса задания"
                  }
                })
                return { success: false, error: result.error }
              }
            } catch (error) {
              span.setAttribute("db.success", false)
              Sentry.captureException(error, {
                tags: {
                  module: "task-transfer",
                  action: "revert_status",
                  severity: "high"
                },
                extra: {
                  assignment_id: assignmentId,
                  current_status: currentStatus,
                  error_message: error instanceof Error ? error.message : String(error),
                  context: "Неожиданная ошибка при отмене статуса задания"
                }
              })
              return { success: false, error }
            }
          }
        );
      },

      // Обновление статуса задания с продолжительностью
      advanceStatusWithDuration: async (assignmentId: string, currentStatus: any, duration?: number) => {
        return Sentry.startSpan(
          {
            op: "db.update",
            name: "Обновление статуса с продолжительностью task-transfer",
          },
          async (span) => {
            try {
              console.log('🚀 Обновляю статус задания:', assignmentId, 'текущий статус:', currentStatus, 'продолжительность:', duration)
              span.setAttribute("module", "task-transfer")
              span.setAttribute("action", "advance_status_with_duration")
              span.setAttribute("assignment_id", assignmentId)
              span.setAttribute("current_status", String(currentStatus))
              span.setAttribute("duration", duration ? String(duration) : "not_set")
              
              const result = await advanceAssignmentStatusWithDuration(assignmentId, currentStatus, duration)
              
              if (result.success) {
                console.log('✅ Статус задания успешно обновлен')
                // Перезагружаем задания после обновления статуса
                await get().loadAssignments()
                return { success: true }
              } else {
                span.setAttribute("db.success", false)
                Sentry.captureException(new Error(String(result.error) || "Неизвестная ошибка обновления статуса с продолжительностью"), {
                  tags: {
                    module: "task-transfer",
                    action: "advance_status_with_duration",
                    severity: "medium"
                  },
                  extra: {
                    assignment_id: assignmentId,
                    current_status: currentStatus,
                    duration: duration,
                    result_error: result.error,
                    context: "Ошибка API при обновлении статуса с продолжительностью"
                  }
                })
                return { success: false, error: result.error }
              }
            } catch (error) {
              span.setAttribute("db.success", false)
              Sentry.captureException(error, {
                tags: {
                  module: "task-transfer",
                  action: "advance_status_with_duration",
                  severity: "high"
                },
                extra: {
                  assignment_id: assignmentId,
                  current_status: currentStatus,
                  duration: duration,
                  error_message: error instanceof Error ? error.message : String(error),
                  context: "Неожиданная ошибка при обновлении статуса с продолжительностью"
                }
              })
              return { success: false, error }
            }
          }
        );
      },

      // Загрузка истории изменений задания
      loadAssignmentHistory: async (assignmentId: string) => {
        return Sentry.startSpan(
          {
            op: "db.query",
            name: "Загрузка истории изменений task-transfer",
          },
          async (span) => {
            console.log('🔍 Загружаю историю изменений задания:', assignmentId)
            set({ isLoadingHistory: true })
            
            span.setAttribute("module", "task-transfer")
            span.setAttribute("action", "load_assignment_history")
            span.setAttribute("assignment_id", assignmentId)
            
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
              span.setAttribute("history_records_loaded", history.length)
            } catch (error) {
              span.setAttribute("db.success", false)
              Sentry.captureException(error, {
                tags: {
                  module: "task-transfer",
                  action: "load_assignment_history",
                  severity: "medium"
                },
                extra: {
                  assignment_id: assignmentId,
                  error_message: error instanceof Error ? error.message : String(error),
                  stack_trace: error instanceof Error ? error.stack : undefined,
                  context: "Ошибка загрузки истории изменений задания"
                }
              })
              set({ isLoadingHistory: false })
              throw error // Пробрасываем ошибку дальше
            }
          }
        );
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
