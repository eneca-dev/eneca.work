export interface Project {
  project_id: string;
  project_name: string;
  project_description?: string;
  project_manager: string;
  project_lead_engineer?: string;
  project_status: 'active' | 'archive' | 'paused' | 'canceled';
  project_created: string;
  project_updated: string;
  client_id: string;
}

export interface Stage {
  stage_id: string;
  stage_name: string;
  stage_description?: string;
}

export interface Object {
  object_id: string;
  object_name: string;
  object_description?: string;
  object_stage_id: string;
  object_responsible?: string;
  object_start_date?: string;
  object_end_date?: string;
  object_created: string;
  object_updated: string;
}

export interface Section {
  section_id: string;
  section_name: string;
  section_description?: string;
  section_responsible?: string;
  section_project_id: string;
  section_created: string;
  section_updated: string;
  section_object_id?: string;
  section_type?: string;
  section_start_date?: string;
  section_end_date?: string;
  section_status_id?: string;
}

export interface ProjectHierarchyNode {
  project_id: string;
  project_name: string;
  project_manager_name?: string;
  project_manager_avatar?: string;
  stages?: StageHierarchyNode[];
}

export interface StageHierarchyNode {
  stage_id: string;
  stage_name: string;
  objects?: ObjectHierarchyNode[];
}

export interface ObjectHierarchyNode {
  object_id: string;
  object_name: string;
  sections?: SectionHierarchyNode[];
}

export interface SectionHierarchyNode {
  section_id: string;
  section_name: string;
  section_responsible_name?: string;
  section_responsible_avatar?: string;
  section_start_date?: string;
  section_end_date?: string;
  total_loading_rate?: number;
  tasks_count?: number;
}

export interface ProjectFilters {
  managerId: string | null;
  projectId: string | null;
  stageId: string | null;
  objectId: string | null;
  departmentId: string | null;
  teamId: string | null;
  employeeId: string | null;
} 