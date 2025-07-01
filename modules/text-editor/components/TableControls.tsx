'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { 
  Plus, 
  Minus, 
  Rows, 
  Columns, 
  Trash2 
} from 'lucide-react'
import { Editor } from '@tiptap/react'
import { cn } from '@/lib/utils'

interface TableControlsProps {
  editor: Editor
  className?: string
}

export function TableControls({ editor, className }: TableControlsProps) {
  if (!editor.isActive('table')) {
    return null
  }

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {/* Разделитель */}
      <div className="w-px h-8 bg-gray-300 mx-1 self-center" />
      
      {/* Управление строками */}
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().addRowBefore().run()}
          className="h-8 w-8 p-0"
          title="Добавить строку выше активной строки"
        >
          <div className="flex flex-col items-center">
            <Plus className="h-3 w-3" />
            <Rows className="h-3 w-3 -mt-1" />
          </div>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().addRowAfter().run()}
          className="h-8 w-8 p-0"
          title="Добавить строку ниже активной строки"
        >
          <div className="flex flex-col items-center">
            <Rows className="h-3 w-3" />
            <Plus className="h-3 w-3 -mt-1" />
          </div>
        </Button>
        
      </div>

      {/* Разделитель */}
      <div className="w-px h-8 bg-gray-300 mx-1 self-center" />

      {/* Управление столбцами */}
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().addColumnBefore().run()}
          className="h-8 w-8 p-0"
          title="Добавить столбец слева от активного столбца"
        >
          <div className="flex items-center">
            <Plus className="h-3 w-3" />
            <Columns className="h-3 w-3" />
          </div>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().addColumnAfter().run()}
          className="h-8 w-8 p-0"
          title="Добавить столбец справа от активного столбца"
        >
          <div className="flex items-center">
            <Columns className="h-3 w-3" />
            <Plus className="h-3 w-3" />
          </div>
        </Button>

      </div>

      {/* Разделитель */}
      <div className="w-px h-8 bg-gray-300 mx-1 self-center" />
      <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().deleteRow().run()}
          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
          title="Удалить активную строку"
        >
          <div className="flex items-center">
            <Minus className="h-3 w-3" />
            <Rows className="h-3 w-3" />
          </div>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().deleteColumn().run()}
          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
          title="Удалить активный столбец"
        >
          <div className="flex items-center">
            <Minus className="h-3 w-3" />
            <Columns className="h-3 w-3" />
          </div>
        </Button>
      {/* Удалить всю таблицу */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().deleteTable().run()}
        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
        title="Удалить всю таблицу"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
} 