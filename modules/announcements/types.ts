export interface Announcement {
  id: string;
  header: string;
  text?: string;
  created_at: string;
  created_by: string;
  author_name?: string;
}

export interface AnnouncementFormData {
  header: string;
  text?: string;
}

export interface AnnouncementsState {
  announcements: Announcement[];
  isLoading: boolean;
  error: string | null;
} 