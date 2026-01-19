import { createClient } from '@/utils/supabase/client'
import type {
  CreateTemplateItemPayload,
  CreateTemplatePayload,
  DecompositionTemplate,
  DecompositionTemplateItem,
  UpdateTemplateItemPayload,
  UpdateTemplatePayload,
} from './types'

const supabase = createClient()

// We always include extended fields; DB has columns per migration

export async function listTemplatesByDepartment(department_id: string): Promise<DecompositionTemplate[]> {
  const { data, error } = await supabase
    .from('decomposition_templates')
    .select(
      [
        'decomposition_template_id',
        'decomposition_department_id',
        'decomposition_template_name',
        'decomposition_template_description',
        'decomposition_template_is_active',
        'decomposition_template_created_at',
        'decomposition_template_updated_at',
      ].join(', ')
    )
    .eq('decomposition_department_id', department_id)
    .order('decomposition_template_name', { ascending: true })
  if (error) throw error
  const mapped: DecompositionTemplate[] = (data || []).map((r: any) => ({
    id: r.decomposition_template_id,
    department_id: r.decomposition_department_id,
    name: r.decomposition_template_name,
    description: r.decomposition_template_description,
    is_active: r.decomposition_template_is_active,
    created_at: r.decomposition_template_created_at,
    updated_at: r.decomposition_template_updated_at,
  }))
  return mapped
}

export async function getTemplate(id: string): Promise<{ template: DecompositionTemplate; items: DecompositionTemplateItem[] }> {
  const [{ data: tData, error: tErr }] = await Promise.all([
    supabase
      .from('decomposition_templates')
      .select(
        [
          'decomposition_template_id',
          'decomposition_department_id',
          'decomposition_template_name',
          'decomposition_template_description',
          'decomposition_template_is_active',
          'decomposition_template_created_at',
          'decomposition_template_updated_at',
        ].join(', ')
      )
      .eq('decomposition_template_id', id)
      .single(),
  ])
  if (tErr) throw tErr

  // Items with fallback if new columns don't exist yet
  let iData: any[] | null = null
  let iErr: any = null
  try {
    const sel = [
      'decomposition_template_item_id',
      'decomposition_template_item_template_id',
      'decomposition_template_item_description',
      'decomposition_template_item_work_category_id',
      'decomposition_template_item_planned_hours',
      'decomposition_template_item_due_offset_days',
      'decomposition_template_item_order',
      'decomposition_template_item_responsible',
      'decomposition_template_item_status_id',
      'decomposition_template_item_progress',
    ].join(', ')
    const { data, error } = await supabase
      .from('decomposition_template_items')
      .select(sel)
      .eq('decomposition_template_item_template_id', id)
      .order('decomposition_template_item_order', { ascending: true })
    if (error) throw error
    iData = (data as any[]) || []
  } catch (e) {
    iErr = e
  }
  if (iErr) throw iErr

  const template: DecompositionTemplate = {
    id: (tData as any).decomposition_template_id,
    department_id: (tData as any).decomposition_department_id,
    name: (tData as any).decomposition_template_name,
    description: (tData as any).decomposition_template_description,
    is_active: (tData as any).decomposition_template_is_active,
    created_at: (tData as any).decomposition_template_created_at,
    updated_at: (tData as any).decomposition_template_updated_at,
  }

  const items: DecompositionTemplateItem[] = ((iData || []) as any[]).map((r) => ({
    id: r.decomposition_template_item_id,
    template_id: r.decomposition_template_item_template_id,
    description: r.decomposition_template_item_description,
    work_category_id: r.decomposition_template_item_work_category_id,
    planned_hours: Number(r.decomposition_template_item_planned_hours ?? 0),
    due_offset_days: r.decomposition_template_item_due_offset_days,
    order: Number(r.decomposition_template_item_order ?? 0),
    // Ответственный в шаблоне больше не используется
    responsible_id: null,
    status_id: r.decomposition_template_item_status_id ?? null,
    progress: r.decomposition_template_item_progress ?? null,
  }))

  return { template, items }
}

export async function createTemplate(payload: CreateTemplatePayload): Promise<DecompositionTemplate> {
  const insertPayload = {
    decomposition_department_id: payload.department_id,
    decomposition_template_name: payload.name,
    decomposition_template_description: payload.description ?? null,
    decomposition_template_is_active: payload.is_active ?? true,
  }
  const { data, error } = await supabase
    .from('decomposition_templates')
    .insert(insertPayload)
    .select(
      [
        'decomposition_template_id',
        'decomposition_department_id',
        'decomposition_template_name',
        'decomposition_template_description',
        'decomposition_template_is_active',
        'decomposition_template_created_at',
        'decomposition_template_updated_at',
      ].join(', ')
    )
    .single()
  if (error) throw error
  const t: DecompositionTemplate = {
    id: (data as any).decomposition_template_id,
    department_id: (data as any).decomposition_department_id,
    name: (data as any).decomposition_template_name,
    description: (data as any).decomposition_template_description,
    is_active: (data as any).decomposition_template_is_active,
    created_at: (data as any).decomposition_template_created_at,
    updated_at: (data as any).decomposition_template_updated_at,
  }
  return t
}

export async function updateTemplate(id: string, payload: UpdateTemplatePayload): Promise<DecompositionTemplate> {
  const updatePayload: Record<string, unknown> = {}
  if (payload.name !== undefined) updatePayload['decomposition_template_name'] = payload.name
  if (payload.description !== undefined) updatePayload['decomposition_template_description'] = payload.description
  if (payload.is_active !== undefined) updatePayload['decomposition_template_is_active'] = payload.is_active

  const { data, error } = await supabase
    .from('decomposition_templates')
    .update(updatePayload)
    .eq('decomposition_template_id', id)
    .select(
      [
        'decomposition_template_id',
        'decomposition_department_id',
        'decomposition_template_name',
        'decomposition_template_description',
        'decomposition_template_is_active',
        'decomposition_template_created_at',
        'decomposition_template_updated_at',
      ].join(', ')
    )
    .single()
  if (error) throw error
  const t: DecompositionTemplate = {
    id: (data as any).decomposition_template_id,
    department_id: (data as any).decomposition_department_id,
    name: (data as any).decomposition_template_name,
    description: (data as any).decomposition_template_description,
    is_active: (data as any).decomposition_template_is_active,
    created_at: (data as any).decomposition_template_created_at,
    updated_at: (data as any).decomposition_template_updated_at,
  }
  return t
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('decomposition_templates')
    .delete()
    .eq('decomposition_template_id', id)
  if (error) throw error
}

export async function createTemplateItem(payload: CreateTemplateItemPayload): Promise<DecompositionTemplateItem> {
  const normalizeUuid = (val: unknown) => {
    if (val === null || val === undefined) return null
    if (typeof val === 'string') {
      const t = val.trim()
      return t.length === 0 ? null : t
    }
    return val as any
  }
  const insertPayload: Record<string, unknown> = {
    decomposition_template_item_template_id: payload.template_id,
    decomposition_template_item_description: payload.description,
    decomposition_template_item_work_category_id: payload.work_category_id,
    decomposition_template_item_planned_hours: payload.planned_hours ?? 0,
    decomposition_template_item_due_offset_days: payload.due_offset_days ?? null,
    decomposition_template_item_order: payload.order ?? 0,
    // Ответственный в шаблоне отключён
    decomposition_template_item_responsible: null,
    decomposition_template_item_status_id: normalizeUuid(payload.status_id),
    decomposition_template_item_progress: payload.progress ?? null,
  }
  const { data, error } = await supabase
    .from('decomposition_template_items')
    .insert(insertPayload)
    .select(
      [
        'decomposition_template_item_id',
        'decomposition_template_item_template_id',
        'decomposition_template_item_description',
        'decomposition_template_item_work_category_id',
        'decomposition_template_item_planned_hours',
        'decomposition_template_item_due_offset_days',
        'decomposition_template_item_order',
        // The next fields may not exist pre-migration; keep them but PostgREST will ignore if not present due to select
        'decomposition_template_item_responsible',
        'decomposition_template_item_status_id',
        'decomposition_template_item_progress',
      ].join(', ')
    )
    .single()
  if (error) throw new Error(error.message)
  const it: DecompositionTemplateItem = {
    id: (data as any).decomposition_template_item_id,
    template_id: (data as any).decomposition_template_item_template_id,
    description: (data as any).decomposition_template_item_description,
    work_category_id: (data as any).decomposition_template_item_work_category_id,
    planned_hours: Number((data as any).decomposition_template_item_planned_hours ?? 0),
    due_offset_days: (data as any).decomposition_template_item_due_offset_days,
    order: Number((data as any).decomposition_template_item_order ?? 0),
    responsible_id: (data as any).decomposition_template_item_responsible ?? null,
    status_id: (data as any).decomposition_template_item_status_id ?? null,
    progress: (data as any).decomposition_template_item_progress ?? null,
  }
  return it
}

export async function updateTemplateItem(id: string, payload: UpdateTemplateItemPayload): Promise<DecompositionTemplateItem> {
  const updatePayload: Record<string, unknown> = {}
  if (payload.description !== undefined) updatePayload['decomposition_template_item_description'] = payload.description
  if (payload.work_category_id !== undefined) updatePayload['decomposition_template_item_work_category_id'] = payload.work_category_id
  if (payload.planned_hours !== undefined) updatePayload['decomposition_template_item_planned_hours'] = payload.planned_hours
  if (payload.due_offset_days !== undefined) updatePayload['decomposition_template_item_due_offset_days'] = payload.due_offset_days
  if (payload.order !== undefined) updatePayload['decomposition_template_item_order'] = payload.order
  // Ответственный в шаблоне отключён — всегда храним NULL
  if (payload.responsible_id !== undefined) updatePayload['decomposition_template_item_responsible'] = null
  if (payload.status_id !== undefined) updatePayload['decomposition_template_item_status_id'] = payload.status_id
  if (payload.progress !== undefined) updatePayload['decomposition_template_item_progress'] = payload.progress

  const { data, error } = await supabase
    .from('decomposition_template_items')
    .update(updatePayload)
    .eq('decomposition_template_item_id', id)
    .select(
      [
        'decomposition_template_item_id',
        'decomposition_template_item_template_id',
        'decomposition_template_item_description',
        'decomposition_template_item_work_category_id',
        'decomposition_template_item_planned_hours',
        'decomposition_template_item_due_offset_days',
        'decomposition_template_item_order',
        'decomposition_template_item_responsible',
        'decomposition_template_item_status_id',
        'decomposition_template_item_progress',
      ].join(', ')
    )
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) {
    const { data: refetch, error: refetchErr } = await supabase
      .from('decomposition_template_items')
      .select(
        [
          'decomposition_template_item_id',
          'decomposition_template_item_template_id',
          'decomposition_template_item_description',
          'decomposition_template_item_work_category_id',
          'decomposition_template_item_planned_hours',
          'decomposition_template_item_due_offset_days',
          'decomposition_template_item_order',
          'decomposition_template_item_responsible',
          'decomposition_template_item_status_id',
          'decomposition_template_item_progress',
        ].join(', ')
      )
      .eq('decomposition_template_item_id', id)
      .single()
    if (refetchErr) throw new Error(refetchErr.message)
    return {
      id: (refetch as any).decomposition_template_item_id,
      template_id: (refetch as any).decomposition_template_item_template_id,
      description: (refetch as any).decomposition_template_item_description,
      work_category_id: (refetch as any).decomposition_template_item_work_category_id,
      planned_hours: Number((refetch as any).decomposition_template_item_planned_hours ?? 0),
      due_offset_days: (refetch as any).decomposition_template_item_due_offset_days,
      order: Number((refetch as any).decomposition_template_item_order ?? 0),
      // Ответственный в шаблоне больше не используется
      responsible_id: null,
      status_id: (refetch as any).decomposition_template_item_status_id ?? null,
      progress: (refetch as any).decomposition_template_item_progress ?? null,
    }
  }
  const it: DecompositionTemplateItem = {
    id: (data as any).decomposition_template_item_id,
    template_id: (data as any).decomposition_template_item_template_id,
    description: (data as any).decomposition_template_item_description,
    work_category_id: (data as any).decomposition_template_item_work_category_id,
    planned_hours: Number((data as any).decomposition_template_item_planned_hours ?? 0),
    due_offset_days: (data as any).decomposition_template_item_due_offset_days,
    order: Number((data as any).decomposition_template_item_order ?? 0),
    // Ответственный в шаблоне больше не используется
    responsible_id: null,
    status_id: (data as any).decomposition_template_item_status_id ?? null,
    progress: (data as any).decomposition_template_item_progress ?? null,
  }
  return it
}

export async function deleteTemplateItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('decomposition_template_items')
    .delete()
    .eq('decomposition_template_item_id', id)
  if (error) throw error
}

export interface ApplyTemplateParams {
  section_id: string
  template_id: string
  base_date?: string | null // Больше не используется: даты не применяем
}

// Применение: append — добавляем строки из шаблона в конец секции
export async function applyTemplateAppend(params: ApplyTemplateParams): Promise<{ inserted: number }> {
  // 1) текущий пользователь для RLS/created_by
  const { data: userResp, error: uErr } = await supabase.auth.getUser()
  if (uErr) throw uErr
  const userId = userResp?.user?.id
  if (!userId) throw new Error('Пользователь не найден')

  // 2) тянем позиции шаблона
  const sel = [
    'decomposition_template_item_id',
    'decomposition_template_item_template_id',
    'decomposition_template_item_description',
    'decomposition_template_item_work_category_id',
    'decomposition_template_item_planned_hours',
    'decomposition_template_item_due_offset_days',
    'decomposition_template_item_order',
    'decomposition_template_item_responsible',
    'decomposition_template_item_status_id',
    'decomposition_template_item_progress',
  ].join(', ')
  const { data: items, error: iErr } = await supabase
    .from('decomposition_template_items')
    .select(sel)
    .eq('decomposition_template_item_template_id', params.template_id)
    .order('decomposition_template_item_order', { ascending: true })
  if (iErr) throw new Error(iErr.message || String(iErr))
  const templateItems: DecompositionTemplateItem[] = ((items || []) as any[]).map((r) => ({
    id: r.decomposition_template_item_id,
    template_id: r.decomposition_template_item_template_id,
    description: r.decomposition_template_item_description,
    work_category_id: r.decomposition_template_item_work_category_id,
    planned_hours: Number(r.decomposition_template_item_planned_hours ?? 0),
    due_offset_days: r.decomposition_template_item_due_offset_days,
    order: Number(r.decomposition_template_item_order ?? 0),
    // Ответственный в шаблоне больше не используется
    responsible_id: null,
    status_id: r.decomposition_template_item_status_id ?? null,
    progress: r.decomposition_template_item_progress ?? null,
  }))
  if (templateItems.length === 0) return { inserted: 0 }

  // 3) узнаём текущий max(order) в секции
  const { data: maxRes, error: mErr } = await supabase
    .from('decomposition_items')
    .select('decomposition_item_order')
    .eq('decomposition_item_section_id', params.section_id)
    .order('decomposition_item_order', { ascending: false })
    .limit(1)
  if (mErr) throw mErr
  const startOrder = ((maxRes && maxRes[0]?.decomposition_item_order) ?? 0) + 1

  // 4) формируем вставку
  const toInsert = templateItems.map((ti, idx) => {
    return {
      decomposition_item_section_id: params.section_id,
      decomposition_item_description: ti.description,
      decomposition_item_work_category_id: ti.work_category_id,
      decomposition_item_planned_hours: ti.planned_hours ?? 0,
      decomposition_item_planned_due_date: null, // даты больше не переносим из шаблонов
      decomposition_item_order: startOrder + idx,
      decomposition_item_created_by: userId,
      // Ответственного из шаблона не переносим
      decomposition_item_responsible: null,
      decomposition_item_status_id: ti.status_id ?? null,
      decomposition_item_progress: ti.progress ?? 0,
    }
  })

  const { error: insErr } = await supabase.from('decomposition_items').insert(toInsert)
  if (insErr) throw insErr
  return { inserted: toInsert.length }
}

export interface ValidationIssue {
  type: 'DEPARTMENT_MISMATCH' | 'MISSING_CATEGORY'
  message: string
  details?: any
}

export interface ValidationResult {
  ok: boolean
  issues: ValidationIssue[]
  summary: { itemsCount: number; totalHours: number }
}

export async function validateTemplateApplicability(section_id: string, template_id: string): Promise<ValidationResult> {
  const issues: ValidationIssue[] = []

  // 1) Секция: отдел
  const { data: sec, error: secErr } = await supabase
    .from('view_section_hierarchy_v2')
    .select('section_id, responsible_department_id')
    .eq('section_id', section_id)
    .single()
  if (secErr) throw secErr

  // 2) Шаблон: отдел
  const { data: tpl, error: tplErr } = await supabase
    .from('decomposition_templates')
    .select('decomposition_template_id, decomposition_department_id, decomposition_template_name')
    .eq('decomposition_template_id', template_id)
    .single()
  if (tplErr) throw tplErr

  if (sec && tpl && (sec as any).responsible_department_id && (tpl as any).decomposition_department_id && (sec as any).responsible_department_id !== (tpl as any).decomposition_department_id) {
    issues.push({
      type: 'DEPARTMENT_MISMATCH',
      message: 'Шаблон принадлежит другому отделу и не может быть применён к этому разделу',
      details: { section_department_id: (sec as any).responsible_department_id, template_department_id: (tpl as any).decomposition_department_id },
    })
  }

  // 3) Позиции шаблона + проверка категорий
  const { data: items, error: itemsErr } = await supabase
    .from('decomposition_template_items')
    .select('decomposition_template_item_work_category_id, decomposition_template_item_planned_hours')
    .eq('decomposition_template_item_template_id', template_id)
  if (itemsErr) throw itemsErr
  const itemsArr = (items as any[]) || []
  const itemsCount = itemsArr.length
  const totalHours = itemsArr.reduce((sum, r) => sum + Number(r.decomposition_template_item_planned_hours || 0), 0)

  const catIds = Array.from(new Set(itemsArr.map((r) => r.decomposition_template_item_work_category_id).filter(Boolean)))
  if (catIds.length > 0) {
    const { data: cats, error: catsErr } = await supabase
      .from('work_categories')
      .select('work_category_id')
      .in('work_category_id', catIds)
    if (catsErr) throw catsErr
    const existing = new Set(((cats || []) as any[]).map((c) => c.work_category_id))
    const missing = catIds.filter((id) => !existing.has(id))
    if (missing.length > 0) {
      issues.push({ type: 'MISSING_CATEGORY', message: 'В шаблоне есть позиции с отсутствующими категориями', details: { missing } })
    }
  }

  return { ok: issues.length === 0, issues, summary: { itemsCount, totalHours } }
}
