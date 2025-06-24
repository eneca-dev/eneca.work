'use client'

import React, { useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon,
  List,
  CheckSquare,
  Highlighter,
  Save,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { QuickTipTapNoteProps } from '@/modules/text-editor/types'

export function QuickTipTapNote({
  onSave,
  onCancel,
  placeholder = 'Введите текст заметки...',
  titlePlaceholder = 'Заголовок заметки',
  autoFocus = true
}: QuickTipTapNoteProps) {
  const [title, setTitle] = useState('')
  const [hasChanges, setHasChanges] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      }),
      Underline,
      Highlight,
      TaskList,
      TaskItem.configure({
        nested: true
      }),
      Placeholder.configure({
        placeholder
      })
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[120px] p-3',
      },
    },
    onUpdate: () => {
      setHasChanges(true)
    },
    autofocus: autoFocus
  })

  const handleSave = () => {
    if (!editor) return
    
    const editorContent = editor.getText().trim()
    const titleContent = title.trim()
    
    if (!titleContent && !editorContent) {
      toast.error('Введите заголовок или текст заметки')
      return
    }
    
    let combinedContent = ''
    if (titleContent && editorContent) {
      combinedContent = `# ${titleContent}\n\n${editorContent}`
    } else if (titleContent) {
      combinedContent = `# ${titleContent}`
    } else {
      combinedContent = editorContent
    }
    
    onSave(combinedContent)
    setHasChanges(false)
    
    // Очищаем редактор
    setTitle('')
    editor.commands.clearContent()
    
    toast.success('Заметка создана')
  }

  const handleCancel = () => {
    // Очищаем редактор
    setTitle('')
    editor?.commands.clearContent()
    setHasChanges(false)
    onCancel()
  }

  if (!editor) {
    return null
  }

  return (
    <Card className="p-4 mb-4">
      {/* Заголовок */}
      <div className="mb-3">
        <Input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            setHasChanges(true)
          }}
          placeholder={titlePlaceholder}
          className="font-medium border-0 bg-transparent px-0 focus:ring-0 text-base"
        />
      </div>

      {/* Упрощенная панель инструментов */}
      <div className="flex items-center gap-1 mb-3 p-2 bg-white rounded border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn(
            'h-7 w-7 p-0',
            editor.isActive('bold') && 'bg-accent'
          )}
          title="Жирный"
        >
          <Bold className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn(
            'h-7 w-7 p-0',
            editor.isActive('italic') && 'bg-accent'
          )}
          title="Курсив"
        >
          <Italic className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={cn(
            'h-7 w-7 p-0',
            editor.isActive('underline') && 'bg-accent'
          )}
          title="Подчеркнутый"
        >
          <UnderlineIcon className="h-3 w-3" />
        </Button>
        
        <div className="w-px h-4 bg-gray-300 mx-1" />
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn(
            'h-7 w-7 p-0',
            editor.isActive('bulletList') && 'bg-accent'
          )}
          title="Список"
        >
          <List className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={cn(
            'h-7 w-7 p-0',
            editor.isActive('taskList') && 'bg-accent'
          )}
          title="Задачи"
        >
          <CheckSquare className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          className={cn(
            'h-7 w-7 p-0',
            editor.isActive('highlight') && 'bg-accent'
          )}
          title="Выделение"
        >
          <Highlighter className="h-3 w-3" />
        </Button>

        <div className="flex gap-1 ml-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="h-7 px-2 text-xs text-gray-600"
          >
            <X className="h-3 w-3 mr-1" />
            Отмена
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            className="h-7 px-2 text-xs"
          >
            <Save className="h-3 w-3 mr-1" />
            Сохранить
          </Button>
        </div>
      </div>

      {/* Редактор */}
      <div className="bg-white border rounded-md">
        <EditorContent 
          editor={editor}
          className="[&_.ProseMirror]:min-h-[120px] [&_.ProseMirror]:focus:outline-none [&_.ProseMirror_ul[data-type='taskList']]:list-none [&_.ProseMirror_ul[data-type='taskList']_li]:flex [&_.ProseMirror_ul[data-type='taskList']_li]:items-start [&_.ProseMirror_ul[data-type='taskList']_li]:gap-2"
        />
      </div>

      {/* Индикатор изменений */}
      {hasChanges && (
        <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
          <div className="w-1.5 h-1.5 bg-foreground rounded-full animate-pulse" />
          Есть несохраненные изменения
        </div>
      )}
    </Card>
  )
} 