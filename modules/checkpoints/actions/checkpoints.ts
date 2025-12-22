'use server'

import { createClient } from '@/utils/supabase/server'
import { getUserPermissions } from '@/modules/permissions/supabase/supabasePermissions'
import type { CheckpointFilters } from '@/modules/cache/keys/query-keys'
import type { ActionResult } from '@/modules/cache/types'
import * as Sentry from '@sentry/nextjs'

// ============================================================================
// Types
// ============================================================================

/** Input для создания чекпоинта */
export interface CreateCheckpointInput {
  sectionId: string
  typeId: string
  title: string // Название чекпоинта. Логика:
                // - Для предустановленных типов: опционально (если пусто — берется checkpoint_types.name)
                // - Для типа 'custom': обязательно (UI должна валидировать)
  checkpointDate: string // ISO date 'YYYY-MM-DD'
  description?: string | null
  customIcon?: string | null
  customColor?: string | null
  linkedSectionIds?: string[] // Дополнительные связанные разделы
}

/** Input для обновления чекпоинта */
export interface UpdateCheckpointInput {
  checkpointId: string
  typeId?: string // Изменение типа чекпоинта
  title?: string
  description?: string | null
  checkpointDate?: string
  customIcon?: string | null
  customColor?: string | null
  linkedSectionIds?: string[] // Полный список связанных разделов
  // Только для optimistic update (не отправляются на сервер)
  _optimisticIcon?: string
  _optimisticColor?: string
}

/** Input для отметки выполнения */
export interface CompleteCheckpointInput {
  checkpointId: string
  completed: boolean // true = выполнено, false = снять отметку
}

/** Тип чекпоинта из VIEW */
export interface Checkpoint {
  checkpoint_id: string
  section_id: string
  type_id: string
  type_code: string
  type_name: string
  is_custom: boolean
  title: string
  description: string | null
  checkpoint_date: string
  icon: string
  color: string
  completed_at: string | null
  completed_by: string | null
  status: 'pending' | 'completed' | 'completed_late' | 'overdue'
  status_label: string
  created_by: string | null
  created_at: string
  updated_at: string
  section_responsible: string | null
  project_manager: string | null
  linked_sections: Array<{ section_id: string; section_name: string }>
  linked_sections_count: number
}

/** Запись audit trail */
export interface AuditEntry {
  audit_id: string
  checkpoint_id: string
  changed_by: string | null
  changed_at: string
  operation_type: 'CREATE' | 'UPDATE' | 'DELETE' | 'COMPLETE' | 'UNCOMPLETE'
  field_name: string
  old_value: string | null
  new_value: string | null
  // Joined fields from profiles
  user_firstname?: string | null
  user_lastname?: string | null
  user_avatar_url?: string | null
}

// ============================================================================
// Permission Helper
// ============================================================================

/**
 * Проверить, может ли текущий пользователь управлять чекпоинтом раздела
 *
 * Логика:
 * 1. checkpoints.manage.all → разрешено (admin)
 * 2. Динамическая проверка контекста:
 *    - Я ответственный за раздел
 *    - Я менеджер проекта
 *    - Ответственный из моего отдела (department_head)
 *    - Ответственный из моей команды (team_lead)
 * 3. Иначе → запрещено
 */
async function canManageCheckpoint(
  sectionId: string
): Promise<{ canManage: boolean; userId: string | null; error?: string }> {
  try {
    const supabase = await createClient()

    // 1. Получить текущего пользователя
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { canManage: false, userId: null, error: 'Пользователь не авторизован' }
    }

    // 2. Получить permissions через getUserPermissions (консистентно с остальным приложением)
    const { permissions } = await getUserPermissions(user.id)

    // 3. Проверить checkpoints.manage.all — полный доступ (admin)
    if (permissions.includes('checkpoints.manage.all')) {
      return { canManage: true, userId: user.id }
    }

    // 4. Динамическая проверка контекста раздела
    // Получаем информацию о разделе
    const { data: section, error: sectionError } = await supabase
      .from('sections')
      .select('section_id, section_responsible, section_project_id')
      .eq('section_id', sectionId)
      .single()

    if (sectionError || !section) {
      return { canManage: false, userId: user.id, error: 'Раздел не найден' }
    }

    // Я ответственный за раздел
    if (section.section_responsible === user.id) {
      return { canManage: true, userId: user.id }
    }

    // Получить менеджера проекта
    const { data: project } = await supabase
      .from('projects')
      .select('project_manager')
      .eq('project_id', section.section_project_id)
      .single()

    // Я менеджер проекта
    if (project?.project_manager === user.id) {
      return { canManage: true, userId: user.id }
    }

    // Если нет ответственного - запрещаем
    if (!section.section_responsible) {
      return { canManage: false, userId: user.id, error: 'Недостаточно прав для управления чекпоинтом' }
    }

    // 5. Для остальных проверок нужна роль - используем view_users
    const { data: userView } = await supabase
      .from('view_users')
      .select('user_id, role_name, department_id, team_id')
      .eq('user_id', user.id)
      .single()

    if (!userView) {
      return { canManage: false, userId: user.id, error: 'Профиль пользователя не найден' }
    }

    // Получить данные ответственного
    const { data: responsibleView } = await supabase
      .from('view_users')
      .select('user_id, department_id, team_id')
      .eq('user_id', section.section_responsible)
      .single()

    if (!responsibleView) {
      return { canManage: false, userId: user.id, error: 'Ответственный не найден' }
    }

    // Ответственный из моего отдела (department_head)
    if (userView.role_name === 'department_head' &&
        responsibleView.department_id === userView.department_id) {
      return { canManage: true, userId: user.id }
    }

    // Ответственный из моей команды (team_lead)
    if (userView.role_name === 'team_lead') {
      // Проверить, что я team_lead команды ответственного
      if (responsibleView.team_id && userView.team_id) {
        const { data: team } = await supabase
          .from('teams')
          .select('team_lead_id')
          .eq('team_id', responsibleView.team_id)
          .single()

        if (team?.team_lead_id === user.id) {
          return { canManage: true, userId: user.id }
        }
      }
    }

    return { canManage: false, userId: user.id, error: 'Недостаточно прав для управления чекпоинтом' }
  } catch (error) {
    console.error('[canManageCheckpoint] Error:', error)
    return {
      canManage: false,
      userId: null,
      error: error instanceof Error ? error.message : 'Ошибка проверки прав',
    }
  }
}

// ============================================================================
// Audit Helpers
// ============================================================================

/**
 * FIFO cleanup: удалить старые audit entries если > 50 на checkpoint
 */
async function cleanupOldAuditEntries(
  supabase: Awaited<ReturnType<typeof createClient>>,
  checkpointId: string
): Promise<void> {
  try {
    // 1. Подсчитать текущее количество записей
    const { count } = await supabase
      .from('checkpoint_audit')
      .select('*', { count: 'exact', head: true })
      .eq('checkpoint_id', checkpointId)

    if (!count || count <= 50) {
      return // Не превышен лимит
    }

    // 2. Найти ID записей для удаления (все кроме последних 50)
    const { data: oldEntries } = await supabase
      .from('checkpoint_audit')
      .select('audit_id')
      .eq('checkpoint_id', checkpointId)
      .order('changed_at', { ascending: true })
      .limit(count - 50)

    if (!oldEntries || oldEntries.length === 0) {
      return
    }

    // 3. Удалить старые записи
    const idsToDelete = oldEntries.map(e => e.audit_id)
    await supabase
      .from('checkpoint_audit')
      .delete()
      .in('audit_id', idsToDelete)

    console.log(`[cleanupOldAuditEntries] Deleted ${idsToDelete.length} old entries for checkpoint ${checkpointId}`)
  } catch (error) {
    // Не критичная ошибка — логируем, но не прерываем основную операцию
    console.error('[cleanupOldAuditEntries] Error:', error)
  }
}

/**
 * Записать audit entry
 */
async function writeAuditEntry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entry: {
    checkpointId: string
    changedBy: string | null
    operationType: 'CREATE' | 'UPDATE' | 'DELETE' | 'COMPLETE' | 'UNCOMPLETE'
    fieldName: string
    oldValue?: string | null
    newValue?: string | null
  }
): Promise<void> {
  try {
    await supabase.from('checkpoint_audit').insert({
      checkpoint_id: entry.checkpointId,
      changed_by: entry.changedBy,
      operation_type: entry.operationType,
      field_name: entry.fieldName,
      old_value: entry.oldValue ?? null,
      new_value: entry.newValue ?? null,
    })

    // FIFO cleanup
    await cleanupOldAuditEntries(supabase, entry.checkpointId)
  } catch (error) {
    console.error('[writeAuditEntry] Error:', error)
    // Не критичная ошибка — основная операция уже выполнена
  }
}

// ============================================================================
// Read Actions
// ============================================================================

/**
 * Получить список чекпоинтов с фильтрами
 *
 * Фильтр sectionId: возвращает чекпоинты где раздел является
 * родительским ИЛИ связанным (через checkpoint_section_links)
 */
export async function getCheckpoints(
  filters?: CheckpointFilters
): Promise<ActionResult<Checkpoint[]>> {
  // Sentry transaction для мониторинга производительности
  return await Sentry.startSpan(
    {
      name: 'getCheckpoints',
      op: 'db.query',
      attributes: {
        'checkpoint.filter.sectionId': filters?.sectionId ?? null,
        'checkpoint.filter.projectId': filters?.projectId ?? null,
        'checkpoint.filter.status': filters?.status ?? null,
      },
    },
    async () => {
      try {
        const supabase = await createClient()

        // Базовый запрос к VIEW
        let query = supabase.from('view_section_checkpoints').select('*')

        // Фильтр по sectionId: родительский ИЛИ связанный раздел
        if (filters?.sectionId) {

          // 1. Найти checkpoint_id где sectionId — связанный раздел
          const { data: linkedCheckpoints } = await supabase
            .from('checkpoint_section_links')
            .select('checkpoint_id')
            .eq('section_id', filters.sectionId)

          const linkedIds = linkedCheckpoints?.map(c => c.checkpoint_id) || []

          // 2. Фильтровать: section_id = sectionId ИЛИ checkpoint_id в linkedIds
          if (linkedIds.length > 0) {
            // Supabase не поддерживает OR напрямую, используем or() filter
            query = query.or(`section_id.eq.${filters.sectionId},checkpoint_id.in.(${linkedIds.join(',')})`)
          } else {
            // Нет связанных — фильтруем только по родительскому
            query = query.eq('section_id', filters.sectionId)
          }
        }

        // Фильтр по projectId
        if (filters?.projectId) {
          // Получить все section_id проекта
          const { data: sectionIds } = await supabase
            .from('sections')
            .select('section_id')
            .eq('section_project_id', filters.projectId)

          if (sectionIds && sectionIds.length > 0) {
            const ids = sectionIds.map(s => s.section_id)

            // Также найти чекпоинты, связанные с разделами проекта
            const { data: linkedCheckpoints } = await supabase
              .from('checkpoint_section_links')
              .select('checkpoint_id')
              .in('section_id', ids)

            const linkedIds = linkedCheckpoints?.map(c => c.checkpoint_id) || []

            if (linkedIds.length > 0) {
              query = query.or(`section_id.in.(${ids.join(',')}),checkpoint_id.in.(${linkedIds.join(',')})`)
            } else {
              query = query.in('section_id', ids)
            }
          } else {
            // Нет разделов в проекте — вернуть пустой массив
            return { success: true, data: [] }
          }
        }

        if (filters?.status) {
          query = query.eq('status', filters.status)
        }

        if (filters?.dateFrom) {
          query = query.gte('checkpoint_date', filters.dateFrom)
        }

        if (filters?.dateTo) {
          query = query.lte('checkpoint_date', filters.dateTo)
        }

        const { data, error } = await query.order('checkpoint_date', { ascending: true })

        if (error) {
          Sentry.captureException(error, {
            tags: { module: 'checkpoints' },
            contexts: { filters },
          })
          console.error('[getCheckpoints] Supabase error:', error)
          return { success: false, error: error.message }
        }

        // Убрать дубликаты (чекпоинт может попасть и как родительский, и как связанный)
        const uniqueCheckpoints = Array.from(
          new Map((data || []).map(c => [c.checkpoint_id, c])).values()
        )

        // Логировать если результат большой (потенциальная проблема производительности)
        if (uniqueCheckpoints.length > 1000) {
          Sentry.captureMessage('Large checkpoint query result', {
            level: 'warning',
            tags: { module: 'checkpoints' },
            extra: { resultCount: uniqueCheckpoints.length, filters },
          })
        }

        return { success: true, data: uniqueCheckpoints as Checkpoint[] }
      } catch (error) {
        Sentry.captureException(error, {
          tags: { module: 'checkpoints', action: 'getCheckpoints' },
          contexts: { filters },
        })
        console.error('[getCheckpoints] Error:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        }
      }
    }
  )
}

/**
 * Получить чекпоинт по ID
 */
export async function getCheckpoint(
  checkpointId: string
): Promise<ActionResult<Checkpoint>> {
  return await Sentry.startSpan(
    {
      name: 'getCheckpoint',
      op: 'db.query',
      attributes: {
        'checkpoint.id': checkpointId,
      },
    },
    async () => {
      try {
        const supabase = await createClient()

        const { data, error } = await supabase
          .from('view_section_checkpoints')
          .select('*')
          .eq('checkpoint_id', checkpointId)
          .maybeSingle()

        if (error) {
          Sentry.captureException(error, {
            tags: { module: 'checkpoints' },
            extra: { checkpointId },
          })
          console.error('[getCheckpoint] Supabase error:', error)
          return { success: false, error: error.message }
        }

        if (!data) {
          return { success: false, error: 'Чекпоинт не найден' }
        }

        return { success: true, data: data as Checkpoint }
      } catch (error) {
        Sentry.captureException(error, {
          tags: { module: 'checkpoints', action: 'getCheckpoint' },
          extra: { checkpointId },
        })
        console.error('[getCheckpoint] Error:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        }
      }
    }
  )
}

/**
 * Получить audit trail чекпоинта
 */
export async function getCheckpointAudit(
  checkpointId: string
): Promise<ActionResult<AuditEntry[]>> {
  return await Sentry.startSpan(
    {
      name: 'getCheckpointAudit',
      op: 'db.query',
      attributes: {
        'checkpoint.id': checkpointId,
      },
    },
    async () => {
      try {
        const supabase = await createClient()

        const { data, error } = await supabase
          .from('checkpoint_audit')
          .select('audit_id, checkpoint_id, changed_by, changed_at, operation_type, field_name, old_value, new_value')
          .eq('checkpoint_id', checkpointId)
          .order('changed_at', { ascending: false })
          .limit(50)

        if (error) {
          Sentry.captureException(error, {
            tags: { module: 'checkpoints' },
            extra: { checkpointId },
          })
          console.error('[getCheckpointAudit] Supabase error:', error)
          return { success: false, error: error.message }
        }

        // Получить уникальные user_id
        const userIds = [...new Set((data || []).map(row => row.changed_by).filter(Boolean))] as string[]

        // Получить данные пользователей
        const usersMap = new Map<string, { firstname: string; lastname: string; avatar_url: string | null }>()
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, first_name, last_name, avatar_url')
            .in('user_id', userIds)

          profiles?.forEach(p => {
            usersMap.set(p.user_id, {
              firstname: p.first_name,
              lastname: p.last_name,
              avatar_url: p.avatar_url,
            })
          })
        }

        // Transform data
        const entries: AuditEntry[] = (data || []).map(row => {
          const userInfo = row.changed_by ? usersMap.get(row.changed_by) : null
          return {
            audit_id: row.audit_id,
            checkpoint_id: row.checkpoint_id,
            changed_by: row.changed_by,
            changed_at: row.changed_at,
            operation_type: row.operation_type as AuditEntry['operation_type'],
            field_name: row.field_name,
            old_value: row.old_value,
            new_value: row.new_value,
            user_firstname: userInfo?.firstname ?? null,
            user_lastname: userInfo?.lastname ?? null,
            user_avatar_url: userInfo?.avatar_url ?? null,
          }
        })

        return { success: true, data: entries }
      } catch (error) {
        Sentry.captureException(error, {
          tags: { module: 'checkpoints', action: 'getCheckpointAudit' },
          extra: { checkpointId },
        })
        console.error('[getCheckpointAudit] Error:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        }
      }
    }
  )
}

// ============================================================================
// Create Action
// ============================================================================

/**
 * Создать новый чекпоинт
 */
export async function createCheckpoint(
  input: CreateCheckpointInput
): Promise<ActionResult<Checkpoint>> {
  return await Sentry.startSpan(
    {
      name: 'createCheckpoint',
      op: 'db.mutation',
      attributes: {
        'checkpoint.sectionId': input.sectionId,
        'checkpoint.typeId': input.typeId,
      },
    },
    async () => {
      try {
        const supabase = await createClient()

        // 1. Проверка прав доступа
        const { canManage, userId, error: permError } = await canManageCheckpoint(input.sectionId)
        if (!canManage) {
          return { success: false, error: permError || 'Недостаточно прав' }
        }

        // 2. Если title пустой — получить name из checkpoint_types
        let finalTitle = input.title?.trim()
        if (!finalTitle) {
          const { data: typeData } = await supabase
            .from('checkpoint_types')
            .select('name, is_custom')
            .eq('type_id', input.typeId)
            .single()

          if (typeData) {
            // Для custom типа title обязателен (UI должна была валидировать)
            if (typeData.is_custom) {
              return { success: false, error: 'Для произвольного типа необходимо указать название' }
            }
            finalTitle = typeData.name
          } else {
            return { success: false, error: 'Тип чекпоинта не найден' }
          }
        }

        // 3. Создать checkpoint
        const { data: checkpoint, error: insertError } = await supabase
          .from('section_checkpoints')
          .insert({
            section_id: input.sectionId,
            type_id: input.typeId,
            title: finalTitle,
            checkpoint_date: input.checkpointDate,
            description: input.description ?? null,
            custom_icon: input.customIcon ?? null,
            custom_color: input.customColor ?? null,
            created_by: userId,
          })
          .select('checkpoint_id')
          .single()

        if (insertError || !checkpoint) {
          Sentry.captureException(insertError, {
            tags: { module: 'checkpoints', action: 'createCheckpoint' },
            extra: { input },
          })
          console.error('[createCheckpoint] Insert error:', insertError)
          return { success: false, error: insertError?.message || 'Ошибка создания чекпоинта' }
        }

        const checkpointId = checkpoint.checkpoint_id

        // 4. Создать связи с дополнительными разделами (если есть)
        if (input.linkedSectionIds && input.linkedSectionIds.length > 0) {
          const links = input.linkedSectionIds.map(sectionId => ({
            checkpoint_id: checkpointId,
            section_id: sectionId,
          }))

          const { error: linksError } = await supabase
            .from('checkpoint_section_links')
            .insert(links)

          if (linksError) {
            console.error('[createCheckpoint] Links error:', linksError)
            // Не критично — чекпоинт уже создан
          }
        }

        // 5. Audit trail: CREATE
        await writeAuditEntry(supabase, {
          checkpointId,
          changedBy: userId,
          operationType: 'CREATE',
          fieldName: 'checkpoint',
          newValue: finalTitle,
        })

        // 6. Получить созданный чекпоинт из VIEW
        const result = await getCheckpoint(checkpointId)
        if (!result.success) {
          return { success: false, error: 'Чекпоинт создан, но не удалось получить данные' }
        }

        return { success: true, data: result.data }
      } catch (error) {
        Sentry.captureException(error, {
          tags: { module: 'checkpoints', action: 'createCheckpoint' },
          extra: { input },
        })
        console.error('[createCheckpoint] Error:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        }
      }
    }
  )
}

// ============================================================================
// Update Action
// ============================================================================

/**
 * Обновить чекпоинт
 */
export async function updateCheckpoint(
  input: UpdateCheckpointInput
): Promise<ActionResult<Checkpoint>> {
  return await Sentry.startSpan(
    {
      name: 'updateCheckpoint',
      op: 'db.mutation',
      attributes: {
        'checkpoint.id': input.checkpointId,
      },
    },
    async () => {
      try {
        const supabase = await createClient()

        // 1. Получить текущие данные чекпоинта для audit trail
        const currentResult = await getCheckpoint(input.checkpointId)
        if (!currentResult.success) {
          return { success: false, error: 'Чекпоинт не найден' }
        }
        const currentCheckpoint = currentResult.data

        // 2. Проверка прав доступа
        const { canManage, userId, error: permError } = await canManageCheckpoint(currentCheckpoint.section_id)
        if (!canManage) {
          return { success: false, error: permError || 'Недостаточно прав' }
        }

        // 3. Подготовить данные для обновления
        const updates: Record<string, unknown> = {}
        if (input.typeId !== undefined) updates.type_id = input.typeId
        if (input.title !== undefined) updates.title = input.title
        if (input.description !== undefined) updates.description = input.description
        if (input.checkpointDate !== undefined) updates.checkpoint_date = input.checkpointDate
        if (input.customIcon !== undefined) updates.custom_icon = input.customIcon
        if (input.customColor !== undefined) updates.custom_color = input.customColor

        console.log('[updateCheckpoint] Input:', input)
        console.log('[updateCheckpoint] Updates to apply:', updates)

        if (Object.keys(updates).length === 0 && !input.linkedSectionIds) {
          return { success: false, error: 'Нет данных для обновления' }
        }

        // 4. Обновить checkpoint
        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase
            .from('section_checkpoints')
            .update(updates)
            .eq('checkpoint_id', input.checkpointId)

          if (updateError) {
            Sentry.captureException(updateError, {
              tags: { module: 'checkpoints', action: 'updateCheckpoint' },
              extra: { input },
            })
            console.error('[updateCheckpoint] Update error:', updateError)
            return { success: false, error: updateError.message }
          }

          // 5. Audit trail для каждого измененного поля
          // Маппинг полей из updates в поля Checkpoint
          const fieldMapping: Record<string, keyof Checkpoint> = {
            'type_id': 'type_id',
            'title': 'title',
            'description': 'description',
            'checkpoint_date': 'checkpoint_date',
            'custom_icon': 'icon',
            'custom_color': 'color',
          }

          for (const [field, newValue] of Object.entries(updates)) {
            const checkpointField = fieldMapping[field]
            if (checkpointField) {
              const oldValue = currentCheckpoint[checkpointField]
              if (oldValue !== newValue) {
                await writeAuditEntry(supabase, {
                  checkpointId: input.checkpointId,
                  changedBy: userId,
                  operationType: 'UPDATE',
                  fieldName: field,
                  oldValue: String(oldValue ?? ''),
                  newValue: String(newValue ?? ''),
                })
              }
            }
          }
        }

        // 6. Обновить связи с разделами (если предоставлен linkedSectionIds)
        if (input.linkedSectionIds !== undefined) {
          // Удалить все существующие связи
          await supabase
            .from('checkpoint_section_links')
            .delete()
            .eq('checkpoint_id', input.checkpointId)

          // Создать новые связи
          if (input.linkedSectionIds.length > 0) {
            const links = input.linkedSectionIds.map(sectionId => ({
              checkpoint_id: input.checkpointId,
              section_id: sectionId,
            }))

            const { error: linksError } = await supabase
              .from('checkpoint_section_links')
              .insert(links)

            if (linksError) {
              console.error('[updateCheckpoint] Links error:', linksError)
              // Не критично
            }
          }

          // Audit для связанных разделов
          const oldLinkedIds = currentCheckpoint.linked_sections.map(s => s.section_id).sort()
          const newLinkedIds = [...input.linkedSectionIds].sort()
          if (JSON.stringify(oldLinkedIds) !== JSON.stringify(newLinkedIds)) {
            await writeAuditEntry(supabase, {
              checkpointId: input.checkpointId,
              changedBy: userId,
              operationType: 'UPDATE',
              fieldName: 'linked_sections',
              oldValue: oldLinkedIds.join(', '),
              newValue: newLinkedIds.join(', '),
            })
          }
        }

        // 7. Получить обновленный чекпоинт
        const result = await getCheckpoint(input.checkpointId)
        if (!result.success) {
          return { success: false, error: 'Чекпоинт обновлен, но не удалось получить данные' }
        }

        return { success: true, data: result.data }
      } catch (error) {
        Sentry.captureException(error, {
          tags: { module: 'checkpoints', action: 'updateCheckpoint' },
          extra: { input },
        })
        console.error('[updateCheckpoint] Error:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        }
      }
    }
  )
}

// ============================================================================
// Complete Action
// ============================================================================

/**
 * Отметить чекпоинт как выполненный/невыполненный
 */
export async function completeCheckpoint(
  input: CompleteCheckpointInput
): Promise<ActionResult<Checkpoint>> {
  return await Sentry.startSpan(
    {
      name: 'completeCheckpoint',
      op: 'db.mutation',
      attributes: {
        'checkpoint.id': input.checkpointId,
        'checkpoint.completed': input.completed,
      },
    },
    async () => {
      try {
        const supabase = await createClient()

        // 1. Получить текущие данные чекпоинта
        const currentResult = await getCheckpoint(input.checkpointId)
        if (!currentResult.success) {
          return { success: false, error: 'Чекпоинт не найден' }
        }
        const currentCheckpoint = currentResult.data

        // 2. Проверка прав доступа
        const { canManage, userId, error: permError } = await canManageCheckpoint(currentCheckpoint.section_id)
        if (!canManage) {
          return { success: false, error: permError || 'Недостаточно прав' }
        }

        // 3. Обновить completed_at и completed_by
        const { error: updateError } = await supabase
          .from('section_checkpoints')
          .update({
            completed_at: input.completed ? new Date().toISOString() : null,
            completed_by: input.completed ? userId : null,
          })
          .eq('checkpoint_id', input.checkpointId)

        if (updateError) {
          Sentry.captureException(updateError, {
            tags: { module: 'checkpoints', action: 'completeCheckpoint' },
            extra: { input },
          })
          console.error('[completeCheckpoint] Update error:', updateError)
          return { success: false, error: updateError.message }
        }

        // 4. Audit trail
        await writeAuditEntry(supabase, {
          checkpointId: input.checkpointId,
          changedBy: userId,
          operationType: input.completed ? 'COMPLETE' : 'UNCOMPLETE',
          fieldName: 'completed',
          oldValue: currentCheckpoint.completed_at ? 'completed' : 'pending',
          newValue: input.completed ? 'completed' : 'pending',
        })

        // 5. Получить обновленный чекпоинт
        const result = await getCheckpoint(input.checkpointId)
        if (!result.success) {
          return { success: false, error: 'Чекпоинт обновлен, но не удалось получить данные' }
        }

        return { success: true, data: result.data }
      } catch (error) {
        Sentry.captureException(error, {
          tags: { module: 'checkpoints', action: 'completeCheckpoint' },
          extra: { input },
        })
        console.error('[completeCheckpoint] Error:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        }
      }
    }
  )
}

// ============================================================================
// Delete Action
// ============================================================================

/**
 * Удалить чекпоинт
 */
export async function deleteCheckpoint(
  checkpointId: string
): Promise<ActionResult<void>> {
  return await Sentry.startSpan(
    {
      name: 'deleteCheckpoint',
      op: 'db.mutation',
      attributes: {
        'checkpoint.id': checkpointId,
      },
    },
    async () => {
      try {
        const supabase = await createClient()

        // 1. Получить данные чекпоинта для audit trail
        const currentResult = await getCheckpoint(checkpointId)
        if (!currentResult.success) {
          return { success: false, error: 'Чекпоинт не найден' }
        }
        const currentCheckpoint = currentResult.data

        // 2. Проверка прав доступа
        const { canManage, userId, error: permError } = await canManageCheckpoint(currentCheckpoint.section_id)
        if (!canManage) {
          return { success: false, error: permError || 'Недостаточно прав' }
        }

        // 3. Audit trail перед удалением
        await writeAuditEntry(supabase, {
          checkpointId,
          changedBy: userId,
          operationType: 'DELETE',
          fieldName: 'checkpoint',
          oldValue: currentCheckpoint.title,
          newValue: null,
        })

        // 4. Удалить чекпоинт (CASCADE удалит связи и audit)
        const { error: deleteError } = await supabase
          .from('section_checkpoints')
          .delete()
          .eq('checkpoint_id', checkpointId)

        if (deleteError) {
          Sentry.captureException(deleteError, {
            tags: { module: 'checkpoints', action: 'deleteCheckpoint' },
            extra: { checkpointId },
          })
          console.error('[deleteCheckpoint] Delete error:', deleteError)
          return { success: false, error: deleteError.message }
        }

        return { success: true, data: undefined }
      } catch (error) {
        Sentry.captureException(error, {
          tags: { module: 'checkpoints', action: 'deleteCheckpoint' },
          extra: { checkpointId },
        })
        console.error('[deleteCheckpoint] Error:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        }
      }
    }
  )
}
