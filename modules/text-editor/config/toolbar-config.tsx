import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Highlighter,
  Code,
  Heading1,
  Heading2,
  Heading3
} from 'lucide-react'
import type { Editor } from '@tiptap/react'
import type { LucideIcon } from 'lucide-react'

export interface ToolbarButtonConfig {
  id: string
  icon: LucideIcon
  title: string
  onClick: (editor: Editor) => void
  isActive: (editor: Editor) => boolean
}

export interface ToolbarGroup {
  buttons: string[]
}

// Конфигурация всех кнопок тулбара
export const toolbarButtonsMap: Record<string, ToolbarButtonConfig> = {
  h1: {
    id: 'h1',
    icon: Heading1,
    title: 'Заголовок 1',
    onClick: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    isActive: (editor) => editor.isActive('heading', { level: 1 })
  },
  h2: {
    id: 'h2',
    icon: Heading2,
    title: 'Заголовок 2',
    onClick: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    isActive: (editor) => editor.isActive('heading', { level: 2 })
  },
  h3: {
    id: 'h3',
    icon: Heading3,
    title: 'Заголовок 3',
    onClick: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    isActive: (editor) => editor.isActive('heading', { level: 3 })
  },
  bold: {
    id: 'bold',
    icon: Bold,
    title: 'Жирный (Ctrl+B)',
    onClick: (editor) => editor.chain().focus().toggleBold().run(),
    isActive: (editor) => editor.isActive('bold')
  },
  italic: {
    id: 'italic',
    icon: Italic,
    title: 'Курсив (Ctrl+I)',
    onClick: (editor) => editor.chain().focus().toggleItalic().run(),
    isActive: (editor) => editor.isActive('italic')
  },
  underline: {
    id: 'underline',
    icon: UnderlineIcon,
    title: 'Подчеркнутый (Ctrl+U)',
    onClick: (editor) => editor.chain().focus().toggleUnderline().run(),
    isActive: (editor) => editor.isActive('underline')
  },
  strike: {
    id: 'strike',
    icon: Strikethrough,
    title: 'Зачеркнутый',
    onClick: (editor) => editor.chain().focus().toggleStrike().run(),
    isActive: (editor) => editor.isActive('strike')
  },
  highlight: {
    id: 'highlight',
    icon: Highlighter,
    title: 'Выделение',
    onClick: (editor) => editor.chain().focus().toggleHighlight().run(),
    isActive: (editor) => editor.isActive('highlight')
  },
  code: {
    id: 'code',
    icon: Code,
    title: 'Инлайн код',
    onClick: (editor) => editor.chain().focus().toggleCode().run(),
    isActive: (editor) => editor.isActive('code')
  }
}

// Группировка кнопок с разделителями
export const toolbarGroups: ToolbarGroup[] = [
  { buttons: ['h1', 'h2', 'h3'] },
  { buttons: ['bold', 'italic', 'underline', 'strike', 'highlight'] },
  { buttons: ['code'] }
]
