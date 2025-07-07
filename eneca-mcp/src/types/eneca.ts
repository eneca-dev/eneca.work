/**
 * Типы для работы с системой планирования проектов Eneca
 * Основаны на реальной структуре БД Supabase
 */

// ===== ОСНОВНЫЕ ТИПЫ ДАННЫХ =====

export interface Profile {
  user_id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  avatar_url?: string;
  department_id?: string;
  team_id?: string;
  role_id?: string;
}

export interface Project {
  project_id: string;
  project_name: string;
  project_description?: string;
  project_manager?: string;
  project_lead_engineer?: string;
  project_status?: string;
  project_created?: string;
  project_updated?: string;
  client_id?: string;
  external_id?: string;
  external_source?: string;
  external_updated_at?: string;
}

export interface Stage {
  stage_id: string;
  stage_name: string;
  stage_description?: string;
  stage_project_id: string;
  stage_created?: string;
  stage_updated?: string;
  external_id?: string;
  external_source?: string;
  external_updated_at?: string;
}

export interface ObjectEntity {
  object_id: string;
  object_name: string;
  object_description?: string;
  object_stage_id: string;
  object_responsible?: string;
  object_start_date?: string;
  object_end_date?: string;
  object_created?: string;
  object_updated?: string;
  object_project_id: string;
  external_id?: string;
  external_source?: string;
  external_updated_at?: string;
}

export interface Section {
  section_id: string;
  section_name: string;
  section_description?: string;
  section_responsible?: string;
  section_project_id: string;
  section_created?: string;
  section_updated?: string;
  section_object_id: string;
  section_type?: string;
  section_start_date?: string;
  section_end_date?: string;
  external_id?: string;
  external_source?: string;
  external_updated_at?: string;
}

export interface Client {
  client_id: string;
  client_name: string;
  client_description?: string;
  client_contact_person?: string;
  client_phone?: string;
  client_email?: string;
  client_address?: string;
  client_created?: string;
  client_updated?: string;
}

// ===== ТИПЫ ДЛЯ СОЗДАНИЯ ЗАПИСЕЙ =====

export interface CreateProjectInput {
  project_name: string;
  project_description?: string;
  project_manager?: string;
  project_lead_engineer?: string;
  project_status?: string;
  client_id?: string;
}

export interface CreateStageInput {
  stage_name: string;
  stage_description?: string;
  stage_project_id: string;
}

export interface CreateObjectInput {
  object_name: string;
  object_description?: string;
  object_stage_id: string;
  object_responsible?: string;
  object_start_date?: string;
  object_end_date?: string;
  object_project_id: string;
}

export interface CreateSectionInput {
  section_name: string;
  section_description?: string;
  section_responsible?: string;
  section_project_id: string;
  section_object_id: string;
  section_type?: string;
  section_start_date?: string;
  section_end_date?: string;
}

// ===== ТИПЫ ДЛЯ ОБНОВЛЕНИЯ ЗАПИСЕЙ =====

export interface UpdateProjectInput {
  project_id: string;
  project_name?: string;
  project_description?: string;
  project_manager?: string;
  project_lead_engineer?: string;
  project_status?: string;
  client_id?: string;
}

export interface UpdateStageInput {
  stage_id: string;
  stage_name?: string;
  stage_description?: string;
  stage_project_id?: string;
}

export interface UpdateObjectInput {
  object_id: string;
  object_name?: string;
  object_description?: string;
  object_stage_id?: string;
  object_responsible?: string;
  object_start_date?: string;
  object_end_date?: string;
  object_project_id?: string;
}

export interface UpdateSectionInput {
  section_id: string;
  section_name?: string;
  section_description?: string;
  section_responsible?: string;
  section_project_id?: string;
  section_object_id?: string;
  section_type?: string;
  section_start_date?: string;
  section_end_date?: string;
}

// ===== ТИПЫ ДЛЯ РЕЗУЛЬТАТОВ ОПЕРАЦИЙ =====

export interface OperationResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface CascadeDeleteInfo {
  sections: number;
  objects: number;
  stages: number;
  total: number;
}

// ===== ТИПЫ ДЛЯ ФИЛЬТРАЦИИ =====

export interface ProjectFilters {
  manager?: string;
  status?: string;
  client_id?: string;
  limit?: number;
  offset?: number;
}

export interface StageFilters {
  project_id?: string;
  limit?: number;
  offset?: number;
}

export interface ObjectFilters {
  project_id?: string;
  stage_id?: string;
  responsible?: string;
  limit?: number;
  offset?: number;
}

export interface SectionFilters {
  project_id?: string;
  object_id?: string;
  responsible?: string;
  section_type?: string;
  limit?: number;
  offset?: number;
} 