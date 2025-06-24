import { createClient } from '@/utils/supabase/client'
import type { Assignment, TaskFilters, AssignmentStatus, CreateAssignmentData, UpdateAssignmentData, AssignmentAuditRecord } from '../types'

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
export async function fetchAssignments(filters: TaskFilters = {}): Promise<Assignment[]> {
  try {
    let query = supabase
      .from('assignments')
      .select('*')
      .order('created_at', { ascending: false })
    

    // Применяем фильтры
    if (filters.projectId) {
      query = query.eq('project_id', filters.projectId)
    }
    
    if (filters.status) {
      query = query.eq('status', filters.status)
    }

    console.log('📞 Выполняю запрос...')
    const { data, error } = await query

    if (error) {
      console.error('❌ Ошибка загрузки заданий:', error)
      throw error
    }

    if (!data || data.length === 0) {
      console.log('✅ Заданий не найдено')
      return []
    }

    console.log('✅ Задания загружены:', data.length)
    
    // Получаем дополнительную информацию отдельными запросами
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

    // Получаем проекты
    const projectsMap = new Map()
    if (projectIds.length > 0) {
      const { data: projects } = await supabase
        .from('projects')
        .select('project_id, project_name')
        .in('project_id', projectIds)
      
      projects?.forEach(p => projectsMap.set(p.project_id, p.project_name))
      console.log('✅ Проекты загружены:', projects?.length || 0)
    }

    // Получаем разделы
    const sectionsMap = new Map()
    if (sectionIds.length > 0) {
      const { data: sections } = await supabase
        .from('sections')
        .select('section_id, section_name')
        .in('section_id', sectionIds)
      
      sections?.forEach(s => sectionsMap.set(s.section_id, s.section_name))
      console.log('✅ Разделы загружены:', sections?.length || 0)
    }

    // Получаем профили пользователей
    const usersMap = new Map()
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', userIds)
      
      profiles?.forEach(p => usersMap.set(p.user_id, `${p.first_name} ${p.last_name}`))
      console.log('✅ Профили загружены:', profiles?.length || 0)
    }
    
    // Преобразуем данные в нужный формат
    const assignments = data.map((assignment: any) => ({
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

    console.log('🎉 Задания обработаны и готовы к возврату:', assignments.length)
    return assignments

  } catch (error: any) {
    console.error('❌ Ошибка при загрузке заданий:', error)
    console.error('❌ Stack trace:', error.stack)
    return []
  }
}

// Функция для получения иерархии проектов из view_section_hierarchy
export async function fetchProjectHierarchy() {
  try {
    const { data, error } = await supabase
      .from('view_section_hierarchy')
      .select('*')
      .order('project_name, stage_name, object_name, section_name')

    if (error) {
      console.error('❌ Ошибка загрузки иерархии проектов:', error)
      throw error
    }

    return data || []
  } catch (error) {
    console.error('❌ Ошибка при загрузке иерархии проектов:', error)
    return []
  }
}

// Функция для получения организационной структуры
export async function fetchOrganizationalStructure() {
  try {
    const { data, error } = await supabase
      .from('view_organizational_structure')
      .select('*')
      .order('department_name, team_name')

    if (error) {
      console.error('❌ Ошибка загрузки организационной структуры:', error)
      throw error
    }

    return data || []
  } catch (error) {
    console.error('❌ Ошибка при загрузке организационной структуры:', error)
    return []
  }
}

// Функция для получения сотрудников
export async function fetchEmployees() {
  try {
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
      console.error('❌ Ошибка загрузки сотрудников:', error)
      throw error
    }

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

    return Array.from(employeesMap.values())
  } catch (error) {
    console.error('❌ Ошибка при загрузке сотрудников:', error)
    return []
  }
}

// Функция для получения разделов
export async function fetchSections() {
  try {
    const { data, error } = await supabase
      .from('sections')
      .select('section_id, section_name, section_project_id, section_responsible')
      .order('section_name')

    if (error) {
      console.error('❌ Ошибка загрузки разделов:', error)
      throw error
    }

    if (!data || data.length === 0) {
      return []
    }

    // Получаем информацию об ответственных отдельным запросом
    const responsibleIds = [...new Set(data.map(s => s.section_responsible).filter(Boolean))]
    const responsibleMap = new Map()
    
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

    return data.map((section: any) => {
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
  } catch (error) {
    console.error('❌ Ошибка при загрузке разделов:', error)
    return []
  }
}

// Функция для создания нового задания
export async function createAssignment(assignmentData: CreateAssignmentData) {
  try {
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
      console.error('❌ Ошибка создания задания:', error)
      throw error
    }

    console.log('✅ Задание создано:', data)
    return { success: true, data }
  } catch (error) {
    console.error('❌ Ошибка при создании задания:', error)
    return { success: false, error }
  }
}

// Функция для обновления статуса задания
export async function updateAssignmentStatus(assignmentId: string, status: AssignmentStatus) {
  try {
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
      console.error('❌ Ошибка обновления статуса задания:', error)
      throw error
    }

    console.log('✅ Статус задания обновлен:', data)
    return { success: true, data }
  } catch (error) {
    console.error('❌ Ошибка при обновлении статуса задания:', error)
    return { success: false, error }
  }
}

// Функция для обновления задания
export async function updateAssignment(assignmentId: string, updateData: UpdateAssignmentData) {
  try {
    // 1. Получаем старые данные задания
    const { data: oldAssignment, error: fetchError } = await supabase
      .from('assignments')
      .select('title, description, due_date, planned_duration, link')
      .eq('assignment_id', assignmentId)
      .single()

    if (fetchError) {
      console.error('❌ Ошибка получения старых данных задания:', fetchError)
      throw fetchError
    }

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
      console.error('❌ Ошибка обновления задания:', error)
      throw error
    }

    // 3. Создаем записи аудита только если задание обновлено
    if (oldAssignment) {
      try {
        // Получаем ID текущего пользователя из Supabase Auth
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user?.id) {
          console.log('👤 Создаю записи аудита для пользователя:', user.id)
          await createAuditRecords(assignmentId, oldAssignment, updateData, user.id)
        } else {
          console.warn('⚠️ Не удалось получить ID текущего пользователя, записи аудита не созданы')
        }
      } catch (auditError) {
        console.error('❌ Ошибка создания записей аудита:', auditError)
        // Не останавливаем выполнение если аудит не удался
      }
    }

    console.log('✅ Задание обновлено с записями аудита:', data)
    return { success: true, data }
  } catch (error: any) {
    console.error('❌ Ошибка при обновлении задания:', error)
    return { success: false, error }
  }
}

// Функция для продвижения статуса задания к следующему
export async function advanceAssignmentStatus(assignmentId: string, currentStatus: AssignmentStatus) {
  return advanceAssignmentStatusWithDuration(assignmentId, currentStatus)
}

// Функция для продвижения статуса задания к следующему с указанием продолжительности
export async function advanceAssignmentStatusWithDuration(assignmentId: string, currentStatus: AssignmentStatus, duration?: number) {
  try {
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
        throw new Error(`Невозможно продвинуть статус из "${currentStatus}"`)
    }

    const { data, error } = await supabase
      .from('assignments')
      .update(updateData)
      .eq('assignment_id', assignmentId)
      .select()
      .single()

    if (error) {
      console.error('❌ Ошибка продвижения статуса задания:', error)
      throw error
    }

    console.log('✅ Статус задания продвинут:', data)
    return { success: true, data }
  } catch (error) {
    console.error('❌ Ошибка при продвижении статуса задания:', error)
    return { success: false, error }
  }
}

// Функция для отката статуса задания к предыдущему
export async function revertAssignmentStatus(assignmentId: string, currentStatus: AssignmentStatus) {
  try {
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
        throw new Error(`Невозможно откатить статус из "${currentStatus}"`)
    }

    const { data, error } = await supabase
      .from('assignments')
      .update(updateData)
      .eq('assignment_id', assignmentId)
      .select()
      .single()

    if (error) {
      console.error('❌ Ошибка отката статуса задания:', error)
      throw error
    }

    console.log('✅ Статус задания откачен:', data)
    return { success: true, data }
  } catch (error) {
    console.error('❌ Ошибка при откате статуса задания:', error)
    return { success: false, error }
  }
}

// Функция для получения истории изменений задания
export async function fetchAssignmentHistory(assignmentId: string): Promise<AssignmentAuditRecord[]> {
  try {
    console.log('📞 Получаю историю изменений для задания:', assignmentId)
    
    // Загружаем записи аудита
    const { data: auditData, error: auditError } = await supabase
      .from('assignment_audit')
      .select('*')
      .eq('assignment_id', assignmentId)
      .order('changed_at', { ascending: false })

    if (auditError) {
      console.error('❌ Ошибка загрузки истории изменений:', auditError)
      console.error('❌ Детали ошибки:', JSON.stringify(auditError, null, 2))
      throw auditError
    }

    console.log('📦 Получены базовые данные аудита:', auditData?.length || 0)

    if (!auditData || auditData.length === 0) {
      console.log('ℹ️ Нет записей аудита для задания:', assignmentId)
      return []
    }

    // Получаем уникальные ID пользователей
    const userIds = [...new Set(auditData.map(record => record.changed_by).filter(Boolean))]
    console.log('👥 Уникальные пользователи в истории:', userIds.length)

    // Загружаем информацию о пользователях
    let usersMap = new Map()
    if (userIds.length > 0) {
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, avatar_url')
        .in('user_id', userIds)

      if (usersError) {
        console.warn('⚠️ Ошибка загрузки профилей пользователей:', usersError)
      } else {
        console.log('👤 Загружены профили пользователей:', usersData?.length || 0)
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

    console.log('✅ История изменений загружена с именами пользователей:', auditRecords.length)
    return auditRecords

  } catch (error: any) {
    console.error('❌ Ошибка при загрузке истории изменений:', error)
    console.error('❌ Stack trace:', error?.stack)
    return []
  }
}

// Функция для создания записей аудита
export async function createAuditRecords(
  assignmentId: string,
  oldData: Record<string, any>,
  newData: Record<string, any>,
  userId: string
) {
  try {
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

    console.log(`💾 Сохраняю ${auditRecords.length} записей аудита...`)

    // Сохраняем записи аудита если есть изменения
    if (auditRecords.length > 0) {
      const { data, error } = await supabase
        .from('assignment_audit')
        .insert(auditRecords)
        .select()
        
      if (error) {
        console.error('❌ Ошибка создания записей аудита:', error)
        console.error('❌ Детали ошибки:', JSON.stringify(error, null, 2))
        throw error
      }
      
      console.log('✅ Записи аудита созданы:', data?.length || 0)
    } else {
      console.log('ℹ️ Нет изменений для записи в аудит')
    }

    return auditRecords
  } catch (error: any) {
    console.error('❌ Ошибка при создании записей аудита:', error)
    console.error('❌ Stack trace:', error?.stack)
    throw error
  }
} 