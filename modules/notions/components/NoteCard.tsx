'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Check, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { parseNotionContent, markdownToHtml } from '@/modules/notions/utils'
import { SingleDeleteConfirm } from '@/modules/notions/components/SingleDeleteConfirm'
import type { Notion } from '@/modules/notions/types'

interface NoteCardProps {
  notion: Notion
  isSelected: boolean
  onToggleSelect: (id: string) => void
  onUpdate: (id: string, content: string) => void
  onToggleDone: (id: string) => void
  onDelete: (id: string) => void
  onOpenFullView: (notion: Notion) => void

  showSelection?: boolean
}

export function NoteCard({
  notion,
  isSelected,
  onToggleSelect,
  onUpdate,
  onToggleDone,
  onDelete,
  onOpenFullView,

  showSelection = false
}: NoteCardProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const handleDelete = () => {
    setShowDeleteModal(true)
  }

  const handleConfirmDelete = async () => {
    onDelete(notion.notion_id)
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return format(date, 'yyyy-MM-dd HH:mm')
    } catch {
      return dateString
    }
  }

  const handleCardClick = (e: React.MouseEvent) => {
    // Не открываем полный вид, если кликнули на кнопки или чекбокс
    if (
      (e.target as HTMLElement).closest('button') ||
      (e.target as HTMLElement).closest('[role="checkbox"]') ||
      (e.target as HTMLElement).tagName === 'INPUT'
    ) {
      return
    }
    onOpenFullView(notion)
  }



  return (
    <Card 
      className={cn(
        "p-4 transition-all duration-200 hover:shadow-md cursor-pointer",
        notion.notion_done && "opacity-50 bg-gray-50 dark:bg-gray-900/50",
        isSelected && "ring-2 ring-primary"
      )}
      onClick={handleCardClick}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          {/* Чекбокс для выбора заметки */}
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect(notion.notion_id)}
            className="mt-1 flex-shrink-0"
          />

          {/* Основное содержимое с ограничением высоты */}
          <div className="flex-1 min-w-0 max-h-[140px] overflow-hidden">
            {/* Парсим контент для разделения заголовка и содержимого */}
            {(() => {
              const parsed = parseNotionContent(notion)
              return (
                <>
                  {/* Заголовок заметки */}
                  {parsed.title && (
                    <h1 className={cn(
                      "text-2xl font-bold leading-none mb-2 line-clamp-2",
                      notion.notion_done && "line-through text-gray-500"
                    )}>
                      {parsed.title}
                    </h1>
                  )}

                  {/* Содержимое markdown с ограничением высоты */}
                  {parsed.content && (
                    <div className="relative">
                      <div className={cn(
                        "max-w-none text-sm leading-relaxed relative",
                        parsed.title ? "line-clamp-3" : "line-clamp-4",
                        notion.notion_done && "line-through text-gray-500"
                      )}
                      >
                        <div 
                          className="prose prose-sm max-w-none
                                   [&_.bullet-line]:flex [&_.bullet-line]:items-start [&_.bullet-line]:gap-2 [&_.bullet-line]:my-1
                                   [&_.checkbox-line]:flex [&_.checkbox-line]:items-start [&_.checkbox-line]:gap-2 [&_.checkbox-line]:my-1"
                          dangerouslySetInnerHTML={{ 
                            __html: markdownToHtml(parsed.content)
                          }} 
                        />
                      </div>

                    </div>
                  )}

                  {/* Если нет ни заголовка, ни контента */}
                  {!parsed.title && !parsed.content && (
                    <p className="text-gray-500 italic">Пустая заметка</p>
                  )}
                </>
              )
            })()}
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

        {/* Дата последнего изменения - вынесена за пределы ограничения высоты */}
        <div className="flex justify-between items-center">
          <p className="text-xs text-gray-500">
            Последнее изменение: {formatDate(notion.notion_updated_at)}
          </p>
        </div>
      </div>

      {/* Диалог подтверждения удаления */}
      <SingleDeleteConfirm
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        notion={notion}
        onConfirm={handleConfirmDelete}
      />
    </Card>
  )
} 