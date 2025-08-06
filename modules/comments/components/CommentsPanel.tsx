'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'
import { useCommentsStore } from '../store'
import { CommentsList } from './CommentsList'
import { CommentEditor } from './CommentEditor'

interface CommentsPanelProps {
  sectionId: string
}

export function CommentsPanel({ sectionId }: CommentsPanelProps) {
  //  Используем стабильные селекторы вместо деструктуризации
  const comments = useCommentsStore(state => state.comments)
  const loading = useCommentsStore(state => state.loading)
  const error = useCommentsStore(state => state.error)
  const isSubmitting = useCommentsStore(state => state.isSubmitting)
  const fetchCommentsStable = useCommentsStore(state => state.fetchComments)
  const addCommentStable = useCommentsStore(state => state.addComment)
  const clearCommentsStable = useCommentsStore(state => state.clearComments)
  const clearErrorStable = useCommentsStore(state => state.clearError)

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  // Ref для элемента-маркера в конце списка
  const scrollAnchorRef = useRef<HTMLDivElement>(null)

  //  Надежная функция автоскролла до самого конца
  const scrollToBottom = () => {
    if (scrollContainerRef.current && scrollAnchorRef.current) {
      // Комбинированный подход: scrollIntoView + fallback с scrollTop
      scrollAnchorRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start',
        inline: 'nearest'
      })
      
      // Дополнительно: убеждаемся что дошли до самого конца
      setTimeout(() => {
        if (scrollContainerRef.current) {
          const container = scrollContainerRef.current
          const maxScroll = container.scrollHeight - container.clientHeight
          if (container.scrollTop < maxScroll - 10) { // Если не дошли до конца
            container.scrollTop = maxScroll // Принудительно скроллим до конца
          }
        }
      }, 300) // После завершения smooth анимации
    }
  }

  useEffect(() => {
    if (sectionId) {
      fetchCommentsStable(sectionId)
    }

    return () => {
      clearCommentsStable()
    }
  }, [sectionId]) // Только стабильная зависимость sectionId

  // Используем useLayoutEffect для синхронного скролла после рендера
  useLayoutEffect(() => {
    if (!loading && comments.length > 0) {
      // Скроллим к последнему комментарию сразу после рендера DOM
      requestAnimationFrame(() => {
        scrollToBottom()
      })
    }
  }, [loading, comments.length, comments[comments.length - 1]?.comment_id]) // Отслеживаем последний комментарий

  const handleAddComment = async (content: string, mentions: string[]) => {
    try {
      await addCommentStable(sectionId, content, mentions)
      // Используем requestAnimationFrame вместо setTimeout
      requestAnimationFrame(() => {
        scrollToBottom()
      })
    } catch (error) {
      console.error('Ошибка добавления комментария:', error)
    }
  }

  return (
    <div className="h-full flex flex-col max-w-full relative">

      {/* Сообщение об ошибке */}
      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-2">
              <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
            </div>
            <button
              onClick={clearErrorStable}
              className="text-red-500 hover:text-red-700 dark:hover:text-red-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Список комментариев */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto min-h-0 pb-4 max-w-full overflow-x-hidden flex flex-col"
      >
        <CommentsList comments={comments} loading={loading} />
        {/* Увеличенный элемент-маркер для точного скролла */}
        <div 
          ref={scrollAnchorRef} 
          className="h-6 w-full pb-4" 
          aria-hidden="true"
        />
      </div>

      {/* Редактор комментария - зафиксирован внизу */}
      <div className="sticky bottom-0 bg-white dark:bg-slate-900 z-10">
        <CommentEditor
          sectionId={sectionId}
          onSubmit={handleAddComment}
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  )
} 