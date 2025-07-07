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
        "p-4 transition-all duration-200 hover:shadow-md dark:hover:shadow-lg dark:hover:shadow-gray-500/20 cursor-pointer bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600",
        notion.notion_done && "opacity-50 bg-gray-50 dark:bg-gray-800/50",
        isSelected && "border-2 border-primary"
      )}
      onClick={handleCardClick}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          {/* Чекбокс для выбора заметки */}
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect(notion.notion_id)}
            className="flex-shrink-0 mt-[0.4rem]"
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
                      "text-2xl font-bold leading-tight mb-2 line-clamp-2 text-gray-900 dark:text-gray-100",
                      notion.notion_done && "line-through text-gray-500 dark:text-gray-400"
                    )}>
                      {parsed.title}
                    </h1>
                  )}

                  {/* Содержимое markdown с ограничением высоты */}
                  {parsed.content && (
                    <div className="relative">
                      <div className={cn(
                        "max-w-none text-sm leading-relaxed relative text-gray-700 dark:text-gray-300",
                        parsed.title ? "line-clamp-3" : "line-clamp-4",
                        notion.notion_done && "line-through text-gray-500 dark:text-gray-400"
                      )}
                      >
                        <div 
                          className="prose prose-sm max-w-none dark:prose-invert
                                   [&_.bullet-line]:flex [&_.bullet-line]:items-start [&_.bullet-line]:gap-2 [&_.bullet-line]:my-1
                                   [&_.checkbox-line]:flex [&_.checkbox-line]:items-start [&_.checkbox-line]:gap-2 [&_.checkbox-line]:my-1
                                   [&_.checkbox-line_input[type='checkbox']:checked]:accent-primary dark:[&_.checkbox-line_input[type='checkbox']:checked]:accent-primary
                                   [&_s]:line-through [&_s]:text-gray-500 dark:[&_s]:text-gray-400 [&_s]:opacity-61
                                   [&_strong]:text-gray-900 dark:[&_strong]:text-gray-100
                                   [&_em]:text-gray-700 dark:[&_em]:text-gray-300
                                   [&_u]:text-gray-700 dark:[&_u]:text-gray-300
                                   [&_table]:border-collapse [&_table]:table [&_table]:max-w-full [&_table]:min-w-[200px] [&_table]:border [&_table]:border-gray-300 dark:[&_table]:border-gray-600 [&_table]:relative
                                   [&_td]:border [&_td]:border-gray-300 dark:[&_td]:border-gray-600 [&_td]:p-2 [&_td]:min-w-[50px] [&_td]:relative [&_td]:transition-all [&_td]:duration-200 [&_td]:bg-white dark:[&_td]:bg-gray-800 [&_td]:text-gray-900 dark:[&_td]:text-gray-100
                                   [&_th]:border [&_th]:border-gray-300 dark:[&_th]:border-gray-600 [&_th]:p-2 [&_th]:bg-gray-50 dark:[&_th]:bg-gray-700 [&_th]:font-semibold [&_th]:min-w-[50px] [&_th]:relative [&_th]:transition-all [&_th]:duration-200 [&_th]:text-gray-900 dark:[&_th]:text-gray-100
                                   [&_table_tr:first-child_td]:bg-gray-50 dark:[&_table_tr:first-child_td]:bg-gray-700 [&_table_tr:first-child_td]:font-semibold [&_table_tr:first-child_td]:text-center [&_table_tr:first-child_td]:text-gray-900 dark:[&_table_tr:first-child_td]:text-gray-100
                                   [&_table_tr:first-child_th]:bg-gray-50 dark:[&_table_tr:first-child_th]:bg-gray-700 [&_table_tr:first-child_th]:font-semibold [&_table_tr:first-child_th]:text-center [&_table_tr:first-child_th]:text-gray-900 dark:[&_table_tr:first-child_th]:text-gray-100
                                   [&_table_tr:not(:first-child)_th]:bg-white dark:[&_table_tr:not(:first-child)_th]:bg-gray-800 [&_table_tr:not(:first-child)_th]:font-normal [&_table_tr:not(:first-child)_th]:text-left [&_table_tr:not(:first-child)_th]:text-gray-900 dark:[&_table_tr:not(:first-child)_th]:text-gray-100
                                   [&_table_tr:not(:first-child)_td]:bg-white dark:[&_table_tr:not(:first-child)_td]:font-normal [&_table_tr:not(:first-child)_td]:text-left [&_table_tr:not(:first-child)_td]:text-gray-900 dark:[&_table_tr:not(:first-child)_td]:text-gray-100
                                   [&_mark]:bg-yellow-200 dark:[&_mark]:bg-yellow-700/75 dark:[&_mark]:text-gray-100"
                          dangerouslySetInnerHTML={{ 
                            __html: markdownToHtml(parsed.content)
                          }} 
                        />
                      </div>

                    </div>
                  )}

                  {/* Если нет ни заголовка, ни контента */}
                  {!parsed.title && !parsed.content && (
                    <p className="text-gray-500 dark:text-gray-400 italic">Пустая заметка</p>
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
                notion.notion_done ? "text-green-600 dark:text-green-400" : "text-gray-400 dark:text-gray-500"
              )} />
            </Button>

            {/* Кнопка удаления */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              className="h-8 w-8 p-0 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              title="Удалить"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Дата последнего изменения - вынесена за пределы ограничения высоты */}
        <div className="flex justify-between items-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
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