// Основные типы для модуля статусов и тегов

export interface SectionStatus {
  id: string;
  name: string;
  color: string;
  description?: string;
}

export interface StatusesTagsState {
  sectionStatuses: SectionStatus[];
  isLoading: boolean;
  error: string | null;
} 