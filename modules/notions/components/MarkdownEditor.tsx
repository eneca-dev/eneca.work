'use client'

import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Bold, Italic, Underline, List, Type, Hash } from 'lucide-react'
import { combineNotionContent, markdownToHtml, htmlToMarkdown } from '../utils'
import React from 'react'

interface MarkdownEditorProps {
  initialTitle?: string
  initialValue: string
  onSave: (content: string) => void
  onCancel: () => void
  placeholder?: string
  titlePlaceholder?: string
  autoFocus?: boolean
  showTitle?: boolean
  startInPreview?: boolean
}

export function MarkdownEditor({ 
  initialTitle = "",
  initialValue, 
  onSave, 
  onCancel, 
  placeholder = "Введите текст заметки...",
  titlePlaceholder = "Заголовок заметки",
  autoFocus = true,
  showTitle = true,
  startInPreview = false
}: MarkdownEditorProps) {
  const [title, setTitle] = useState(initialTitle)
  const titleRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<MutationObserver | null>(null)
  const hasChangedRef = useRef(false)

  // Отслеживание изменений
  useEffect(() => {
    const checkChanges = () => {
      const editorContent = editorRef.current?.innerHTML || ''
      const markdownContent = htmlToMarkdown(editorContent)
      const combinedContent = combineNotionContent(title.trim(), markdownContent.trim())
      const originalCombined = combineNotionContent(initialTitle, initialValue)
      
      hasChangedRef.current = combinedContent !== originalCombined
    }

    checkChanges()
  }, [title, initialTitle, initialValue])

  // Автосохранение при закрытии страницы/браузера
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChangedRef.current) {
        handleSave()
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && hasChangedRef.current) {
        handleSave()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // Обработчик кликов по чекбоксам
  const handleCheckboxClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' && target.getAttribute('type') === 'checkbox') {
      e.stopPropagation()
      const checkbox = target as HTMLInputElement
      checkbox.checked = !checkbox.checked
      
      // Обновляем визуальное состояние
      const parentDiv = checkbox.closest('.checkbox-line')
      if (parentDiv) {
        const textSpan = parentDiv.querySelector('span')
        if (textSpan) {
          if (checkbox.checked) {
            textSpan.classList.add('line-through', 'opacity-60')
          } else {
            textSpan.classList.remove('line-through', 'opacity-60')
          }
        }
      }
    }
  }

  // Инициализация содержимого редактора и MutationObserver
  useEffect(() => {
    if (editorRef.current && initialValue) {
      editorRef.current.innerHTML = markdownToHtml(initialValue)
    }

    // Настройка MutationObserver для отслеживания изменений в редакторе
    if (editorRef.current) {
      observerRef.current = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            // Проверяем добавленные узлы
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as Element
                applyHeaderClass(element)
              }
            })
          } else if (mutation.type === 'characterData' && mutation.target.parentElement) {
            // Проверяем изменения текста в заголовках
            applyHeaderClass(mutation.target.parentElement)
          }
        })
      })

      observerRef.current.observe(editorRef.current, {
        childList: true,
        subtree: true,
        characterData: true
      })
      
      // Добавляем обработчик кликов по чекбоксам
      editorRef.current.addEventListener('click', handleCheckboxClick)
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
      if (editorRef.current) {
        editorRef.current.removeEventListener('click', handleCheckboxClick)
      }
    }
  }, [])

  useEffect(() => {
    if (autoFocus) {
      // Даем время на рендер и затем фокусируемся
      setTimeout(() => {
        if (showTitle && titleRef.current && !title.trim()) {
          titleRef.current.focus()
        } else if (editorRef.current) {
          editorRef.current.focus()
        }
      }, 100)
    }
  }, [autoFocus, showTitle])

  // Функция для применения классов к заголовкам
  const applyHeaderClass = (element: Element) => {
    if (['H1', 'H2', 'H3'].includes(element.tagName)) {
      const headerClass = element.tagName === 'H1' ? 'text-2xl font-bold mt-4 mb-2' :
                         element.tagName === 'H2' ? 'text-xl font-bold mt-4 mb-2' :
                         'text-lg font-bold mt-4 mb-2'
      element.className = headerClass
    }
    
    // Также проверяем дочерние элементы
    element.querySelectorAll('h1, h2, h3').forEach(header => {
      const headerClass = header.tagName === 'H1' ? 'text-2xl font-bold mt-4 mb-2' :
                         header.tagName === 'H2' ? 'text-xl font-bold mt-4 mb-2' :
                         'text-lg font-bold mt-4 mb-2'
      header.className = headerClass
    })
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 's':
          e.preventDefault()
          handleSave()
          break
        case 'Enter':
          e.preventDefault()
          handleSave()
          break
        case 'b':
        case 'и':
          e.preventDefault()
          formatText('bold')
          break
        case 'i':
        case 'ш':
          e.preventDefault()
          formatText('italic')
          break
        case 'u':
        case 'г':
          e.preventDefault()
          formatText('underline')
          break
        case '1':
          e.preventDefault()
          formatText('h1')
          break
        case '2':
          e.preventDefault()
          formatText('h2')
          break
        case '3':
          e.preventDefault()
          formatText('h3')
          break
      }
    }

    if (e.key === 'Escape') {
      onCancel()
    }

    // Автоматическое создание чекбоксов при вводе "- [ ]" или "- [x]"
    if (e.key === ']') {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        const container = range.startContainer
        
        if (container.nodeType === Node.TEXT_NODE) {
          const textContent = container.textContent || ''
          const cursorPosition = range.startOffset
          
          // Проверяем шаблоны для чекбоксов
          const beforeCursor = textContent.substring(0, cursorPosition)
          const checkboxPattern = /- \[([ x])\]$/
          const match = beforeCursor.match(checkboxPattern)
          
          if (match) {
            e.preventDefault()
            
            const isChecked = match[1] === 'x'
            const parentElement = container.parentElement || editorRef.current
            
                         // Создаем checkbox-line элемент
             const checkboxDiv = document.createElement('div')
             checkboxDiv.className = 'checkbox-line'
             const remainingText = textContent.substring(cursorPosition)
             checkboxDiv.innerHTML = `<input type="checkbox" ${isChecked ? 'checked' : ''} class="mr-2"> <span${isChecked ? ' class="line-through opacity-60"' : ''}>${remainingText}</span>`
             
             // Заменяем текущий элемент на checkbox
             if (container.parentElement && container.parentElement !== editorRef.current) {
               container.parentElement.replaceWith(checkboxDiv)
             } else {
               // Если мы в корневом элементе, удаляем шаблон и вставляем checkbox
               container.textContent = ''
               range.insertNode(checkboxDiv)
             }
             
             // Устанавливаем курсор в span после чекбокса
             const newRange = document.createRange()
             const span = checkboxDiv.querySelector('span')
             if (span) {
               newRange.setStart(span, span.textContent?.length || 0)
               newRange.collapse(true)
               selection.removeAllRanges()
               selection.addRange(newRange)
             }
          }
        }
      }
    }

    // Автоматическое создание bullet list при вводе "- "
    if (e.key === ' ') {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        const container = range.startContainer
        
        if (container.nodeType === Node.TEXT_NODE) {
          const textContent = container.textContent || ''
          const cursorPosition = range.startOffset
          
          // Проверяем, что текст начинается с "-" и курсор после дефиса
          if (textContent === '-' && cursorPosition === 1) {
            e.preventDefault()
            
            const parentElement = container.parentElement || editorRef.current
            
            // Создаем bullet-line элемент
            const bulletDiv = document.createElement('div')
            bulletDiv.className = 'bullet-line'
            bulletDiv.innerHTML = '•&nbsp;'
            
            // Заменяем текущий элемент на bullet
            if (container.parentElement && container.parentElement !== editorRef.current) {
              container.parentElement.replaceWith(bulletDiv)
            } else {
              // Если мы в корневом элементе, удаляем текст и вставляем bullet
              container.textContent = ''
              range.insertNode(bulletDiv)
            }
            
            // Устанавливаем курсор в конец bullet строки
            const newRange = document.createRange()
            newRange.setStart(bulletDiv.childNodes[1] || bulletDiv, bulletDiv.childNodes[1] ? 1 : 0)
            newRange.collapse(true)
            selection.removeAllRanges()
            selection.addRange(newRange)
          }
        }
      }
    }

    // Обработка Enter для списков и обычного текста
    if (e.key === 'Enter') {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        let container = range.commonAncestorContainer
        
        // Поднимаемся до элемента
        if (container.nodeType === Node.TEXT_NODE) {
          container = container.parentElement!
        }
        
        // Ищем родительский bullet-line или checkbox-line
        let listElement = container as Element
        let depth = 0
        const maxDepth = 10
        while (listElement && !listElement.classList.contains('bullet-line') && !listElement.classList.contains('checkbox-line') && depth < maxDepth) {
          listElement = listElement.parentElement as Element
          depth++
        }
        
        if (listElement && (listElement.classList.contains('bullet-line') || listElement.classList.contains('checkbox-line'))) {
          e.preventDefault()
          
          // Проверяем, пустая ли строка (только bullet или только checkbox + пробел)
          const textContent = listElement.textContent?.trim() || ''
          const isBulletEmpty = listElement.classList.contains('bullet-line') && (textContent === '•' || textContent === '')
          const isCheckboxEmpty = listElement.classList.contains('checkbox-line') && textContent === ''
          
          if (isBulletEmpty || isCheckboxEmpty) {
            // Если строка пустая, создаем обычную строку и удаляем текущую
            const newDiv = document.createElement('div')
            newDiv.innerHTML = '<br>'
            
            listElement.parentNode?.insertBefore(newDiv, listElement.nextSibling)
            listElement.remove()
            
            // Устанавливаем курсор в новую строку
            const newRange = document.createRange()
            newRange.setStart(newDiv, 0)
            newRange.collapse(true)
            selection.removeAllRanges()
            selection.addRange(newRange)
          } else {
            // Создаем новый элемент списка
            if (listElement.classList.contains('bullet-line')) {
              const newBullet = document.createElement('div')
              newBullet.className = 'bullet-line'
              newBullet.innerHTML = '•&nbsp;'
              
              listElement.parentNode?.insertBefore(newBullet, listElement.nextSibling)
              
              // Устанавливаем курсор после буллета и пробела
              const newRange = document.createRange()
              newRange.setStart(newBullet.childNodes[1] || newBullet, newBullet.childNodes[1] ? 1 : 0)
              newRange.collapse(true)
              selection.removeAllRanges()
              selection.addRange(newRange)
            } else if (listElement.classList.contains('checkbox-line')) {
              const newCheckbox = document.createElement('div')
              newCheckbox.className = 'checkbox-line'
              newCheckbox.innerHTML = '<input type="checkbox" class="mr-2"> <span></span>'
              
              listElement.parentNode?.insertBefore(newCheckbox, listElement.nextSibling)
              
              // Устанавливаем курсор в span элемент
              const span = newCheckbox.querySelector('span')
              if (span) {
                const newRange = document.createRange()
                newRange.setStart(span, 0)
                newRange.collapse(true)
                selection.removeAllRanges()
                selection.addRange(newRange)
              }
            }
          }
        } else {
          // Обычный перенос строки - не создаем bullet list
          e.preventDefault()
          const newDiv = document.createElement('div')
          newDiv.innerHTML = '<br>'
          
          range.deleteContents()
          range.insertNode(newDiv)
          
          // Устанавливаем курсор в новую строку
          const newRange = document.createRange()
          newRange.setStart(newDiv, 0)
          newRange.collapse(true)
          selection.removeAllRanges()
          selection.addRange(newRange)
        }
      }
    }
  }

  const formatText = (command: string) => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    
    switch (command) {
      case 'bold':
        document.execCommand('bold', false)
        break
      case 'italic':
        document.execCommand('italic', false)
        break
      case 'underline':
        document.execCommand('underline', false)
        break
      case 'h1':
      case 'h2':
      case 'h3':
        document.execCommand('formatBlock', false, command)
        // Классы будут применены автоматически через MutationObserver
        break
    }
    
    editorRef.current?.focus()
  }

  const insertBulletList = () => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const bulletDiv = document.createElement('div')
    bulletDiv.className = 'bullet-line'
    bulletDiv.innerHTML = '•&nbsp;'
    
    const range = selection.getRangeAt(0)
    range.deleteContents()
    range.insertNode(bulletDiv)
    
    // Устанавливаем курсор после буллета и пробела
    const newRange = document.createRange()
    newRange.setStart(bulletDiv.childNodes[1] || bulletDiv, bulletDiv.childNodes[1] ? 1 : 0)
    newRange.collapse(true)
    selection.removeAllRanges()
    selection.addRange(newRange)
    
    editorRef.current?.focus()
  }

  const insertCheckbox = () => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const checkboxDiv = document.createElement('div')
    checkboxDiv.className = 'checkbox-line'
    checkboxDiv.innerHTML = '<input type="checkbox" class="mr-2"> <span></span>'
    
    const range = selection.getRangeAt(0)
    range.deleteContents()
    range.insertNode(checkboxDiv)
    
    // Устанавливаем курсор в span элемент
    const span = checkboxDiv.querySelector('span')
    if (span) {
      const newRange = document.createRange()
      newRange.setStart(span, 0)
      newRange.collapse(true)
      selection.removeAllRanges()
      selection.addRange(newRange)
    }
    
    editorRef.current?.focus()
  }

  const handleSave = () => {
    const editorContent = editorRef.current?.innerHTML || ''
    const markdownContent = htmlToMarkdown(editorContent)
    
    if (markdownContent.trim() || title.trim()) {
      const combinedContent = combineNotionContent(title.trim(), markdownContent.trim())
      onSave(combinedContent)
      hasChangedRef.current = false
    }
  }

  const handleBlur = () => {
    setTimeout(() => {
      if (document.activeElement?.closest('.markdown-editor-container')) {
        return
      }
      
      if (hasChangedRef.current) {
        handleSave()
      }
    }, 100)
  }

  const handleTitleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Предотвращаем переход в editor при обычном вводе
    if (e.key === 'Enter') {
      e.preventDefault()
      editorRef.current?.focus()
    } else if (e.key === 'Escape') {
      onCancel()
    }
    // Не блокируем другие клавиши для нормального ввода в title
  }

  return (
    <div className="markdown-editor-container space-y-3">
      <div className="space-y-3">
        {showTitle && (
          <Input
            ref={titleRef}
            value={title}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
            onKeyDown={handleTitleKeyDown}
            placeholder={titlePlaceholder}
            className="font-medium"
          />
        )}
        
        {/* Кнопки форматирования */}
        <div className="flex items-center gap-1 p-2 bg-gray-50 dark:bg-gray-800 rounded-md border">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => formatText('bold')}
            className="h-7 px-2"
            title="Жирный текст (Ctrl+B)"
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => formatText('italic')}
            className="h-7 px-2"
            title="Курсив (Ctrl+I)"
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => formatText('underline')}
            className="h-7 px-2"
            title="Подчеркнутый (Ctrl+U)"
          >
            <Underline className="h-4 w-4" />
          </Button>
          <div className="w-px h-6 bg-gray-300 mx-1" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => formatText('h1')}
            className="h-7 px-2"
            title="Заголовок 1 (Ctrl+1)"
          >
            <Hash className="h-4 w-4" />
            <span className="text-xs ml-1">1</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => formatText('h2')}
            className="h-7 px-2"
            title="Заголовок 2 (Ctrl+2)"
          >
            <Hash className="h-4 w-4" />
            <span className="text-xs ml-1">2</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => formatText('h3')}
            className="h-7 px-2"
            title="Заголовок 3 (Ctrl+3)"
          >
            <Hash className="h-4 w-4" />
            <span className="text-xs ml-1">3</span>
          </Button>
          <div className="w-px h-6 bg-gray-300 mx-1" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={insertBulletList}
            className="h-7 px-2"
            title="Буллет-лист"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={insertCheckbox}
            className="h-7 px-2"
            title="Чекбокс"
          >
            ☐
          </Button>
        </div>
        
        <Card className="p-4 min-h-[120px]">
          <div
            ref={editorRef}
            contentEditable
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className="outline-none min-h-[80px] prose prose-sm max-w-none
                     [&_.bullet-line]:flex [&_.bullet-line]:items-start [&_.bullet-line]:gap-2 [&_.bullet-line]:my-1
                     [&_.checkbox-line]:flex [&_.checkbox-line]:items-start [&_.checkbox-line]:gap-2 [&_.checkbox-line]:my-1
                     [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2
                     [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2  
                     [&_h3]:text-lg [&_h3]:font-bold [&_h3]:mt-4 [&_h3]:mb-2"
            suppressContentEditableWarning={true}
            data-placeholder={placeholder}
            style={{
              minHeight: '80px',
            }}
          />
        </Card>
        
        <div className="text-xs text-gray-500 space-y-1">
          <p>Заметка автоматически сохраняется при потере фокуса или закрытии страницы</p>
          <p>Горячие клавиши: Ctrl+S (сохранить), Ctrl+B (жирный), Ctrl+I (курсив), Ctrl+U (подчеркнутый), Ctrl+1,2,3 (заголовки)</p>
        </div>
      </div>
    </div>
  )
} 