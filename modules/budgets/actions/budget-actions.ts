'use server'

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import type {
  BudgetCurrent,
  BudgetFilters,
  CreateBudgetInput,
  UpdateBudgetAmountInput,
  BudgetEntityType,
  EntityHierarchy,
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
  // stage исключён — стадия теперь параметр проекта, а не отдельная сущность
  entity_type: z.enum(['project', 'object', 'section']),
  entity_id: z.string().uuid('Некорректный ID сущности'),
  name: z.string().max(255).optional(),
  total_amount: z.number().min(0, 'Сумма не может быть отрицательной'),
  description: z.string().max(1000).optional(),
  parent_budget_id: z.string().uuid().nullable().optional(),
})

const UpdateBudgetAmountSchema = z.object({
  budget_id: z.string().uuid('Некорректный ID бюджета'),
  total_amount: z.number().min(0, 'Сумма не может быть отрицательной'),
  previous_amount: z.number().optional(),
  comment: z.string().max(500).optional(),
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
 * Получить список бюджетов с фильтрами (из v_cache_budgets)
 *
 * Загружает все страницы параллельно: сначала первая страница + count,
 * затем все остальные страницы одновременно через Promise.all.
 * Это в ~30x быстрее последовательной пагинации при большом числе записей.
 */
export async function getBudgets(
  filters?: BudgetFilters
): Promise<ActionResult<BudgetCurrent[]>> {
  try {
    const supabase = await createClient()
    const PAGE_SIZE = 1000

    // count передаётся в первый .select() — вызывать .select() дважды нельзя,
    // это ломает получение count (он становится null).
    const buildQuery = (withCount = false) => {
      let q = supabase
        .from('v_cache_budgets')
        .select('*', withCount ? { count: 'exact' } : undefined)
      if (filters?.entity_type) q = q.eq('entity_type', filters.entity_type)
      if (filters?.entity_id)   q = q.eq('entity_id', filters.entity_id)
      if (filters?.is_active !== undefined) q = q.eq('is_active', filters.is_active)
      if (filters?.project_ids?.length) q = q.in('project_id', filters.project_ids)
      return q.order('created_at', { ascending: false })
    }

    // Шаг 1: первая страница + точный count за один запрос
    const { data: firstPage, count, error: firstError } = await buildQuery(true)
      .range(0, PAGE_SIZE - 1)

    if (firstError) {
      console.error('[getBudgets] Supabase error:', firstError)
      return { success: false, error: firstError.message }
    }

    const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

    // Шаг 2: все оставшиеся страницы параллельно
    const remainingResults = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) =>
        buildQuery(false).range((i + 1) * PAGE_SIZE, (i + 2) * PAGE_SIZE - 1)
      )
    )

    for (const result of remainingResults) {
      if (result.error) {
        console.error('[getBudgets] Page error:', result.error)
        return { success: false, error: result.error.message }
      }
    }

    const allData: BudgetCurrent[] = [
      ...(firstPage ?? []) as BudgetCurrent[],
      ...remainingResults.flatMap(r => (r.data ?? []) as BudgetCurrent[]),
    ]

    return { success: true, data: allData }
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
 * Получить бюджет по ID (из v_cache_budgets)
 */
export async function getBudgetById(
  budgetId: string
): Promise<ActionResult<BudgetCurrent>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('v_cache_budgets')
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
 * Получить иерархию сущности (section → object → project)
 * Примечание: stage исключён из иерархии бюджетов
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
      projectId: null,
    }

    if (entityType === 'project') {
      hierarchy.projectId = entityId
      return { success: true, data: hierarchy }
    }

    if (entityType === 'object') {
      const { data: object } = await supabase
        .from('objects')
        .select('object_id, object_project_id')
        .eq('object_id', entityId)
        .single()

      if (object) {
        hierarchy.objectId = object.object_id
        hierarchy.projectId = object.object_project_id
      }
      return { success: true, data: hierarchy }
    }

    if (entityType === 'section') {
      const { data: section } = await supabase
        .from('view_section_hierarchy')
        .select('section_id, object_id, project_id')
        .eq('section_id', entityId)
        .single()

      if (section) {
        hierarchy.objectId = section.object_id
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
    // Иерархия: section → object → project (stage исключён)
    const parentEntities: Array<{ type: BudgetEntityType; id: string }> = []

    if (entityType === 'section' && hierarchy.objectId) {
      parentEntities.push({ type: 'object', id: hierarchy.objectId })
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
        .from('v_cache_budgets')
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
      .from('budgets')
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
      await supabase.from('budgets').delete().eq('budget_id', budget.budget_id)
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
    const validated = UpdateBudgetAmountSchema.safeParse(input)
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message || 'Ошибка валидации' }
    }

    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Пользователь не авторизован' }
    }

    // Обновляем сумму
    const { error: updateError } = await supabase
      .from('budgets')
      .update({ total_amount: input.total_amount, updated_at: new Date().toISOString() })
      .eq('budget_id', input.budget_id)

    if (updateError) {
      console.error('[updateBudgetAmount] Update error:', updateError)
      return { success: false, error: updateError.message }
    }

    // Записываем в историю.
    // previous_amount передаётся с клиента (он уже есть в кэше) — не делаем лишний SELECT.
    await supabase.from('budget_history').insert({
      budget_id: input.budget_id,
      change_type: 'amount_changed',
      previous_state: { total_amount: input.previous_amount ?? null },
      new_state: { total_amount: input.total_amount },
      comment: input.comment,
      changed_by: user.id,
    })

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

    // Система согласования через budget_parts не используется:
    // requires_approval = false для всех частей, только 3 из 19K расходов имели part_id.
    // Расходы создаются автоматически из work_logs (status='approved') или вручную.
    const { data, error } = await supabase
      .from('budget_expenses')
      .insert({
        budget_id: input.budget_id,
        part_id: input.part_id ?? null,
        amount: input.amount,
        description: input.description,
        expense_date: input.expense_date || new Date().toISOString().split('T')[0],
        work_log_id: input.work_log_id,
        status: 'approved',
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
 *
 * Проверяет целостность данных:
 * - Нельзя деактивировать если есть активные дочерние бюджеты
 * - Предупреждение если есть approved расходы (но разрешаем)
 */
export async function deactivateBudget(
  budgetId: string,
  options?: { force?: boolean }
): Promise<ActionResult<{ success: boolean; warning?: string }>> {
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

    // Проверка 1: Есть ли активные дочерние бюджеты
    const { data: children, error: childrenError } = await supabase
      .from('budgets')
      .select('budget_id, name')
      .eq('parent_budget_id', budgetId)
      .eq('is_active', true)

    if (childrenError) {
      console.error('[deactivateBudget] Children check error:', childrenError)
      return { success: false, error: 'Ошибка проверки дочерних бюджетов' }
    }

    if (children && children.length > 0) {
      const childNames = children.map(c => c.name).join(', ')
      return {
        success: false,
        error: `Нельзя деактивировать бюджет: есть ${children.length} активных дочерних бюджетов (${childNames}). Сначала деактивируйте их.`,
      }
    }

    // Проверка 2: Есть ли approved расходы (предупреждение, но не блокируем)
    let warning: string | undefined
    const { data: expenses, error: expensesError } = await supabase
      .from('budget_expenses')
      .select('expense_id')
      .eq('budget_id', budgetId)
      .eq('status', 'approved')

    if (!expensesError && expenses && expenses.length > 0) {
      warning = `Бюджет имеет ${expenses.length} подтверждённых расходов. История будет сохранена.`
    }

    // Записываем в историю перед деактивацией
    const currentResult = await getBudgetById(budgetId)
    if (currentResult.success) {
      await supabase.from('budget_history').insert({
        budget_id: budgetId,
        change_type: 'status_changed',
        previous_state: { is_active: true },
        new_state: { is_active: false },
        comment: 'Бюджет деактивирован',
        changed_by: user.id,
      })
    }

    // Выполняем деактивацию
    const { error } = await supabase
      .from('budgets')
      .update({ is_active: false })
      .eq('budget_id', budgetId)

    if (error) {
      console.error('[deactivateBudget] Error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: { success: true, warning } }
  } catch (error) {
    console.error('[deactivateBudget] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

/**
 * Очистить бюджет (обнулить сумму вместо удаления)
 *
 * Используется когда нужно "удалить" бюджет но сохранить историю.
 * Обнуляет total_amount и все части.
 */
export async function clearBudget(
  budgetId: string,
  comment?: string
): Promise<ActionResult<BudgetCurrent>> {
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

    // Получаем текущее состояние
    const currentResult = await getBudgetById(budgetId)
    if (!currentResult.success) {
      return currentResult
    }

    const previousAmount = currentResult.data.total_amount

    // Обнуляем total_amount (части пересчитаются автоматически через триггер)
    const { error: updateError } = await supabase
      .from('budgets')
      .update({
        total_amount: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('budget_id', budgetId)

    if (updateError) {
      console.error('[clearBudget] Update error:', updateError)
      return { success: false, error: updateError.message }
    }

    // Записываем в историю
    await supabase.from('budget_history').insert({
      budget_id: budgetId,
      change_type: 'amount_changed',
      previous_state: { total_amount: previousAmount },
      new_state: { total_amount: 0 },
      comment: comment || 'Бюджет очищен',
      changed_by: user.id,
    })

    return getBudgetById(budgetId)
  } catch (error) {
    console.error('[clearBudget] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }
}

