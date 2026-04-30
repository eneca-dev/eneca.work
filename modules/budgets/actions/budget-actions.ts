'use server'

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/modules/cache'
import type {
  BudgetCurrent,
  BudgetFilters,
  CreateBudgetInput,
  UpdateBudgetAmountInput,
  BudgetEntityType,
  EntityHierarchy,
} from '../types'

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

// ============================================================================
// Permission Helpers
// ============================================================================

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function checkPermission(
  supabase: SupabaseClient,
  userId: string,
  permission: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('user_has_permission', {
    p_user_id: userId,
    p_permission_name: permission,
  })
  return !error && data === true
}

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
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { success: false, error: 'Не авторизован' }

    const hasPermission = await checkPermission(supabase, user.id, 'budgets.view.all')
    if (!hasPermission) return { success: false, error: 'Нет прав на просмотр бюджетов' }

    const PAGE_SIZE = 1000

    // Страница бюджетов использует lean-view без агрегации расходов (~3–5x быстрее).
    // Остальные потребители (resource-graph, modals) получают полные данные из v_cache_budgets.
    const viewName = filters?.lean ? 'v_budgets_for_page' : 'v_cache_budgets'

    // count передаётся в первый .select() — вызывать .select() дважды нельзя,
    // это ломает получение count (он становится null).
    const buildQuery = (withCount = false) => {
      let q = supabase
        .from(viewName as 'v_cache_budgets' | 'v_budgets_for_page')
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

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Пользователь не авторизован' }
    }

    const hasPermission = await checkPermission(supabase, user.id, 'budgets.create')
    if (!hasPermission) return { success: false, error: 'Нет прав на создание бюджетов' }

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

    // Параллельно: getUser (нужен user.id для истории) + has_budget_permission (не требует user.id,
    // использует auth.uid() из JWT-контекста) — экономим один round-trip.
    const [
      { data: { user }, error: userError },
      { data: hasPermission },
    ] = await Promise.all([
      supabase.auth.getUser(),
      supabase.rpc('has_budget_permission', { permission_name: 'budgets.edit' }),
    ])

    if (userError || !user) return { success: false, error: 'Пользователь не авторизован' }
    if (!hasPermission) return { success: false, error: 'Нет прав на редактирование бюджетов' }

    // Обновляем сумму
    const { error: updateError } = await supabase
      .from('budgets')
      .update({ total_amount: input.total_amount, updated_at: new Date().toISOString() })
      .eq('budget_id', input.budget_id)

    if (updateError) {
      console.error('[updateBudgetAmount] Update error:', updateError)
      return { success: false, error: updateError.message }
    }

    // История — fire-and-forget, не блокируем ответ клиенту.
    // previous_amount передаётся с клиента (он уже есть в кэше) — не делаем лишний SELECT.
    supabase.from('budget_history').insert({
      budget_id: input.budget_id,
      change_type: 'amount_changed',
      previous_state: { total_amount: input.previous_amount ?? null },
      new_state: { total_amount: input.total_amount },
      comment: input.comment,
      changed_by: user.id,
    })

    // Не делаем getBudgetById — optimistic update уже показал новое значение в UI,
    // а invalidateKeys запустит фоновый refetch с актуальными данными из view.
    return {
      success: true,
      data: { budget_id: input.budget_id, total_amount: input.total_amount } as BudgetCurrent,
    }
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

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Пользователь не авторизован' }
    }

    const hasPermission = await checkPermission(supabase, user.id, 'budgets.delete')
    if (!hasPermission) return { success: false, error: 'Нет прав на деактивацию бюджетов' }

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


