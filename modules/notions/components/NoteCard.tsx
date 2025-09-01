'use client'

import { useState, useRef, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Check, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { parseNotionContent, markdownToTipTapHTML } from '@/modules/notions'
import { SingleDeleteConfirm } from '@/modules/notions/components/SingleDeleteConfirm'
import type { Notion } from '@/modules/notions/types'
import DOMPurify from 'isomorphic-dompurify'

interface NoteCardProps {
  notion: Notion
  isSelected: boolean
  isActive?: boolean
  onToggleSelect: (id: string) => void
  onUpdate: (id: string, content: string) => void
  onToggleDone: (id: string) => void
  onDelete: (id: string) => void
  onOpenFullView: (notion: Notion) => void

  showSelection?: boolean
}

// Хелпер для безопасной санитизации HTML
const sanitizeHTML = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['target', 'rel', 'data-type', 'data-checked']
  })
}

export function NoteCard({
  notion,
  isSelected,
  isActive = false,
  onToggleSelect,
  onUpdate,
  onToggleDone,
  onDelete,
  onOpenFullView,

  showSelection = false
}: NoteCardProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [needsExpansion, setNeedsExpansion] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

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

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsExpanded(!isExpanded)
  }

  // Проверяем, нужно ли показывать кнопку разворачивания
  useEffect(() => {
    const checkContentOverflow = () => {
      if (contentRef.current) {
        const element = contentRef.current
        const isOverflowing = element.scrollHeight > element.clientHeight
        setNeedsExpansion(isOverflowing)
      }
    }

    // Небольшая задержка для корректной работы после рендеринга
    const timeoutId = setTimeout(checkContentOverflow, 50)

    return () => clearTimeout(timeoutId)
  }, [notion])



  return (
    <Card 
      className={cn(
        "p-4 transition-all duration-300 hover:shadow-md dark:hover:shadow-lg dark:hover:shadow-gray-500/20 cursor-pointer bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600",
        isActive && "bg-gray-50 dark:bg-gray-600/60",
        notion.notion_done && "opacity-50 bg-gray-50 dark:bg-gray-800/50",
        isSelected && "border-2 border-primary",
        isExpanded && "shadow-lg dark:shadow-xl"
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
          <div className={cn(
            "flex-1 min-w-0 transition-all duration-300",
            isExpanded ? "max-h-none" : "max-h-[140px] overflow-hidden"
          )}>
            {/* Парсим контент для разделения заголовка и содержимого */}
            {(() => {
              const parsed = parseNotionContent(notion)
              return (
                <>
                  {/* Заголовок заметки */}
                  {parsed.title && (
                    <h1 className={cn(
                      "text-xl font-semibold leading-tight mb-2 line-clamp-2 text-gray-900 dark:text-gray-100",
                      notion.notion_done && "line-through text-gray-500 dark:text-gray-400"
                    )}>
                      {parsed.title}
                    </h1>
                  )}

                  {/* Содержимое markdown только для чтения */}
                  {parsed.content && (
                    <div className="relative">
                      <div
                        ref={contentRef}
                        className={cn(
                          "max-w-none text-sm leading-relaxed relative text-gray-700 dark:text-gray-300 overflow-hidden",
                          !isExpanded && (parsed.title ? "line-clamp-3" : "line-clamp-4"),
                          notion.notion_done && "line-through text-gray-500 dark:text-gray-400"
                        )}
                      >
                        <div
                          className="prose prose-sm max-w-none dark:prose-invert pointer-events-none table-preview-mode [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:my-2 [&_ul]:text-gray-900 dark:[&_ul]:text-gray-100 [&_ul_::marker]:text-gray-900 dark:[&_ul_::marker]:text-gray-100 [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:my-2 [&_ol]:text-gray-900 dark:[&_ol]:text-gray-100 [&_ol_::marker]:text-gray-900 dark:[&_ol_::marker]:text-gray-100 [&_li]:my-1 [&_li]:leading-relaxed [&_ul_ul]:list-[circle] [&_ul_ul]:ml-4 [&_ul_ul_ul]:list-[square] [&_ul_ul_ul]:ml-4 [&_s]:line-through [&_s]:text-gray-500 dark:[&_s]:text-gray-400 [&_s]:opacity-[0.61] [&_ol_ol_ol]:list-[lower-roman] [&_ol_ol_ol]:ml-4 [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 dark:[&_blockquote]:border-gray-600 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-gray-700 dark:[&_blockquote]:text-gray-300 [&_blockquote_::before]:content-none [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4 [&_h1]:mt-6 [&_h1]:text-gray-900 dark:[&_h1]:text-gray-100 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-3 [&_h2]:mt-5 [&_h2]:text-gray-900 dark:[&_h2]:text-gray-100 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-gray-900 dark:[&_h3]:text-gray-100 [&_code]:bg-gray-100 dark:[&_code]:bg-gray-700 [&_code]:px-1 [&_code]:rounded [&_code]:font-mono [&_code]:text-sm [&_code]:text-gray-800 dark:[&_code]:text-gray-200 [&_pre]:bg-gray-100 dark:[&_pre]:bg-gray-700 [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:font-mono [&_pre]:text-sm [&_pre]:my-2 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre]:text-gray-800 dark:[&_pre]:text-gray-200 [&_mark]:bg-yellow-200 dark:[&_mark]:bg-yellow-700/75 dark:[&_mark]:text-gray-100 [&_mark_s]:!text-gray-500 dark:[&_mark_s]:!text-gray-400 [&_ul[data-type='taskList']]:list-none [&_ul[data-type='taskList']_li]:flex [&_ul[data-type='taskList']_li]:items-center [&_ul[data-type='taskList']_li]:gap-2 [&_ul[data-type='taskList']_li_>_label]:flex [&_ul[data-type='taskList']_li_>_label]:items-center [&_ul[data-type='taskList']_li_>_label]:gap-1 [&_ul[data-type='taskList']_li_>_label]:cursor-pointer [&_ul[data-type='taskList']_li_>_label]:min-h-[1.5rem] [&_ul[data-type='taskList']_li_>_label]:flex-shrink-0 [&_ul[data-type='taskList']_li_>_label_>_input[type='checkbox']]:m-0 [&_ul[data-type='taskList']_li_>_label_>_input[type='checkbox']]:accent-primary [&_ul[data-type='taskList']_li_>_label_>_input[type='checkbox']]:w-4 [&_ul[data-type='taskList']_li_>_label_>_input[type='checkbox']]:h-4 [&_ul[data-type='taskList']_li_>_div]:flex-1 [&_ul[data-type='taskList']_li_>_div]:min-h-[1.5rem] [&_ul[data-type='taskList']_li_>_div]:min-w-0 [&_ul[data-type='taskList']_li_>_div]:break-words [&_ul[data-type='taskList']_li_>_div_>_p]:break-words [&_ul[data-type='taskList']_li[data-checked='true']_>_div]:!text-gray-500 dark:[&_ul[data-type='taskList']_li[data-checked='true']_>_div]:!text-gray-400 [&_ul[data-type='taskList']_li[data-checked='true']_>_div]:!line-through [&_ul[data-type='taskList']_li[data-checked='true']_>_div_>_p]:!text-gray-500 dark:[&_ul[data-type='taskList']_li[data-checked='true']_>_div_>_p]:!text-gray-400 [&_ul[data-type='taskList']_li[data-checked='true']_>_div_>_p]:!line-through [&_s]:line-through [&_s]:text-gray-500 dark:[&_s]:text-gray-400 [&_s]:opacity-61 [&_strong]:text-gray-900 dark:[&_strong]:text-gray-100 [&_em]:text-gray-700 dark:[&_em]:text-gray-300 [&_u]:text-gray-700 dark:[&_u]:text-gray-300 [&_table]:border-collapse [&_table]:table [&_table]:max-w-full [&_table]:min-w-[200px] [&_table]:border [&_table]:border-gray-300 dark:[&_table]:border-gray-600 [&_table]:relative [&_table]:my-4 [&_table]:table-auto [&_table]:w-full [&_td]:border [&_td]:border-gray-300 dark:[&_td]:border-gray-600 [&_td]:p-2 [&_td]:min-w-0 [&_td]:relative [&_td]:transition-all [&_td]:duration-200 [&_td]:bg-white dark:[&_td]:bg-gray-800 [&_td]:text-gray-900 dark:[&_td]:text-gray-100 [&_td]:break-words [&_td]:overflow-hidden [&_th]:border [&_th]:border-gray-300 dark:[&_th]:border-gray-600 [&_th]:p-2 [&_th]:bg-gray-50 dark:[&_th]:bg-gray-700 [&_th]:font-semibold [&_th]:min-w-0 [&_th]:relative [&_th]:transition-all [&_th]:duration-200 [&_th]:text-gray-900 dark:[&_th]:text-gray-100 [&_th]:break-words [&_th]:overflow-hidden [&_table_tr:first-child_td]:bg-white dark:[&_table_tr:first-child_td]:bg-gray-800 [&_table_tr:first-child_td]:font-normal [&_table_tr:first-child_td]:text-left [&_table_tr:first-child_td]:text-gray-900 dark:[&_table_tr:first-child_td]:text-gray-100 [&_table_tr:first-child_th]:bg-gray-50 dark:[&_table_tr:first-child_th]:bg-gray-700 [&_table_tr:first-child_th]:font-semibold [&_table_tr:first-child_th]:text-center [&_table_tr:first-child_th]:text-gray-900 dark:[&_table_tr:first-child_th]:text-gray-100 [&_table_tr:not(:first-child)_th]:bg-gray-50 dark:[&_table_tr:not(:first-child)_th]:bg-gray-700 [&_table_tr:not(:first-child)_th]:font-normal [&_table_tr:not(:first-child)_th]:text-left [&_table_tr:not(:first-child)_th]:text-gray-900 dark:[&_table_tr:not(:first-child)_th]:text-gray-100 [&_table_tr:not(:first-child)_td]:bg-white dark:[&_table_tr:not(:first-child)_td]:bg-gray-800 [&_table_tr:not(:first-child)_td]:font-normal [&_table_tr:not(:first-child)_td]:text-left [&_table_tr:not(:first-child)_td]:text-gray-900 dark:[&_table_tr:not(:first-child)_td]:text-gray-100 [&_mark]:bg-yellow-200 dark:[&_mark]:bg-yellow-700/75 dark:[&_mark]:text-gray-100"
                          dangerouslySetInnerHTML={{ 
                            __html: sanitizeHTML(markdownToTipTapHTML(parsed.content))
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
            {/* Кнопка разворачивания/сворачивания - показывается только если есть что разворачивать */}
            {needsExpansion && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleExpand}
                className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-600"
                title={isExpanded ? "Свернуть заметку" : "Развернуть заметку"}
              >
                <ChevronDown className={cn(
                  "h-4 w-4 text-gray-600 dark:text-gray-400 transition-transform duration-300",
                  isExpanded && "rotate-180"
                )} />
              </Button>
            )}

            {/* Кнопка отметки выполнения */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleDone(notion.notion_id)}
              className="h-8 w-8 p-0"
              title={notion.notion_done ? "Разархивировать" : "Архивировать"}
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