'use client'

import React, { useCallback, useState, useMemo } from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useCommentsStore } from '../store'
import { ReadOnlyTipTapEditor } from './ReadOnlyTipTapEditor'
import { useHtmlParser } from '../hooks/useHtmlParser'
import type { SectionComment } from '../types'

interface CommentItemProps {
  comment: SectionComment
}

// Функция для умного обрезания HTML контента
function truncateHtmlContent(htmlContent: string, maxChars: number): string {
  if (typeof document === 'undefined') return htmlContent
  
  // Создаем временный элемент для получения текста без тегов
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = htmlContent
  const textContent = tempDiv.textContent || tempDiv.innerText || ''
  
  // Если текст короткий - возвращаем как есть
  if (textContent.length <= maxChars) {
    return htmlContent
  }
  
  // Если текст длинный - нужно обрезать умно
  let charCount = 0
  let truncatedHtml = ''
  const walker = document.createTreeWalker(
    tempDiv,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    null
  )
  
  let node: Node | null
  const elementsStack: string[] = []
  
  while ((node = walker.nextNode()) && charCount < maxChars) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || ''
      const remainingChars = maxChars - charCount
      
      if (text.length <= remainingChars) {
        truncatedHtml += text
        charCount += text.length
      } else {
        // Обрезаем текст по словам для красоты
        const truncatedText = text.slice(0, remainingChars)
        const lastSpaceIndex = truncatedText.lastIndexOf(' ')
        const finalText = lastSpaceIndex > 0 ? truncatedText.slice(0, lastSpaceIndex) : truncatedText
        truncatedHtml += finalText
        charCount += finalText.length
        break
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element
      const tagName = element.tagName.toLowerCase()
      
      // Добавляем открывающий тег
      truncatedHtml += `<${tagName}`
      
      // Добавляем атрибуты
      Array.from(element.attributes).forEach(attr => {
        truncatedHtml += ` ${attr.name}="${attr.value}"`
      })
      
      truncatedHtml += '>'
      elementsStack.push(tagName)
    }
  }
  
  // Закрываем все открытые теги
  while (elementsStack.length > 0) {
    const tagName = elementsStack.pop()
    truncatedHtml += `</${tagName}>`
  }
  
  return truncatedHtml
}

function CommentItemComponent({ comment }: CommentItemProps) {
  const { updateComment } = useCommentsStore()
  const [isExpanded, setIsExpanded] = useState(false)
  
  //  Используем кешированный парсер HTML
  const parseHtml = useHtmlParser()
  
  const authorInitials = comment.author_name
    .split(' ')
    .map(name => name.charAt(0))
    .join('')
    .substring(0, 2)
    .toUpperCase()

  // Заменяем DOM операции на кешированный парсинг
  const { textLength, needsCollapse, displayContent } = useMemo(() => {
    const parsed = parseHtml(comment.content)
    const needsCollapse = parsed.textLength > 300
    
    let content = comment.content
    if (needsCollapse && !isExpanded) {
      content = truncateHtmlContent(comment.content, 300)
    }
    
    return { 
      textLength: parsed.textLength, 
      needsCollapse, 
      displayContent: content 
    }
  }, [comment.content, isExpanded, parseHtml])

  // Единственный callback для автосохранения через TipTap
  const handleContentUpdate = useCallback(async (newContent: string) => {
    try {
      console.log('TipTap автосохранение чекбоксов')
      await updateComment(comment.comment_id, newContent)
      console.log('✅ Успешно сохранено')
    } catch (error) {
      console.error('❌ Ошибка сохранения:', error)
    }
  }, [comment.comment_id, updateComment])

  const handleToggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev)
  }, [])

  return (
    <div className="flex space-x-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
      <Avatar className="w-8 h-8 flex-shrink-0">
        <AvatarImage src={comment.author_avatar_url} alt={comment.author_name} />
        <AvatarFallback className="text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
          {authorInitials}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 space-y-1 min-w-0">
        <div className="flex items-baseline space-x-2">
          <span className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">
            {comment.author_name}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
            {format(new Date(comment.created_at), 'dd.MM.yyyy HH:mm', { locale: ru })}
          </span>
        </div>
        
        <ReadOnlyTipTapEditor 
          content={displayContent}
          commentId={comment.comment_id}
          authorId={comment.author_id} // Передаем ID автора для проверки прав
          onUpdate={handleContentUpdate}
        />
        
        {needsCollapse && (
          <div className="mt-2">
            <button
              onClick={handleToggleExpanded}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium transition-colors cursor-pointer"
            >
              {isExpanded ? 'свернуть' : '...ещё'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// Простая мемоизация компонента - TipTap сам оптимизирует обновления
export const CommentItem = React.memo(CommentItemComponent)
 