import { useCallback } from 'react'
import { searchUsersForMentions } from '../api/comments'
import type { MentionUser } from '../types'

export function useMentions() {
  /**
   * Поиск пользователей для предложений упоминаний
   */
  const searchUsers = useCallback(async (query: string, sectionId: string): Promise<MentionUser[]> => {
    try {
      return await searchUsersForMentions(query, sectionId)
    } catch (error) {
      console.error('Ошибка поиска пользователей:', error)
      return []
    }
  }, [])

  /**
   * Извлекает ID упомянутых пользователей из HTML контента
   */
  const extractMentions = useCallback((htmlContent: string): string[] => {
    if (!htmlContent) return []
    
    // Попробуем разные варианты регулярных выражений для TipTap
    const patterns = [
      /<span[^>]*data-id=["']([^"']+)["'][^>]*>/g,                    // data-id первый
      /<span[^>]*data-mention-id=["']([^"']+)["'][^>]*>/g,           // data-mention-id
      /<mention[^>]*data-id=["']([^"']+)["'][^>]*>/g,                // mention tag
      /<span[^>]*class="[^"]*mention[^"]*"[^>]*data-id=["']([^"']+)["'][^>]*>/g, // class mention
      // Дополнительные гибкие паттерны
      /data-id=["']([^"']+)["']/g,                                   // просто data-id где угодно
      /<[^>]*data-id=["']([^"']+)["'][^>]*>/g,                       // любой тег с data-id
    ]
    
    const mentions: string[] = []
    
    patterns.forEach((pattern) => {
      pattern.lastIndex = 0 // Сбрасываем regex
      let match
      let patternMatches = 0
      while ((match = pattern.exec(htmlContent)) !== null) {
        mentions.push(match[1])
        patternMatches++
        // Защита от бесконечных циклов
        if (patternMatches > 100) break
      }
    })

    const uniqueMentions = [...new Set(mentions)] // Убираем дубликаты
    
    // Если ничего не нашли через HTML, пробуем fallback
    if (uniqueMentions.length === 0) {
      // Ищем все возможные форматы упоминаний
      const fallbackPatterns = [
        /@\[([^\]]+)\]\(([^)]+)\)/g,           // @[Name](id) формат
        /data-id=["']([^"']+)["']/g,           // любые data-id в тексте
        /<[^>]*data-id=["']([^"']+)["'][^>]*>/g // любые теги с data-id
      ]
      
      fallbackPatterns.forEach((pattern) => {
        pattern.lastIndex = 0
        let match
        while ((match = pattern.exec(htmlContent)) !== null) {
          const mentionId = match[2] || match[1] // берем второй захват или первый
          if (mentionId && mentionId.length > 10) { // проверяем что это похоже на UUID
            uniqueMentions.push(mentionId)
          }
        }
      })
    }
    
    return uniqueMentions
  }, [])
  
  /**
   * Заменяет набранный текст на mention node
   */
  const replaceMentionText = useCallback((editor: any, mentionData: { id: string, label: string }) => {
    const { state } = editor.view
    const { selection } = state
    const { from, to } = selection
    
    const textBeforeCursor = state.doc.textBetween(Math.max(0, from - 50), from, '\n', '\0')
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')
    
    if (lastAtIndex !== -1) {
      const mentionStart = from - (textBeforeCursor.length - lastAtIndex)
      const mentionEnd = to
      
      editor
        .chain()
        .focus()
        .deleteRange({ from: mentionStart, to: mentionEnd })
        .insertContent({
          type: 'mention',
          attrs: {
            id: mentionData.id,
            label: mentionData.label,
          },
        })
        .run()
    }
  }, [])

  /**
   * Создает объект рендеринга для TipTap Mention extension
   */
    const renderMentionSuggestion = useCallback(() => {

    return () => {
      let component: any
      let popup: any
      let currentEditor: any  // Сохраняем ссылку на editor

      // Общая функция для рендеринга предложений
      const renderSuggestions = () => {
        if (!popup || !component) return
        
        popup.innerHTML = component.suggestions.map((suggestion: MentionUser, index: number) => 
          `<div class="mention-suggestion-item px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 border-l-2 border-transparent hover:border-blue-500 ${
            index === component.selectedIndex ? 'bg-blue-100 dark:bg-blue-900 border-l-2 border-blue-500' : ''
          }" data-index="${index}">
            <div class="flex items-center space-x-2">
              ${suggestion.avatar_url ? 
                `<img src="${suggestion.avatar_url}" alt="${suggestion.name}" class="w-6 h-6 rounded-full border border-gray-200 dark:border-gray-600">` :
                `<div class="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-xs font-bold text-white">${suggestion.name.charAt(0).toUpperCase()}</div>`
              }
              <span class="text-sm font-medium text-gray-900 dark:text-gray-100">${suggestion.name}</span>
            </div>
          </div>`
        ).join('')
        
        // Добавляем обработчики кликов
        popup.querySelectorAll('.mention-suggestion-item').forEach((item: any) => {
          item.addEventListener('click', (e: Event) => {
            e.preventDefault()
            e.stopPropagation()
            const index = parseInt(item.dataset.index)
            if (component) {
              component.selectItem(index)
            }
          })
        })
      }

      // Общая функция для позиционирования popup
      const positionPopup = (propsRef: any) => {
        try {
          if (!popup || !popup.parentNode) return
          
          const rect = propsRef.clientRect()
          if (!rect) return
          
          let left = rect.left
          let top = rect.bottom + 8
          
          const popupRect = popup.getBoundingClientRect()
          
          // Корректируем позицию
          if (left + popupRect.width > window.innerWidth) {
            left = window.innerWidth - popupRect.width - 10
          }
          if (left < 10) {
            left = 10
          }
          
          if (top + popupRect.height > window.innerHeight) {
            top = rect.top - popupRect.height - 8
          }
          if (top < 10) {
            top = rect.bottom + 8
          }
          
          popup.style.left = `${left}px`
          popup.style.top = `${top}px`
        } catch (error) {
          console.error('Ошибка позиционирования popup:', error)
        }
      }

      return {
        onStart: (props: any) => {
          currentEditor = props.editor
          
          component = {
            suggestions: props.items || [],
            selectedIndex: 0,
            selectItem: (index: number) => {
              const item = component.suggestions[index]
              if (item && currentEditor) {
                replaceMentionText(currentEditor, {
                  id: item.user_id,
                  label: item.name
                })
                
                if (popup && popup.parentNode) {
                  popup.parentNode.removeChild(popup)
                }
              }
            },
            upHandler: () => {
              component.selectedIndex = ((component.selectedIndex + component.suggestions.length - 1) % component.suggestions.length)
              renderSuggestions()
              return true
            },
            downHandler: () => {
              component.selectedIndex = ((component.selectedIndex + 1) % component.suggestions.length)
              renderSuggestions()
              return true
            },
            enterHandler: () => {
              component.selectItem(component.selectedIndex)
              return true
            }
          }

          if (component.suggestions.length === 0) {
            return
          }

          // Создаем dropdown элемент
          popup = document.createElement('div')
          popup.className = 'mention-suggestions fixed z-[9999] bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg shadow-xl max-h-48 overflow-y-auto min-w-[200px]'
          popup.style.fontSize = '14px'

          renderSuggestions()
          document.body.appendChild(popup)

          // Позиционируем popup
          positionPopup(props)
          setTimeout(() => positionPopup(props), 50)
        },
        
        onUpdate: (props: any) => {
          currentEditor = props.editor
          
          // Если popup не существует, пересоздаем его
          if (!popup || !popup.parentNode) {
            popup = document.createElement('div')
            popup.className = 'mention-suggestions fixed z-[9999] bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg shadow-xl max-h-48 overflow-y-auto min-w-[200px]'
            popup.style.fontSize = '14px'
            document.body.appendChild(popup)
          }
          
          // Если component не существует, инициализируем его
          if (!component) {
            component = {
              suggestions: [],
              selectedIndex: 0,
              selectItem: (index: number) => {
                const item = component.suggestions[index]
                if (item && currentEditor) {
                  replaceMentionText(currentEditor, {
                    id: item.user_id,
                    label: item.name
                  })
                  
                  if (popup && popup.parentNode) {
                    popup.parentNode.removeChild(popup)
                  }
                }
              },
              upHandler: () => {
                component.selectedIndex = ((component.selectedIndex + component.suggestions.length - 1) % component.suggestions.length)
                renderSuggestions()
                return true
              },
              downHandler: () => {
                component.selectedIndex = ((component.selectedIndex + 1) % component.suggestions.length)
                renderSuggestions()
                return true
              },
              enterHandler: () => {
                component.selectItem(component.selectedIndex)
                return true
              }
            }
          }
          
          component.suggestions = props.items || []
          component.selectedIndex = 0
          
          if (component.suggestions.length === 0) {
            if (popup && popup.parentNode) {
              popup.parentNode.removeChild(popup)
            }
            return
          }
          
          renderSuggestions()
          positionPopup(props)
        },
        
        onKeyDown: (props: any) => {
          if (props.event.key === 'ArrowUp') {
            component.upHandler()
            return true
          }
          
          if (props.event.key === 'ArrowDown') {
            component.downHandler()
            return true
          }
          
          if (props.event.key === 'Enter') {
            component.enterHandler()
            return true
          }
          
          return false
        },
        
        onExit: () => {
          if (popup && popup.parentNode) {
            popup.parentNode.removeChild(popup)
          }
          component = null
          popup = null
        },
      }
    }
  }, [])

  return {
    extractMentions,
    renderMentionSuggestion,
    searchUsers
  }
} 
