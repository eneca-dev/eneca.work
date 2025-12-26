'use server'

import { createClient } from '@/utils/supabase/server'
import type {
  BudgetCurrent,
  BudgetVersion,
  BudgetFilters,
  CreateBudgetInput,
  UpdateBudgetAmountInput,
  SectionBudgetSummary,
  BudgetType,
  BudgetEntityType,
  EntityHierarchy,
} from '../types'

// ============================================================================
// Types
// ============================================================================

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

// ============================================================================
// Read Actions
// ============================================================================

/**
 * Получить список бюджетов с фильтрами
 */
export async function getBudgets(
  filters?: BudgetFilters
): Promise<ActionResult<BudgetCurrent[]>> {
  try {
    const supabase = await createClient()

    let query = supabase.from('v_cache_budgets_current').select('*')

    if (filters?.entity_type) {
      query = query.eq('entity_type', filters.entity_type)
    }

    if (filters?.entity_id) {
      query = query.eq('entity_id', filters.entity_id)
    }

    if (filters?.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('[getBudgets] Supabase error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: data as BudgetCurrent[] }
  } catch (error) {
    console.error('[getBudgets] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

/**
 * Получить бюджеты для конкретной сущности (раздела, проекта и т.д.)
 */
export async function getBudgetsByEntity(
  entityType: string,
  entityId: string
): Promise<ActionResult<BudgetCurrent[]>> {
  return getBudgets({ entity_type: entityType as BudgetFilters['entity_type'], entity_id: entityId })
}

/**
 * Получить бюджет по ID
 */
export async function getBudgetById(
  budgetId: string
): Promise<ActionResult<BudgetCurrent>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('v_cache_budgets_current')
      .select('*')
      .eq('budget_id', budgetId)
      .maybeSingle()

    if (error) {
      console.error('[getBudgetById] Supabase error:', error)
      return { success: false, error: error.message }
    }

    if (!data) {
      return { success: false, error: 'Бюджет не найден' }
    }

    return { success: true, data: data as BudgetCurrent }
  } catch (error) {
    console.error('[getBudgetById] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

/**
 * Получить историю версий бюджета
 */
export async function getBudgetVersions(
  budgetId: string
): Promise<ActionResult<BudgetVersion[]>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('budget_versions')
      .select('*')
      .eq('budget_id', budgetId)
      .order('effective_from', { ascending: false })

    if (error) {
      console.error('[getBudgetVersions] Supabase error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: data as BudgetVersion[] }
  } catch (error) {
    console.error('[getBudgetVersions] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

/**
 * Получить сводку бюджетов по разделам
 */
export async function getSectionBudgetSummary(
  projectId?: string
): Promise<ActionResult<SectionBudgetSummary[]>> {
  try {
    const supabase = await createClient()

    let query = supabase.from('v_cache_section_budget_summary').select('*')

    if (projectId) {
      query = query.eq('section_project_id', projectId)
    }

    const { data, error } = await query.order('section_name')

    if (error) {
      console.error('[getSectionBudgetSummary] Supabase error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: data as SectionBudgetSummary[] }
  } catch (error) {
    console.error('[getSectionBudgetSummary] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

/**
 * Получить список типов бюджетов
 */
export async function getBudgetTypes(): Promise<ActionResult<BudgetType[]>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('v_cache_budget_types')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (error) {
      console.error('[getBudgetTypes] Supabase error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: data as BudgetType[] }
  } catch (error) {
    console.error('[getBudgetTypes] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

/**
 * Получить иерархию сущности (section → object → stage → project)
 */
export async function getEntityHierarchy(
  entityType: BudgetEntityType,
  entityId: string
): Promise<ActionResult<EntityHierarchy>> {
  try {
    const supabase = await createClient()

    const hierarchy: EntityHierarchy = {
      entityType,
      entityId,
      objectId: null,
      stageId: null,
      projectId: null,
    }

    if (entityType === 'project') {
      hierarchy.projectId = entityId
      return { success: true, data: hierarchy }
    }

    if (entityType === 'stage') {
      // Stage → Project
      const { data: stage } = await supabase
        .from('stages')
        .select('stage_id, project_id')
        .eq('stage_id', entityId)
        .single()

      if (stage) {
        hierarchy.stageId = stage.stage_id
        hierarchy.projectId = stage.project_id
      }
      return { success: true, data: hierarchy }
    }

    if (entityType === 'object') {
      // Object → Stage → Project
      const { data: object } = await supabase
        .from('objects')
        .select('object_id, object_stage_id, object_project_id')
        .eq('object_id', entityId)
        .single()

      if (object) {
        hierarchy.objectId = object.object_id
        hierarchy.stageId = object.object_stage_id
        hierarchy.projectId = object.object_project_id
      }
      return { success: true, data: hierarchy }
    }

    if (entityType === 'section') {
      // Section → Object → Stage → Project (используем view_section_hierarchy)
      const { data: section } = await supabase
        .from('view_section_hierarchy')
        .select('section_id, object_id, stage_id, project_id')
        .eq('section_id', entityId)
        .single()

      if (section) {
        hierarchy.objectId = section.object_id
        hierarchy.stageId = section.stage_id
        hierarchy.projectId = section.project_id
      }
      return { success: true, data: hierarchy }
    }

    return { success: true, data: hierarchy }
  } catch (error) {
    console.error('[getEntityHierarchy] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

/**
 * Найти кандидатов на родительский бюджет (того же типа, выше по иерархии)
 */
export async function findParentBudgetCandidates(
  entityType: BudgetEntityType,
  entityId: string,
  budgetTypeId: string
): Promise<ActionResult<BudgetCurrent[]>> {
  try {
    const supabase = await createClient()

    // Получаем иерархию сущности
    const hierarchyResult = await getEntityHierarchy(entityType, entityId)
    if (!hierarchyResult.success) {
      return { success: false, error: hierarchyResult.error }
    }

    const hierarchy = hierarchyResult.data

    // Собираем ID родительских сущностей и их типы
    const parentEntities: Array<{ type: BudgetEntityType; id: string }> = []

    // Порядок поиска: object → stage → project (от ближайшего к дальнему)
    if (entityType === 'section' && hierarchy.objectId) {
      parentEntities.push({ type: 'object', id: hierarchy.objectId })
    }
    if ((entityType === 'section' || entityType === 'object') && hierarchy.stageId) {
      parentEntities.push({ type: 'stage', id: hierarchy.stageId })
    }
    if (hierarchy.projectId && entityType !== 'project') {
      parentEntities.push({ type: 'project', id: hierarchy.projectId })
    }

    if (parentEntities.length === 0) {
      return { success: true, data: [] }
    }

    // Ищем бюджеты того же типа у родительских сущностей
    const parentIds = parentEntities.map((p) => p.id)

    const { data, error } = await supabase
      .from('v_cache_budgets_current')
      .select('*')
      .eq('budget_type_id', budgetTypeId)
      .in('entity_id', parentIds)
      .eq('is_active', true)

    if (error) {
      console.error('[findParentBudgetCandidates] Supabase error:', error)
      return { success: false, error: error.message }
    }

    // Сортируем по иерархии (ближайший родитель первым)
    const sorted = (data as BudgetCurrent[]).sort((a, b) => {
      const aIndex = parentEntities.findIndex((p) => p.id === a.entity_id)
      const bIndex = parentEntities.findIndex((p) => p.id === b.entity_id)
      return aIndex - bIndex
    })

    return { success: true, data: sorted }
  } catch (error) {
    console.error('[findParentBudgetCandidates] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

// ============================================================================
// Write Actions
// ============================================================================

/**
 * Создать новый бюджет
 */
export async function createBudget(
  input: CreateBudgetInput
): Promise<ActionResult<BudgetCurrent>> {
  try {
    const supabase = await createClient()

    // Получаем текущего пользователя
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Пользователь не авторизован' }
    }

    // 1. Создаём бюджет
    const { data: budget, error: budgetError } = await supabase
      .from('budgets')
      .insert({
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        name: input.name,
        budget_type_id: input.budget_type_id,
        parent_budget_id: input.parent_budget_id || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (budgetError) {
      console.error('[createBudget] Budget insert error:', budgetError)
      return { success: false, error: budgetError.message }
    }

    // 2. Создаём первую версию с суммой
    const { error: versionError } = await supabase
      .from('budget_versions')
      .insert({
        budget_id: budget.budget_id,
        planned_amount: input.planned_amount,
        comment: input.comment || 'Начальный бюджет',
        created_by: user.id,
      })

    if (versionError) {
      console.error('[createBudget] Version insert error:', versionError)
      // Откатываем создание бюджета
      await supabase.from('budgets').delete().eq('budget_id', budget.budget_id)
      return { success: false, error: versionError.message }
    }

    // 3. Получаем созданный бюджет из view
    const result = await getBudgetById(budget.budget_id)
    return result
  } catch (error) {
    console.error('[createBudget] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

/**
 * Обновить сумму бюджета (создаёт новую версию)
 */
export async function updateBudgetAmount(
  input: UpdateBudgetAmountInput
): Promise<ActionResult<BudgetCurrent>> {
  try {
    const supabase = await createClient()

    // Получаем текущего пользователя
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Пользователь не авторизован' }
    }

    // 1. Закрываем текущую версию
    const today = new Date().toISOString().split('T')[0]

    const { error: closeError } = await supabase
      .from('budget_versions')
      .update({ effective_to: today })
      .eq('budget_id', input.budget_id)
      .is('effective_to', null)

    if (closeError) {
      console.error('[updateBudgetAmount] Close version error:', closeError)
      return { success: false, error: closeError.message }
    }

    // 2. Создаём новую версию
    const { error: versionError } = await supabase
      .from('budget_versions')
      .insert({
        budget_id: input.budget_id,
        planned_amount: input.planned_amount,
        comment: input.comment,
        created_by: user.id,
      })

    if (versionError) {
      console.error('[updateBudgetAmount] New version error:', versionError)
      return { success: false, error: versionError.message }
    }

    // 3. Обновляем updated_at бюджета
    await supabase
      .from('budgets')
      .update({ updated_at: new Date().toISOString() })
      .eq('budget_id', input.budget_id)

    // 4. Возвращаем обновлённый бюджет
    return getBudgetById(input.budget_id)
  } catch (error) {
    console.error('[updateBudgetAmount] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

/**
 * Деактивировать бюджет (soft delete)
 */
export async function deactivateBudget(
  budgetId: string
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('budgets')
      .update({ is_active: false })
      .eq('budget_id', budgetId)

    if (error) {
      console.error('[deactivateBudget] Error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: { success: true } }
  } catch (error) {
    console.error('[deactivateBudget] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}
