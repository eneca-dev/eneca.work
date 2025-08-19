export interface DecompositionTemplate {
  id: string
  department_id: string
  name: string
  description?: string | null
  is_active: boolean
  created_by?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface DecompositionTemplateItem {
  id: string
  template_id: string
  description: string
  work_category_id: string
  planned_hours: number
  due_offset_days?: number | null
  order: number
}

export interface CreateTemplatePayload {
  department_id: string
  name: string
  description?: string
  is_active?: boolean
}

export interface UpdateTemplatePayload {
  name?: string
  description?: string
  is_active?: boolean
}

export interface CreateTemplateItemPayload {
  template_id: string
  description: string
  work_category_id: string
  planned_hours?: number
  due_offset_days?: number | null
  order?: number
}

export interface UpdateTemplateItemPayload {
  description?: string
  work_category_id?: string
  planned_hours?: number
  due_offset_days?: number | null
  order?: number
}
