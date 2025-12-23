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
// ============================================================================

/**
 * Получить список всех шаблонов
 */
export async function getTemplatesList(): Promise<ActionResult<TemplateListItem[]>> {
  try {
    const supabase = await createClient()

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Не авторизован' }
    }

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
 */
export async function getTemplateDetail(templateId: string): Promise<ActionResult<TemplateDetail>> {
  try {
    const supabase = await createClient()

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Не авторизован' }
    }

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
 */
export async function createTemplate(input: {
  name: string
  departmentId: string
  stages: TemplateStage[]
}): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = await createClient()

    // Auth check
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
 */
export async function removeTemplate(input: {
  templateId: string
}): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = await createClient()

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Не авторизован' }
    }

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
 * Создает этапы и декомпозиции в БД, возвращает созданные Stage[]
 */
export async function applyTemplateToSection(input: {
  templateId: string
  sectionId: string
  statusId: string | null
}): Promise<ActionResult<Stage[]>> {
  try {
    const supabase = await createClient()

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Не авторизован' }
    }

    // 1. Load template structure
    const templateResult = await getTemplateDetail(input.templateId)
    if (!templateResult.success) {
      return { success: false, error: templateResult.error }
    }

    const template = templateResult.data
    if (!template.stages || template.stages.length === 0) {
      return { success: false, error: 'Шаблон пуст или не содержит этапов' }
    }

    // 2. Find max order among existing stages
    const { data: existingStages } = await supabase
      .from('decomposition_stages')
      .select('decomposition_stage_order')
      .eq('decomposition_stage_section_id', input.sectionId)
      .order('decomposition_stage_order', { ascending: false })
      .limit(1)

    const maxOrder = existingStages?.[0]?.decomposition_stage_order ?? 0

    // 3. Batch insert new stages
    const stagesToCreate = template.stages.map((stage) => ({
      decomposition_stage_section_id: input.sectionId,
      decomposition_stage_name: stage.name,
      decomposition_stage_order: maxOrder + stage.order + 1,
      decomposition_stage_start: null,
      decomposition_stage_finish: null,
      decomposition_stage_description: null,
      decomposition_stage_status_id: input.statusId,
    }))

    const { data: createdStages, error: stagesError } = await supabase
      .from('decomposition_stages')
      .insert(stagesToCreate)
      .select('decomposition_stage_id, decomposition_stage_name, decomposition_stage_start, decomposition_stage_finish, decomposition_stage_description, decomposition_stage_status_id')

    if (stagesError) {
      console.error('[applyTemplateToSection] Stages error:', stagesError)
      return { success: false, error: `Не удалось создать этапы: ${stagesError.message}` }
    }

    if (!createdStages || createdStages.length === 0) {
      return { success: false, error: 'Не удалось создать этапы' }
    }

    // Save IDs for potential rollback
    const createdStageIds = createdStages.map((s: DbDecompositionStageRow) => s.decomposition_stage_id)

    // 4. Batch insert all decompositions for all stages
    const itemsToCreate: DecompositionItemInsert[] = []
    createdStages.forEach((dbStage: DbDecompositionStageRow, stageIndex: number) => {
      const templateStage = template.stages[stageIndex]
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

    // Create decompositions only if there are any
    let createdItems: DbDecompositionItemRow[] = []
    if (itemsToCreate.length > 0) {
      const { data, error: itemsError } = await supabase
        .from('decomposition_items')
        .insert(itemsToCreate)
        .select('decomposition_item_id, decomposition_item_stage_id, decomposition_item_description')

      if (itemsError) {
        // Rollback: delete created stages
        console.error('[applyTemplateToSection] Items error, rolling back:', itemsError)
        await supabase
          .from('decomposition_stages')
          .delete()
          .in('decomposition_stage_id', createdStageIds)
        return { success: false, error: `Не удалось создать декомпозиции: ${itemsError.message}` }
      }

      createdItems = (data || []) as DbDecompositionItemRow[]
    }

    // 5. Build Stage[] for adding to state
    const newStages: Stage[] = createdStages.map((dbStage: DbDecompositionStageRow, stageIndex: number) => {
      const templateStage = template.stages[stageIndex]
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
