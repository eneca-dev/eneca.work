'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Check, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { parseNotionContent, markdownToHtml } from '../utils'
import type { Notion } from '../types'

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
        "max-h-[200px] overflow-hidden", // Ограничиваем высоту
        notion.notion_done && "opacity-50 bg-gray-50 dark:bg-gray-900/50",
        isSelected && "ring-2 ring-primary"
      )}
      onClick={handleCardClick}
    >
      <div className="flex items-start gap-3">
        {/* Чекбокс для выбора заметки */}
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(notion.notion_id)}
          className="mt-1 flex-shrink-0"
        />

        {/* Основное содержимое */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {/* Парсим контент для разделения заголовка и содержимого */}
          {(() => {
            const parsed = parseNotionContent(notion)
            return (
              <>
                {/* Заголовок заметки */}
                {parsed.title && (
                  <h1 className={cn(
                    "text-lg font-bold leading-tight mb-2 line-clamp-2",
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
                      parsed.title ? "line-clamp-4" : "line-clamp-6",
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
                    {/* Индикатор того, что содержимое обрезано */}
                    {parsed.content.split('\n').length > (parsed.title ? 4 : 6) && (
                      <div className="absolute bottom-0 right-0 bg-gradient-to-l from-white dark:from-gray-900 to-transparent pl-8 pr-2">
                        <span className="text-xs text-gray-400 italic">нажмите для просмотра</span>
                      </div>
                    )}
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
          <p className="text-xs text-gray-500 mt-2">
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