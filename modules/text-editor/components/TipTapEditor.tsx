'use client'

import React, { forwardRef, useImperativeHandle, useEffect, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Highlight from '@tiptap/extension-highlight'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Typography from '@tiptap/extension-typography'
import Placeholder from '@tiptap/extension-placeholder'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon, 
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Link as LinkIcon,
  Undo,
  Redo,
  Save,
  X,
  CheckSquare,
  Type,
  Table as TableIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { TipTapEditorProps, TipTapEditorRef } from '@/modules/text-editor/types'

export const TipTapEditor = forwardRef<TipTapEditorRef, TipTapEditorProps>(({
  initialTitle = '',
  initialValue,
  onSave,
  onCancel,
  titlePlaceholder = 'Заголовок заметки',
  showTitle = true,
  autoFocus = true,
  className
}, ref) => {
  const [title, setTitle] = useState(initialTitle)
  const [hasChanges, setHasChanges] = useState(false)

  // Комбинирование заголовка и содержимого
  const combineContent = (titleValue: string, editorContent: string) => {
    const cleanTitle = titleValue.trim()
    const cleanContent = editorContent.trim()
    
    if (!cleanTitle && !cleanContent) return ''
    if (!cleanTitle) return cleanContent
    if (!cleanContent) return `# ${cleanTitle}`
    
    return `# ${cleanTitle}\n\n${cleanContent}`
  }

  // Парсинг исходного содержимого
  const parseInitialContent = (content: string) => {
    if (!content) return { title: '', editorContent: '' }
    
    const lines = content.split('\n')
    const firstLine = lines[0]?.trim()
    
    // Проверяем, начинается ли первая строка с # (заголовок)
    if (firstLine?.startsWith('# ')) {
      const titleValue = firstLine.substring(2).trim()
      const remainingContent = lines.slice(1).join('\n').trim()
      // Удаляем лишние переносы строк в начале
      const cleanContent = remainingContent.replace(/^\n+/, '')
      return { title: titleValue, editorContent: cleanContent }
    }
    
    return { title: '', editorContent: content }
  }

  const { title: parsedTitle, editorContent: parsedContent } = parseInitialContent(initialValue)

  // Инициализируем заголовок
  useEffect(() => {
    if (initialTitle) {
      setTitle(initialTitle)
    } else {
      setTitle(parsedTitle)
    }
  }, [initialTitle, parsedTitle])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        },
        bulletList: {
          keepMarks: true,
          keepAttributes: true
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: true
        }
      }),
      Underline,
      TextStyle,
      Color,
      Typography,
      Highlight.configure({
        multicolor: true
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline cursor-pointer hover:text-blue-800'
        }
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg'
        }
      }),
      TaskList,
      TaskItem.configure({
        nested: true
      }),
      Placeholder.configure({
        placeholder: 'Начните писать свою заметку...'
      }),
      Table.configure({
        resizable: true
      }),
      TableRow,
      TableHeader,
      TableCell
    ],
    content: parsedContent,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[200px] p-4 border rounded-md',
      },
    },
    onUpdate: ({ editor }) => {
      setHasChanges(true)
    },
    autofocus: autoFocus && !showTitle
  })

  useImperativeHandle(ref, () => ({
    save: handleSave,
    focus: () => {
      if (showTitle && !title.trim()) {
        document.getElementById('title-input')?.focus()
      } else {
        editor?.commands.focus()
      }
    },
    getContent: () => {
      const editorContent = editor?.getText() || ''
      return combineContent(title, editorContent)
    }
  }))

  const handleSave = () => {
    if (!editor) return
    
    const editorContent = editor.getText()
    const combinedContent = combineContent(title, editorContent)
    
    onSave(combinedContent)
    setHasChanges(false)
    toast.success('Заметка сохранена')
  }

  const handleTitleChange = (value: string) => {
    setTitle(value)
    setHasChanges(true)
  }

  // Проверка на изменения при закрытии
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasChanges])

  // Горячие клавиши
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 's':
            e.preventDefault()
            handleSave()
            break
          case 'Escape':
            e.preventDefault()
            onCancel()
            break
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (!editor) {
    return null
  }

  return (
    <div className={cn('w-full max-w-4xl mx-auto', className)}>
      {/* Заголовок */}
      {showTitle && (
        <div className="mb-4">
          <Input
            id="title-input"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder={titlePlaceholder}
            className="text-xl font-bold border-0 border-b-2 border-gray-200 rounded-none px-0 focus:border-primary focus:ring-0"
            autoFocus={autoFocus}
          />
        </div>
      )}

      {/* Панель инструментов */}
      <div className="border border-gray-200 rounded-t-lg bg-gray-50 p-2 flex flex-wrap gap-1">
        {/* Заголовки */}
        <div className="flex gap-1 mr-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('heading', { level: 1 }) && 'bg-accent'
            )}
            title="Заголовок 1"
          >
            <Heading1 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('heading', { level: 2 }) && 'bg-accent'
            )}
            title="Заголовок 2"
          >
            <Heading2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('heading', { level: 3 }) && 'bg-accent'
            )}
            title="Заголовок 3"
          >
            <Heading3 className="h-4 w-4" />
          </Button>
        </div>

        {/* Разделитель */}
        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Форматирование текста */}
        <div className="flex gap-1 mr-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('bold') && 'bg-accent'
            )}
            title="Жирный"
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('italic') && 'bg-accent'
            )}
            title="Курсив"
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('underline') && 'bg-accent'
            )}
            title="Подчеркнутый"
          >
            <UnderlineIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('strike') && 'bg-accent'
            )}
            title="Зачеркнутый"
          >
            <Strikethrough className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('highlight') && 'bg-accent'
            )}
            title="Выделение"
          >
            <Highlighter className="h-4 w-4" />
          </Button>
        </div>

        {/* Разделитель */}
        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Списки */}
        <div className="flex gap-1 mr-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('bulletList') && 'bg-accent'
            )}
            title="Маркированный список"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('orderedList') && 'bg-accent'
            )}
            title="Нумерованный список"
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('taskList') && 'bg-accent'
            )}
            title="Список задач"
          >
            <CheckSquare className="h-4 w-4" />
          </Button>
        </div>

        {/* Разделитель */}
        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Цитата и код */}
        <div className="flex gap-1 mr-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('blockquote') && 'bg-accent'
            )}
            title="Цитата"
          >
            <Quote className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('code') && 'bg-accent'
            )}
            title="Код"
          >
            <Code className="h-4 w-4" />
          </Button>
        </div>

        {/* Разделитель */}
        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Отмена/Повтор */}
        <div className="flex gap-1 mr-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="h-8 w-8 p-0"
            title="Отменить"
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="h-8 w-8 p-0"
            title="Повторить"
          >
            <Redo className="h-4 w-4" />
          </Button>
        </div>

        {/* Разделитель */}
        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Таблицы */}
        <div className="flex gap-1 mr-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            className="h-8 w-8 p-0"
            title="Вставить таблицу"
          >
            <TableIcon className="h-4 w-4" />
          </Button>
        </div>

        {/* Разделитель */}
        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Действия */}
        <div className="flex gap-1 ml-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="h-8 px-3 text-gray-600 hover:text-gray-800"
            title="Отмена"
          >
            <X className="h-4 w-4 mr-1" />
            Отмена
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            className="h-8 px-3"
            title="Сохранить (Ctrl+S)"
          >
            <Save className="h-4 w-4 mr-1" />
            Сохранить
          </Button>
        </div>
      </div>

      {/* Редактор */}
      <div className="border border-t-0 border-gray-200 rounded-b-lg bg-white">
        <EditorContent 
          editor={editor} 
          className="prose prose-sm max-w-none [&_.ProseMirror]:min-h-[200px] [&_.ProseMirror]:p-4 [&_.ProseMirror]:focus:outline-none [&_.ProseMirror_ul[data-type='taskList']]:list-none [&_.ProseMirror_ul[data-type='taskList']_li]:flex [&_.ProseMirror_ul[data-type='taskList']_li]:items-start [&_.ProseMirror_ul[data-type='taskList']_li]:gap-2 [&_.ProseMirror_ul[data-type='taskList']_li_>_label]:flex [&_.ProseMirror_ul[data-type='taskList']_li_>_label]:items-center [&_.ProseMirror_ul[data-type='taskList']_li_>_label]:gap-2 [&_.ProseMirror_ul[data-type='taskList']_li_>_label_>_input]:m-0 [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_table]:table [&_.ProseMirror_table]:w-full [&_.ProseMirror_table]:border [&_.ProseMirror_table]:border-gray-300 [&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-gray-300 [&_.ProseMirror_td]:p-2 [&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-gray-300 [&_.ProseMirror_th]:p-2 [&_.ProseMirror_th]:bg-gray-50 [&_.ProseMirror_th]:font-semibold"
        />
      </div>

      {/* Индикатор изменений */}
      {hasChanges && (
        <div className="mt-2 text-sm text-muted-foreground flex items-center gap-1">
          <div className="w-2 h-2 bg-foreground rounded-full animate-pulse" />
          Есть несохраненные изменения
        </div>
      )}
    </div>
  )
})

TipTapEditor.displayName = 'TipTapEditor' 