// Основные компоненты
export { CommentsPanel } from './components/CommentsPanel'
export { CommentsList } from './components/CommentsList'
export { CommentItem } from './components/CommentItem'
export { CommentEditor } from './components/CommentEditor'
export { ReadOnlyTipTapEditor } from './components/ReadOnlyTipTapEditor'


// Хуки
export { useMentions } from './hooks/useMentions'

// Store
export { useCommentsStore } from './store'

// Типы
export type {
  SectionComment,
  CommentsState,
  MentionUser
} from './types'

// API функции
export {
  fetchSectionComments,
  createSectionComment,
  searchUsersForMentions,
  updateCommentContent
} from './api/comments'

// Утилиты
export { extractMentions } from './utils/mentionParser'
 