'use client'

import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Save, Eye, Edit3 } from 'lucide-react'
import { combineNotionContent } from '../utils'

interface MarkdownEditorProps {
  initialTitle?: string
  initialValue: string
  onSave: (content: string) => void
  onCancel: () => void
  placeholder?: string
  titlePlaceholder?: string
  autoFocus?: boolean
  showTitle?: boolean
}

export function MarkdownEditor({ 
  initialTitle = "",
  initialValue, 
  onSave, 
  onCancel, 
  placeholder = "Введите текст заметки...",
  titlePlaceholder = "Заголовок заметки",
  autoFocus = true,
  showTitle = true
}: MarkdownEditorProps) {
  const [title, setTitle] = useState(initialTitle)
  const [value, setValue] = useState(initialValue)
  const [isPreview, setIsPreview] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (autoFocus) {
      if (showTitle && titleRef.current) {
        titleRef.current.focus()
        const length = titleRef.current.value.length
        titleRef.current.setSelectionRange(length, length)
      } else if (textareaRef.current) {
        textareaRef.current.focus()
        const length = textareaRef.current.value.length
        textareaRef.current.setSelectionRange(length, length)
      }
    }
  }, [autoFocus, showTitle])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
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
        // Жирный текст (англ/рус)
        case 'b':
        case 'и':
          e.preventDefault()
          insertFormatting('**', '**')
          break
        // Курсив (англ/рус)
        case 'i':
        case 'ш':
          e.preventDefault()
          insertFormatting('*', '*')
          break
        // Подчеркивание (англ/рус)
        case 'u':
        case 'г':
          e.preventDefault()
          insertFormatting('__', '__')
          break
        // Заголовки
        case '1':
          e.preventDefault()
          insertFormatting('# ', '')
          break
        case '2':
          e.preventDefault()
          insertFormatting('## ', '')
          break
        case '3':
          e.preventDefault()
          insertFormatting('### ', '')
          break
      }
    }

    if (e.key === 'Escape') {
      onCancel()
    }
  }

  const insertFormatting = (before: string, after: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = value.substring(start, end)
    const newText = value.substring(0, start) + before + selectedText + after + value.substring(end)
    
    setValue(newText)
    
    // Установить курсор после вставленного форматирования
    setTimeout(() => {
      textarea.focus()
      const newCursorPos = start + before.length + selectedText.length + after.length
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  const handleSave = () => {
    if (value.trim() || title.trim()) {
      const combinedContent = combineNotionContent(title.trim(), value.trim())
      onSave(combinedContent)
    }
  }

  const handleBlur = () => {
    // Автосохранение при потере фокуса (с небольшой задержкой)
    setTimeout(() => {
      if (document.activeElement?.closest('.markdown-editor-container')) {
        return // Не сохраняем если фокус перешел на другой элемент в этом же редакторе
      }
      if ((value.trim() || title.trim()) && (value !== initialValue || title !== initialTitle)) {
        const combinedContent = combineNotionContent(title.trim(), value.trim())
        const originalCombined = combineNotionContent(initialTitle, initialValue)
        if (combinedContent !== originalCombined) {
          handleSave()
        }
      }
    }, 100)
  }

  return (
    <div className="markdown-editor-container space-y-3">
      <div className="flex items-center gap-2">
      <Button
          type="button"
          variant={isPreview ? 'outline' : 'default'}
          size="sm"
          onClick={() => setIsPreview(false)}
        >
          <Edit3 className="h-4 w-4 mr-1" />
          Редактирование
        </Button>
        <Button
          type="button"
          variant={isPreview ? 'default' : 'outline'}
          size="sm"
          onClick={() => setIsPreview(true)}
        >
          <Eye className="h-4 w-4 mr-1" />
          Предпросмотр
        </Button>
        <div className="flex-1" />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
        >
          Отмена
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={!(value.trim() || title.trim())}
        >
          <Save className="h-4 w-4 mr-1" />
          Сохранить
        </Button>
      </div>

      {isPreview ? (
        <Card className="p-4 min-h-[120px] bg-gray-50 dark:bg-gray-900">
          {(value.trim() || title.trim()) ? (
                          <div className="prose dark:prose-invert prose-sm max-w-none">
                {showTitle && title.trim() && (
                  <h1 className="text-xl font-bold mb-3">{title}</h1>
                )}
                <div 
                  dangerouslySetInnerHTML={{ 
                    __html: value
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/\*(.*?)\*/g, '<em>$1</em>')
                      .replace(/__(.*?)__/g, '<u>$1</u>')
                      .replace(/^(#{1,3})\s+(.+)$/gm, (match, hashes, content) => {
                        const level = hashes.length
                        const sizes = ['text-xl', 'text-lg', 'text-base']
                        const margins = ['mt-4 mb-2', 'mt-3 mb-2', 'mt-2 mb-2']
                        return `<h${level} class="font-bold ${sizes[level-1]} ${margins[level-1]}">${content}</h${level}>`
                      })
                      .replace(/\n/g, '<br/>')
                  }} 
                />
              </div>
          ) : (
            <p className="text-gray-500 italic">Предпросмотр будет показан здесь...</p>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {showTitle && (
            <Input
              ref={titleRef}
              value={title}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
              placeholder={titlePlaceholder}
              className="font-medium"
            />
          )}
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={placeholder}
            className="min-h-[120px] resize-none"
            rows={6}
          />
          <div className="text-xs text-gray-500 space-y-1">
            <p>Горячие клавиши: Ctrl+S (сохранить), Ctrl+B (жирный), Ctrl+I (курсив), Ctrl+U (подчеркнутый)</p>
            <p>Ctrl+1,2,3 (заголовки), Ctrl+Enter (сохранить), Esc (отмена)</p>
          </div>
        </div>
      )}
    </div>
  )
} 