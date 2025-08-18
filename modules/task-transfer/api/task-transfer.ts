import { createClient } from '@/utils/supabase/client'
import type { Assignment, TaskFilters, AssignmentStatus, CreateAssignmentData, UpdateAssignmentData, AssignmentAuditRecord } from '../types'
import * as Sentry from "@sentry/nextjs"

const supabase = createClient()

// Интерфейс для заданий из базы данных
interface AssignmentFromDB {
  assignment_id: string
  project_id: string
  from_section_id: string
  to_section_id: string
  title: string
  description?: string
  status: AssignmentStatus
  created_at: string
  updated_at: string
  due_date?: string
  link?: string
  created_by?: string
  updated_by?: string
  planned_transmitted_date?: string
  planned_duration?: number
  actual_transmitted_date?: string
  actual_accepted_date?: string
  actual_worked_out_date?: string
  actual_agreed_date?: string
}

// Функция для получения заданий с фильтрацией
// Функция для получения карты проектов
async function fetchProjectsMap(projectIds: string[]): Promise<Map<string, string>> {
  const projectsMap = new Map<string, string>()
  
  if (projectIds.length === 0) return projectsMap

  const { data: projects } = await supabase
    .from('projects')
    .select('project_id, project_name')
    .in('project_id', projectIds)
  
  projects?.forEach(p => projectsMap.set(p.project_id, p.project_name))
  console.log('✅ Проекты загружены:', projects?.length || 0)
  
  return projectsMap
}

// Функция для получения карты разделов
async function fetchSectionsMap(sectionIds: string[]): Promise<Map<string, string>> {
  const sectionsMap = new Map<string, string>()
  
  if (sectionIds.length === 0) return sectionsMap

  const { data: sections } = await supabase
    .from('sections')
    .select('section_id, section_name')
    .in('section_id', sectionIds)
  
  sections?.forEach(s => sectionsMap.set(s.section_id, s.section_name))
  console.log('✅ Разделы загружены:', sections?.length || 0)
  
  return sectionsMap
}

// Функция для получения карты пользователей
async function fetchUsersMap(userIds: string[]): Promise<Map<string, string>> {
  const usersMap = new Map<string, string>()
  
  if (userIds.length === 0) return usersMap

  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, first_name, last_name')
    .in('user_id', userIds)
  
  profiles?.forEach(p => usersMap.set(p.user_id, `${p.first_name} ${p.last_name}`))
  console.log('✅ Профили загружены:', profiles?.length || 0)
  
  return usersMap
}

// Функция обогащения заданий метаданными
function enrichAssignmentsWithMetadata(
  rawAssignments: any[],
  projectsMap: Map<string, string>,
  sectionsMap: Map<string, string>,
  usersMap: Map<string, string>
): Assignment[] {
  return rawAssignments.map((assignment: any) => ({
    assignment_id: assignment.assignment_id,
    project_id: assignment.project_id,
    from_section_id: assignment.from_section_id,
    to_section_id: assignment.to_section_id,
    title: assignment.title,
    description: assignment.description,
    status: assignment.status,
    created_at: assignment.created_at,
    updated_at: assignment.updated_at,
    due_date: assignment.due_date,
    link: assignment.link,
    created_by: assignment.created_by,
    updated_by: assignment.updated_by,
    planned_transmitted_date: assignment.planned_transmitted_date,
    planned_duration: assignment.planned_duration,
    actual_transmitted_date: assignment.actual_transmitted_date,
    actual_accepted_date: assignment.actual_accepted_date,
    actual_worked_out_date: assignment.actual_worked_out_date,
    actual_agreed_date: assignment.actual_agreed_date,
    // Дополнительная информация из отдельных запросов
    project_name: projectsMap.get(assignment.project_id),
    from_section_name: sectionsMap.get(assignment.from_section_id),
    to_section_name: sectionsMap.get(assignment.to_section_id),
    created_by_name: assignment.created_by ? usersMap.get(assignment.created_by) : undefined,
    updated_by_name: assignment.updated_by ? usersMap.get(assignment.updated_by) : undefined
  }))
}

export async function fetchAssignments(filters: TaskFilters = {}): Promise<Assignment[]> {
  return Sentry.startSpan(
    {
      op: "db.query",
      name: "Загрузка заданий с фильтрацией",
    },
    async (span) => {
      try {
        let query = supabase
          .from('assignments')
          .select('*')
          .order('created_at', { ascending: false })
        
        span.setAttribute("table", "assignments")
        span.setAttribute("operation", "fetch_assignments")
        span.setAttribute("has_filters", Object.keys(filters).length > 0)
        
        // Применяем фильтры
        if (filters.projectId) {
          query = query.eq('project_id', filters.projectId)
          span.setAttribute("filter.project_id", filters.projectId)
        }
        
        if (filters.status) {
          query = query.eq('status', filters.status)
          span.setAttribute("filter.status", filters.status)
        }

        console.log('📞 Выполняю запрос...')
        const { data, error } = await query

        if (error) {
          span.setAttribute("db.success", false)
          span.setAttribute("db.error", error.message)
          
          Sentry.captureException(error, {
            tags: {
              module: 'task_transfer',
              action: 'fetch_assignments',
              table: 'assignments'
            },
            extra: {
              filters: JSON.stringify(filters),
              error_code: error.code,
              error_details: error.details,
              error_hint: error.hint,
              timestamp: new Date().toISOString()
            }
          })
          throw error
        }

        span.setAttribute("db.success", true)
        span.setAttribute("assignments.count", data?.length || 0)

        if (!data || data.length === 0) {
          console.log('✅ Заданий не найдено')
          return []
        }

        console.log('✅ Задания загружены:', data.length)
        
        // Извлекаем уникальные ID для дополнительных запросов
        const projectIds = [...new Set(data.map(a => a.project_id).filter(Boolean))]
        const sectionIds = [...new Set([
          ...data.map(a => a.from_section_id).filter(Boolean),
          ...data.map(a => a.to_section_id).filter(Boolean)
        ])]
        const userIds = [...new Set([
          ...data.map(a => a.created_by).filter(Boolean),
          ...data.map(a => a.updated_by).filter(Boolean)
        ])]

        console.log('📦 Загружаю дополнительную информацию...', {
          projectIds: projectIds.length,
          sectionIds: sectionIds.length,
          userIds: userIds.length
        })

        span.setAttribute("enrichment.projects", projectIds.length)
        span.setAttribute("enrichment.sections", sectionIds.length)
        span.setAttribute("enrichment.users", userIds.length)

        // Параллельно загружаем все карты данных
        const [projectsMap, sectionsMap, usersMap] = await Promise.all([
          fetchProjectsMap(projectIds),
          fetchSectionsMap(sectionIds),
          fetchUsersMap(userIds)
        ])
        
        // Обогащаем задания метаданными
        const assignments = enrichAssignmentsWithMetadata(data, projectsMap, sectionsMap, usersMap)

        span.setAttribute("assignments.processed", assignments.length)
        console.log('🎉 Задания обработаны и готовы к возврату:', assignments.length)
        return assignments

      } catch (error: any) {
        span.setAttribute("error", true)
        span.setAttribute("error.message", error.message)
        
        Sentry.captureException(error, {
          tags: {
            module: 'task_transfer',
            action: 'fetch_assignments',
            error_type: 'processing_error'
          },
          extra: {
            filters: JSON.stringify(filters),
            error_message: error.message,
            stack_trace: error.stack,
            timestamp: new Date().toISOString()
          }
        })
        return []
      }
    }
  )
}

// Функция для получения иерархии проектов из view_section_hierarchy
export async function fetchProjectHierarchy() {
  return Sentry.startSpan(
    {
      op: "db.query",
      name: "Загрузка иерархии проектов",
    },
    async (span) => {
      try {
        span.setAttribute("table", "view_section_hierarchy")
        span.setAttribute("operation", "fetch_hierarchy")
        
        const { data, error } = await supabase
          .from('view_section_hierarchy')
          .select('*')
          .order('project_name, stage_name, object_name, section_name')

        if (error) {
          span.setAttribute("db.success", false)
          span.setAttribute("db.error", error.message)
          
          Sentry.captureException(error, {
            tags: {
              module: 'task_transfer',
              action: 'fetch_project_hierarchy',
              table: 'view_section_hierarchy'
            },
            extra: {
              error_code: error.code,
              error_details: error.details,
              timestamp: new Date().toISOString()
            }
          })
          throw error
        }

        span.setAttribute("db.success", true)
        span.setAttribute("hierarchy.count", data?.length || 0)
        
        return data || []
      } catch (error) {
        span.setAttribute("error", true)
        span.setAttribute("error.message", (error as Error).message)
        
        Sentry.captureException(error, {
          tags: {
            module: 'task_transfer',
            action: 'fetch_project_hierarchy',
            error_type: 'processing_error'
          },
          extra: {
            error_message: (error as Error).message,
            timestamp: new Date().toISOString()
          }
        })
        return []
      }
    }
  )
}

// Функция для получения организационной структуры
export async function fetchOrganizationalStructure() {
  return Sentry.startSpan(
    {
      op: "db.query",
      name: "Загрузка организационной структуры",
    },
    async (span) => {
      try {
        span.setAttribute("table", "view_organizational_structure")
        span.setAttribute("operation", "fetch_organization")
        
        const { data, error } = await supabase
          .from('view_organizational_structure')
          .select('*')
          .order('department_name, team_name')

        if (error) {
          span.setAttribute("db.success", false)
          span.setAttribute("db.error", error.message)
          
          Sentry.captureException(error, {
            tags: {
              module: 'task_transfer',
              action: 'fetch_organizational_structure',
              table: 'view_organizational_structure'
            },
            extra: {
              error_code: error.code,
              error_details: error.details,
              timestamp: new Date().toISOString()
            }
          })
          throw error
        }

        span.setAttribute("db.success", true)
        span.setAttribute("organization.count", data?.length || 0)
        
        return data || []
      } catch (error) {
        span.setAttribute("error", true)
        span.setAttribute("error.message", (error as Error).message)
        
        Sentry.captureException(error, {
          tags: {
            module: 'task_transfer',
            action: 'fetch_organizational_structure',
            error_type: 'processing_error'
          },
          extra: {
            error_message: (error as Error).message,
            timestamp: new Date().toISOString()
          }
        })
        return []
      }
    }
  )
}

// Функция для получения сотрудников
export async function fetchEmployees() {
  return Sentry.startSpan(
    {
      op: "db.query",
      name: "Загрузка сотрудников с дедупликацией",
    },
    async (span) => {
      try {
        span.setAttribute("table", "view_employee_workloads")
        span.setAttribute("operation", "fetch_employees")
        
        const { data, error } = await supabase
          .from('view_employee_workloads')
          .select(`
            user_id,
            full_name,
            final_team_id,
            final_department_id,
            position_name,
            avatar_url
          `)
          .order('full_name')

        if (error) {
          span.setAttribute("db.success", false)
          span.setAttribute("db.error", error.message)
          
          Sentry.captureException(error, {
            tags: {
              module: 'task_transfer',
              action: 'fetch_employees',
              table: 'view_employee_workloads'
            },
            extra: {
              error_code: error.code,
              error_details: error.details,
              timestamp: new Date().toISOString()
            }
          })
          throw error
        }

        span.setAttribute("db.success", true)
        span.setAttribute("employees.raw_count", data?.length || 0)

        // Дедупликация по имени (для связи с view_section_hierarchy)
        const employeesMap = new Map()
        data?.forEach((row: any) => {
          // Используем имя как ключ для дедупликации, так как в view_section_hierarchy используются имена
          const key = row.full_name
          if (!employeesMap.has(key)) {
            employeesMap.set(key, {
              id: row.user_id,
              name: row.full_name,
              teamId: row.final_team_id,
              departmentId: row.final_department_id,
              position: row.position_name,
              avatarUrl: row.avatar_url
            })
          }
        })

        const employees = Array.from(employeesMap.values())
        span.setAttribute("employees.deduplicated_count", employees.length)
        
        return employees
      } catch (error) {
        span.setAttribute("error", true)
        span.setAttribute("error.message", (error as Error).message)
        
        Sentry.captureException(error, {
          tags: {
            module: 'task_transfer',
            action: 'fetch_employees',
            error_type: 'processing_error'
          },
          extra: {
            error_message: (error as Error).message,
            timestamp: new Date().toISOString()
          }
        })
        return []
      }
    }
  )
}

// Функция для получения разделов
export async function fetchSections() {
  return Sentry.startSpan(
    {
      op: "db.query",
      name: "Загрузка разделов с ответственными",
    },
    async (span) => {
      try {
        span.setAttribute("table", "sections")
        span.setAttribute("operation", "fetch_sections")
        
        const { data, error } = await supabase
          .from('sections')
          .select('section_id, section_name, section_project_id, section_responsible')
          .order('section_name')

    if (error) {
      span.setAttribute("db.success", false)
      span.setAttribute("db.error", error.message)
      
      Sentry.captureException(error, {
        tags: {
          module: 'task_transfer',
          action: 'fetch_sections',
          table: 'sections'
        },
        extra: {
          error_code: error.code,
          error_details: error.details,
          timestamp: new Date().toISOString()
        }
      })
      throw error
    }

    span.setAttribute("db.success", true)
    span.setAttribute("sections.count", data?.length || 0)

    if (!data || data.length === 0) {
      return []
    }

    // Получаем информацию об ответственных отдельным запросом
    const responsibleIds = [...new Set(data.map(s => s.section_responsible).filter(Boolean))]
    const responsibleMap = new Map()
    
    span.setAttribute("responsible.count", responsibleIds.length)
    
    if (responsibleIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, avatar_url')
        .in('user_id', responsibleIds)
      
      profiles?.forEach(p => responsibleMap.set(p.user_id, {
        name: `${p.first_name} ${p.last_name}`,
        avatar: p.avatar_url
      }))
    }

    const sections = data.map((section: any) => {
      const responsible = responsibleMap.get(section.section_responsible)
      return {
        id: section.section_id,
        name: section.section_name,
        projectId: section.section_project_id,
        responsibleId: section.section_responsible,
        responsibleName: responsible?.name,
        responsibleAvatar: responsible?.avatar
      }
    })
    
        span.setAttribute("sections.processed", sections.length)
        return sections
          
      } catch (error) {
        span.setAttribute("error", true)
        span.setAttribute("error.message", (error as Error).message)
        
        Sentry.captureException(error, {
          tags: {
            module: 'task_transfer',
            action: 'fetch_sections',
            error_type: 'processing_error'
          },
          extra: {
            error_message: (error as Error).message,
            timestamp: new Date().toISOString()
          }
        })
        return []
      }
    }
  )
}

// Функция для создания нового задания
export async function createAssignment(assignmentData: CreateAssignmentData) {
  return Sentry.startSpan(
    {
      op: "db.insert",
      name: "Создание нового задания",
    },
    async (span) => {
      try {
        span.setAttribute("table", "assignments")
        span.setAttribute("operation", "create_assignment")
        span.setAttribute("project_id", assignmentData.project_id)
        span.setAttribute("from_section_id", assignmentData.from_section_id)
        span.setAttribute("to_section_id", assignmentData.to_section_id)
        span.setAttribute("title", assignmentData.title.substring(0, 100))
        span.setAttribute("has_description", !!assignmentData.description)
        span.setAttribute("has_due_date", !!assignmentData.due_date)
        span.setAttribute("planned_duration", assignmentData.planned_duration || 0)
        
        const { data, error } = await supabase
          .from('assignments')
          .insert({
            project_id: assignmentData.project_id,
            from_section_id: assignmentData.from_section_id,
            to_section_id: assignmentData.to_section_id,
            title: assignmentData.title,
            description: assignmentData.description,
            due_date: assignmentData.due_date,
            link: assignmentData.link,
            planned_transmitted_date: assignmentData.planned_transmitted_date,
            planned_duration: assignmentData.planned_duration,
            status: 'Создано' as AssignmentStatus,
            created_at: new Date().toISOString()
          })
          .select()
          .single()

        if (error) {
          span.setAttribute("db.success", false)
          span.setAttribute("db.error", error.message)
          
          Sentry.captureException(error, {
            tags: {
              module: 'task_transfer',
              action: 'create_assignment',
              table: 'assignments',
              critical: true
            },
            extra: {
              assignment_data: JSON.stringify(assignmentData),
              error_code: error.code,
              error_details: error.details,
              error_hint: error.hint,
              timestamp: new Date().toISOString()
            }
          })
          throw error
        }

        span.setAttribute("db.success", true)
        span.setAttribute("assignment_id", data.assignment_id)
        
        console.log('✅ Задание создано:', data)
        return { success: true, data }
        
      } catch (error) {
        span.setAttribute("error", true)
        span.setAttribute("error.message", (error as Error).message)
        
        Sentry.captureException(error, {
          tags: {
            module: 'task_transfer',
            action: 'create_assignment',
            error_type: 'creation_error',
            critical: true
          },
          extra: {
            assignment_data: JSON.stringify(assignmentData),
            error_message: (error as Error).message,
            timestamp: new Date().toISOString()
          }
        })
        return { success: false, error }
      }
    }
  )
}

// Функция для обновления статуса задания
export async function updateAssignmentStatus(assignmentId: string, status: AssignmentStatus) {
  return Sentry.startSpan(
    {
      op: "db.update",
      name: "Обновление статуса задания",
    },
    async (span) => {
      try {
        span.setAttribute("table", "assignments")
        span.setAttribute("operation", "update_status")
        span.setAttribute("assignment_id", assignmentId)
        span.setAttribute("new_status", status)
        
        const { data, error } = await supabase
          .from('assignments')
          .update({ 
            status,
            updated_at: new Date().toISOString()
          })
          .eq('assignment_id', assignmentId)
          .select()
          .single()

        if (error) {
          span.setAttribute("db.success", false)
          span.setAttribute("db.error", error.message)
          
          Sentry.captureException(error, {
            tags: {
              module: 'task_transfer',
              action: 'update_assignment_status',
              table: 'assignments',
              assignment_id: assignmentId
            },
            extra: {
              assignment_id: assignmentId,
              new_status: status,
              error_code: error.code,
              error_details: error.details,
              timestamp: new Date().toISOString()
            }
          })
          throw error
        }

        span.setAttribute("db.success", true)
        span.setAttribute("updated_status", data.status)
        
        console.log('✅ Статус задания обновлен:', data)
        return { success: true, data }
        
      } catch (error) {
        span.setAttribute("error", true)
        span.setAttribute("error.message", (error as Error).message)
        
        Sentry.captureException(error, {
          tags: {
            module: 'task_transfer',
            action: 'update_assignment_status',
            error_type: 'status_update_error',
            assignment_id: assignmentId
          },
          extra: {
            assignment_id: assignmentId,
            new_status: status,
            error_message: (error as Error).message,
            timestamp: new Date().toISOString()
          }
        })
        return { success: false, error }
      }
    }
  )
}

// Функция для обновления задания
export async function updateAssignment(assignmentId: string, updateData: UpdateAssignmentData) {
  return Sentry.startSpan(
    {
      op: "db.update",
      name: "Обновление задания с аудитом",
    },
    async (span) => {
      try {
        span.setAttribute("table", "assignments")
        span.setAttribute("operation", "update_assignment_with_audit")
        span.setAttribute("assignment_id", assignmentId)
        span.setAttribute("update_fields", Object.keys(updateData).join(", "))
        
        // 1. Получаем старые данные задания
        const { data: oldAssignment, error: fetchError } = await supabase
          .from('assignments')
          .select('title, description, due_date, planned_duration, link')
          .eq('assignment_id', assignmentId)
          .single()

        if (fetchError) {
          span.setAttribute("db.success", false)
          span.setAttribute("fetch_error", fetchError.message)
          
          Sentry.captureException(fetchError, {
            tags: {
              module: 'task_transfer',
              action: 'update_assignment_fetch_old',
              table: 'assignments',
              assignment_id: assignmentId
            },
            extra: {
              assignment_id: assignmentId,
              error_code: fetchError.code,
              error_details: fetchError.details,
              timestamp: new Date().toISOString()
            }
          })
          throw fetchError
        }

        span.setAttribute("old_data_fetched", true)

        // 2. Обновляем задание
        const { data, error } = await supabase
          .from('assignments')
          .update({
            ...updateData,
            updated_at: new Date().toISOString()
          })
          .eq('assignment_id', assignmentId)
          .select()
          .single()

        if (error) {
          span.setAttribute("db.success", false)
          span.setAttribute("update_error", error.message)
          
          Sentry.captureException(error, {
            tags: {
              module: 'task_transfer',
              action: 'update_assignment_main',
              table: 'assignments',
              assignment_id: assignmentId,
              critical: true
            },
            extra: {
              assignment_id: assignmentId,
              update_data: JSON.stringify(updateData),
              error_code: error.code,
              error_details: error.details,
              timestamp: new Date().toISOString()
            }
          })
          throw error
        }

        span.setAttribute("db.success", true)
        span.setAttribute("assignment_updated", true)

        // 3. Создаем записи аудита только если задание обновлено
        if (oldAssignment) {
          try {
            // Получаем ID текущего пользователя из Supabase Auth
            const { data: { user } } = await supabase.auth.getUser()
            
            if (user?.id) {
              console.log('👤 Создаю записи аудита для пользователя:', user.id)
              span.setAttribute("audit.user_id", user.id)
              await createAuditRecords(assignmentId, oldAssignment, updateData, user.id)
              span.setAttribute("audit.created", true)
            } else {
              span.setAttribute("audit.no_user", true)
              Sentry.captureMessage('Не удалось получить ID текущего пользователя для аудита', {
                level: 'warning',
                tags: {
                  module: 'task_transfer',
                  action: 'update_assignment_audit',
                  assignment_id: assignmentId
                },
                extra: {
                  assignment_id: assignmentId,
                  timestamp: new Date().toISOString()
                }
              })
            }
          } catch (auditError) {
            span.setAttribute("audit.error", true)
            Sentry.captureException(auditError, {
              tags: {
                module: 'task_transfer',
                action: 'update_assignment_audit',
                assignment_id: assignmentId,
                error_type: 'audit_error'
              },
              extra: {
                assignment_id: assignmentId,
                error_message: (auditError as Error).message,
                timestamp: new Date().toISOString()
              }
            })
            // Не останавливаем выполнение если аудит не удался
          }
        }

        console.log('✅ Задание обновлено с записями аудита:', data)
        return { success: true, data }
        
      } catch (error: any) {
        span.setAttribute("error", true)
        span.setAttribute("error.message", error.message)
        
        Sentry.captureException(error, {
          tags: {
            module: 'task_transfer',
            action: 'update_assignment',
            assignment_id: assignmentId,
            error_type: 'general_update_error'
          },
          extra: {
            assignment_id: assignmentId,
            update_data: JSON.stringify(updateData),
            error_message: error.message,
            timestamp: new Date().toISOString()
          }
        })
        return { success: false, error }
      }
    }
  )
}

// Функция для продвижения статуса задания к следующему
export async function advanceAssignmentStatus(assignmentId: string, currentStatus: AssignmentStatus) {
  return advanceAssignmentStatusWithDuration(assignmentId, currentStatus)
}

// Функция для продвижения статуса задания к следующему с указанием продолжительности
export async function advanceAssignmentStatusWithDuration(assignmentId: string, currentStatus: AssignmentStatus, duration?: number) {
  return Sentry.startSpan(
    {
      op: "db.update",
      name: "Продвижение статуса задания",
    },
    async (span) => {
      try {
        span.setAttribute("table", "assignments")
        span.setAttribute("operation", "advance_status")
        span.setAttribute("assignment_id", assignmentId)
        span.setAttribute("current_status", currentStatus)
        span.setAttribute("duration", duration || 0)
        
        const currentDate = new Date().toISOString().split('T')[0] // Только дата без времени
        let updateData: any = {
          updated_at: new Date().toISOString()
        }

        // Определяем следующий статус и обновляем соответствующие поля
        switch (currentStatus) {
          case 'Создано':
            updateData.status = 'Передано'
            updateData.actual_transmitted_date = currentDate
            break
          case 'Передано':
            updateData.status = 'Принято'
            updateData.actual_accepted_date = currentDate
            // Обновляем плановую продолжительность, если указана
            if (duration !== undefined) {
              updateData.planned_duration = duration
            }
            break
          case 'Принято':
            updateData.status = 'Выполнено'
            updateData.actual_worked_out_date = currentDate
            break
          case 'Выполнено':
            updateData.status = 'Согласовано'
            updateData.actual_agreed_date = currentDate
            break
          default:
            const error = new Error(`Невозможно продвинуть статус из "${currentStatus}"`)
            span.setAttribute("status_error", true)
            Sentry.captureException(error, {
              tags: {
                module: 'task_transfer',
                action: 'advance_status_invalid',
                assignment_id: assignmentId,
                error_type: 'invalid_status_transition'
              },
              extra: {
                assignment_id: assignmentId,
                current_status: currentStatus,
                timestamp: new Date().toISOString()
              }
            })
            throw error
        }

        span.setAttribute("new_status", updateData.status)
        span.setAttribute("status_fields", Object.keys(updateData).join(", "))

        const { data, error } = await supabase
          .from('assignments')
          .update(updateData)
          .eq('assignment_id', assignmentId)
          .select()
          .single()

        if (error) {
          span.setAttribute("db.success", false)
          span.setAttribute("db.error", error.message)
          
          Sentry.captureException(error, {
            tags: {
              module: 'task_transfer',
              action: 'advance_assignment_status',
              table: 'assignments',
              assignment_id: assignmentId,
              critical: true
            },
            extra: {
              assignment_id: assignmentId,
              current_status: currentStatus,
              new_status: updateData.status,
              duration: duration,
              error_code: error.code,
              error_details: error.details,
              timestamp: new Date().toISOString()
            }
          })
          throw error
        }

        span.setAttribute("db.success", true)
        span.setAttribute("status_advanced", true)

        console.log('✅ Статус задания продвинут:', data)
        return { success: true, data }
        
      } catch (error) {
        span.setAttribute("error", true)
        span.setAttribute("error.message", (error as Error).message)
        
        Sentry.captureException(error, {
          tags: {
            module: 'task_transfer',
            action: 'advance_assignment_status',
            assignment_id: assignmentId,
            error_type: 'advance_status_error'
          },
          extra: {
            assignment_id: assignmentId,
            current_status: currentStatus,
            duration: duration,
            error_message: (error as Error).message,
            timestamp: new Date().toISOString()
          }
        })
        return { success: false, error }
      }
    }
  )
}

// Функция для отката статуса задания к предыдущему
export async function revertAssignmentStatus(assignmentId: string, currentStatus: AssignmentStatus) {
  return Sentry.startSpan(
    {
      op: "db.update",
      name: "Откат статуса задания",
    },
    async (span) => {
      try {
        span.setAttribute("table", "assignments")
        span.setAttribute("operation", "revert_status")
        span.setAttribute("assignment_id", assignmentId)
        span.setAttribute("current_status", currentStatus)
        
        let updateData: any = {
          updated_at: new Date().toISOString()
        }

        // Определяем предыдущий статус и очищаем соответствующие поля
        switch (currentStatus) {
          case 'Передано':
            updateData.status = 'Создано'
            updateData.actual_transmitted_date = null
            break
          case 'Принято':
            updateData.status = 'Передано'
            updateData.actual_accepted_date = null
            break
          case 'Выполнено':
            updateData.status = 'Принято'
            updateData.actual_worked_out_date = null
            break
          case 'Согласовано':
            updateData.status = 'Выполнено'
            updateData.actual_agreed_date = null
            break
          default:
            const error = new Error(`Невозможно откатить статус из "${currentStatus}"`)
            span.setAttribute("status_error", true)
            Sentry.captureException(error, {
              tags: {
                module: 'task_transfer',
                action: 'revert_status_invalid',
                assignment_id: assignmentId,
                error_type: 'invalid_status_revert'
              },
              extra: {
                assignment_id: assignmentId,
                current_status: currentStatus,
                timestamp: new Date().toISOString()
              }
            })
            throw error
        }

        span.setAttribute("reverted_status", updateData.status)
        span.setAttribute("cleared_fields", Object.keys(updateData).filter(k => updateData[k] === null).join(", "))

        const { data, error } = await supabase
          .from('assignments')
          .update(updateData)
          .eq('assignment_id', assignmentId)
          .select()
          .single()

        if (error) {
          span.setAttribute("db.success", false)
          span.setAttribute("db.error", error.message)
          
          Sentry.captureException(error, {
            tags: {
              module: 'task_transfer',
              action: 'revert_assignment_status',
              table: 'assignments',
              assignment_id: assignmentId,
              critical: true
            },
            extra: {
              assignment_id: assignmentId,
              current_status: currentStatus,
              reverted_status: updateData.status,
              error_code: error.code,
              error_details: error.details,
              timestamp: new Date().toISOString()
            }
          })
          throw error
        }

        span.setAttribute("db.success", true)
        span.setAttribute("status_reverted", true)

        console.log('✅ Статус задания откачен:', data)
        return { success: true, data }
        
      } catch (error) {
        span.setAttribute("error", true)
        span.setAttribute("error.message", (error as Error).message)
        
        Sentry.captureException(error, {
          tags: {
            module: 'task_transfer',
            action: 'revert_assignment_status',
            assignment_id: assignmentId,
            error_type: 'revert_status_error'
          },
          extra: {
            assignment_id: assignmentId,
            current_status: currentStatus,
            error_message: (error as Error).message,
            timestamp: new Date().toISOString()
          }
        })
        return { success: false, error }
      }
    }
  )
}

// Функция для получения истории изменений задания
export async function fetchAssignmentHistory(assignmentId: string): Promise<AssignmentAuditRecord[]> {
  return Sentry.startSpan(
    {
      op: "db.query",
      name: "Загрузка истории изменений задания",
    },
    async (span) => {
      try {
        span.setAttribute("table", "assignment_audit")
        span.setAttribute("operation", "fetch_history")
        span.setAttribute("assignment_id", assignmentId)
        
        console.log('📞 Получаю историю изменений для задания:', assignmentId)
        
        // Загружаем записи аудита
        const { data: auditData, error: auditError } = await supabase
          .from('assignment_audit')
          .select('*')
          .eq('assignment_id', assignmentId)
          .order('changed_at', { ascending: false })

        if (auditError) {
          span.setAttribute("db.success", false)
          span.setAttribute("audit_error", auditError.message)
          
          Sentry.captureException(auditError, {
            tags: {
              module: 'task_transfer',
              action: 'fetch_assignment_history',
              table: 'assignment_audit',
              assignment_id: assignmentId
            },
            extra: {
              assignment_id: assignmentId,
              error_code: auditError.code,
              error_details: JSON.stringify(auditError, null, 2),
              timestamp: new Date().toISOString()
            }
          })
          throw auditError
        }

        span.setAttribute("db.success", true)
        span.setAttribute("audit_records.count", auditData?.length || 0)

        console.log('📦 Получены базовые данные аудита:', auditData?.length || 0)

        if (!auditData || auditData.length === 0) {
          console.log('ℹ️ Нет записей аудита для задания:', assignmentId)
          return []
        }

        // Получаем уникальные ID пользователей
        const userIds = [...new Set(auditData.map(record => record.changed_by).filter(Boolean))]
        console.log('👥 Уникальные пользователи в истории:', userIds.length)
        
        span.setAttribute("users.count", userIds.length)

        // Загружаем информацию о пользователях
        let usersMap = new Map()
        if (userIds.length > 0) {
          const { data: usersData, error: usersError } = await supabase
            .from('profiles')
            .select('user_id, first_name, last_name, avatar_url')
            .in('user_id', userIds)

          if (usersError) {
            span.setAttribute("users_fetch_error", true)
            Sentry.captureException(usersError, {
              tags: {
                module: 'task_transfer',
                action: 'fetch_history_users',
                assignment_id: assignmentId,
                table: 'profiles'
              },
              extra: {
                assignment_id: assignmentId,
                user_ids: userIds,
                error_code: usersError.code,
                error_details: usersError.details,
                timestamp: new Date().toISOString()
              }
            })
          } else {
            console.log('👤 Загружены профили пользователей:', usersData?.length || 0)
            span.setAttribute("users.loaded", usersData?.length || 0)
            usersData?.forEach(user => {
              usersMap.set(user.user_id, {
                name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
                avatar: user.avatar_url
              })
            })
          }
        }

        // Преобразуем данные с информацией о пользователях
        const auditRecords = auditData.map((record: any) => {
          const userInfo = usersMap.get(record.changed_by)
          
          return {
            audit_id: record.audit_id,
            assignment_id: record.assignment_id,
            changed_by: record.changed_by,
            changed_at: record.changed_at,
            operation_type: record.operation_type,
            field_name: record.field_name,
            old_value: record.old_value,
            new_value: record.new_value,
            created_at: record.created_at,
            changed_by_name: userInfo?.name || 'Неизвестный пользователь',
            changed_by_avatar: userInfo?.avatar
          }
        })

        span.setAttribute("records.processed", auditRecords.length)
        console.log('✅ История изменений загружена с именами пользователей:', auditRecords.length)
        return auditRecords

      } catch (error: any) {
        span.setAttribute("error", true)
        span.setAttribute("error.message", error.message)
        
        Sentry.captureException(error, {
          tags: {
            module: 'task_transfer',
            action: 'fetch_assignment_history',
            assignment_id: assignmentId,
            error_type: 'history_fetch_error'
          },
          extra: {
            assignment_id: assignmentId,
            error_message: error.message,
            stack_trace: error?.stack,
            timestamp: new Date().toISOString()
          }
        })
        return []
      }
    }
  )
}

// Функция для создания записей аудита
export async function createAuditRecords(
  assignmentId: string,
  oldData: Record<string, any>,
  newData: Record<string, any>,
  userId: string
) {
  return Sentry.startSpan(
    {
      op: "db.insert",
      name: "Создание записей аудита изменений",
    },
    async (span) => {
      try {
        span.setAttribute("table", "assignment_audit")
        span.setAttribute("operation", "create_audit_records")
        span.setAttribute("assignment_id", assignmentId)
        span.setAttribute("user_id", userId)
        span.setAttribute("fields_to_check", Object.keys(newData).length)
        
        console.log('🔍 Создаю записи аудита для задания:', assignmentId)
        console.log('📊 Старые данные:', oldData)
        console.log('📊 Новые данные:', newData)
        
        const auditRecords = []

        for (const [fieldName, newValue] of Object.entries(newData)) {
          const oldValue = oldData[fieldName]
          
          // Пропускаем если значение не изменилось или undefined
          if (newValue === undefined || oldValue === newValue) {
            console.log(`⏭️ Пропускаю поле ${fieldName}: значение не изменилось`)
            continue
          }

          console.log(`📝 Поле ${fieldName} изменено: "${oldValue}" → "${newValue}"`)
          
          auditRecords.push({
            assignment_id: assignmentId,
            changed_by: userId,
            operation_type: 'UPDATE',
            field_name: fieldName,
            old_value: oldValue?.toString() || null,
            new_value: newValue?.toString() || null
          })
        }

        span.setAttribute("changes.detected", auditRecords.length)
        console.log(`💾 Сохраняю ${auditRecords.length} записей аудита...`)

        // Сохраняем записи аудита если есть изменения
        if (auditRecords.length > 0) {
          const { data, error } = await supabase
            .from('assignment_audit')
            .insert(auditRecords)
            .select()
            
          if (error) {
            span.setAttribute("db.success", false)
            span.setAttribute("audit_error", error.message)
            
            Sentry.captureException(error, {
              tags: {
                module: 'task_transfer',
                action: 'create_audit_records',
                table: 'assignment_audit',
                assignment_id: assignmentId,
                critical: true
              },
              extra: {
                assignment_id: assignmentId,
                user_id: userId,
                audit_records: JSON.stringify(auditRecords),
                error_code: error.code,
                error_details: JSON.stringify(error, null, 2),
                timestamp: new Date().toISOString()
              }
            })
            throw error
          }
          
          span.setAttribute("db.success", true)
          span.setAttribute("records.created", data?.length || 0)
          console.log('✅ Записи аудита созданы:', data?.length || 0)
        } else {
          span.setAttribute("no_changes", true)
          console.log('ℹ️ Нет изменений для записи в аудит')
        }

        return auditRecords
        
      } catch (error: any) {
        span.setAttribute("error", true)
        span.setAttribute("error.message", error.message)
        
        Sentry.captureException(error, {
          tags: {
            module: 'task_transfer',
            action: 'create_audit_records',
            assignment_id: assignmentId,
            error_type: 'audit_creation_error',
            critical: true
          },
          extra: {
            assignment_id: assignmentId,
            user_id: userId,
            old_data: JSON.stringify(oldData),
            new_data: JSON.stringify(newData),
            error_message: error.message,
            stack_trace: error?.stack,
            timestamp: new Date().toISOString()
          }
        })
        throw error
      }
    }
  )
} 