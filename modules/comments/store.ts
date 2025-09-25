
import { create } from 'zustand'
import { fetchSectionComments, createSectionComment, updateCommentContent } from './api/comments'
import type { SectionComment } from './types'

interface CommentsStore {
  // Состояние хранится по sectionId, чтобы несколько панелей были независимы
  commentsBySectionId: Record<string, SectionComment[]>
  loadingBySectionId: Record<string, boolean>
  errorBySectionId: Record<string, string | null>
  newCommentContent: string
  isSubmitting: boolean

  // Действия для загрузки данных
  fetchComments: (sectionId: string) => Promise<void>

  // Действия для создания комментариев
  addComment: (sectionId: string, content: string, mentions: string[]) => Promise<void>

  // Действия для обновления комментариев
  updateComment: (commentId: string, newContent: string) => Promise<void>

  // Действия для UI состояния
  setNewCommentContent: (content: string) => void
  clearCommentsFor: (sectionId: string) => void
  clearAll: () => void
  clearErrorFor: (sectionId: string) => void
}

export const useCommentsStore = create<CommentsStore>((set, get) => ({
  // Начальное состояние
  commentsBySectionId: {},
  loadingBySectionId: {},
  errorBySectionId: {},
  newCommentContent: '',
  isSubmitting: false,

  // Загрузка комментариев раздела (изолированно по sectionId)
  fetchComments: async (sectionId: string) => {
    set(state => ({
      loadingBySectionId: { ...state.loadingBySectionId, [sectionId]: true },
      errorBySectionId: { ...state.errorBySectionId, [sectionId]: null },
    }))
    
    try {
      const comments = await fetchSectionComments(sectionId)
      set(state => ({
        commentsBySectionId: { ...state.commentsBySectionId, [sectionId]: comments },
        loadingBySectionId: { ...state.loadingBySectionId, [sectionId]: false },
      }))
    } catch (error) {
      console.error('Ошибка загрузки комментариев:', error)
      set(state => ({
        errorBySectionId: { ...state.errorBySectionId, [sectionId]: 'Ошибка загрузки комментариев' },
        loadingBySectionId: { ...state.loadingBySectionId, [sectionId]: false },
        commentsBySectionId: { ...state.commentsBySectionId, [sectionId]: [] },
      }))
    }
  },

  // Добавление нового комментария
  addComment: async (sectionId: string, content: string, mentions: string[]) => {
    set({ isSubmitting: true })
    try {
      await createSectionComment(sectionId, content, mentions)

      await get().fetchComments(sectionId)
      set({ newCommentContent: '', isSubmitting: false })
    } catch (error) {
      console.error('Ошибка добавления комментария:', error)
      set(state => ({
        errorBySectionId: { ...state.errorBySectionId, [sectionId]: error instanceof Error ? error.message : 'Ошибка при добавлении комментария' },
        isSubmitting: false,
      }))
    }
  },

  // Обновление содержимого комментария (например, состояние чекбоксов)
  updateComment: async (commentId: string, newContent: string) => {
    try {
      await updateCommentContent(commentId, newContent)
      // Обновляем во всех разделах, где присутствует комментарий
      const { commentsBySectionId } = get()
      const updated: Record<string, SectionComment[]> = {}
      for (const [secId, list] of Object.entries(commentsBySectionId)) {
        updated[secId] = list.map(c => c.comment_id === commentId ? { ...c, content: newContent } : c)
      }
      set({ commentsBySectionId: updated })
    } catch (error) {
      console.error('Ошибка обновления комментария:', error)
    }
  },

  // Действия для UI состояния
  setNewCommentContent: (content: string) => set({ newCommentContent: content }),

  clearCommentsFor: (sectionId: string) => set(state => ({
    commentsBySectionId: { ...state.commentsBySectionId, [sectionId]: [] },
    errorBySectionId: { ...state.errorBySectionId, [sectionId]: null },
    loadingBySectionId: { ...state.loadingBySectionId, [sectionId]: false },
  })),

  clearAll: () => set({
    commentsBySectionId: {},
    errorBySectionId: {},
    loadingBySectionId: {},
    newCommentContent: '',
    isSubmitting: false,
  }),

  clearErrorFor: (sectionId: string) => set(state => ({
    errorBySectionId: { ...state.errorBySectionId, [sectionId]: null }
  })),
}))

 