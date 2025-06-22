'use client'

import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent, forwardRef, useImperativeHandle } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Bold, Italic, Underline, List, Hash } from 'lucide-react'
import { combineNotionContent, markdownToHtml, htmlToMarkdown } from '../utils'
import React from 'react'

interface RichTextEditorProps {
  initialTitle?: string
  initialValue: string
  onSave: (content: string) => void
  onCancel: () => void
  titlePlaceholder?: string
  showTitle?: boolean
}

export interface EditorRef {
  save: () => void
}

export const RichTextEditor = forwardRef<EditorRef, RichTextEditorProps>(({ 
  initialTitle = "",
  initialValue, 
  onSave, 
  onCancel, 
  titlePlaceholder = "Заголовок заметки",
  showTitle = true
}, ref) => {
  const [title, setTitle] = useState(initialTitle)
  const titleRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const hasChangedRef = useRef(false)

  // Предоставляем метод save через ref
  useImperativeHandle(ref, () => ({
    save: handleSave
  }))

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
    let lastSaveTime = 0
    const MIN_SAVE_INTERVAL = 500 // минимальный интервал между сохранениями

    const saveIfNeeded = () => {
      const now = Date.now()
      if (hasChangedRef.current && (now - lastSaveTime) > MIN_SAVE_INTERVAL) {
        handleSave()
        lastSaveTime = now
      }
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChangedRef.current) {
        // Синхронное сохранение перед уходом
        handleSave()
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && hasChangedRef.current) {
        handleSave()
      }
    }

    // Отслеживание кликов по элементам навигации
    const handleNavigationClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      
      // Проверяем клики по элементам навигации
      const isNavigationElement = target.closest(`
        a[href],
        button[data-navigate],
        .nav-item,
        .sidebar,
        [href*="/dashboard"],
        .weekly-calendar,
        .calendar-grid,
        [title*="календарю"],
        [title*="календарь"],
        .cursor-pointer[onclick],
        [role="menuitem"]
      `)
      
      if (isNavigationElement && hasChangedRef.current) {
        // Немедленное сохранение при навигации
        handleSave()
      }
    }

    // Отслеживание фокуса окна
    const handleWindowBlur = () => {
      if (hasChangedRef.current) {
        handleSave()
      }
    }

    // Автосохранение при нажатии клавиш навигации
    const handleKeyDown = (e: Event) => {
      const keyboardEvent = e as globalThis.KeyboardEvent
      // Сохраняем при Alt+Tab, Ctrl+Tab и других комбинациях навигации
      if ((keyboardEvent.altKey && keyboardEvent.key === 'Tab') || 
          (keyboardEvent.ctrlKey && keyboardEvent.key === 'Tab') ||
          (keyboardEvent.ctrlKey && keyboardEvent.key === 'w') || // Ctrl+W (закрытие вкладки)
          (keyboardEvent.key === 'F5') || // F5 (обновление)
          (keyboardEvent.ctrlKey && keyboardEvent.key === 'r')) { // Ctrl+R (обновление)
        if (hasChangedRef.current) {
          keyboardEvent.preventDefault()
          handleSave()
          // Позволяем продолжить действие после небольшой задержки
          setTimeout(() => {
            if (keyboardEvent.ctrlKey && keyboardEvent.key === 'w') {
              window.close()
            } else if (keyboardEvent.key === 'F5' || (keyboardEvent.ctrlKey && keyboardEvent.key === 'r')) {
              window.location.reload()
            }
          }, 100)
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    document.addEventListener('click', handleNavigationClick, true)
    window.addEventListener('blur', handleWindowBlur)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      document.removeEventListener('click', handleNavigationClick, true)
      window.removeEventListener('blur', handleWindowBlur)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // Обработчик кликов по чекбоксам
  // Функция для сохранения позиции курсора
  const saveCursorPosition = () => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return null
    
    const range = selection.getRangeAt(0)
    const walker = document.createTreeWalker(
      editorRef.current!,
      NodeFilter.SHOW_TEXT,
      null
    )
    
    let charCount = 0
    let node
    
    while (node = walker.nextNode()) {
      if (node === range.startContainer) {
        return charCount + range.startOffset
      }
      charCount += node.textContent?.length || 0
    }
    
    return charCount
  }
  
  // Функция для восстановления позиции курсора
  const restoreCursorPosition = (savedPosition: number) => {
    if (!editorRef.current || savedPosition === null) return
    
    const walker = document.createTreeWalker(
      editorRef.current,
      NodeFilter.SHOW_TEXT,
      null
    )
    
    let charCount = 0
    let node
    
    while (node = walker.nextNode()) {
      const nodeLength = node.textContent?.length || 0
      
      if (charCount + nodeLength >= savedPosition) {
        const selection = window.getSelection()
        const range = document.createRange()
        
        try {
          range.setStart(node, savedPosition - charCount)
          range.collapse(true)
          
          selection?.removeAllRanges()
          selection?.addRange(range)
        } catch (e) {
          // Если не удалось установить курсор в точную позицию, ставим в конец
          range.selectNodeContents(editorRef.current)
          range.collapse(false)
          selection?.removeAllRanges()
          selection?.addRange(range)
        }
        break
      }
      
      charCount += nodeLength
    }
  }

  // Функция для обновления состояния плейсхолдеров заголовков
  const updateHeaderPlaceholders = () => {
    if (!editorRef.current) return
    
    // Находим все заголовки с классом header-placeholder
    const headers = editorRef.current.querySelectorAll('h1.header-placeholder, h2.header-placeholder, h3.header-placeholder')
    
    headers.forEach((header) => {
      const hasText = (header.textContent?.trim().length ?? 0) > 0
      
      if (hasText) {
        // Если есть текст, убираем атрибут data-placeholder
        header.removeAttribute('data-placeholder')
      } else {
        // Если текста нет, добавляем атрибут data-placeholder
        const headerNumber = header.tagName === 'H1' ? '1' : header.tagName === 'H2' ? '2' : '3'
        header.setAttribute('data-placeholder', `Заголовок ${headerNumber}`)
      }
    })
  }

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

  // Инициализация содержимого редактора
  useEffect(() => {
    if (editorRef.current && initialValue) {
      console.log('Initializing editor with:', initialValue)
      const htmlContent = markdownToHtml(initialValue)
      console.log('Converted to HTML:', htmlContent)
      
      // Сохраняем позицию курсора если редактор уже имеет содержимое
      const savedCursorPosition = editorRef.current.innerHTML.trim() ? saveCursorPosition() : null
      
      // Очищаем редактор и вставляем содержимое
      editorRef.current.innerHTML = htmlContent
      
      // Восстанавливаем курсор если он был сохранен
      if (savedCursorPosition !== null) {
        setTimeout(() => {
          restoreCursorPosition(savedCursorPosition)
          updateHeaderPlaceholders()
        }, 0)
      } else {
        // При первой инициализации обновляем плейсхолдеры
        setTimeout(() => {
          updateHeaderPlaceholders()
        }, 0)
      }
    }
    
    // Добавляем обработчик кликов по чекбоксам
    if (editorRef.current) {
      editorRef.current.addEventListener('click', handleCheckboxClick)
    }
    
    return () => {
      if (editorRef.current) {
        editorRef.current.removeEventListener('click', handleCheckboxClick)
      }
    }
  }, [initialValue])

  useEffect(() => {
    if (showTitle && titleRef.current && !title.trim() && !document.activeElement?.closest('.rich-editor-container')) {
      titleRef.current.focus()
    }
  }, [showTitle])

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
          e.preventDefault()
          formatText('bold')
          break
        case 'i':
          e.preventDefault()
          formatText('italic')
          break
        case 'u':
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
        
        // Проверяем, что курсор находится в начале строки после дефиса
        if (container.nodeType === Node.TEXT_NODE) {
          const textContent = container.textContent || ''
          const cursorPosition = range.startOffset
          
          // Проверяем, что текст начинается с "-" и курсор после дефиса
          if (textContent === '-' && cursorPosition === 1) {
            e.preventDefault()
            
            // Получаем родительский элемент
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
            newRange.selectNodeContents(bulletDiv)
            newRange.collapse(false)
            selection.removeAllRanges()
            selection.addRange(newRange)
          }
        }
      }
    }

    // Обработка Enter для заголовков и списков
    if (e.key === 'Enter') {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        const container = range.commonAncestorContainer
        
        // Проверяем, находимся ли в заголовке
        let headerElement = container.nodeType === Node.TEXT_NODE ? container.parentElement : container as Element
        
        // Поднимаемся по DOM дереву, ища заголовок
        while (headerElement && !['H1', 'H2', 'H3'].includes(headerElement.tagName) && headerElement !== editorRef.current) {
          headerElement = headerElement.parentElement
        }
        
        if (headerElement && ['H1', 'H2', 'H3'].includes(headerElement.tagName)) {
          e.preventDefault()
          
          // Создаем обычный div для новой строки
          const newDiv = document.createElement('div')
          newDiv.innerHTML = '<br>'
          
          // Вставляем после заголовка
          headerElement.parentNode?.insertBefore(newDiv, headerElement.nextSibling)
          
          // Устанавливаем курсор в новую строку
          const newRange = document.createRange()
          newRange.setStart(newDiv, 0)
          newRange.collapse(true)
          selection.removeAllRanges()
          selection.addRange(newRange)
          return
        }
        
        // Проверяем, находимся ли в списке
        let listElement = container.nodeType === Node.TEXT_NODE ? container.parentElement : container as Element
        while (listElement && !listElement.classList.contains('bullet-line') && !listElement.classList.contains('checkbox-line')) {
          listElement = listElement.parentElement
        }
        
        if (listElement) {
          e.preventDefault()
          
          if (listElement.classList.contains('bullet-line')) {
            // Проверяем, пустой ли буллет (содержит только • и пробел)
            const textContent = listElement.textContent?.trim() || ''
            const isBulletEmpty = textContent === '•' || textContent === ''
            
            if (isBulletEmpty) {
              // Если буллет пустой, создаем обычную строку
              const newDiv = document.createElement('div')
              newDiv.innerHTML = '<br>'
              
              listElement.parentNode?.insertBefore(newDiv, listElement.nextSibling)
              listElement.remove()
              
              // Устанавливаем курсор в начало новой строки
              const newRange = document.createRange()
              newRange.setStart(newDiv, 0)
              newRange.collapse(true)
              selection.removeAllRanges()
              selection.addRange(newRange)
            } else {
              // Если буллет не пустой, создаем новый буллет
              const newBullet = document.createElement('div')
              newBullet.className = 'bullet-line'
              newBullet.innerHTML = '•&nbsp;'
              
              listElement.parentNode?.insertBefore(newBullet, listElement.nextSibling)
              
              // Устанавливаем курсор в конец строки буллета
              const newRange = document.createRange()
              newRange.selectNodeContents(newBullet)
              newRange.collapse(false)
              selection.removeAllRanges()
              selection.addRange(newRange)
            }
          } else if (listElement.classList.contains('checkbox-line')) {
            // Проверяем, пустой ли чекбокс (содержит только чекбокс и пробел)
            const textContent = listElement.textContent?.trim() || ''
            const isCheckboxEmpty = textContent === '' || textContent === ' '
            
            if (isCheckboxEmpty) {
              // Если чекбокс пустой, создаем обычную строку
              const newDiv = document.createElement('div')
              newDiv.innerHTML = '<br>'
              
              listElement.parentNode?.insertBefore(newDiv, listElement.nextSibling)
              listElement.remove()
              
              // Устанавливаем курсор в начало новой строки
              const newRange = document.createRange()
              newRange.setStart(newDiv, 0)
              newRange.collapse(true)
              selection.removeAllRanges()
              selection.addRange(newRange)
            } else {
              // Если чекбокс не пустой, создаем новый чекбокс
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
        }
      }
    }
  }

  const formatText = (command: string) => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    
    if (command === 'h1' || command === 'h2' || command === 'h3') {
      const selectedText = selection.toString()
      
      // Проверяем, находимся ли мы уже в заголовке
      let currentElement = range.startContainer.nodeType === Node.TEXT_NODE 
        ? range.startContainer.parentElement 
        : range.startContainer as Element
      
      // Поднимаемся до блочного элемента
      while (currentElement && currentElement !== editorRef.current) {
        if (['H1', 'H2', 'H3', 'DIV', 'P'].includes(currentElement.tagName)) {
          break
        }
        currentElement = currentElement.parentElement
      }
      
      // Если мы в заголовке, заменяем его
      if (currentElement && ['H1', 'H2', 'H3'].includes(currentElement.tagName)) {
        const headerElement = document.createElement(command)
        headerElement.textContent = currentElement.textContent || ''
        headerElement.className = command === 'h1' ? 'text-2xl font-bold mt-4 mb-2 header-placeholder' :
                                  command === 'h2' ? 'text-xl font-bold mt-4 mb-2 header-placeholder' :
                                  'text-lg font-bold mt-4 mb-2 header-placeholder'
        
        // Добавляем атрибут data-placeholder только если нет текста
        if (!headerElement.textContent?.trim()) {
          const headerNumber = command === 'h1' ? '1' : command === 'h2' ? '2' : '3'
          headerElement.setAttribute('data-placeholder', `Заголовок ${headerNumber}`)
        }
        
        currentElement.parentNode?.replaceChild(headerElement, currentElement)
        
        // Устанавливаем курсор в заголовок
        const newRange = document.createRange()
        if (headerElement.firstChild) {
          newRange.setStart(headerElement.firstChild, headerElement.firstChild.textContent?.length || 0)
        } else {
          newRange.setStart(headerElement, 0)
        }
        newRange.collapse(true)
        selection.removeAllRanges()
        selection.addRange(newRange)
      } else {
        // Создаем новый заголовок
        const headerElement = document.createElement(command)
        headerElement.textContent = selectedText || ''
        headerElement.className = command === 'h1' ? 'text-2xl font-bold mt-4 mb-2 header-placeholder' :
                                  command === 'h2' ? 'text-xl font-bold mt-4 mb-2 header-placeholder' :
                                  'text-lg font-bold mt-4 mb-2 header-placeholder'
        
        // Добавляем атрибут data-placeholder только если нет выделенного текста
        if (!selectedText) {
          const headerNumber = command === 'h1' ? '1' : command === 'h2' ? '2' : '3'
          headerElement.setAttribute('data-placeholder', `Заголовок ${headerNumber}`)
        }
        
        range.deleteContents()
        range.insertNode(headerElement)
        
        // Устанавливаем курсор внутрь заголовка
        const newRange = document.createRange()
        newRange.setStart(headerElement, 0)
        newRange.collapse(true)
        selection.removeAllRanges()
        selection.addRange(newRange)
      }
    } else {
      document.execCommand(command, false, undefined)
    }
  }

  const insertBulletList = () => {
    const selection = window.getSelection()
    if (!selection) return
    
    const bulletDiv = document.createElement('div')
    bulletDiv.className = 'bullet-line'
    bulletDiv.innerHTML = '•&nbsp;'
    
    const range = selection.getRangeAt(0)
    range.deleteContents()
    range.insertNode(bulletDiv)
    
    // Устанавливаем курсор после bullet
    const newRange = document.createRange()
    newRange.setStartAfter(bulletDiv.firstChild!)
    newRange.collapse(true)
    selection.removeAllRanges()
    selection.addRange(newRange)
  }

  const insertCheckbox = () => {
    const selection = window.getSelection()
    if (!selection) return
    
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
  }

  const handleSave = () => {
    const editorContent = editorRef.current?.innerHTML || ''
    const markdownContent = htmlToMarkdown(editorContent)
    const combinedContent = combineNotionContent(title.trim(), markdownContent.trim())
    
    console.log('💾 Автосохранение заметки:', { title: title.trim(), hasContent: !!markdownContent.trim() })
    onSave(combinedContent)
    hasChangedRef.current = false
  }

  const handleBlur = () => {
    // Обновляем плейсхолдеры при потере фокуса
    updateHeaderPlaceholders()
    
    setTimeout(() => {
      if (document.activeElement?.closest('.rich-editor-container')) {
        return
      }
      
      if (hasChangedRef.current) {
        handleSave()
      }
    }, 100)
  }

  return (
    <div className="rich-editor-container space-y-4 h-full flex flex-col">
      {/* Панель управления - убрал кнопки "Закрыть" и "Сохранить" */}
      <div className="flex items-center justify-between gap-2 flex-shrink-0">
        {/* Кнопки форматирования */}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => formatText('bold')}
            className="h-8 px-3"
            title="Жирный (Ctrl+B)"
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => formatText('italic')}
            className="h-8 px-3"
            title="Курсив (Ctrl+I)"
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => formatText('underline')}
            className="h-8 px-3"
            title="Подчеркнутый (Ctrl+U)"
          >
            <Underline className="h-4 w-4" />
          </Button>
          <div className="w-px h-6 bg-gray-300 mx-1" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => formatText('h1')}
            className="h-8 px-3"
            title="Заголовок 1 (Ctrl+1)"
          >
            <Hash className="h-4 w-4" />
            <span className="text-xs ml-1">1</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => formatText('h2')}
            className="h-8 px-3"
            title="Заголовок 2 (Ctrl+2)"
          >
            <Hash className="h-4 w-4" />
            <span className="text-xs ml-1">2</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => formatText('h3')}
            className="h-8 px-3"
            title="Заголовок 3 (Ctrl+3)"
          >
            <Hash className="h-4 w-4" />
            <span className="text-xs ml-1">3</span>
          </Button>
          <div className="w-px h-6 bg-gray-300 mx-1" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={insertBulletList}
            className="h-8 px-3"
            title="Список"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={insertCheckbox}
            className="h-8 px-3"
            title="Чекбокс"
          >
            ☐
          </Button>
        </div>
      </div>

      {/* Редактор с фиксированной высотой и скроллом */}
      <div className="flex-1 overflow-hidden bg-white dark:bg-gray-900 border rounded-lg min-h-0">
        <div className="p-6 h-full flex flex-col">
          {showTitle && (
            <div className="flex-shrink-0 mb-6">
              <Input
                ref={titleRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={titlePlaceholder}
                className="font-bold text-2xl border-none shadow-none px-0 bg-transparent"
                style={{ fontSize: '28px' }}
              />
            </div>
          )}
          
          {/* WYSIWYG редактор с скроллом */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div
              ref={editorRef}
              contentEditable
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              onInput={updateHeaderPlaceholders}
              className="outline-none min-h-[300px] prose prose-sm max-w-none dark:prose-invert
                       [&_.bullet-line]:flex [&_.bullet-line]:items-start [&_.bullet-line]:gap-2 [&_.bullet-line]:my-1
                       [&_.checkbox-line]:flex [&_.checkbox-line]:items-start [&_.checkbox-line]:gap-2 [&_.checkbox-line]:my-1
                       [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2
                       [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2  
                       [&_h3]:text-lg [&_h3]:font-bold [&_h3]:mt-4 [&_h3]:mb-2
                       [&_h1.header-placeholder:empty]:before:content-[attr(data-placeholder)] [&_h1.header-placeholder:empty]:before:text-gray-400 [&_h1.header-placeholder:empty]:before:opacity-60
                       [&_h2.header-placeholder:empty]:before:content-[attr(data-placeholder)] [&_h2.header-placeholder:empty]:before:text-gray-400 [&_h2.header-placeholder:empty]:before:opacity-60
                       [&_h3.header-placeholder:empty]:before:content-[attr(data-placeholder)] [&_h3.header-placeholder:empty]:before:text-gray-400 [&_h3.header-placeholder:empty]:before:opacity-60"
              suppressContentEditableWarning={true}
              data-placeholder="Начните печатать... Используйте кнопки выше для форматирования или горячие клавиши"
              style={{
                fontSize: '14px',
                lineHeight: '1.5'
              }}
            />
          </div>
        </div>
      </div>

      <div className="text-xs text-gray-500 flex-shrink-0">
        <p>Заметка автоматически сохраняется при потере фокуса или закрытии страницы</p>
        <p>Горячие клавиши: Ctrl+S (сохранить), Ctrl+B (жирный), Ctrl+I (курсив), Ctrl+U (подчеркнутый), Ctrl+1,2,3 (заголовки)</p>
      </div>
    </div>
  )
})

RichTextEditor.displayName = 'RichTextEditor' 