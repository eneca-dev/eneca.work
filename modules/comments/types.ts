export interface SectionComment {
  comment_id: string
  section_id: string
  author_id: string
  content: string
  mentions: string[]
  created_at: string
  // Джойн данные
  author_name: string
  author_avatar_url?: string
}

export interface CommentsState {
  comments: SectionComment[]
  loading: boolean
  error: string | null
  newCommentContent: string
  isSubmitting: boolean
}

// Тип для поиска пользователей в упоминаниях
export interface MentionUser {
  user_id: string
  name: string
  avatar_url?: string
}

 