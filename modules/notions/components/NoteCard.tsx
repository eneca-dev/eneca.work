'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { MarkdownEditor } from './MarkdownEditor'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Edit3, Trash2, Check } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { parseNotionContent, getNotionDisplayTitle } from '../utils'
import type { Notion } from '../types'

interface NoteCardProps {
  notion: Notion
  isSelected: boolean
  onToggleSelect: (id: string) => void
  onUpdate: (id: string, content: string) => void
  onToggleDone: (id: string) => void
  onDelete: (id: string) => void
  showSelection?: boolean
}

export function NoteCard({
  notion,
  isSelected,
  onToggleSelect,
  onUpdate,
  onToggleDone,
  onDelete,
  showSelection = false
}: NoteCardProps) {
  const [isEditing, setIsEditing] = useState(false)

  const handleSave = (content: string) => {
    onUpdate(notion.notion_id, content)
    setIsEditing(false)
  }

  const handleDelete = () => {
    if (window.confirm('Вы действительно хотите удалить эту заметку?')) {
      if (window.confirm('Подтвердите удаление. Это действие нельзя отменить.')) {
        onDelete(notion.notion_id)
      }
    }
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return format(date, 'yyyy-MM-dd HH:mm')
    } catch {
      return dateString
    }
  }



  if (isEditing) {
    const parsed = parseNotionContent(notion)
    return (
      <Card className="p-4">
        <MarkdownEditor
          initialTitle={parsed.title}
          initialValue={parsed.content}
          onSave={handleSave}
          onCancel={() => setIsEditing(false)}
          placeholder="Введите текст заметки..."
          showTitle={true}
        />
      </Card>
    )
  }

  return (
    <Card 
      className={cn(
        "p-4 transition-all duration-200 hover:shadow-md",
        notion.notion_done && "opacity-50 bg-gray-50 dark:bg-gray-900/50",
        isSelected && "ring-2 ring-primary"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Чекбокс для выбора заметки */}
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(notion.notion_id)}
          className="mt-1"
        />

        {/* Основное содержимое */}
        <div className="flex-1 min-w-0">
          {/* Парсим контент для разделения заголовка и содержимого */}
          {(() => {
            const parsed = parseNotionContent(notion)
            return (
              <>
                {/* Заголовок заметки - как h1 */}
                {parsed.title && (
                  <h1 className={cn(
                    "text-2xl font-bold leading-none",
                    notion.notion_done && "line-through text-gray-500"
                  )}
                  style={{ marginBottom: '-8px' }}
                  >
                    {parsed.title}
                  </h1>
                )}

                {/* Содержимое markdown с правильными заголовками и переносами строк */}
                {parsed.content && (
                  <div className={cn(
                    "max-w-none",
                    notion.notion_done && "line-through text-gray-500"
                  )}
                  style={{
                    fontSize: '14px',
                    lineHeight: '1.4'
                  }}
                  >
                    <div 
                      dangerouslySetInnerHTML={{ 
                        __html: parsed.content
                          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          .replace(/\*(.*?)\*/g, '<em>$1</em>')
                          .replace(/__(.*?)__/g, '<u>$1</u>')
                          .replace(/^(#{1,3})\s+(.+)$/gm, (match, hashes, content) => {
                            const level = hashes.length
                            const sizes = ['24px', '20px', '18px']
                            const topMargins = ['16px', '12px', '8px']
                            return `<h${level} style="font-size: ${sizes[level-1]}; font-weight: bold; margin-top: ${topMargins[level-1]}; margin-bottom: -8px; line-height: 1.1;">${content}</h${level}>`
                          })
                          .replace(/\n/g, '<br/>')
                      }} 
                    />
                  </div>
                )}

                {/* Если нет ни заголовка, ни контента */}
                {!parsed.title && !parsed.content && (
                  <p className="text-gray-500 italic">Пустая заметка</p>
                )}
              </>
            )
          })()}

          {/* Дата последнего изменения */}
          <p className="text-xs text-gray-500 mt-3">
            Последнее изменение: {formatDate(notion.notion_updated_at)}
          </p>
        </div>

        {/* Действия */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Кнопка отметки выполнения */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleDone(notion.notion_id)}
            className="h-8 w-8 p-0"
            title={notion.notion_done ? "Отметить как невыполненное" : "Отметить как выполненное"}
          >
            <Check className={cn(
              "h-4 w-4",
              notion.notion_done ? "text-green-600" : "text-gray-400"
            )} />
          </Button>

          {/* Кнопка редактирования */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="h-8 w-8 p-0"
            title="Редактировать"
          >
            <Edit3 className="h-4 w-4" />
          </Button>

          {/* Кнопка удаления */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
            title="Удалить"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  )
} 