'use client'

import React, { useState, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon,
  List,
  CheckSquare,
  Highlighter,
  X,
  Indent,
  Outdent
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { htmlToMarkdown } from '@/modules/notions'
import { useAutoSave } from '@/modules/notions/hooks/useAutoSave'
import { SaveIndicator } from '@/modules/notions/components/SaveIndicator'
import { useNotionsStore } from '@/modules/notions/store'
import type { QuickTipTapNoteProps } from '@/modules/text-editor/types'

export function QuickTipTapNote({
  onSave,
  onCancel,
  placeholder = 'Введите текст заметки...',
  titlePlaceholder = 'Заголовок заметки',
  autoFocus = true
}: QuickTipTapNoteProps) {
  const [title, setTitle] = useState('')
  const [hasChanges, setHasChanges] = useState(false)
  const [createdNotionId, setCreatedNotionId] = useState<string | null>(null)
  const { createNotionSilent } = useNotionsStore()
  
  // Хук автосохранения
  const { saveStatus, triggerSave } = useAutoSave({
    notionId: createdNotionId || undefined,
    enabled: !!createdNotionId,
    delay: 300
  })

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        },
        bulletList: {
          keepMarks: true,
          keepAttributes: true
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: true
        }
      }),
      Underline,
      Highlight,
      TaskList,
      TaskItem.configure({
        nested: true
      }),
      Placeholder.configure({
        placeholder
      })
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[120px] p-3 prose-headings:font-bold prose-h1:text-xl prose-h1:mb-2 prose-h2:text-lg prose-h2:mb-2 prose-h3:text-base prose-h3:mb-2 prose-strong:font-bold prose-em:italic prose-ul:list-disc prose-ul:ml-4 prose-ol:list-decimal prose-ol:ml-4 prose-li:my-1',
      },
    },
    onUpdate: async ({ editor }) => {
      setHasChanges(true)
      
      // Автосоздание заметки при первом изменении
      if (!createdNotionId) {
        try {
          const editorHTML = editor.getHTML()
          const editorMarkdown = htmlToMarkdown(editorHTML).trim()
          const titleContent = title.trim()
          
          // Создаем заметку только если есть контент
          if (titleContent || editorMarkdown) {
            let combinedContent = ''
            if (titleContent && editorMarkdown) {
              combinedContent = `# ${titleContent}\n\n${editorMarkdown}`
            } else if (titleContent) {
              combinedContent = `# ${titleContent}`
            } else {
              combinedContent = editorMarkdown
            }
            
                         const newNotion = await createNotionSilent({ notion_content: combinedContent })
             setCreatedNotionId(newNotion.notion_id)
          }
        } catch (error) {
          console.error('Ошибка при автосоздании заметки:', error)
        }
      } else {
        // Автосохранение существующей заметки
        try {
          const editorHTML = editor.getHTML()
          const editorMarkdown = htmlToMarkdown(editorHTML).trim()
          const titleContent = title.trim()
          
          let combinedContent = ''
          if (titleContent && editorMarkdown) {
            combinedContent = `# ${titleContent}\n\n${editorMarkdown}`
          } else if (titleContent) {
            combinedContent = `# ${titleContent}`
          } else {
            combinedContent = editorMarkdown
          }
          
          triggerSave(combinedContent)
        } catch (error) {
          console.error('Ошибка при автосохранении:', error)
        }
      }
    },
    autofocus: autoFocus
  })



  const handleCancel = () => {
    // Заметка уже автоматически сохранена, просто вызываем onCancel
    onCancel()
  }

  // Обработчик клавиш для отступов в списках
  useEffect(() => {
    if (!editor) return

    const handleTabKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        const isInListItem = editor.isActive('listItem')
        const isInTaskItem = editor.isActive('taskItem')
        
        if (isInListItem || isInTaskItem) {
          event.preventDefault()
          
          if (event.shiftKey) {
            // Shift+Tab - уменьшить отступ
            if (isInListItem && editor.can().liftListItem('listItem')) {
              editor.chain().focus().liftListItem('listItem').run()
            } else if (isInTaskItem && editor.can().liftListItem('taskItem')) {
              editor.chain().focus().liftListItem('taskItem').run()
            }
          } else {
            // Tab - увеличить отступ
            if (isInListItem && editor.can().sinkListItem('listItem')) {
              editor.chain().focus().sinkListItem('listItem').run()
            } else if (isInTaskItem && editor.can().sinkListItem('taskItem')) {
              editor.chain().focus().sinkListItem('taskItem').run()
            }
          }
        }
      }
    }

    const editorElement = editor.view.dom
    editorElement.addEventListener('keydown', handleTabKeyDown)

    return () => {
      editorElement.removeEventListener('keydown', handleTabKeyDown)
    }
  }, [editor])

  if (!editor) {
    return null
  }

  return (
    <Card className="p-4 mb-4">
      {/* Заголовок */}
      <div className="mb-3">
        <Input
          value={title}
          onChange={async (e) => {
            const newTitle = e.target.value
            setTitle(newTitle)
            setHasChanges(true)
            
            // Автосоздание заметки при изменении заголовка
            if (!createdNotionId && newTitle.trim()) {
              try {
                const editorHTML = editor?.getHTML() || ''
                const editorMarkdown = htmlToMarkdown(editorHTML).trim()
                
                let combinedContent = ''
                if (newTitle.trim() && editorMarkdown) {
                  combinedContent = `# ${newTitle.trim()}\n\n${editorMarkdown}`
                } else if (newTitle.trim()) {
                  combinedContent = `# ${newTitle.trim()}`
                } else {
                  combinedContent = editorMarkdown
                }
                
                if (combinedContent) {
                  const newNotion = await createNotionSilent({ notion_content: combinedContent })
                  setCreatedNotionId(newNotion.notion_id)
                }
              } catch (error) {
                console.error('Ошибка при автосоздании заметки из заголовка:', error)
              }
            } else if (createdNotionId) {
              // Автосохранение существующей заметки
              try {
                const editorHTML = editor?.getHTML() || ''
                const editorMarkdown = htmlToMarkdown(editorHTML).trim()
                
                let combinedContent = ''
                if (newTitle.trim() && editorMarkdown) {
                  combinedContent = `# ${newTitle.trim()}\n\n${editorMarkdown}`
                } else if (newTitle.trim()) {
                  combinedContent = `# ${newTitle.trim()}`
                } else {
                  combinedContent = editorMarkdown
                }
                
                triggerSave(combinedContent)
              } catch (error) {
                console.error('Ошибка при автосохранении заголовка:', error)
              }
            }
          }}
          placeholder={titlePlaceholder}
          className="text-2xl font-bold leading-none mb-2 border-0 border-b-2 border-gray-200 rounded-none px-0 focus:border-primary focus:ring-0"
        />
      </div>

      {/* Упрощенная панель инструментов */}
      <div className="flex items-center gap-1 mb-3 p-2 bg-white rounded border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn(
            'h-7 w-7 p-0',
            editor.isActive('bold') 
              ? 'bg-primary text-primary-foreground hover:bg-primary/80' 
              : 'hover:bg-gray-200'
          )}
          title="Жирный"
        >
          <Bold className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn(
            'h-7 w-7 p-0',
            editor.isActive('italic') 
              ? 'bg-primary text-primary-foreground hover:bg-primary/80' 
              : 'hover:bg-gray-200'
          )}
          title="Курсив"
        >
          <Italic className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={cn(
            'h-7 w-7 p-0',
            editor.isActive('underline') 
              ? 'bg-primary text-primary-foreground hover:bg-primary/80' 
              : 'hover:bg-gray-200'
          )}
          title="Подчеркнутый"
        >
          <UnderlineIcon className="h-3 w-3" />
        </Button>
        
        <div className="w-px h-7 bg-gray-300 mx-1 self-center" />
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn(
            'h-7 w-7 p-0',
            editor.isActive('bulletList') 
              ? 'bg-primary text-primary-foreground hover:bg-primary/80' 
              : 'hover:bg-gray-200'
          )}
          title="Список"
        >
          <List className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={cn(
            'h-7 w-7 p-0',
            editor.isActive('taskList') 
              ? 'bg-primary text-primary-foreground hover:bg-primary/80' 
              : 'hover:bg-gray-200'
          )}
          title="Задачи"
        >
          <CheckSquare className="h-3 w-3" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (editor.isActive('listItem')) {
              editor.chain().focus().sinkListItem('listItem').run()
            } else if (editor.isActive('taskItem')) {
              editor.chain().focus().sinkListItem('taskItem').run()
            }
          }}
          disabled={!editor.can().sinkListItem('listItem') && !editor.can().sinkListItem('taskItem')}
          className="h-7 w-7 p-0"
          title="Увеличить отступ"
        >
          <Indent className="h-3 w-3" />
        </Button>

        
        <div className="w-px h-7 bg-gray-300 mx-1 self-center" />
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          className={cn(
            'h-7 w-7 p-0',
            editor.isActive('highlight') 
              ? 'bg-primary text-primary-foreground hover:bg-primary/80' 
              : 'hover:bg-gray-200'
          )}
          title="Выделение"
        >
          <Highlighter className="h-3 w-3" />
        </Button>

        <div className="flex items-center gap-2 ml-auto">
          <SaveIndicator status={saveStatus} />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="h-7 px-2 text-xs text-gray-600"
          >
            <X className="h-3 w-3 mr-1" />
            Закрыть
          </Button>
        </div>
      </div>

      {/* Редактор */}
      <div className="bg-white border rounded-md">
        <EditorContent 
          editor={editor}
          className="prose prose-sm max-w-none
                     [&_.ProseMirror]:min-h-[120px] [&_.ProseMirror]:focus:outline-none
                     [&_.ProseMirror_h1]:text-xl [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:mb-2
                     [&_.ProseMirror_h2]:text-lg [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:mb-2
                     [&_.ProseMirror_h3]:text-base [&_.ProseMirror_h3]:font-bold [&_.ProseMirror_h3]:mb-2
                     [&_.ProseMirror_strong]:font-bold [&_.ProseMirror_em]:italic [&_.ProseMirror_u]:underline [&_.ProseMirror_s]:line-through [&_.ProseMirror_s]:text-gray-500
                     [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:ml-4 [&_.ProseMirror_ul]:my-1
                     [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:ml-4 [&_.ProseMirror_ol]:my-1
                     [&_.ProseMirror_li]:leading-relaxed
                     [&_.ProseMirror_ul_ul]:list-[circle] [&_.ProseMirror_ul_ul]:ml-4
                     [&_.ProseMirror_ul_ul_ul]:list-[square] [&_.ProseMirror_ul_ul_ul]:ml-4
                     [&_.ProseMirror_ol_ol]:list-[lower-alpha] [&_.ProseMirror_ol_ol]:ml-4
                     [&_.ProseMirror_ol_ol_ol]:list-[lower-roman] [&_.ProseMirror_ol_ol_ol]:ml-4
                     [&_.ProseMirror_mark]:bg-yellow-200
                     [&_.ProseMirror_ul[data-type='taskList']]:list-none [&_.ProseMirror_ul[data-type='taskList']_li]:flex [&_.ProseMirror_ul[data-type='taskList']_li]:items-start [&_.ProseMirror_ul[data-type='taskList']_li]:gap-1 [&_.ProseMirror_ul[data-type='taskList']_li_>_label]:flex [&_.ProseMirror_ul[data-type='taskList']_li_>_label]:items-center [&_.ProseMirror_ul[data-type='taskList']_li_>_label]:gap-1 [&_.ProseMirror_ul[data-type='taskList']_li_>_label]:cursor-pointer [&_.ProseMirror_ul[data-type='taskList']_li_>_label]:min-h-[1.5rem] [&_.ProseMirror_ul[data-type='taskList']_li_>_label]:flex-shrink-0 [&_.ProseMirror_ul[data-type='taskList']_li_>_label_>_input[type='checkbox']]:m-0 [&_.ProseMirror_ul[data-type='taskList']_li_>_label_>_input[type='checkbox']]:accent-primary [&_.ProseMirror_ul[data-type='taskList']_li_>_label_>_input[type='checkbox']]:mt-[0.125rem] [&_.ProseMirror_ul[data-type='taskList']_li_>_div]:flex-1 [&_.ProseMirror_ul[data-type='taskList']_li_>_div]:min-h-[1.5rem] [&_.ProseMirror_ul[data-type='taskList']_li_>_div]:min-w-0 [&_.ProseMirror_ul[data-type='taskList']_li_>_div]:break-words [&_.ProseMirror_ul[data-type='taskList']_li_>_div_>_p]:break-words [&_.ProseMirror_ul[data-type='taskList']_li[data-checked='true']_>_div]:!text-gray-500 [&_.ProseMirror_ul[data-type='taskList']_li[data-checked='true']_>_div]:!line-through [&_.ProseMirror_ul[data-type='taskList']_li[data-checked='true']_>_div_>_p]:!text-gray-500 [&_.ProseMirror_ul[data-type='taskList']_li[data-checked='true']_>_div_>_p]:!line-through
                     [&_.ProseMirror_ul[data-type='taskList']_ul[data-type='taskList']]:ml-4 [&_.ProseMirror_ul[data-type='taskList']_ul[data-type='taskList']_ul[data-type='taskList']]:ml-4"
        />
      </div>

      {/* Подсказка об автосохранении */}
      <div className="mt-2 text-xs text-muted-foreground text-center">
        Изменения сохраняются автоматически при вводе
      </div>
    </Card>
  )
} 