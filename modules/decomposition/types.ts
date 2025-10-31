export interface DecompositionItem {
  id?: string
  work_type: string
  work_content: string
  labor_costs: number
  duration_days: number
  execution_period: number
  complexity_level?: string | number
  decomposition_item_stage_id?: string | null
}

export interface DecompositionData {
  decomposition_id: string
  decomposition_creator_id: string
  decomposition_section_id: string
  decomposition_content: DecompositionItem[]
}

// Добавляем новый интерфейс для шаблонов декомпозиций
export interface DecompositionTemplate {
  decomposition_template_id: string
  decomposition_template_name: string
  decomposition_department_id: string
  department_name?: string
  decomposition_template_creator_id: string
  creator_name?: string
  decomposition_template_created_at: string
  decomposition_template_content: DecompositionItem[]
}

// Обновленная структура на основе public_schema_tables.md
export interface SectionHierarchy {
  section_id: string
  section_name: string
  object_id: string
  object_name: string
  stage_id: string
  stage_name: string
  project_id: string
  project_name: string
  client_id: string
  client_name: string
  project_lead_engineer_id: string
  project_lead_engineer_name: string
  project_manager_id: string
  project_manager_name: string
  section_responsible_id: string
  section_responsible_name: string
  responsible_department_id: string
  responsible_department_name: string
}

export interface DecompositionStage {
  decomposition_stage_id: string
  decomposition_stage_section_id: string
  decomposition_stage_name: string
  decomposition_stage_description: string | null
  decomposition_stage_start: string | null // date ISO
  decomposition_stage_finish: string | null // date ISO
  decomposition_stage_order: number
}

export type TabType = "view" | "create" | "templates" | "stages"
