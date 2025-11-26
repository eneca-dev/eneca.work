import { createClient } from '@/utils/supabase/client'
import type { TemplateListItem, TemplateDetail, TemplateStage, Stage, Decomposition } from './types'

/**
 * Загрузить список всех шаблонов
 * Один запрос с JOIN для получения названий отделов и авторов
 */
export async function loadTemplatesList(): Promise<TemplateListItem[]> {
  const supabase = createClient()

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

  if (error) throw error

  return (data || []).map((item: any) => ({
    id: item.id,
    name: item.name,
    departmentId: item.department_id,
    departmentName: item.departments.department_name,
    creatorName: `${item.profiles.first_name} ${item.profiles.last_name}`.trim(),
    createdAt: item.created_at
  }))
}

/**
 * Загрузить полную структуру шаблона
 * Один запрос с JOIN для получения этапов и элементов
 */
export async function loadTemplateDetail(templateId: string): Promise<TemplateDetail> {
  const supabase = createClient()

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

  if (error) throw error

  const stages: TemplateStage[] = (data.dec_template_stages || [])
    .sort((a: any, b: any) => a.stage_order - b.stage_order)
    .map((stage: any) => ({
      name: stage.name,
      order: stage.stage_order,
      items: stage.items || []
    }))

  return {
    id: data.id,
    name: data.name,
    stages
  }
}

/**
 * Сохранить новый шаблон
 * INSERT template + batch INSERT stages
 */
export async function saveTemplate(
  name: string,
  departmentId: string,
  stages: TemplateStage[],
  userId: string
): Promise<void> {
  const supabase = createClient()

  // 1. Создать шаблон
  const { data: template, error: templateError } = await supabase
    .from('dec_templates')
    .insert({
      name,
      department_id: departmentId,
      created_by: userId,
      is_active: true
    })
    .select('id')
    .single()

  if (templateError) throw templateError

  // Сохранить ID созданного template для возможного отката
  const createdTemplateId = template.id

  try {
    // 2. Batch insert этапов с items в JSONB
    const stagesToInsert = stages.map(stage => ({
      template_id: template.id,
      name: stage.name,
      stage_order: stage.order,
      items: stage.items
    }))

    const { error: stagesError } = await supabase
      .from('dec_template_stages')
      .insert(stagesToInsert)

    if (stagesError) throw stagesError
  } catch (stagesError) {
    // ROLLBACK: Удалить созданный шаблон при ошибке создания этапов
    console.error('Ошибка при создании этапов шаблона, откат шаблона:', stagesError)
    try {
      await supabase
        .from('dec_templates')
        .delete()
        .eq('id', createdTemplateId)
    } catch (rollbackError) {
      console.error('Ошибка при откате шаблона:', rollbackError)
    }
    throw stagesError
  }
}

/**
 * Удалить шаблон
 * DELETE с CASCADE удалением stages
 */
export async function deleteTemplate(templateId: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('dec_templates')
    .delete()
    .eq('id', templateId)

  if (error) throw error
}

/**
 * Применить шаблон к разделу
 * Загрузить шаблон, найти max order, batch insert stages + items
 * Вернуть Stage[] для добавления в state БЕЗ перезагрузки
 */
export async function applyTemplate(
  templateId: string,
  sectionId: string,
  statuses: Array<{ id: string; name: string }>
): Promise<Stage[]> {
  const supabase = createClient()

  try {
    // 1. Загрузить полную структуру шаблона
    const template = await loadTemplateDetail(templateId)

    if (!template || !template.stages || template.stages.length === 0) {
      throw new Error('Шаблон пуст или не содержит этапов')
    }

  // 2. Найти максимальный order среди существующих этапов
  const { data: existingStages } = await supabase
    .from('decomposition_stages')
    .select('decomposition_stage_order')
    .eq('decomposition_stage_section_id', sectionId)
    .order('decomposition_stage_order', { ascending: false })
    .limit(1)

  const maxOrder = existingStages?.[0]?.decomposition_stage_order ?? 0

  // 3. Batch insert новых этапов
  const stagesToCreate = template.stages.map((stage) => ({
    decomposition_stage_section_id: sectionId,
    decomposition_stage_name: stage.name,
    decomposition_stage_order: maxOrder + stage.order + 1,
    decomposition_stage_start: null,
    decomposition_stage_finish: null
  }))

  const { data: createdStages, error: stagesError } = await supabase
    .from('decomposition_stages')
    .insert(stagesToCreate)
    .select('decomposition_stage_id, decomposition_stage_name, decomposition_stage_start, decomposition_stage_finish')

  if (stagesError) {
    console.error('Ошибка создания этапов:', stagesError)
    throw new Error(`Не удалось создать этапы: ${stagesError.message}`)
  }

  if (!createdStages || createdStages.length === 0) {
    throw new Error('Не удалось создать этапы')
  }

  // Сохранить IDs созданных stages для возможного отката
  const createdStageIds = createdStages.map((s: any) => s.decomposition_stage_id)

  try {
    // 4. Найти статус "План" с помощью регулярного выражения (используем переданные статусы)
    const planStatus = statuses.find((s) => /план/i.test(s.name)) || statuses[0]
    const planStatusId = planStatus?.id || null
    const planStatusName = planStatus?.name || ''

    // 5. Batch insert всех декомпозиций для всех этапов
    const itemsToCreate: any[] = []
    createdStages.forEach((dbStage: any, stageIndex: number) => {
      const templateStage = template.stages[stageIndex]
      templateStage.items.forEach((item, itemIndex) => {
        itemsToCreate.push({
          decomposition_item_section_id: sectionId, // Обязательное поле!
          decomposition_item_stage_id: dbStage.decomposition_stage_id,
          decomposition_item_description: item.description,
          decomposition_item_work_category_id: item.workCategoryId,
          decomposition_item_difficulty_id: item.difficultyId,
          decomposition_item_planned_hours: item.plannedHours,
          decomposition_item_order: itemIndex,
          decomposition_item_progress: 0,
          decomposition_item_planned_due_date: null,
          decomposition_item_status_id: planStatusId
        })
      })
    })

    // Создаем декомпозиции только если они есть
    let createdItems: any[] = []
    if (itemsToCreate.length > 0) {
      const { data, error: itemsError } = await supabase
        .from('decomposition_items')
        .insert(itemsToCreate)
        .select('decomposition_item_id, decomposition_item_stage_id, decomposition_item_description')

      if (itemsError) {
        console.error('Ошибка создания декомпозиций:', itemsError)
        throw new Error(`Не удалось создать декомпозиции: ${itemsError.message}`)
      }

      createdItems = data || []
    }

    // 6. Сформировать Stage[] для добавления в state
    const newStages: Stage[] = createdStages.map((dbStage: any, stageIndex: number) => {
      const templateStage = template.stages[stageIndex]
      const stageItems = createdItems.filter(
        (item: any) => item.decomposition_item_stage_id === dbStage.decomposition_stage_id
      )

      const decompositions: Decomposition[] = templateStage.items.map((item, itemIndex) => ({
        id: stageItems[itemIndex]?.decomposition_item_id || '',
        description: item.description,
        typeOfWork: item.workCategoryName,
        difficulty: item.difficultyName || '',
        responsible: '',
        plannedHours: item.plannedHours,
        progress: 0,
        status: planStatusName,
        completionDate: null
      }))

      return {
        id: dbStage.decomposition_stage_id,
        name: dbStage.decomposition_stage_name,
        startDate: dbStage.decomposition_stage_start,
        endDate: dbStage.decomposition_stage_finish,
        decompositions
      }
    })

    return newStages
  } catch (itemsError) {
    // ROLLBACK: Удалить созданные этапы при ошибке создания декомпозиций
    console.error('Ошибка при создании декомпозиций, откат созданных этапов:', itemsError)
    try {
      await supabase
        .from('decomposition_stages')
        .delete()
        .in('decomposition_stage_id', createdStageIds)
    } catch (rollbackError) {
      console.error('Ошибка при откате этапов:', rollbackError)
    }
    throw itemsError
  }
  } catch (error) {
    console.error('Ошибка применения шаблона:', error)
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Неизвестная ошибка при применении шаблона')
  }
}
