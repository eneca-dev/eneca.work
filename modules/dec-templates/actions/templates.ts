'use server'

import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/modules/cache'
import type {
  TemplateListItem,
  TemplateDetail,
  TemplateStage,
  TemplateStageItem,
  Stage,
  Decomposition,
} from '../types'

// ============================================================================
// Types for database responses
// ============================================================================

interface DbTemplateListRow {
  id: string
  name: string
  department_id: string
  created_by: string
  created_at: string
  departments: { department_name: string }
  profiles: { first_name: string; last_name: string }
}

interface DbTemplateStageRow {
  id: string
  name: string
  stage_order: number
  items: TemplateStageItem[]
}

interface DbDecompositionStageRow {
  decomposition_stage_id: string
  decomposition_stage_name: string
  decomposition_stage_start: string | null
  decomposition_stage_finish: string | null
  decomposition_stage_description: string | null
  decomposition_stage_status_id: string | null
}

interface DbDecompositionItemRow {
  decomposition_item_id: string
  decomposition_item_stage_id: string
  decomposition_item_description: string
}

interface DecompositionItemInsert {
  decomposition_item_section_id: string
  decomposition_item_stage_id: string
  decomposition_item_description: string
  decomposition_item_work_category_id: string
  decomposition_item_difficulty_id: string | null
  decomposition_item_planned_hours: number
  decomposition_item_order: number
}

// ============================================================================
// Server Actions
// RLS обеспечивает авторизацию через JWT в cookies.
// getUser() нужен ТОЛЬКО когда требуется user.id в логике.
// ============================================================================

/**
 * Получить список всех шаблонов
 * Auth: RLS (не нужен user.id)
 */
export async function getTemplatesList(): Promise<ActionResult<TemplateListItem[]>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('dec_templates')
      .select(`
        id,
        name,
        department_id,
        created_by,
        created_at,
        departments!inner(department_name),
        profiles!inner(first_name, last_name)
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[getTemplatesList] Supabase error:', error)
      return { success: false, error: error.message }
    }

    const templates: TemplateListItem[] = (data || []).map((item: DbTemplateListRow) => ({
      id: item.id,
      name: item.name,
      departmentId: item.department_id,
      departmentName: item.departments.department_name,
      creatorName: `${item.profiles.first_name} ${item.profiles.last_name}`.trim(),
      createdAt: item.created_at,
    }))

    return { success: true, data: templates }
  } catch (error) {
    console.error('[getTemplatesList] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки шаблонов',
    }
  }
}

/**
 * Получить детали шаблона по ID
 * Auth: RLS (не нужен user.id)
 */
export async function getTemplateDetail(templateId: string): Promise<ActionResult<TemplateDetail>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('dec_templates')
      .select(`
        id,
        name,
        dec_template_stages(
          id,
          name,
          stage_order,
          items
        )
      `)
      .eq('id', templateId)
      .single()

    if (error) {
      console.error('[getTemplateDetail] Supabase error:', error)
      return { success: false, error: error.message }
    }

    const stages: TemplateStage[] = (data.dec_template_stages || [])
      .sort((a: DbTemplateStageRow, b: DbTemplateStageRow) => a.stage_order - b.stage_order)
      .map((stage: DbTemplateStageRow) => ({
        name: stage.name,
        order: stage.stage_order,
        items: stage.items || [],
      }))

    return {
      success: true,
      data: {
        id: data.id,
        name: data.name,
        stages,
      },
    }
  } catch (error) {
    console.error('[getTemplateDetail] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки шаблона',
    }
  }
}

/**
 * Сохранить новый шаблон
 * Auth: НУЖЕН user.id для created_by
 */
export async function createTemplate(input: {
  name: string
  departmentId: string
  stages: TemplateStage[]
}): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = await createClient()

    // Нужен user.id для created_by
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Не авторизован' }
    }

    // 1. Create template
    const { data: template, error: templateError } = await supabase
      .from('dec_templates')
      .insert({
        name: input.name,
        department_id: input.departmentId,
        created_by: user.id,
        is_active: true,
      })
      .select('id')
      .single()

    if (templateError) {
      console.error('[createTemplate] Template error:', templateError)
      return { success: false, error: templateError.message }
    }

    // 2. Batch insert stages with items in JSONB
    if (input.stages.length > 0) {
      const stagesToInsert = input.stages.map((stage) => ({
        template_id: template.id,
        name: stage.name,
        stage_order: stage.order,
        items: stage.items,
      }))

      const { error: stagesError } = await supabase
        .from('dec_template_stages')
        .insert(stagesToInsert)

      if (stagesError) {
        // Rollback: delete created template
        console.error('[createTemplate] Stages error, rolling back:', stagesError)
        await supabase.from('dec_templates').delete().eq('id', template.id)
        return { success: false, error: stagesError.message }
      }
    }

    return { success: true, data: { id: template.id } }
  } catch (error) {
    console.error('[createTemplate] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка сохранения шаблона',
    }
  }
}

/**
 * Удалить шаблон
 * Auth: RLS (не нужен user.id)
 */
export async function removeTemplate(input: {
  templateId: string
}): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('dec_templates')
      .delete()
      .eq('id', input.templateId)

    if (error) {
      console.error('[removeTemplate] Supabase error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: { id: input.templateId } }
  } catch (error) {
    console.error('[removeTemplate] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка удаления шаблона',
    }
  }
}

/**
 * Применить шаблон к разделу
 * Auth: RLS (не нужен user.id)
 *
 * ОПТИМИЗИРОВАНО:
 * - Параллельные запросы через Promise.all
 * - Нет дублирования auth проверок
 * - Batch insert для этапов и задач
 */
export async function applyTemplateToSection(input: {
  templateId: string
  sectionId: string
  statusId: string | null
}): Promise<ActionResult<Stage[]>> {
  try {
    const supabase = await createClient()

    // =========================================================================
    // STEP 1: Параллельно загружаем все необходимые данные
    // =========================================================================
    const [templateResult, statusesResult, maxOrderResult] = await Promise.all([
      // 1a. Загружаем шаблон с этапами
      supabase
        .from('dec_templates')
        .select(`
          id,
          name,
          dec_template_stages(
            id,
            name,
            stage_order,
            items
          )
        `)
        .eq('id', input.templateId)
        .single(),

      // 1b. Загружаем статусы (только id и name для поиска "План")
      supabase
        .from('section_statuses')
        .select('id, name'),

      // 1c. Загружаем max order существующих этапов
      supabase
        .from('decomposition_stages')
        .select('decomposition_stage_order')
        .eq('decomposition_stage_section_id', input.sectionId)
        .order('decomposition_stage_order', { ascending: false })
        .limit(1),
    ])

    // Проверяем ошибки
    if (templateResult.error) {
      console.error('[applyTemplateToSection] Template error:', templateResult.error)
      return { success: false, error: 'Шаблон не найден' }
    }

    const templateData = templateResult.data
    if (!templateData?.dec_template_stages?.length) {
      return { success: false, error: 'Шаблон пуст или не содержит этапов' }
    }

    // Парсим этапы шаблона
    const templateStages: TemplateStage[] = (templateData.dec_template_stages || [])
      .sort((a: DbTemplateStageRow, b: DbTemplateStageRow) => a.stage_order - b.stage_order)
      .map((stage: DbTemplateStageRow) => ({
        name: stage.name,
        order: stage.stage_order,
        items: stage.items || [],
      }))

    // Находим статус "План"
    let resolvedStatusId: string | null = null
    if (statusesResult.data?.length) {
      const planStatus = statusesResult.data.find((s) => /план/i.test(s.name))
      resolvedStatusId = planStatus?.id || statusesResult.data[0]?.id || null
    }

    // Max order
    const maxOrder = maxOrderResult.data?.[0]?.decomposition_stage_order ?? 0

    // =========================================================================
    // STEP 2: Создаём этапы (batch insert)
    // =========================================================================
    const stagesToCreate = templateStages.map((stage) => ({
      decomposition_stage_section_id: input.sectionId,
      decomposition_stage_name: stage.name,
      decomposition_stage_order: maxOrder + stage.order + 1,
      decomposition_stage_start: null,
      decomposition_stage_finish: null,
      decomposition_stage_description: null,
      decomposition_stage_status_id: resolvedStatusId,
    }))

    const { data: createdStages, error: stagesError } = await supabase
      .from('decomposition_stages')
      .insert(stagesToCreate)
      .select('decomposition_stage_id, decomposition_stage_name, decomposition_stage_start, decomposition_stage_finish, decomposition_stage_description, decomposition_stage_status_id')

    if (stagesError) {
      console.error('[applyTemplateToSection] Stages error:', stagesError)
      return { success: false, error: `Не удалось создать этапы: ${stagesError.message}` }
    }

    if (!createdStages?.length) {
      return { success: false, error: 'Не удалось создать этапы' }
    }

    // IDs для потенциального rollback
    const createdStageIds = createdStages.map((s: DbDecompositionStageRow) => s.decomposition_stage_id)

    // =========================================================================
    // STEP 3: Создаём задачи (batch insert)
    // =========================================================================
    const itemsToCreate: DecompositionItemInsert[] = []
    createdStages.forEach((dbStage: DbDecompositionStageRow, stageIndex: number) => {
      const templateStage = templateStages[stageIndex]
      templateStage.items.forEach((item, itemIndex) => {
        itemsToCreate.push({
          decomposition_item_section_id: input.sectionId,
          decomposition_item_stage_id: dbStage.decomposition_stage_id,
          decomposition_item_description: item.description,
          decomposition_item_work_category_id: item.workCategoryId,
          decomposition_item_difficulty_id: item.difficultyId,
          decomposition_item_planned_hours: item.plannedHours,
          decomposition_item_order: itemIndex,
        })
      })
    })

    let createdItems: DbDecompositionItemRow[] = []
    if (itemsToCreate.length > 0) {
      const { data, error: itemsError } = await supabase
        .from('decomposition_items')
        .insert(itemsToCreate)
        .select('decomposition_item_id, decomposition_item_stage_id, decomposition_item_description')

      if (itemsError) {
        // Rollback
        console.error('[applyTemplateToSection] Items error, rolling back:', itemsError)
        await supabase
          .from('decomposition_stages')
          .delete()
          .in('decomposition_stage_id', createdStageIds)
        return { success: false, error: `Не удалось создать задачи: ${itemsError.message}` }
      }

      createdItems = (data || []) as DbDecompositionItemRow[]
    }

    // =========================================================================
    // STEP 4: Формируем результат
    // =========================================================================
    const newStages: Stage[] = createdStages.map((dbStage: DbDecompositionStageRow, stageIndex: number) => {
      const templateStage = templateStages[stageIndex]
      const stageItems = createdItems.filter(
        (item) => item.decomposition_item_stage_id === dbStage.decomposition_stage_id
      )

      const decompositions: Decomposition[] = templateStage.items.map((item, itemIndex) => ({
        id: stageItems[itemIndex]?.decomposition_item_id || '',
        description: item.description,
        typeOfWork: item.workCategoryName,
        difficulty: item.difficultyName || '',
        plannedHours: item.plannedHours,
        progress: 0,
      }))

      return {
        id: dbStage.decomposition_stage_id,
        name: dbStage.decomposition_stage_name,
        startDate: dbStage.decomposition_stage_start,
        endDate: dbStage.decomposition_stage_finish,
        description: dbStage.decomposition_stage_description,
        statusId: dbStage.decomposition_stage_status_id,
        responsibles: [],
        decompositions,
      }
    })

    return { success: true, data: newStages }
  } catch (error) {
    console.error('[applyTemplateToSection] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка применения шаблона',
    }
  }
}
