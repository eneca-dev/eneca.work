'use server'

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import type {
  BudgetCurrent,
  BudgetFull,
  BudgetFilters,
  CreateBudgetInput,
  UpdateBudgetAmountInput,
  SectionBudgetSummary,
  BudgetEntityType,
  EntityHierarchy,
  CreateBudgetPartInput,
  UpdateBudgetPartInput,
  CreateExpenseInput,
  ApproveExpenseInput,
  BudgetExpense,
  BudgetHistoryEntry,
} from '../types'

// ============================================================================
// Types
// ============================================================================

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

// ============================================================================
// Zod Validation Schemas
// ============================================================================

const CreateBudgetSchema = z.object({
  entity_type: z.enum(['project', 'stage', 'object', 'section']),
  entity_id: z.string().uuid('Некорректный ID сущности'),
  name: z.string().max(255).optional(),
  total_amount: z.number().min(0, 'Сумма не может быть отрицательной'),
  description: z.string().max(1000).optional(),
  parent_budget_id: z.string().uuid().nullable().optional(),
})

const UpdateBudgetAmountSchema = z.object({
  budget_id: z.string().uuid('Некорректный ID бюджета'),
  total_amount: z.number().min(0, 'Сумма не может быть отрицательной'),
  comment: z.string().max(500).optional(),
})

const CreateBudgetPartSchema = z.object({
  budget_id: z.string().uuid('Некорректный ID бюджета'),
  part_type: z.enum(['main', 'premium', 'custom']),
  custom_name: z.string().max(100).optional(),
  fixed_amount: z.number().min(0).optional(),
  percentage: z.number().min(0).max(100, 'Процент должен быть от 0 до 100').optional(),
  requires_approval: z.boolean().optional(),
  approval_threshold: z.number().min(0).optional(),
  color: z.string().max(20).optional(),
})

const UpdateBudgetPartSchema = z.object({
  part_id: z.string().uuid('Некорректный ID части'),
  fixed_amount: z.number().min(0).optional(),
  percentage: z.number().min(0).max(100, 'Процент должен быть от 0 до 100').optional(),
  requires_approval: z.boolean().optional(),
  approval_threshold: z.number().min(0).optional(),
})

const CreateExpenseSchema = z.object({
  budget_id: z.string().uuid('Некорректный ID бюджета'),
  part_id: z.string().uuid().optional(),
  amount: z.number().positive('Сумма расхода должна быть положительной'),
  description: z.string().max(500).optional(),
  expense_date: z.string().optional(),
  work_log_id: z.string().uuid().optional(),
})

const ApproveExpenseSchema = z.object({
  expense_id: z.string().uuid('Некорректный ID расхода'),
  approved: z.boolean(),
  rejection_reason: z.string().max(500).optional(),
})

// ============================================================================
// Read Actions
// ============================================================================

/**
 * Получить список бюджетов с фильтрами (из v_cache_budgets_v2)
 */
export async function getBudgets(
  filters?: BudgetFilters
): Promise<ActionResult<BudgetCurrent[]>> {
  try {
    const supabase = await createClient()

    let query = supabase.from('v_cache_budgets_v2').select('*')

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
 * Получить бюджеты для конкретной сущности
 */
export async function getBudgetsByEntity(
  entityType: string,
  entityId: string
): Promise<ActionResult<BudgetCurrent[]>> {
  return getBudgets({ entity_type: entityType as BudgetFilters['entity_type'], entity_id: entityId })
}

/**
 * Получить бюджет по ID (из v_cache_budgets_v2)
 */
export async function getBudgetById(
  budgetId: string
): Promise<ActionResult<BudgetCurrent>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('v_cache_budgets_v2')
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
 * Получить полную информацию о бюджете с частями (из v_budgets_full)
 */
export async function getBudgetFull(
  budgetId: string
): Promise<ActionResult<BudgetFull>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('v_budgets_full')
      .select('*')
      .eq('budget_id', budgetId)
      .maybeSingle()

    if (error) {
      console.error('[getBudgetFull] Supabase error:', error)
      return { success: false, error: error.message }
    }

    if (!data) {
      return { success: false, error: 'Бюджет не найден' }
    }

    return { success: true, data: data as BudgetFull }
  } catch (error) {
    console.error('[getBudgetFull] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

/**
 * Получить историю изменений бюджета
 */
export async function getBudgetHistory(
  budgetId: string
): Promise<ActionResult<BudgetHistoryEntry[]>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('budget_history')
      .select('*')
      .eq('budget_id', budgetId)
      .order('changed_at', { ascending: false })

    if (error) {
      console.error('[getBudgetHistory] Supabase error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: data as BudgetHistoryEntry[] }
  } catch (error) {
    console.error('[getBudgetHistory] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

/**
 * Получить расходы бюджета
 */
export async function getBudgetExpenses(
  budgetId: string
): Promise<ActionResult<BudgetExpense[]>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('budget_expenses')
      .select('*')
      .eq('budget_id', budgetId)
      .order('expense_date', { ascending: false })

    if (error) {
      console.error('[getBudgetExpenses] Supabase error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: data as BudgetExpense[] }
  } catch (error) {
    console.error('[getBudgetExpenses] Error:', error)
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
      const { data: stage } = await supabase
        .from('stages')
        .select('stage_id, stage_project_id')
        .eq('stage_id', entityId)
        .single()

      if (stage) {
        hierarchy.stageId = stage.stage_id
        hierarchy.projectId = stage.stage_project_id
      }
      return { success: true, data: hierarchy }
    }

    if (entityType === 'object') {
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
 * Найти родительский бюджет в иерархии
 */
export async function findParentBudget(
  entityType: BudgetEntityType,
  entityId: string
): Promise<ActionResult<BudgetCurrent | null>> {
  try {
    const supabase = await createClient()

    // Получаем иерархию сущности
    const hierarchyResult = await getEntityHierarchy(entityType, entityId)
    if (!hierarchyResult.success) {
      return { success: false, error: hierarchyResult.error }
    }

    const hierarchy = hierarchyResult.data

    // Собираем ID родительских сущностей и их типы (от ближайшего к дальнему)
    const parentEntities: Array<{ type: BudgetEntityType; id: string }> = []

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
      return { success: true, data: null }
    }

    // Ищем бюджет у родительских сущностей (в порядке приоритета)
    for (const parent of parentEntities) {
      const { data, error } = await supabase
        .from('v_cache_budgets_v2')
        .select('*')
        .eq('entity_type', parent.type)
        .eq('entity_id', parent.id)
        .eq('is_active', true)
        .maybeSingle()

      if (error) {
        console.error('[findParentBudget] Supabase error:', error)
        continue
      }

      if (data) {
        return { success: true, data: data as BudgetCurrent }
      }
    }

    return { success: true, data: null }
  } catch (error) {
    console.error('[findParentBudget] Error:', error)
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
    // Валидация входных данных
    const validated = CreateBudgetSchema.safeParse(input)
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message || 'Ошибка валидации' }
    }

    const supabase = await createClient()

    // Получаем текущего пользователя
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Пользователь не авторизован' }
    }

    // Находим родительский бюджет если не указан
    let parentBudgetId = input.parent_budget_id
    if (!parentBudgetId) {
      const parentResult = await findParentBudget(input.entity_type, input.entity_id)
      if (parentResult.success && parentResult.data) {
        parentBudgetId = parentResult.data.budget_id
      }
    }

    // 1. Создаём бюджет
    const { data: budget, error: budgetError } = await supabase
      .from('budgets_v2')
      .insert({
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        name: input.name || 'Бюджет',
        description: input.description,
        total_amount: input.total_amount,
        parent_budget_id: parentBudgetId || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (budgetError) {
      console.error('[createBudget] Budget insert error:', budgetError)
      return { success: false, error: budgetError.message }
    }

    // 2. Создаём основную часть бюджета (100% по умолчанию)
    const { error: partError } = await supabase
      .from('budget_parts')
      .insert({
        budget_id: budget.budget_id,
        part_type: 'main',
        percentage: 100, // Основная часть = 100% бюджета
        color: '#1E7260', // Основной цвет
      })

    if (partError) {
      console.error('[createBudget] Part insert error:', partError)
      // Откатываем создание бюджета
      await supabase.from('budgets_v2').delete().eq('budget_id', budget.budget_id)
      return { success: false, error: partError.message }
    }

    // 3. Записываем в историю
    await supabase.from('budget_history').insert({
      budget_id: budget.budget_id,
      change_type: 'created',
      new_state: {
        total_amount: input.total_amount,
        entity_type: input.entity_type,
        entity_id: input.entity_id,
      },
      comment: 'Бюджет создан',
      changed_by: user.id,
    })

    // 4. Получаем созданный бюджет из view
    return getBudgetById(budget.budget_id)
  } catch (error) {
    console.error('[createBudget] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

/**
 * Обновить сумму бюджета
 */
export async function updateBudgetAmount(
  input: UpdateBudgetAmountInput
): Promise<ActionResult<BudgetCurrent>> {
  try {
    // Валидация входных данных
    const validated = UpdateBudgetAmountSchema.safeParse(input)
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message || 'Ошибка валидации' }
    }

    const supabase = await createClient()

    // Получаем текущего пользователя
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Пользователь не авторизован' }
    }

    // Получаем текущее состояние
    const currentResult = await getBudgetById(input.budget_id)
    if (!currentResult.success) {
      return currentResult
    }

    const previousAmount = currentResult.data.total_amount

    // 1. Обновляем total_amount бюджета
    const { error: updateError } = await supabase
      .from('budgets_v2')
      .update({
        total_amount: input.total_amount,
        updated_at: new Date().toISOString(),
      })
      .eq('budget_id', input.budget_id)

    if (updateError) {
      console.error('[updateBudgetAmount] Update error:', updateError)
      return { success: false, error: updateError.message }
    }

    // Примечание: части бюджета пересчитываются автоматически через триггер
    // когда total_amount меняется, calculated_amount частей обновляется

    // 3. Записываем в историю
    await supabase.from('budget_history').insert({
      budget_id: input.budget_id,
      change_type: 'amount_changed',
      previous_state: { total_amount: previousAmount },
      new_state: { total_amount: input.total_amount },
      comment: input.comment,
      changed_by: user.id,
    })

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
 * Добавить часть к бюджету (premium или custom)
 */
export async function addBudgetPart(
  input: CreateBudgetPartInput
): Promise<ActionResult<BudgetFull>> {
  try {
    // Валидация входных данных
    const validated = CreateBudgetPartSchema.safeParse(input)
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message || 'Ошибка валидации' }
    }

    const supabase = await createClient()

    // Проверка авторизации
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Пользователь не авторизован' }
    }

    const { error } = await supabase
      .from('budget_parts')
      .insert({
        budget_id: input.budget_id,
        part_type: input.part_type,
        custom_name: input.custom_name,
        fixed_amount: input.fixed_amount,
        percentage: input.percentage,
        requires_approval: input.requires_approval ?? (input.part_type === 'premium'),
        approval_threshold: input.approval_threshold,
        color: input.color ?? (input.part_type === 'premium' ? '#F59E0B' : '#6b7280'),
      })

    if (error) {
      console.error('[addBudgetPart] Insert error:', error)
      return { success: false, error: error.message }
    }

    return getBudgetFull(input.budget_id)
  } catch (error) {
    console.error('[addBudgetPart] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

/**
 * Обновить часть бюджета
 *
 * Важно: constraint требует либо percentage (fixed_amount = NULL),
 * либо fixed_amount (percentage = NULL). Нельзя оба сразу.
 */
export async function updateBudgetPart(
  input: UpdateBudgetPartInput
): Promise<ActionResult<{ success: boolean }>> {
  try {
    // Валидация входных данных
    const validated = UpdateBudgetPartSchema.safeParse(input)
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message || 'Ошибка валидации' }
    }

    const supabase = await createClient()

    // Проверка авторизации
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Пользователь не авторизован' }
    }

    const updateData: Record<string, unknown> = {}

    // Если задаём percentage, то fixed_amount должен быть NULL
    if (input.percentage !== undefined) {
      updateData.percentage = input.percentage
      updateData.fixed_amount = null
    }
    // Если задаём fixed_amount, то percentage должен быть NULL
    else if (input.fixed_amount !== undefined) {
      updateData.fixed_amount = input.fixed_amount
      updateData.percentage = null
    }

    if (input.requires_approval !== undefined) updateData.requires_approval = input.requires_approval
    if (input.approval_threshold !== undefined) updateData.approval_threshold = input.approval_threshold

    const { error } = await supabase
      .from('budget_parts')
      .update(updateData)
      .eq('part_id', input.part_id)

    if (error) {
      console.error('[updateBudgetPart] Update error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: { success: true } }
  } catch (error) {
    console.error('[updateBudgetPart] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

/**
 * Удалить часть бюджета
 */
export async function deleteBudgetPart(
  partId: string
): Promise<ActionResult<{ success: boolean }>> {
  try {
    // Валидация входных данных
    if (!partId || !z.string().uuid().safeParse(partId).success) {
      return { success: false, error: 'Некорректный ID части' }
    }

    const supabase = await createClient()

    // Проверка авторизации
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Пользователь не авторизован' }
    }

    // Проверяем что это не main часть
    const { data: part } = await supabase
      .from('budget_parts')
      .select('part_type')
      .eq('part_id', partId)
      .single()

    if (part?.part_type === 'main') {
      return { success: false, error: 'Нельзя удалить основную часть бюджета' }
    }

    const { error } = await supabase
      .from('budget_parts')
      .delete()
      .eq('part_id', partId)

    if (error) {
      console.error('[deleteBudgetPart] Delete error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: { success: true } }
  } catch (error) {
    console.error('[deleteBudgetPart] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

/**
 * Создать расход
 */
export async function createExpense(
  input: CreateExpenseInput
): Promise<ActionResult<BudgetExpense>> {
  try {
    // Валидация входных данных
    const validated = CreateExpenseSchema.safeParse(input)
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message || 'Ошибка валидации' }
    }

    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Пользователь не авторизован' }
    }

    // Определяем статус и часть
    let status: 'pending' | 'approved' = 'approved'
    let partId = input.part_id

    // Если часть не указана, используем main
    if (!partId) {
      const { data: mainPart } = await supabase
        .from('budget_parts')
        .select('part_id, requires_approval, approval_threshold')
        .eq('budget_id', input.budget_id)
        .eq('part_type', 'main')
        .single()

      if (mainPart) {
        partId = mainPart.part_id
        // Проверяем нужно ли согласование
        if (mainPart.requires_approval) {
          if (!mainPart.approval_threshold || input.amount >= mainPart.approval_threshold) {
            status = 'pending'
          }
        }
      }
    } else {
      // Проверяем требования согласования для указанной части
      const { data: part } = await supabase
        .from('budget_parts')
        .select('requires_approval, approval_threshold')
        .eq('part_id', partId)
        .single()

      if (part?.requires_approval) {
        if (!part.approval_threshold || input.amount >= part.approval_threshold) {
          status = 'pending'
        }
      }
    }

    const { data, error } = await supabase
      .from('budget_expenses')
      .insert({
        budget_id: input.budget_id,
        part_id: partId,
        amount: input.amount,
        description: input.description,
        expense_date: input.expense_date || new Date().toISOString().split('T')[0],
        work_log_id: input.work_log_id,
        status,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error('[createExpense] Insert error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: data as BudgetExpense }
  } catch (error) {
    console.error('[createExpense] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

/**
 * Одобрить или отклонить расход
 */
export async function approveExpense(
  input: ApproveExpenseInput
): Promise<ActionResult<BudgetExpense>> {
  try {
    // Валидация входных данных
    const validated = ApproveExpenseSchema.safeParse(input)
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message || 'Ошибка валидации' }
    }

    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Пользователь не авторизован' }
    }

    const updateData: Record<string, unknown> = {
      status: input.approved ? 'approved' : 'rejected',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    }

    if (!input.approved && input.rejection_reason) {
      updateData.rejection_reason = input.rejection_reason
    }

    const { data, error } = await supabase
      .from('budget_expenses')
      .update(updateData)
      .eq('expense_id', input.expense_id)
      .select()
      .single()

    if (error) {
      console.error('[approveExpense] Update error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: data as BudgetExpense }
  } catch (error) {
    console.error('[approveExpense] Error:', error)
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
    // Валидация входных данных
    if (!budgetId || !z.string().uuid().safeParse(budgetId).success) {
      return { success: false, error: 'Некорректный ID бюджета' }
    }

    const supabase = await createClient()

    // Проверка авторизации
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Пользователь не авторизован' }
    }

    const { error } = await supabase
      .from('budgets_v2')
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

