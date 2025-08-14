export interface ProjectInfo {
  project_id: string;
  project_name: string;
  project_description?: string;
  project_status: string;
  project_created: string;
  project_updated: string;
  manager?: {
    user_id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  };
  lead_engineer?: {
    user_id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  };
  client?: {
    client_id: string;
    client_name: string;
  };
  // Статистика задач (добавляется динамически)
  total_tasks?: number;
  total_hours?: number;
  completed_tasks?: number;
  completed_hours?: number;
  in_progress_tasks?: number;
  in_progress_hours?: number;
  total_assignments?: number;
}

// Общий интерфейс для диаграмм статусов
export interface ChartDataItem {
  name: string;
  value: number;
  color: string;
}

// Типы для комментариев
export interface CommentItem {
  id: string;
  section_id: string;
  user: string;
  comment: string;
  time: string;
}

// Типы для Supabase ответов
export interface SectionComment {
  comment_id: string;
  section_id: string;
  content: string;
  created_at: string;
  author_id: string;
  sections: Array<{
    section_id: string;
    section_project_id: string;
  }>;
}

export interface UserProfile {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export interface Task {
  task_id: string;
  task_status: string;
  task_completed: string | null;
  task_parent_section: string;
  loadings: Array<{
    loading_start: string;
    loading_finish: string;
    loading_rate: number;
    loading_status: string;
  }>;
}

// Интерфейс для статистики проекта
export interface ProjectStatistics {
  stages_count: number;
  objects_count: number;
  sections_count: number;
  total_tasks: number;
  total_hours: number;
}

// Используем только named exports для интерфейсов