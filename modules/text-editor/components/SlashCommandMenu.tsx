'use client'

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { Editor } from '@tiptap/react'
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code2,
  Table as TableIcon,
  TextIcon
} from 'lucide-react'

export interface SlashCommandItem {
  title: string
  description: string
  icon: React.ReactNode
  command: (props: { editor: Editor; range: any }) => void
}

export interface SlashCommandMenuProps {
  items: SlashCommandItem[]
  command: (item: SlashCommandItem) => void
}

export interface SlashCommandMenuRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

export const SlashCommandMenu = forwardRef<SlashCommandMenuRef, SlashCommandMenuProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0)

    useEffect(() => {
      setSelectedIndex(0)
    }, [items])

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((selectedIndex + items.length - 1) % items.length)
          return true
        }

        if (event.key === 'ArrowDown') {
          setSelectedIndex((selectedIndex + 1) % items.length)
          return true
        }

        if (event.key === 'Enter') {
          const item = items[selectedIndex]
          if (item) {
            command(item)
          }
          return true
        }

        return false
      }
    }))

    if (!items.length) {
      return null
    }

    return (
      <div className="z-50 min-w-[280px] bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
        <div className="p-1 max-h-[300px] overflow-y-auto">
          {items.map((item, index) => (
            <button
              key={index}
              onClick={() => command(item)}
              className={`w-full flex items-start gap-3 px-3 py-2 rounded-md transition-colors ${
                index === selectedIndex
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50'
              }`}
            >
              <span className="flex-shrink-0 mt-0.5 text-muted-foreground">
                {item.icon}
              </span>
              <div className="flex-1 text-left">
                <div className="font-medium text-sm">{item.title}</div>
                <div className="text-xs text-muted-foreground">
                  {item.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }
)

SlashCommandMenu.displayName = 'SlashCommandMenu'

// Список команд по умолчанию
export const getSlashCommandItems = (): SlashCommandItem[] => [
  {
    title: 'Заголовок 1',
    description: 'Большой заголовок раздела',
    icon: <Heading1 className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode('heading', { level: 1 })
        .run()
    }
  },
  {
    title: 'Заголовок 2',
    description: 'Средний заголовок',
    icon: <Heading2 className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode('heading', { level: 2 })
        .run()
    }
  },
  {
    title: 'Заголовок 3',
    description: 'Маленький заголовок',
    icon: <Heading3 className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode('heading', { level: 3 })
        .run()
    }
  },
  {
    title: 'Маркированный список',
    description: 'Создать список с маркерами',
    icon: <List className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run()
    }
  },
  {
    title: 'Нумерованный список',
    description: 'Создать нумерованный список',
    icon: <ListOrdered className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run()
    }
  },
  {
    title: 'Список задач',
    description: 'Список с чекбоксами',
    icon: <CheckSquare className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run()
    }
  },
  {
    title: 'Цитата',
    description: 'Блок цитаты',
    icon: <Quote className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run()
    }
  },
  {
    title: 'Блок кода',
    description: 'Блок кода с подсветкой',
    icon: <Code2 className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCodeBlock().run()
    }
  },
  {
    title: 'Таблица',
    description: 'Вставить таблицу 3x3',
    icon: <TableIcon className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run()
    }
  },
  {
    title: 'Текст',
    description: 'Обычный параграф текста',
    icon: <TextIcon className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().run()
    }
  }
]
