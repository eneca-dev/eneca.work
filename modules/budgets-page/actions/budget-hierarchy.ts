/**
 * Budgets Page — Server Action: иерархия бюджетов (section-grain)
 *
 * Читает лёгкую live-вью v_budget_hierarchy (~4.3к строк, грейн = раздел) вместо
 * тяжёлой v_resource_graph (19к строк до задач). Числа (расчётный, распределено)
 * уже посчитаны в БД. Этапы/задачи грузятся лениво (getSectionBudgetItems).
 *
 * Фильтры и безопасность — зеркало getResourceGraphData (resource-graph), но без
 * stage/item-сортировки и item-фильтров (их на section-grain нет).
 * ⚠️ При изменении логики фильтров в getResourceGraphData — синхронизировать здесь.
 */

'use server'

import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/modules/cache'
import type { BudgetCurrent } from '@/modules/budgets'
import { type FilterQueryParams, getNegatedParams } from '@/modules/inline-filter'
import { getFilterContext } from '@/modules/permissions/server/get-filter-context'
import { applyMandatoryFilters } from '@/modules/permissions/utils/mandatory-filters'
import { getRestrictedProjectIds } from '@/modules/permissions/server/restricted-projects'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Строка v_budget_hierarchy (грейн = раздел; объект/проект могут быть без раздела → section_* = null) */
export interface BudgetHierarchyRow {
  project_id: string
  project_name: string | null
  project_status: string | null
  stage_type: string | null
  is_restricted: boolean | null
  manager_id: string | null
  object_id: string | null
  object_name: string | null
  section_id: string | null
  section_name: string | null
  section_hourly_rate: number | string | null
  section_responsible_id: string | null
  section_responsible_name: string | null
  section_department_id: string | null
  section_department_name: string | null
  section_subdivision_id: string | null
  section_subdivision_name: string | null
  section_calc_budget: number | string | null
  section_loading_hours: number | string | null
  section_loading_count: number | null
  section_errors_count: number | null
  section_distributed: number | string | null
  section_has_stages: boolean | null
}

/**
 * Иерархия бюджетов для страницы Бюджетов (Проект → Объект → Раздел).
 * Возвращает плоские section-grain строки; дерево собирается на клиенте.
 */
export async function getBudgetHierarchy(
  filters?: FilterQueryParams
): Promise<ActionResult<BudgetHierarchyRow[]>> {
  try {
    const supabase = await createClient()

    // 🔒 Контекст разрешений + restricted-проекты (как в getResourceGraphData)
    const [filterContextResult, restrictedIds] = await Promise.all([
      getFilterContext(),
      getRestrictedProjectIds(),
    ])
    const filterContext = filterContextResult.success ? filterContextResult.data : null
    const secureFilters = applyMandatoryFilters(filters || {}, filterContext)
    const isAdmin = filterContext?.permissions.includes('hierarchy.is_admin') ?? false

    // ── Пред-подготовка (tag UUIDs, team employee IDs) — могут short-circuit ──
    let projectIdsFromTags: string[] | null = null
    let employeeIdsFromTeam: string[] | null = null

    // Tag filter → project IDs
    const tagValues = secureFilters?.tag_id
    if (tagValues) {
      const tagArray = Array.isArray(tagValues) ? tagValues : [tagValues]
      if (tagArray.length > 0) {
        const isUuid = UUID_RE.test(tagArray[0])
        let tagUuids: string[]
        if (isUuid) {
          tagUuids = tagArray
        } else {
          const { data: tags, error: tagsError } = await supabase
            .from('project_tags')
            .select('tag_id, name')
            .in('name', tagArray)
          if (tagsError) return { success: false, error: tagsError.message }
          tagUuids = tags?.map(t => t.tag_id) || []
          if (tagUuids.length === 0) return { success: true, data: [] }
        }

        const { data: tagLinks, error: tagError } = await supabase
          .from('project_tag_links')
          .select('project_id')
          .in('tag_id', tagUuids)
        if (tagError) return { success: false, error: tagError.message }

        projectIdsFromTags = [...new Set(tagLinks?.map(l => l.project_id) || [])]
        if (projectIdsFromTags.length === 0) return { success: true, data: [] }
      }
    }

    // Team filter → employee IDs (ответственные разделов)
    const teamIdRaw = secureFilters?.team_id
    if (teamIdRaw) {
      const teamId = Array.isArray(teamIdRaw) ? teamIdRaw[0] : teamIdRaw
      const isUuid = UUID_RE.test(teamId)
      let teamQuery = supabase.from('v_org_structure').select('employee_id')
      teamQuery = isUuid ? teamQuery.eq('team_id', teamId) : teamQuery.ilike('team_name', teamId)
      const { data: teamMembers, error: teamError } = await teamQuery
      if (teamError) return { success: false, error: teamError.message }
      employeeIdsFromTeam = [
        ...new Set((teamMembers || []).map(m => m.employee_id).filter((id): id is string => id !== null)),
      ]
      if (employeeIdsFromTeam.length === 0) return { success: true, data: [] }
    }

    // ── Builder с фильтрами (section-grain) ──
    const buildQuery = (withCount: boolean) => {
      let q = withCount
        ? supabase.from('v_budget_hierarchy').select('*', { count: 'exact' })
        : supabase.from('v_budget_hierarchy').select('*')

      // 🔒 Скрываем restricted-проекты от не-админов
      if (!isAdmin && restrictedIds.length > 0) {
        q = q.not('project_id', 'in', `(${restrictedIds.join(',')})`)
      }

      if (projectIdsFromTags && projectIdsFromTags.length > 0) {
        q = q.in('project_id', projectIdsFromTags)
      }

      // Subdivision
      if (secureFilters?.subdivision_id) {
        const v = Array.isArray(secureFilters.subdivision_id) ? secureFilters.subdivision_id[0] : secureFilters.subdivision_id
        q = UUID_RE.test(v) ? q.eq('section_subdivision_id', v) : q.ilike('section_subdivision_name', v)
      }

      // Department
      if (secureFilters?.department_id) {
        const v = Array.isArray(secureFilters.department_id) ? secureFilters.department_id[0] : secureFilters.department_id
        q = UUID_RE.test(v) ? q.eq('section_department_id', v) : q.ilike('section_department_name', v)
      }

      // Project (id или название, несколько значений)
      if (secureFilters?.project_id) {
        const values = Array.isArray(secureFilters.project_id) ? secureFilters.project_id : [secureFilters.project_id]
        const uuids = values.filter(v => UUID_RE.test(v))
        const names = values.filter(v => !UUID_RE.test(v))
        if (uuids.length > 0 && names.length === 0) {
          q = q.in('project_id', uuids)
        } else if (names.length > 0 && uuids.length === 0) {
          q = q.or(names.map(n => `project_name.ilike.${n}`).join(','))
        } else if (uuids.length > 0 && names.length > 0) {
          const parts: string[] = uuids.map(id => `project_id.eq.${id}`)
          names.forEach(n => parts.push(`project_name.ilike.${n}`))
          q = q.or(parts.join(','))
        }
      }

      // Исключающие фильтры
      for (const val of getNegatedParams(secureFilters, 'project_id')) {
        q = UUID_RE.test(val) ? q.neq('project_id', val) : q.not('project_name', 'ilike', val)
      }
      for (const val of getNegatedParams(secureFilters, 'department_id')) {
        q = UUID_RE.test(val) ? q.neq('section_department_id', val) : q.not('section_department_name', 'ilike', val)
      }
      for (const val of getNegatedParams(secureFilters, 'subdivision_id')) {
        q = UUID_RE.test(val) ? q.neq('section_subdivision_id', val) : q.not('section_subdivision_name', 'ilike', val)
      }

      // Project status
      if (secureFilters?.project_status && typeof secureFilters.project_status === 'string') {
        q = q.eq('project_status', secureFilters.project_status)
      }

      // Team → ответственные разделов
      if (employeeIdsFromTeam && employeeIdsFromTeam.length > 0) {
        q = q.in('section_responsible_id', employeeIdsFromTeam)
      }

      // Responsible
      const responsibleIdRaw = secureFilters?.responsible_id
      if (responsibleIdRaw) {
        const v = Array.isArray(responsibleIdRaw) ? responsibleIdRaw[0] : responsibleIdRaw
        q = UUID_RE.test(v) ? q.eq('section_responsible_id', v) : q.ilike('section_responsible_name', v)
      }

      // Order (section-grain: до раздела)
      q = q.order('project_name').order('object_name').order('section_name')
      return q
    }

    // Пагинация (как в resource-graph). PAGE_SIZE = Max rows Data API.
    // Обычно ~4.4к строк → 1 запрос; пагинация страхует от тихого обрезания при росте.
    const PAGE_SIZE = 5000
    const { data: firstPage, count, error: firstError } = await buildQuery(true).range(0, PAGE_SIZE - 1)
    if (firstError) {
      console.error('[getBudgetHierarchy] Supabase error:', firstError)
      return { success: false, error: firstError.message }
    }

    const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)
    const remaining = await Promise.all(
      Array.from({ length: Math.max(0, totalPages - 1) }, (_, i) =>
        buildQuery(false).range((i + 1) * PAGE_SIZE, (i + 2) * PAGE_SIZE - 1)
      )
    )
    const failed = remaining.find(r => r.error)
    if (failed?.error) {
      console.error('[getBudgetHierarchy] Pagination error:', failed.error)
      return { success: false, error: failed.error.message }
    }

    const rows = [
      ...((firstPage ?? []) as BudgetHierarchyRow[]),
      ...remaining.flatMap(r => (r.data ?? []) as BudgetHierarchyRow[]),
    ]
    return { success: true, data: rows }
  } catch (error) {
    console.error('[getBudgetHierarchy] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки иерархии бюджетов',
    }
  }
}

// ============================================================================
// Ленивая подгрузка этапов+задач одного раздела (Фаза 3)
// ============================================================================

/** Задача (item) для дерева бюджетов — поля для BudgetRow + бюджеты (Фаза 7) */
export interface BudgetSectionItem {
  id: string
  description: string
  plannedHours: number
  order: number
  budgets: BudgetCurrent[]
}

/** Этап декомпозиции с задачами и бюджетами */
export interface BudgetSectionStage {
  id: string
  name: string
  order: number
  budgets: BudgetCurrent[]
  items: BudgetSectionItem[]
}

/**
 * Этапы+задачи ОДНОГО раздела + ИХ бюджеты (вызывается при раскрытии раздела).
 * Фаза 7: на старте getBudgets грузит только project/object/section, поэтому бюджеты
 * этапов/задач отдаём здесь (lean v_budgets_for_page по entity этого раздела).
 * Лёгкие запросы (~десятки строк), без тяжёлой v_resource_graph.
 */
export async function getSectionBudgetItems(
  sectionId: string
): Promise<ActionResult<BudgetSectionStage[]>> {
  try {
    const supabase = await createClient()

    // 🔒 Defense-in-depth: раздел не должен принадлежать restricted-проекту (для не-админов)
    const [filterContextResult, restrictedIds] = await Promise.all([
      getFilterContext(),
      getRestrictedProjectIds(),
    ])
    const filterContext = filterContextResult.success ? filterContextResult.data : null
    const isAdmin = filterContext?.permissions.includes('hierarchy.is_admin') ?? false

    const { data: sectionRow, error: secErr } = await supabase
      .from('sections')
      .select('section_project_id')
      .eq('section_id', sectionId)
      .maybeSingle()
    if (secErr) return { success: false, error: secErr.message }
    if (!sectionRow) return { success: true, data: [] }
    if (!isAdmin && restrictedIds.includes(sectionRow.section_project_id)) {
      return { success: true, data: [] }
    }

    // Этапы раздела
    const { data: stages, error: stagesErr } = await supabase
      .from('decomposition_stages')
      .select('decomposition_stage_id, decomposition_stage_name, decomposition_stage_order')
      .eq('decomposition_stage_section_id', sectionId)
      .order('decomposition_stage_order')
    if (stagesErr) return { success: false, error: stagesErr.message }
    if (!stages || stages.length === 0) return { success: true, data: [] }

    const stageIds = stages.map(s => s.decomposition_stage_id)

    // Задачи этих этапов
    const { data: items, error: itemsErr } = await supabase
      .from('decomposition_items')
      .select('decomposition_item_id, decomposition_item_description, decomposition_item_planned_hours, decomposition_item_order, decomposition_item_stage_id')
      .in('decomposition_item_stage_id', stageIds)
      .order('decomposition_item_order')
    if (itemsErr) return { success: false, error: itemsErr.message }

    const itemIds = (items ?? []).map(it => it.decomposition_item_id)

    // Бюджеты этапов+задач (lean, тот же источник, что getBudgets для верхних уровней)
    const { data: budgets, error: budgetsErr } = await supabase
      .from('v_budgets_for_page')
      .select('*')
      .in('entity_type', ['decomposition_stage', 'decomposition_item'])
      .in('entity_id', [...stageIds, ...itemIds])
      .eq('is_active', true)
    if (budgetsErr) return { success: false, error: budgetsErr.message }

    const budgetsByEntity = new Map<string, BudgetCurrent[]>()
    for (const b of (budgets ?? []) as BudgetCurrent[]) {
      const arr = budgetsByEntity.get(b.entity_id) || []
      arr.push(b)
      budgetsByEntity.set(b.entity_id, arr)
    }

    // Группируем задачи по этапу
    const itemsByStage = new Map<string, BudgetSectionItem[]>()
    for (const it of items ?? []) {
      const arr = itemsByStage.get(it.decomposition_item_stage_id) || []
      arr.push({
        id: it.decomposition_item_id,
        description: it.decomposition_item_description || '',
        plannedHours: Number(it.decomposition_item_planned_hours ?? 0),
        order: it.decomposition_item_order ?? 0,
        budgets: budgetsByEntity.get(it.decomposition_item_id) ?? [],
      })
      itemsByStage.set(it.decomposition_item_stage_id, arr)
    }

    const result: BudgetSectionStage[] = stages.map(s => ({
      id: s.decomposition_stage_id,
      name: s.decomposition_stage_name || '',
      order: s.decomposition_stage_order ?? 0,
      budgets: budgetsByEntity.get(s.decomposition_stage_id) ?? [],
      items: itemsByStage.get(s.decomposition_stage_id) ?? [],
    }))

    return { success: true, data: result }
  } catch (error) {
    console.error('[getSectionBudgetItems] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки задач раздела',
    }
  }
}
