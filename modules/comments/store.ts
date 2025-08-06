
import { create } from 'zustand'
import { fetchSectionComments, createSectionComment, updateCommentContent } from './api/comments'
import { sendCommentNotifications } from './utils/notificationHelpers'
import type { SectionComment, CommentsState } from './types'

interface CommentsStore extends CommentsState {
  // Действия для загрузки данных
  fetchComments: (sectionId: string) => Promise<void>
  
  // Действия для создания комментариев
  addComment: (sectionId: string, content: string, mentions: string[]) => Promise<void>
  
  // Действия для обновления комментариев
  updateComment: (commentId: string, newContent: string) => Promise<void>
  
  // Действия для UI состояния
  setNewCommentContent: (content: string) => void
  clearComments: () => void
  clearError: () => void
}

export const useCommentsStore = create<CommentsStore>((set, get) => ({
  // Начальное состояние
  comments: [],
  loading: false,
  error: null,
  newCommentContent: '',
  isSubmitting: false,

  // Загрузка комментариев раздела
  fetchComments: async (sectionId: string) => {
    set({ loading: true, error: null })
    
    try {
      const comments = await fetchSectionComments(sectionId)
      set({ comments, loading: false })
    } catch (error) {
      console.error('Ошибка загрузки комментариев:', error)
      set({ 
        error: 'Ошибка загрузки комментариев', 
        loading: false,
        comments: [] 
      })
    }
  },

  // Добавление нового комментария
  addComment: async (sectionId: string, content: string, mentions: string[]) => {
    set({ isSubmitting: true, error: null })
    
    try {
      // 1. Создаем комментарий в БД
      await createSectionComment(sectionId, content, mentions)
      
      // 2. Отправляем уведомления (не блокирующе)
      sendCommentNotifications(sectionId, mentions, content)
        .catch((error: any) => console.error('Ошибка уведомлений:', error))
      
      // 3. Перезагружаем список комментариев
      await get().fetchComments(sectionId)
      
      // 4. Сбрасываем состояние формы
      set({ newCommentContent: '', isSubmitting: false })
      console.log('Комментарий успешно добавлен')
      
    } catch (error) {
      console.error('Ошибка добавления комментария:', error)
      set({ 
        error: error instanceof Error ? error.message : 'Ошибка при добавлении комментария', 
        isSubmitting: false 
      })
    }
  },

  // Обновление содержимого комментария (например, состояние чекбоксов)
  updateComment: async (commentId: string, newContent: string) => {
    try {
      // Обновляем в базе данных
      await updateCommentContent(commentId, newContent)
      
      // Обновляем в локальном состоянии
      const currentComments = get().comments
      const updatedComments = currentComments.map(comment => 
        comment.comment_id === commentId 
          ? { ...comment, content: newContent }
          : comment
      )
      
      set({ comments: updatedComments })
      console.log('Комментарий успешно обновлен')
      
    } catch (error) {
      console.error('Ошибка обновления комментария:', error)
      set({ 
        error: error instanceof Error ? error.message : 'Ошибка при обновлении комментария'
      })
    }
  },

  // Действия для UI состояния
  setNewCommentContent: (content: string) => set({ newCommentContent: content }),
  
  clearComments: () => set({ 
    comments: [], 
    error: null,
    newCommentContent: '',
    loading: false,
    isSubmitting: false
  }),
  
  clearError: () => set({ error: null })
}))

 