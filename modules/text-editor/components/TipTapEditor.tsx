'use client'

import React, { forwardRef, useImperativeHandle, useEffect, useState, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'
import { Transaction } from '@tiptap/pm/state'
import { EditorState } from '@tiptap/pm/state'
import { ChainedCommands } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
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
import '@/styles/editor-tables.css'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon, 
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Link as LinkIcon,
  Undo,
  Redo,
  X,
  CheckSquare,
  Type,
  Table as TableIcon,
  Indent,
  Outdent
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { htmlToMarkdown, markdownToTipTapHTML } from '@/modules/notions'
import { useAutoSave } from '@/modules/notions/hooks/useAutoSave'
import { useListIndentation } from '@/hooks/useListIndentation'
import { TableSizeSelector } from '@/modules/text-editor/components/client'
import { TableControls } from '@/modules/text-editor/components/client'
import type { TipTapEditorProps, TipTapEditorRef } from '@/modules/text-editor/types'

export const TipTapEditor = forwardRef<TipTapEditorRef, TipTapEditorProps>(({
  initialTitle = '',
  initialValue,
  onSave,
  onCancel,
  titlePlaceholder = 'Заголовок заметки',
  showTitle = true,
  autoFocus = true,
  className,
  notionId,
  enableAutoSave = true
}, ref) => {
  const [title, setTitle] = useState(initialTitle)
  const [hasChanges, setHasChanges] = useState(false)
  const [tooltipState, setTooltipState] = useState<{
    show: boolean
    message: string
    duration: number
  }>({
    show: false,
    message: '',
    duration: 0
  })
  
  // Хук автосохранения
  const { saveStatus, triggerSave, forceSave } = useAutoSave({
    notionId,
    enabled: enableAutoSave && !!notionId,
    delay: 300 // Ещё быстрее для мгновенной реакции
  })

  // Функция для показа подсказки о невозможности создания таблицы
  const showTableBlockedTooltip = useCallback(() => {
    setTooltipState({
      show: true,
      message: 'Невозможно создать таблицу внутри таблицы',
      duration: 3000
    })
    setTimeout(() => {
      setTooltipState(prev => ({ ...prev, show: false }))
    }, 3000)
  }, [])

  // Функция для показа подсказки о замене символов "|"
  const showTablePipeWarningTooltip = useCallback(() => {
    setTooltipState({
      show: true,
      message: 'По техническим причинам все символы "|" внутри таблицы будут заменены на "/"',
      duration: 5000
    })
    setTimeout(() => {
      setTooltipState(prev => ({ ...prev, show: false }))
    }, 5000)
  }, [])

  // Отслеживание изменений состояния подсказки
  useEffect(() => {
  }, [tooltipState])

  // Комбинирование заголовка и содержимого
  const combineContent = (titleValue: string, editorContent: string) => {
    const cleanTitle = titleValue.trim()
    const cleanContent = editorContent.trim()
    
    if (!cleanTitle && !cleanContent) return ''
    
    // Если нет заголовка, но есть контент, устанавливаем "Без названия"
    if (!cleanTitle) {
      if (cleanContent) {
        return `# Без названия\n\n${cleanContent}`
      }
      return cleanContent
    }
    
    // Если есть заголовок, но нет контента
    if (!cleanContent) return `# ${cleanTitle}`
    
    // Если есть и заголовок, и контент
    return `# ${cleanTitle}\n\n${cleanContent}`
  }

  // Парсинг исходного содержимого
  const parseInitialContent = (content: string, hasExternalTitle: boolean) => {
    if (!content) return { title: '', editorContent: '' }
    
    // Если заголовок уже передан извне (через initialTitle), не извлекаем его из контента
    if (hasExternalTitle) {
      return { title: '', editorContent: content }
    }
    
    const lines = content.split('\n')
    const firstLine = lines[0]?.trim()
    
    // Проверяем, начинается ли первая строка с # (заголовок)
    if (firstLine?.startsWith('# ')) {
      const titleValue = firstLine.substring(2).trim()
      const remainingContent = lines.slice(1).join('\n').trim()
      // Удаляем лишние переносы строк в начале
      const cleanContent = remainingContent.replace(/^\n+/, '')
      return { title: titleValue, editorContent: cleanContent }
    }
    
    return { title: '', editorContent: content }
  }

  const { title: parsedTitle, editorContent: parsedContent } = parseInitialContent(initialValue, !!initialTitle)

  // Инициализируем заголовок
  useEffect(() => {
    if (initialTitle) {
      setTitle(initialTitle)
    } else {
      setTitle(parsedTitle)
    }
  }, [initialTitle, parsedTitle])

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
      TaskItem.configure({
        nested: true
      }),
      Placeholder.configure({
        placeholder: 'Начните писать свою заметку...'
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
        cellMinWidth: 50
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
      TableWithResizeButtons
    ],
    content: parsedContent ? markdownToTipTapHTML(parsedContent) : '<p></p>',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[200px] p-4 border rounded-md prose-headings:font-bold prose-h1:text-2xl prose-h1:mb-2 prose-h1:mt-4 prose-h2:text-xl prose-h2:mb-2 prose-h2:mt-4 prose-h3:text-lg prose-h3:mb-2 prose-h3:mt-4 prose-strong:font-bold prose-em:italic prose-ul:list-disc prose-ul:ml-6 prose-ol:list-decimal prose-ol:ml-6 prose-li:my-1',
      },

    },
    onUpdate: ({ editor }) => {
      setHasChanges(true)
      
      // Автосохранение при изменении контента
      if (enableAutoSave && notionId) {
        try {
          const editorHTML = editor.getHTML()
          const editorMarkdown = htmlToMarkdown(editorHTML)
          const combinedContent = combineContent(title, editorMarkdown)
          triggerSave(combinedContent)
        } catch (error) {
          console.error('Ошибка при автосохранении:', error)
        }
      }
    },
    onBlur: ({ editor }) => {
      // Принудительно сохраняем при потере фокуса
      if (enableAutoSave && notionId && hasChanges) {
        try {
          const editorHTML = editor.getHTML()
          const editorMarkdown = htmlToMarkdown(editorHTML)
          const combinedContent = combineContent(title, editorMarkdown)
          // Используем forceSave для немедленного сохранения без debounce
          forceSave(combinedContent)
        } catch (error) {
          console.error('Ошибка при сохранении на blur:', error)
        }
      }
    },
    autofocus: autoFocus && !showTitle
  })

  useImperativeHandle(ref, () => ({
    save: async () => {
      // Принудительное автосохранение
      if (enableAutoSave && notionId && editor) {
        try {
          const editorHTML = editor.getHTML()
          const editorMarkdown = htmlToMarkdown(editorHTML)
          const combinedContent = combineContent(title, editorMarkdown)
          await forceSave(combinedContent)
        } catch (error) {
          console.error('Ошибка при принудительном сохранении:', error)
        }
      } else {
        // Обычное сохранение через callback для режимов без автосохранения
        if (editor) {
          try {
            const editorHTML = editor.getHTML()
            const editorMarkdown = htmlToMarkdown(editorHTML)
            const combinedContent = combineContent(title, editorMarkdown)
            onSave(combinedContent)
            setHasChanges(false)
          } catch (error) {
            console.error('Ошибка при сохранении:', error)
          }
        }
      }
    },
    focus: () => {
      if (showTitle && !title.trim()) {
        document.getElementById('title-input')?.focus()
      } else {
        editor?.commands.focus()
      }
    },
    getContent: () => {
      if (!editor) return combineContent(title, '')
      try {
        // Получаем HTML-контент и конвертируем в markdown
        const editorHTML = editor.getHTML()
        const editorMarkdown = htmlToMarkdown(editorHTML)
        return combineContent(title, editorMarkdown)
      } catch (error) {
        console.error('Ошибка при получении контента:', error)
        return combineContent(title, '')
      }
    }
  }))



  // Функция принудительного сохранения
  const performForceSave = useCallback(async () => {
    if (!enableAutoSave || !notionId || !editor) return
    
    try {
      const editorHTML = editor.getHTML()
      const editorMarkdown = htmlToMarkdown(editorHTML)
      const combinedContent = combineContent(title, editorMarkdown)
      await forceSave(combinedContent)
    } catch (error) {
      console.error('Ошибка при принудительном сохранении:', error)
    }
  }, [enableAutoSave, notionId, editor, title, forceSave, combineContent])

  const handleTitleChange = (value: string) => {
    setTitle(value)
    setHasChanges(true)
    
    // Автосохранение при изменении заголовка
    if (enableAutoSave && notionId && editor) {
      try {
        const editorHTML = editor.getHTML()
        const editorMarkdown = htmlToMarkdown(editorHTML)
        const combinedContent = combineContent(value, editorMarkdown)
        triggerSave(combinedContent)
      } catch (error) {
        console.error('Ошибка при автосохранении заголовка:', error)
      }
    }
  }

  // Принудительное сохранение при различных событиях
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Если автосохранение включено, принудительно сохраняем
      if (enableAutoSave && notionId && hasChanges) {
        // Немедленно запускаем сохранение
        performForceSave()
        
        // Задерживаем закрытие на короткое время для завершения сохранения
        e.preventDefault()
        e.returnValue = ''
        
        // Через короткое время убираем блокировку
        setTimeout(() => {
          window.removeEventListener('beforeunload', handleBeforeUnload)
        }, 100)
      }
      
      // Если автосохранение выключено, показываем предупреждение
      if (!enableAutoSave && hasChanges) {
        e.preventDefault()
        e.returnValue = 'У вас есть несохраненные изменения. Вы уверены, что хотите покинуть страницу?'
      }
    }

    const handleVisibilityChange = () => {
      // Сохраняем при скрытии вкладки
      if (document.hidden && enableAutoSave && hasChanges) {
        performForceSave()
      }
    }

    const handlePageHide = () => {
      // Сохраняем при скрытии страницы (iOS Safari)
      if (enableAutoSave && hasChanges) {
        performForceSave()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', handlePageHide)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [hasChanges, enableAutoSave, notionId, title, editor, performForceSave, combineContent])

  // Горячие клавиши
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  // Обработчик клавиш для отступов в списках
  useListIndentation(editor)

  // Функция для вставки таблицы с проверками и дополнительной логикой
  const handleTableInsertion = useCallback((rows: number, cols: number, editor: any) => {
    // Проверяем, не находимся ли мы уже внутри ячейки таблицы
    const { selection } = editor.state
    const { $anchor } = selection
    
    let inTableCell = false
    for (let depth = $anchor.depth; depth > 0; depth--) {
      const node = $anchor.node(depth)
      if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
        inTableCell = true
        break
      }
    }
    
    // Если мы в ячейке таблицы, не создаем новую таблицу
    if (inTableCell) {
      showTableBlockedTooltip()
      return
    }
    
    // Вставляем таблицу и сразу добавляем параграф после неё в одной атомарной операции
    editor.chain()
      .focus()
      .insertTable({ 
        rows, 
        cols, 
        withHeaderRow: true 
      })
      .command(({ tr, state }: { tr: Transaction; state: EditorState }) => {
        // Получаем текущую позицию после вставки таблицы
        const { selection } = state
        const { $anchor } = selection
        
        // Находим таблицу, которая содержит текущую позицию
        let tableNode = null
        let tablePos = -1
        
        // Ищем таблицу от текущей позиции вверх по дереву
        for (let depth = $anchor.depth; depth > 0; depth--) {
          const node = $anchor.node(depth)
          if (node.type.name === 'table') {
            tableNode = node
            tablePos = $anchor.before(depth)
            break
          }
        }
        
        if (tableNode && tablePos >= 0) {
          // Позиция после таблицы
          const afterTablePos = tablePos + tableNode.nodeSize
          
          // Создаем пустой параграф
          const paragraph = state.schema.nodes.paragraph.create()
          
          // Вставляем параграф после таблицы
          tr.insert(afterTablePos, paragraph)
          
          // Устанавливаем курсор в новый параграф
          const $pos = tr.doc.resolve(afterTablePos + 1)
          tr.setSelection(TextSelection.near($pos))
          
          return true
        }
        
        return false
      })
      .command(({ commands }: { commands: ChainedCommands }) => {
        // Убеждаемся, что курсор находится после таблицы
        return commands.focus()
      })
      .run()
    
    // Показываем подсказку о замене символов "|"
    showTablePipeWarningTooltip()
  }, [showTableBlockedTooltip, showTablePipeWarningTooltip])

  if (!editor) {
    return null
  }

  return (
    <div className={cn('w-full max-w-4xl mx-auto h-full flex flex-col relative', className)}>
      {/* Подсказка о таблицах */}
      {tooltipState.show && (
        <div 
          className="absolute top-16 right-2 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 text-sm px-3 py-1 rounded-xl shadow-xl whitespace-nowrap border border-red-600 dark:border-red-800 z-50"
        >
          {tooltipState.message}
        </div>
      )}
      {/* Заголовок */}
      {showTitle && (
        <div className="mb-4 flex-shrink-0">
          <Input
            id="title-input"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            onBlur={() => {
              // Принудительно сохраняем при потере фокуса заголовка
              if (enableAutoSave && notionId && hasChanges && editor) {
                try {
                  const editorHTML = editor.getHTML()
                  const editorMarkdown = htmlToMarkdown(editorHTML)
                  const combinedContent = combineContent(title, editorMarkdown)
                  forceSave(combinedContent)
                } catch (error) {
                  console.error('Ошибка при сохранении заголовка на blur:', error)
                }
              }
            }}
            placeholder={titlePlaceholder}
            className="text-2xl font-bold mb-4 mt-6 border-0 border-b-2 border-gray-200 dark:border-gray-700 rounded-none px-0 focus:border-primary focus:ring-0 text-foreground dark:text-gray-100 !text-2xl bg-transparent"
            autoFocus={autoFocus}
          />
        </div>
      )}

      {/* Панель инструментов */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-t-lg bg-gray-50 dark:bg-gray-700 p-2 flex flex-wrap gap-1 flex-shrink-0">
        {/* Заголовки */}
        <div className="flex gap-1 mr-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('heading', { level: 1 }) 
                ? 'bg-primary text-primary-foreground hover:bg-primary/80' 
                : 'hover:bg-gray-200'
            )}
            title="Заголовок 1 (# )"
          >
            <Heading1 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('heading', { level: 2 }) 
                ? 'bg-primary text-primary-foreground hover:bg-primary/80' 
                : 'hover:bg-gray-200'
            )}
            title="Заголовок 2 (## )"
          >
            <Heading2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('heading', { level: 3 }) 
                ? 'bg-primary text-primary-foreground hover:bg-primary/80' 
                : 'hover:bg-gray-200'
            )}
            title="Заголовок 3 (### )"
          >
            <Heading3 className="h-4 w-4" />
          </Button>
        </div>

        {/* Разделитель */}
        <div className="w-px h-8 bg-gray-300 dark:bg-gray-600 mx-1 self-center" />

        {/* Форматирование текста */}
        <div className="flex gap-1 mr-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('bold') 
                ? 'bg-primary text-primary-foreground hover:bg-primary/80' 
                : 'hover:bg-gray-200 dark:hover:bg-gray-600'
            )}
            title="Жирный (Ctrl+B)"
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('italic') 
                ? 'bg-primary text-primary-foreground hover:bg-primary/80' 
                : 'hover:bg-gray-200 dark:hover:bg-gray-600'
            )}
            title="Курсив (Ctrl+I)"
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('underline') 
                ? 'bg-primary text-primary-foreground hover:bg-primary/80' 
                : 'hover:bg-gray-200 dark:hover:bg-gray-600'
            )}
            title="Подчеркнутый (Ctrl+U)"
          >
            <UnderlineIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('strike') 
                ? 'bg-primary text-primary-foreground hover:bg-primary/80' 
                : 'hover:bg-gray-200 dark:hover:bg-gray-600'
            )}
            title="Зачеркнутый (Ctrl+Shift+S)"
          >
            <Strikethrough className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('highlight') 
                ? 'bg-primary text-primary-foreground hover:bg-primary/80' 
                : 'hover:bg-gray-200 dark:hover:bg-gray-600'
            )}
            title="Выделение (Ctrl+Shift+H)"
          >
            <Highlighter className="h-4 w-4" />
          </Button>
        </div>

        {/* Разделитель */}
        <div className="w-px h-8 bg-gray-300 dark:bg-gray-600 mx-1 self-center" />

        {/* Списки */}
        <div className="flex gap-1 mr-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('bulletList') 
                ? 'bg-primary text-primary-foreground hover:bg-primary/80' 
                : 'hover:bg-gray-200 dark:hover:bg-gray-600'
            )}
            title="Маркированный список (- )"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('orderedList') 
                ? 'bg-primary text-primary-foreground hover:bg-primary/80' 
                : 'hover:bg-gray-200 dark:hover:bg-gray-600'
            )}
            title="Нумерованный список"
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('taskList') 
                ? 'bg-primary text-primary-foreground hover:bg-primary/80' 
                : 'hover:bg-gray-200 dark:hover:bg-gray-600'
            )}
            title="Список задач"
          >
            <CheckSquare className="h-4 w-4" />
          </Button>
        </div>


        {/* Разделитель */}
        <div className="w-px h-8 bg-gray-300 dark:bg-gray-600 mx-1 self-center" />

        {/* Цитата и код */}
        <div className="flex gap-1 mr-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('blockquote') 
                ? 'bg-primary text-primary-foreground hover:bg-primary/80' 
                : 'hover:bg-gray-200 dark:hover:bg-gray-600'
            )}
            title="Цитата"
          >
            <Quote className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('code') 
                ? 'bg-primary text-primary-foreground hover:bg-primary/80' 
                : 'hover:bg-gray-200 dark:hover:bg-gray-600'
            )}
            title="Инлайн код"
          >
            <Code className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={cn(
              'h-8 w-8 p-0',
              editor.isActive('codeBlock') 
                ? 'bg-primary text-primary-foreground hover:bg-primary/80' 
                : 'hover:bg-gray-200 dark:hover:bg-gray-600'
            )}
            title="Блок кода"
          >
            <Code2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Разделитель */}
        <div className="w-px h-8 bg-gray-300 dark:bg-gray-600 mx-1 self-center" />

        {/* Отмена/Повтор */}
        <div className="flex gap-1 mr-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="h-8 w-8 p-0"
            title="Отменить"
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="h-8 w-8 p-0"
            title="Повторить"
          >
            <Redo className="h-4 w-4" />
          </Button>
        </div>

        {/* Разделитель */}
        <div className="w-px h-8 bg-gray-300 dark:bg-gray-600 mx-1 self-center" />

        {/* Таблицы */}
        <div className="flex gap-1 mr-2">
          <TableSizeSelector 
            onSelect={(rows, cols) => {
              handleTableInsertion(rows, cols, editor)
            }} 
          />
        </div>

        {/* Управление таблицами - показывается только когда курсор в таблице */}
        <TableControls editor={editor} />



      </div>

      {/* Редактор */}
      <div className="border border-t-0 border-gray-200 dark:border-gray-700 rounded-b-lg bg-white dark:bg-gray-800 overflow-y-auto flex-1 min-h-0">
        <EditorContent 
          editor={editor} 
          className="prose prose-sm max-w-none h-full dark:prose-invert
                     [&_.ProseMirror]:min-h-full [&_.ProseMirror]:p-4 [&_.ProseMirror]:focus:outline-none [&_.ProseMirror]:text-gray-900 dark:[&_.ProseMirror]:text-gray-100
                     [&_.ProseMirror_h1]:text-2xl [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:mb-4 [&_.ProseMirror_h1]:mt-6 [&_.ProseMirror_h1]:text-gray-900 dark:[&_.ProseMirror_h1]:text-gray-100
                     [&_.ProseMirror_h2]:text-xl [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:mb-3 [&_.ProseMirror_h2]:mt-5 [&_.ProseMirror_h2]:text-gray-900 dark:[&_.ProseMirror_h2]:text-gray-100
                     [&_.ProseMirror_h3]:text-lg [&_.ProseMirror_h3]:font-bold [&_.ProseMirror_h3]:mb-2 [&_.ProseMirror_h3]:mt-4 [&_.ProseMirror_h3]:text-gray-900 dark:[&_.ProseMirror_h3]:text-gray-100
                     [&_.ProseMirror_strong]:font-bold [&_.ProseMirror_em]:italic [&_.ProseMirror_u]:underline [&_.ProseMirror_s]:line-through [&_.ProseMirror_s]:text-gray-500 dark:[&_.ProseMirror_s]:text-gray-400
                     [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:ml-6 [&_.ProseMirror_ul]:my-2
                     [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:ml-6 [&_.ProseMirror_ol]:my-2
                     [&_.ProseMirror_li]:my-1 [&_.ProseMirror_li]:leading-relaxed
                     [&_.ProseMirror_ul_ul]:list-[circle] [&_.ProseMirror_ul_ul]:ml-4
                     [&_.ProseMirror_ul_ul_ul]:list-[square] [&_.ProseMirror_ul_ul_ul]:ml-4
                     [&_.ProseMirror_ol_ol]:list-[lower-alpha] [&_.ProseMirror_ol_ol]:ml-4
                     [&_.ProseMirror_ol_ol_ol]:list-[lower-roman] [&_.ProseMirror_ol_ol_ol]:ml-4
                     [&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-gray-300 dark:[&_.ProseMirror_blockquote]:border-gray-600 [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_blockquote]:italic [&_.ProseMirror_blockquote]:text-gray-700 dark:[&_.ProseMirror_blockquote]:text-gray-300
                     [&_.ProseMirror_code]:bg-gray-100 dark:[&_.ProseMirror_code]:bg-gray-700 [&_.ProseMirror_code]:px-1 [&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:font-mono [&_.ProseMirror_code]:text-sm [&_.ProseMirror_code]:text-gray-800 dark:[&_.ProseMirror_code]:text-gray-200
                     [&_.ProseMirror_pre]:bg-gray-100 dark:[&_.ProseMirror_pre]:bg-gray-700 [&_.ProseMirror_pre]:p-4 [&_.ProseMirror_pre]:rounded-lg [&_.ProseMirror_pre]:overflow-x-auto [&_.ProseMirror_pre]:font-mono [&_.ProseMirror_pre]:text-sm [&_.ProseMirror_pre]:my-2 [&_.ProseMirror_pre_code]:bg-transparent [&_.ProseMirror_pre_code]:p-0 [&_.ProseMirror_pre]:text-gray-800 dark:[&_.ProseMirror_pre]:text-gray-200
                     [&_.ProseMirror_mark]:bg-yellow-200 dark:[&_.ProseMirror_mark]:bg-yellow-700/75 dark:[&_.ProseMirror_mark]:text-gray-100 [&_.ProseMirror_mark_s]:!text-gray-500 dark:[&_.ProseMirror_mark_s]:!text-gray-400 [&_.ProseMirror_ul[data-type='taskList']_li[data-checked='true']_>_div_[&_.ProseMirror_mark]]:!text-gray-500 dark:[&_.ProseMirror_ul[data-type='taskList']_li[data-checked='true']_>_div_[&_.ProseMirror_mark]]:!text-gray-400
                     [&_.ProseMirror_ul[data-type='taskList']]:list-none [&_.ProseMirror_ul[data-type='taskList']_li]:flex [&_.ProseMirror_ul[data-type='taskList']_li]:items-start [&_.ProseMirror_ul[data-type='taskList']_li]:gap-1 [&_.ProseMirror_ul[data-type='taskList']_li_>_label]:flex [&_.ProseMirror_ul[data-type='taskList']_li_>_label]:items-center [&_.ProseMirror_ul[data-type='taskList']_li_>_label]:gap-1 [&_.ProseMirror_ul[data-type='taskList']_li_>_label]:cursor-pointer [&_.ProseMirror_ul[data-type='taskList']_li_>_label]:min-h-[1.5rem] [&_.ProseMirror_ul[data-type='taskList']_li_>_label]:flex-shrink-0 [&_.ProseMirror_ul[data-type='taskList']_li_>_label_>_input[type='checkbox']]:m-0 [&_.ProseMirror_ul[data-type='taskList']_li_>_label_>_input[type='checkbox']]:accent-primary [&_.ProseMirror_ul[data-type='taskList']_li_>_label_>_input[type='checkbox']]:mt-[0.125rem] [&_.ProseMirror_ul[data-type='taskList']_li_>_div]:flex-1 [&_.ProseMirror_ul[data-type='taskList']_li_>_div]:min-h-[1.5rem] [&_.ProseMirror_ul[data-type='taskList']_li_>_div]:min-w-0 [&_.ProseMirror_ul[data-type='taskList']_li_>_div]:break-words [&_.ProseMirror_ul[data-type='taskList']_li_>_div_>_p]:break-words [&_.ProseMirror_ul[data-type='taskList']_li[data-checked='true']_>_div]:!text-gray-500 dark:[&_.ProseMirror_ul[data-type='taskList']_li[data-checked='true']_>_div]:!text-gray-400 [&_.ProseMirror_ul[data-type='taskList']_li[data-checked='true']_>_div]:!line-through [&_.ProseMirror_ul[data-type='taskList']_li[data-checked='true']_>_div_>_p]:!text-gray-500 dark:[&_.ProseMirror_ul[data-type='taskList']_li[data-checked='true']_>_div_>_p]:!text-gray-400 [&_.ProseMirror_ul[data-type='taskList']_li[data-checked='true']_>_div_>_p]:!line-through
                     [&_.ProseMirror_ul[data-type='taskList']_ul[data-type='taskList']]:ml-4 [&_.ProseMirror_ul[data-type='taskList']_ul[data-type='taskList']_ul[data-type='taskList']]:ml-4"
        />
      </div>

      {/* Индикатор изменений - только если автосохранение выключено */}
      {hasChanges && !enableAutoSave && (
        <div className="mt-2 text-sm text-muted-foreground flex items-center gap-1 flex-shrink-0">
          <div className="w-2 h-2 bg-foreground rounded-full animate-pulse" />
          Есть несохраненные изменения
        </div>
      )}
    </div>
  )
})

TipTapEditor.displayName = 'TipTapEditor' 