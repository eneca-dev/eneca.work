'use client'

import { BubbleMenu, Editor } from '@tiptap/react'
import { Button } from '@/components/ui/button'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Highlighter,
  Code,
  Link as LinkIcon,
  Heading1,
  Heading2,
  Heading3
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface BubbleMenuToolbarProps {
  editor: Editor
}

export function BubbleMenuToolbar({ editor }: BubbleMenuToolbarProps) {
  if (!editor) {
    return null
  }

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{
        duration: 100,
        placement: 'top',
        animation: 'shift-away'
      }}
      className="flex items-center gap-1 bg-popover border border-border rounded-lg shadow-lg p-1"
    >
      {/* Заголовки */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={cn(
          'h-8 w-8 p-0',
          editor.isActive('heading', { level: 1 })
            ? 'bg-primary text-primary-foreground'
            : ''
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
          editor.isActive('heading', { level: 2 })
            ? 'bg-primary text-primary-foreground'
            : ''
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
          editor.isActive('heading', { level: 3 })
            ? 'bg-primary text-primary-foreground'
            : ''
        )}
        title="Заголовок 3"
      >
        <Heading3 className="h-4 w-4" />
      </Button>

      {/* Разделитель */}
      <div className="w-px h-6 bg-border mx-1" />

      {/* Форматирование текста */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={cn(
          'h-8 w-8 p-0',
          editor.isActive('bold')
            ? 'bg-primary text-primary-foreground'
            : ''
        )}
        title="Жирный (Ctrl+B)"
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={cn(
          'h-8 w-8 p-0',
          editor.isActive('italic')
            ? 'bg-primary text-primary-foreground'
            : ''
        )}
        title="Курсив (Ctrl+I)"
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={cn(
          'h-8 w-8 p-0',
          editor.isActive('underline')
            ? 'bg-primary text-primary-foreground'
            : ''
        )}
        title="Подчеркнутый (Ctrl+U)"
      >
        <UnderlineIcon className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={cn(
          'h-8 w-8 p-0',
          editor.isActive('strike')
            ? 'bg-primary text-primary-foreground'
            : ''
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
          editor.isActive('highlight')
            ? 'bg-primary text-primary-foreground'
            : ''
        )}
        title="Выделение"
      >
        <Highlighter className="h-4 w-4" />
      </Button>

      {/* Разделитель */}
      <div className="w-px h-6 bg-border mx-1" />

      {/* Код */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleCode().run()}
        className={cn(
          'h-8 w-8 p-0',
          editor.isActive('code')
            ? 'bg-primary text-primary-foreground'
            : ''
        )}
        title="Инлайн код"
      >
        <Code className="h-4 w-4" />
      </Button>
    </BubbleMenu>
  )
}
