'use client'

import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Save, Bold, Italic, Underline, List, Hash } from 'lucide-react'
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

export function RichTextEditor({ 
  initialTitle = "",
  initialValue, 
  onSave, 
  onCancel, 
  titlePlaceholder = "Заголовок заметки",
  showTitle = true
}: RichTextEditorProps) {
  const [title, setTitle] = useState(initialTitle)
  const titleRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)



  // Инициализация содержимого редактора
  useEffect(() => {
    if (editorRef.current && initialValue) {
      console.log('Initializing editor with:', initialValue)
      const htmlContent = markdownToHtml(initialValue)
      console.log('Converted to HTML:', htmlContent)
      
      // Очищаем редактор и вставляем содержимое
      editorRef.current.innerHTML = htmlContent
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

    // Обработка Enter для списков
    if (e.key === 'Enter') {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        const container = range.commonAncestorContainer
        
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
              newBullet.innerHTML = '• &nbsp;'
              
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
              newCheckbox.innerHTML = '<input type="checkbox" class="mr-2 pointer-events-none"> '
              
              listElement.parentNode?.insertBefore(newCheckbox, listElement.nextSibling)
              
              // Устанавливаем курсор после чекбокса
              const textNode = newCheckbox.childNodes[1]
              if (textNode) {
                const newRange = document.createRange()
                newRange.setStart(textNode, 1)
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
        const headerClass = command === 'h1' ? 'text-2xl font-bold mt-4 mb-2' :
                           command === 'h2' ? 'text-xl font-bold mt-4 mb-2' :
                           'text-lg font-bold mt-4 mb-2'
        document.execCommand('formatBlock', false, command)
        // Добавляем класс к созданному заголовку
        setTimeout(() => {
          const element = selection.anchorNode?.parentElement
          if (element && ['H1', 'H2', 'H3'].includes(element.tagName)) {
            element.className = headerClass
          }
        }, 0)
        break
    }
  }

  const insertBulletList = () => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const bulletDiv = document.createElement('div')
    bulletDiv.className = 'bullet-line'
    bulletDiv.innerHTML = '• &nbsp;'
    
    const range = selection.getRangeAt(0)
    range.deleteContents()
    range.insertNode(bulletDiv)
    
    // Устанавливаем курсор в конец строки буллета
    const newRange = document.createRange()
    newRange.selectNodeContents(bulletDiv)
    newRange.collapse(false)
    selection.removeAllRanges()
    selection.addRange(newRange)
  }

  const insertCheckbox = () => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const checkboxDiv = document.createElement('div')
    checkboxDiv.className = 'checkbox-line'
    checkboxDiv.innerHTML = '<input type="checkbox" class="mr-2 pointer-events-none"> '
    
    const range = selection.getRangeAt(0)
    range.deleteContents()
    range.insertNode(checkboxDiv)
    
    // Устанавливаем курсор после чекбокса
    const textNode = checkboxDiv.childNodes[1]
    if (textNode) {
      const newRange = document.createRange()
      newRange.setStart(textNode, 1)
      newRange.collapse(true)
      selection.removeAllRanges()
      selection.addRange(newRange)
    }
  }

  const handleSave = () => {
    const editorContent = editorRef.current?.innerHTML || ''
    const markdownContent = htmlToMarkdown(editorContent)
    
    if (markdownContent.trim() || title.trim()) {
      const combinedContent = combineNotionContent(title.trim(), markdownContent.trim())
      onSave(combinedContent)
    }
  }

  const handleBlur = () => {
    setTimeout(() => {
      if (document.activeElement?.closest('.rich-editor-container')) {
        return
      }
      
      const editorContent = editorRef.current?.innerHTML || ''
      const markdownContent = htmlToMarkdown(editorContent)
      
      if ((markdownContent.trim() || title.trim()) && (markdownContent !== initialValue || title !== initialTitle)) {
        const combinedContent = combineNotionContent(title.trim(), markdownContent.trim())
        const originalCombined = combineNotionContent(initialTitle, initialValue)
        if (combinedContent !== originalCombined) {
          handleSave()
        }
      }
    }, 100)
  }

  return (
    <div className="rich-editor-container space-y-4 h-full flex flex-col">
      {/* Панель управления */}
      <div className="flex items-center justify-between gap-2">
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

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
          >
            Закрыть
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={!((editorRef.current?.textContent?.trim()) || title.trim())}
          >
            <Save className="h-4 w-4 mr-1" />
            Сохранить
          </Button>
        </div>
      </div>

      {/* Редактор */}
      <div className="flex-1 overflow-hidden bg-white dark:bg-gray-900 border rounded-lg">
        <div className="p-6 h-full overflow-y-auto">
          {showTitle && (
            <Input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={titlePlaceholder}
              className="font-bold text-2xl border-none shadow-none px-0 mb-6 bg-transparent"
              style={{ fontSize: '28px' }}
            />
          )}
          
          {/* WYSIWYG редактор */}
          <div
            ref={editorRef}
            contentEditable
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className="outline-none min-h-[300px] prose prose-sm max-w-none dark:prose-invert
                     [&_.bullet-line]:flex [&_.bullet-line]:items-start [&_.bullet-line]:gap-2 [&_.bullet-line]:my-1
                     [&_.checkbox-line]:flex [&_.checkbox-line]:items-start [&_.checkbox-line]:gap-2 [&_.checkbox-line]:my-1
                     [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2
                     [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2  
                     [&_h3]:text-lg [&_h3]:font-bold [&_h3]:mt-4 [&_h3]:mb-2"
            suppressContentEditableWarning={true}
            data-placeholder="Начните печатать... Используйте кнопки выше для форматирования или горячие клавиши"
            style={{
              fontSize: '14px',
              lineHeight: '1.5'
            }}
          />
        </div>
      </div>

      <div className="text-xs text-gray-500">
        <p>Горячие клавиши: Ctrl+S (сохранить), Ctrl+B (жирный), Ctrl+I (курсив), Ctrl+U (подчеркнутый), Ctrl+1,2,3 (заголовки), Ctrl+Enter (сохранить), Esc (закрыть)</p>
      </div>
    </div>
  )
} 