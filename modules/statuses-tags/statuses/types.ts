// Типы для работы со статусами секций проектов

export interface SectionStatus {
  id: string;
  name: string;
  color: string;
  description?: string;
}

export interface SectionStatusFormData {
  name: string;
  color: string;
  description?: string;
}

export interface SectionStatusesState {
  statuses: SectionStatus[];
  isLoading: boolean;
  error: Error | null;
  selectedStatus: SectionStatus | null;
} 