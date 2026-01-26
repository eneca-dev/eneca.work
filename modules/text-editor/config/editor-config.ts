import StarterKit from '@tiptap/starter-kit'
import BulletList from '@tiptap/extension-bullet-list'
import OrderedList from '@tiptap/extension-ordered-list'
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
import HardBreak from '@tiptap/extension-hard-break'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import { TableWithFirstRowHeader } from '@/modules/text-editor/extensions/table-with-first-row-header'
import { TableWithResizeButtons } from '@/modules/text-editor/extensions/table-with-resize-buttons'
import { SlashCommand } from '@/modules/text-editor/extensions/slash-command'

/**
 * Константы для редактора
 */
export const EDITOR_CONSTANTS = {
  AUTOSAVE_DELAY: 600,
  DEFAULT_PLACEHOLDER: 'Начните писать свою заметку...',
  DEFAULT_TITLE_PLACEHOLDER: 'Заголовок заметки',
  MIN_CELL_WIDTH: 50,
} as const

/**
 * Создает конфигурацию расширений для TipTap редактора
 */
export function createEditorExtensions(placeholder?: string) {
  return [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3]
      },
      bulletList: false, // Отключаем встроенный bulletList
      orderedList: false // Отключаем встроенный orderedList
    }),
    // Добавляем собственные расширения списков без input rules (обработка в onUpdate)
    BulletList.configure({
      keepMarks: true,
      keepAttributes: true
    }),
    OrderedList.configure({
      keepMarks: true,
      keepAttributes: true
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
    TaskItem,
    Placeholder.configure({
      placeholder: placeholder || EDITOR_CONSTANTS.DEFAULT_PLACEHOLDER
    }),
    HardBreak.configure({
      keepMarks: false,
      HTMLAttributes: {
        class: 'table-line-break'
      }
    }),
    Table.configure({
      resizable: true,
      allowTableNodeSelection: true,
      cellMinWidth: EDITOR_CONSTANTS.MIN_CELL_WIDTH
    }),
    TableRow,
    TableHeader.configure({
      HTMLAttributes: {
        class: 'table-header-cell'
      }
    }),
    TableCell.configure({
      HTMLAttributes: {
        class: 'table-data-cell'
      }
    }),
    TableWithFirstRowHeader,
    TableWithResizeButtons,
    SlashCommand
  ]
}

/**
 * Конфигурация свойств редактора
 */
export const editorPropsConfig = {
  attributes: {
    class: 'prose prose-sm max-w-none focus:outline-none min-h-[200px] p-4 prose-headings:font-bold prose-h1:text-2xl prose-h1:mb-2 prose-h1:mt-4 prose-h2:text-xl prose-h2:mb-2 prose-h2:mt-4 prose-h3:text-lg prose-h3:mb-2 prose-h3:mt-4 prose-strong:font-bold prose-em:italic prose-ul:list-disc prose-ul:ml-6 prose-ol:list-decimal prose-ol:ml-6 prose-li:my-1',
  }
}

/**
 * Создает обработчики DOM событий для редактора
 */
export function createEditorDOMHandlers(
  setIsComposing: (value: boolean) => void
) {
  return {
    compositionstart: () => {
      setIsComposing(true)
      return false
    },
    compositionend: () => {
      setIsComposing(false)
      return false
    },
    input: () => {
      // Разрешаем работу input rules
      return true
    }
  }
}
