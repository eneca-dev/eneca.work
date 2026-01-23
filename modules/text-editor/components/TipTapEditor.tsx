'use client'

import React, { forwardRef, useImperativeHandle, useEffect, useState, useCallback, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'
import { Transaction } from '@tiptap/pm/state'
import { EditorState } from '@tiptap/pm/state'
import { ChainedCommands } from '@tiptap/react'
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
import { BubbleMenuToolbar } from '@/modules/text-editor/components/BubbleMenuToolbar'
import '@/styles/editor-tables.css'
import { Input } from '@/components/ui/input'
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
    delay: 600 // Чуть дольше, чтобы избежать лишних перерисовок во время набора
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

  // Функция для проверки, находится ли курсор внутри цитаты
  const isInsideBlockquote = useCallback((editor: any) => {
    if (!editor) return false

    const { selection } = editor.state
    const { $anchor } = selection

    // Проверяем все уровни вверх от текущей позиции
    for (let depth = $anchor.depth; depth > 0; depth--) {
      const node = $anchor.node(depth)
      if (node.type.name === 'blockquote') {
        return true
      }
    }

    return false
  }, [])

  // Функция для проверки, находится ли курсор внутри блока кода
  const isInsideCodeBlock = useCallback((editor: any) => {
    if (!editor) return false

    const { selection } = editor.state
    const { $anchor } = selection

    // Проверяем все уровни вверх от текущей позиции
    for (let depth = $anchor.depth; depth > 0; depth--) {
      const node = $anchor.node(depth)
      if (node.type.name === 'codeBlock') {
        return true
      }
    }

    return false
  }, [])

  // Функция для показа подсказки о невозможности создания чекбокса в цитате
  const showBlockquoteTaskBlockedTooltip = useCallback(() => {
    setTooltipState({
      show: true,
      message: 'Невозможно создать чекбокс внутри цитаты',
      duration: 3000
    })
    setTimeout(() => {
      setTooltipState(prev => ({ ...prev, show: false }))
    }, 3000)
  }, [])

  // Функция для показа подсказки о невозможности создания списков в цитате
  const showBlockquoteListBlockedTooltip = useCallback(() => {
    setTooltipState({
      show: true,
      message: 'Невозможно создать список внутри цитаты',
      duration: 3000
    })
    setTimeout(() => {
      setTooltipState(prev => ({ ...prev, show: false }))
    }, 3000)
  }, [])

  // Функция для показа предупреждения о списках в цитате
  const showBlockquoteListWarningTooltip = useCallback(() => {
    setTooltipState({
      show: true,
      message: 'Списки внутри цитаты удаляются после закрытия заметки. Вы можете потерять данные. Постарайтесь избегать списков внутри цитат',
      duration: 5000
    })
    setTimeout(() => {
      setTooltipState(prev => ({ ...prev, show: false }))
    }, 5000)
  }, [])

  // Функция для показа предупреждения о заголовках в цитате
  const showBlockquoteHeaderWarningTooltip = useCallback(() => {
    setTooltipState({
      show: true,
      message: 'Заголовки внутри цитаты будут преобразованы в обычный текст после закрытия заметки',
      duration: 4000
    })
    setTimeout(() => {
      setTooltipState(prev => ({ ...prev, show: false }))
    }, 4000)
  }, [])

  // Функция для показа подсказки о невозможности создания списков в блоке кода
  const showCodeBlockListBlockedTooltip = useCallback(() => {
    setTooltipState({
      show: true,
      message: 'Невозможно создать список внутри блока кода',
      duration: 3000
    })
    setTimeout(() => {
      setTooltipState(prev => ({ ...prev, show: false }))
    }, 3000)
  }, [])

  // Функция для показа подсказки о невозможности табуляции в чекбоксах
  const showTaskListTabBlockedTooltip = useCallback(() => {
    setTooltipState({
      show: true,
      message: 'Невозможно создать отступ в чекбоксе. Используйте клавиши со стрелками для навигации',
      duration: 3000
    })
    setTimeout(() => {
      setTooltipState(prev => ({ ...prev, show: false }))
    }, 3000)
  }, [])

  // Отслеживание изменений состояния подсказки
  useEffect(() => {
  }, [tooltipState])

  // Флаг набора через IME/композицию
  const [isComposing, setIsComposing] = useState(false)

  // Отслеживание предыдущего состояния списков для цитаты
  const prevListState = useRef({ bulletList: false, orderedList: false })

  // Отслеживание предыдущего состояния заголовков для цитаты
  const prevHeaderState = useRef({ h1: false, h2: false, h3: false })

  // Функция для вставки блока кода с выделенным текстом
  const handleCodeBlockInsertion = useCallback((editor: any) => {
    const { selection } = editor.state
    const { $from, $to } = selection

    // Если нет выделения, просто создаем пустой блок кода
    if ($from.pos === $to.pos) {
      editor.chain().focus().setCodeBlock().run()
      return
    }

    // Получаем выделенный текст с сохранением переносов строк
    const slice = editor.state.doc.slice($from.pos, $to.pos)
    let selectedText = ''

    // Проходим по всем узлам в выделенном фрагменте и собираем текст с переносами строк
    slice.content.forEach((node: any, index: number) => {
      if (node.isText) {
        selectedText += node.text
      } else if (node.type.name === 'paragraph' || node.type.name === 'heading') {
        // Для параграфов и заголовков добавляем их текстовое содержимое
        if (node.content && node.content.size > 0) {
          node.content.forEach((childNode: any) => {
            if (childNode.isText) {
              selectedText += childNode.text
            }
          })
        }
        // Добавляем перенос строки после параграфа/заголовка (кроме последнего)
        if (index < slice.content.size - 1) {
          selectedText += '\n'
        }
      } else if (node.type.name === 'hardBreak') {
        selectedText += '\n'
      } else {
        // Для других типов узлов пытаемся получить их текстовое содержимое
        if (node.textContent) {
          selectedText += node.textContent
        }
      }
    })

    // Очищаем текст от лишних переносов строк в конце
    selectedText = selectedText.replace(/\n+$/, '')

    // Если текст пустой, создаем пустой блок кода
    if (!selectedText.trim()) {
      editor.chain().focus().setCodeBlock().run()
      return
    }

    // Удаляем выделенный текст и вставляем блок кода с этим текстом
    editor.chain()
      .deleteSelection()
      .setCodeBlock()
      .insertContent(selectedText)
      .run()
  }, [])

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
      TableWithResizeButtons,
      SlashCommand
    ],
    content: parsedContent ? markdownToTipTapHTML(parsedContent) : '<p></p>',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[200px] p-4 prose-headings:font-bold prose-h1:text-2xl prose-h1:mb-2 prose-h1:mt-4 prose-h2:text-xl prose-h2:mb-2 prose-h2:mt-4 prose-h3:text-lg prose-h3:mb-2 prose-h3:mt-4 prose-strong:font-bold prose-em:italic prose-ul:list-disc prose-ul:ml-6 prose-ol:list-decimal prose-ol:ml-6 prose-li:my-1',
      },
      handleDOMEvents: {
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
    },
    onUpdate: ({ editor, transaction }) => {
      if (isComposing) return

      // Проверяем активацию списков через кнопки в цитате
      if (transaction?.docChanged) {
        const { selection } = editor.state
        const { $anchor } = selection
        let inBlockquote = false

        // Проверяем все уровни вверх от текущей позиции
        for (let depth = $anchor.depth; depth > 0; depth--) {
          const node = $anchor.node(depth)
          if (node.type.name === 'blockquote') {
            inBlockquote = true
            break
          }
        }

        if (inBlockquote) {
          const isBulletListNow = editor.isActive('bulletList')
          const isOrderedListNow = editor.isActive('orderedList')

          // Если список был активирован в цитате (переход из не-списка в список), показываем предупреждение
          if ((isBulletListNow && !prevListState.current.bulletList) || (isOrderedListNow && !prevListState.current.orderedList)) {
            showBlockquoteListWarningTooltip()
          }

          // Обновляем предыдущее состояние
          prevListState.current = { bulletList: isBulletListNow, orderedList: isOrderedListNow }

          // Проверяем активацию заголовков в цитате
          const isH1Now = editor.isActive('heading', { level: 1 })
          const isH2Now = editor.isActive('heading', { level: 2 })
          const isH3Now = editor.isActive('heading', { level: 3 })

          // Если заголовок был активирован в цитате (переход из не-заголовка в заголовок), показываем предупреждение
          if ((isH1Now && !prevHeaderState.current.h1) ||
              (isH2Now && !prevHeaderState.current.h2) ||
              (isH3Now && !prevHeaderState.current.h3)) {
            showBlockquoteHeaderWarningTooltip()
          }

          // Обновляем предыдущее состояние заголовков
          prevHeaderState.current = { h1: isH1Now, h2: isH2Now, h3: isH3Now }
        }
      }

      setHasChanges(true)

      // Проверяем, не пытается ли пользователь создать чекбокс внутри цитаты через markdown синтаксис
      if (transaction?.docChanged) {
        const { selection } = editor.state
        const { $anchor } = selection

        // Проверяем, не находимся ли мы внутри цитаты
        let inBlockquote = false
        for (let depth = $anchor.depth; depth > 0; depth--) {
          const node = $anchor.node(depth)
          if (node.type.name === 'blockquote') {
            inBlockquote = true
            break
          }
        }

        if (inBlockquote) {
          // Получаем текущий контент и проверяем на наличие паттернов чекбоксов
          const currentContent = editor.getText()
          const contentLines = currentContent.split('\n')

          // Ищем строки, которые могут содержать чекбоксы
          for (let i = 0; i < contentLines.length; i++) {
            const line = contentLines[i]
            if (/^\s*- \[ \]/.test(line) || /^\s*- \[x\]/.test(line)) {
              // Нашли чекбокс внутри цитаты - показываем предупреждение
              showBlockquoteTaskBlockedTooltip()

              // Удаляем только что введенный чекбокс
              const textBeforeLine = contentLines.slice(0, i).join('\n') + (i > 0 ? '\n' : '')
              const from = textBeforeLine.length
              const to = from + line.length
              editor.chain().deleteRange({ from, to }).insertContentAt(from, line.replace(/^\s*- \[[ x]\] /, '- ')).run()

              break
            }
          }
                  // Если не в цитате, обрабатываем создание списков и заголовков через markdown синтаксис
        if (transaction?.docChanged) {
          const currentContent = editor.getText()
          const contentLines = currentContent.split('\n')

          // Ищем строки с markdown синтаксисом списков и заголовков
          for (let i = 0; i < contentLines.length; i++) {
            const line = contentLines[i]

            // Проверяем на заголовки
            const headerMatch = line.match(/^\s*(#{1,3})\s+(.+)$/)
            if (headerMatch) {
              const hashSymbols = headerMatch[1]
              const headerText = headerMatch[2]
              const level = hashSymbols.length

              const textBeforeLine = contentLines.slice(0, i).join('\n') + (i > 0 ? '\n' : '')
              const from = textBeforeLine.length
              const to = from + line.length

              // Создаем заголовок
              editor.chain()
                .deleteRange({ from, to })
                .insertContentAt(from, headerText)
                .command(({ commands }) => commands.setHeading({ level: level as 1 | 2 | 3 }))
                .run()
              break
            }

            // Проверяем на буллет-лист (- или *)
            if ((/^\s*- $/.test(line) || /^\s*\* $/.test(line)) && !/^\s*- \[/.test(line)) {
              const textBeforeLine = contentLines.slice(0, i).join('\n') + (i > 0 ? '\n' : '')
              const from = textBeforeLine.length
              const to = from + line.length

              // Создаем буллет-лист
              editor.chain()
                .deleteRange({ from, to })
                .insertContentAt(from, '')
                .command(({ commands }) => commands.toggleBulletList())
                .run()
              break
            }

            // Проверяем на нумерованный список
            const numberedMatch = line.match(/^\s*(\d+)\. $/)
            if (numberedMatch) {
              const textBeforeLine = contentLines.slice(0, i).join('\n') + (i > 0 ? '\n' : '')
              const from = textBeforeLine.length
              const to = from + line.length

              // Создаем нумерованный список
              editor.chain()
                .deleteRange({ from, to })
                .insertContentAt(from, '')
                .command(({ commands }) => commands.toggleOrderedList())
                .run()
              break
            }
          }
        }
        }

        // Обрабатываем создание списков и заголовков в цитате с предупреждением
        if (inBlockquote && transaction?.docChanged) {
          const currentContent = editor.getText()
          const contentLines = currentContent.split('\n')

          // Ищем строки с markdown синтаксисом списков и заголовков в цитате
          for (let i = 0; i < contentLines.length; i++) {
            const line = contentLines[i]

            // Проверяем на заголовки в цитате
            const headerMatch = line.match(/^\s*(#{1,3})\s+(.+)$/)
            if (headerMatch) {
              const hashSymbols = headerMatch[1]
              const headerText = headerMatch[2]

              const textBeforeLine = contentLines.slice(0, i).join('\n') + (i > 0 ? '\n' : '')
              const from = textBeforeLine.length
              const to = from + line.length

              // Конвертируем заголовок в обычный текст и показываем предупреждение
              editor.chain()
                .deleteRange({ from, to })
                .insertContentAt(from, headerText)
                .run()

              showBlockquoteHeaderWarningTooltip()
              break
            }

            // Проверяем на буллет-лист в цитате (- или *)
            if ((/^\s*- $/.test(line) || /^\s*\* $/.test(line)) && !/^\s*- \[/.test(line)) {
              const textBeforeLine = contentLines.slice(0, i).join('\n') + (i > 0 ? '\n' : '')
              const from = textBeforeLine.length
              const to = from + line.length

              // Создаем буллет-лист и показываем предупреждение
              editor.chain()
                .deleteRange({ from, to })
                .insertContentAt(from, '')
                .command(({ commands }) => commands.toggleBulletList())
                .run()

              showBlockquoteListWarningTooltip()
              break
            }

            // Проверяем на нумерованный список в цитате
            const numberedMatch = line.match(/^\s*(\d+)\. $/)
            if (numberedMatch) {
              const textBeforeLine = contentLines.slice(0, i).join('\n') + (i > 0 ? '\n' : '')
              const from = textBeforeLine.length
              const to = from + line.length

              // Создаем нумерованный список и показываем предупреждение
              editor.chain()
                .deleteRange({ from, to })
                .insertContentAt(from, '')
                .command(({ commands }) => commands.toggleOrderedList())
                .run()

              showBlockquoteListWarningTooltip()
              break
            }
          }
        }
      }

      // Автосохранение при изменении контента
      if (enableAutoSave && notionId) {
        try {
          const editorHTML = editor.getHTML()
          const editorMarkdown = htmlToMarkdown(editorHTML, { normalize: false })
          const combinedContent = combineContent(title, editorMarkdown)
          triggerSave(combinedContent)
        } catch (error) {
          console.error('Ошибка при автосохранении:', error)
        }
      }
    },
    onBlur: ({ editor }) => {
      // Принудительно сохраняем при потере фокуса
      if (hasChanges) {
        try {
          const editorHTML = editor.getHTML()
          const editorMarkdown = htmlToMarkdown(editorHTML, { normalize: true })
          const combinedContent = combineContent(title, editorMarkdown)

          // Для существующих заметок используем автосохранение
          if (enableAutoSave && notionId) {
            // Используем forceSave для немедленного сохранения без debounce
            forceSave(combinedContent)
          } else {
            // Для новых заметок или когда автосохранение отключено - вызываем onSave
            onSave(combinedContent)
          }
        } catch (error) {
          console.error('Ошибка при сохранении на blur:', error)
        }
      }
    },
    autofocus: autoFocus && !showTitle
  })

  // Обновляем содержимое редактора только при смене заметки (notionId)
  useEffect(() => {
    if (!editor) return
    const nextTitle = initialTitle || parsedTitle
    setTitle(nextTitle)
    const nextContent = parsedContent ? markdownToTipTapHTML(parsedContent) : '<p></p>'
    editor.commands.setContent(nextContent, false)
    setHasChanges(false)

    // Сбрасываем состояние списков и заголовков при загрузке нового контента
    prevListState.current = { bulletList: false, orderedList: false }
    prevHeaderState.current = { h1: false, h2: false, h3: false }
  }, [notionId])

  useImperativeHandle(ref, () => ({
    save: async () => {
      // Принудительное автосохранение
      if (enableAutoSave && notionId && editor) {
        try {
          const editorHTML = editor.getHTML()
          const editorMarkdown = htmlToMarkdown(editorHTML, { normalize: true })
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
        const editorMarkdown = htmlToMarkdown(editorHTML, { normalize: false })
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
      const editorMarkdown = htmlToMarkdown(editorHTML, { normalize: true })
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
        const editorMarkdown = htmlToMarkdown(editorHTML, { normalize: true })
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
        return
      }

      // Проверяем нажатие Tab в чекбоксах
      if (e.key === 'Tab' && editor) {
        // Проверяем, находимся ли мы внутри чекбокса (taskItem)
        if (editor.isActive('taskItem')) {
          e.preventDefault()
          showTaskListTabBlockedTooltip()
          return
        }
      }

      // Проверяем горячие клавиши для чекбоксов
      // Обычно это Ctrl+Shift+7 или Ctrl+Shift+9
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === '7' || e.key === '9')) {
        // Проверяем, не находимся ли мы внутри цитаты
        if (isInsideBlockquote(editor)) {
          e.preventDefault()
          showBlockquoteTaskBlockedTooltip()
          return
        }
        // Проверяем, не находимся ли мы внутри блока кода
        if (isInsideCodeBlock(editor)) {
          e.preventDefault()
          showCodeBlockListBlockedTooltip()
          return
        }
      }

      // Проверяем горячие клавиши для заголовков
      // Обычно это Ctrl+1, Ctrl+2, Ctrl+3 для заголовков разных уровней
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === '1' || e.key === '2' || e.key === '3')) {
        // Проверяем, не находимся ли мы внутри цитаты
        if (isInsideBlockquote(editor)) {
          e.preventDefault()
          showBlockquoteHeaderWarningTooltip()
          return
        }
      }

      // Проверяем горячие клавиши для списков
      // Обычно это Ctrl+Shift+8 для буллет-листа или Ctrl+Shift+1 для нумерованного списка
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === '8' || e.key === '1')) {
        // Проверяем, не находимся ли мы внутри цитаты
        if (isInsideBlockquote(editor)) {
          e.preventDefault()
          showBlockquoteListBlockedTooltip()
          return
        }
        // Проверяем, не находимся ли мы внутри блока кода
        if (isInsideCodeBlock(editor)) {
          e.preventDefault()
          showCodeBlockListBlockedTooltip()
          return
        }
      }

      // Проверяем горячие клавиши для блока кода
      // Обычно это Ctrl+Shift+C или Ctrl+Alt+C
      if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') ||
          ((e.ctrlKey || e.metaKey) && e.altKey && e.key === 'C')) {
        e.preventDefault()
        handleCodeBlockInsertion(editor)
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel, editor, isInsideBlockquote, isInsideCodeBlock, showBlockquoteTaskBlockedTooltip, showBlockquoteListBlockedTooltip, showBlockquoteHeaderWarningTooltip, showCodeBlockListBlockedTooltip, showTaskListTabBlockedTooltip, handleCodeBlockInsertion])

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
    <div className={cn('w-full h-full flex flex-col relative', className)}>
      {/* Всплывающий тулбар при выделении текста */}
      <BubbleMenuToolbar editor={editor} />

      {/* Подсказка о таблицах */}
      {tooltipState.show && (
        <div
          className="absolute top-16 right-2 bg-destructive/10 text-destructive text-sm px-3 py-1 rounded-xl shadow-xl whitespace-nowrap border border-destructive z-50"
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
            className="!text-2xl font-bold mb-4 mt-6 border-0 border-b-2 border-border rounded-none px-0 focus:border-primary focus:ring-0 text-foreground bg-transparent"
            autoFocus={autoFocus}
          />
        </div>
      )}

      {/* Редактор */}
      <div className="bg-card overflow-y-auto flex-1 min-h-0">
        <EditorContent 
          editor={editor} 
          className="prose prose-sm max-w-none h-full dark:prose-invert
                     [&_.ProseMirror]:min-h-full [&_.ProseMirror]:p-4 [&_.ProseMirror]:focus:outline-none [&_.ProseMirror]:text-foreground
                     [&_.ProseMirror_h1]:text-2xl [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:mb-4 [&_.ProseMirror_h1]:mt-6 [&_.ProseMirror_h1]:text-foreground
                     [&_.ProseMirror_h2]:text-xl [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:mb-3 [&_.ProseMirror_h2]:mt-5 [&_.ProseMirror_h2]:text-foreground
                     [&_.ProseMirror_h3]:text-lg [&_.ProseMirror_h3]:font-bold [&_.ProseMirror_h3]:mb-2 [&_.ProseMirror_h3]:mt-4 [&_.ProseMirror_h3]:text-foreground
                     [&_.ProseMirror_strong]:font-bold [&_.ProseMirror_em]:italic [&_.ProseMirror_u]:underline [&_.ProseMirror_s]:line-through [&_.ProseMirror_s]:text-muted-foreground
                     [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:ml-6 [&_.ProseMirror_ul]:my-2 [&_.ProseMirror_ul]:text-foreground [&_.ProseMirror_ul_::marker]:text-foreground
                     [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:ml-6 [&_.ProseMirror_ol]:my-2 [&_.ProseMirror_ol]:text-foreground [&_.ProseMirror_ol_::marker]:text-foreground
                     [&_.ProseMirror_li]:my-1 [&_.ProseMirror_li]:leading-relaxed
                     [&_.ProseMirror_ul_ul]:list-[circle] [&_.ProseMirror_ul_ul]:ml-4
                     [&_.ProseMirror_ul_ul_ul]:list-[square] [&_.ProseMirror_ul_ul_ul]:ml-4
                     [&_.ProseMirror_ol_ol]:list-[lower-alpha] [&_.ProseMirror_ol_ol]:ml-4
                     [&_.ProseMirror_ol_ol_ol]:list-[lower-roman] [&_.ProseMirror_ol_ol_ol]:ml-4
                     [&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-border [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_blockquote]:italic [&_.ProseMirror_blockquote]:text-muted-foreground [&_.ProseMirror_blockquote_::before]:content-none
                     [&_.ProseMirror_code]:bg-muted [&_.ProseMirror_code]:px-1 [&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:font-mono [&_.ProseMirror_code]:text-sm [&_.ProseMirror_code]:text-foreground [&_.ProseMirror_code_::before]:content-[``]!important [&_.ProseMirror_code_::after]:content-['']!important
                     [&_.ProseMirror_pre]:bg-muted [&_.ProseMirror_pre]:p-4 [&_.ProseMirror_pre]:rounded-lg [&_.ProseMirror_pre]:overflow-x-auto [&_.ProseMirror_pre]:font-mono [&_.ProseMirror_pre]:text-sm [&_.ProseMirror_pre]:my-2 [&_.ProseMirror_pre_code]:bg-transparent [&_.ProseMirror_pre_code]:p-0 [&_.ProseMirror_pre]:text-foreground
                     [&_.ProseMirror_mark]:bg-yellow-200 dark:[&_.ProseMirror_mark]:bg-yellow-700/75 dark:[&_.ProseMirror_mark]:text-foreground [&_.ProseMirror_mark_s]:!text-muted-foreground [&_.ProseMirror_ul[data-type='taskList']_li[data-checked='true']_>_div_[&_.ProseMirror_mark]]:!text-muted-foreground
                     [&_.ProseMirror_ul[data-type='taskList']]:list-none [&_.ProseMirror_ul[data-type='taskList']_li]:flex [&_.ProseMirror_ul[data-type='taskList']_li]:items-start [&_.ProseMirror_ul[data-type='taskList']_li]:gap-2 [&_.ProseMirror_ul[data-type='taskList']_li]:pt-[0.125rem] [&_.ProseMirror_ul[data-type='taskList']_li_>_label]:flex [&_.ProseMirror_ul[data-type='taskList']_li_>_label]:items-center [&_.ProseMirror_ul[data-type='taskList']_li_>_label]:gap-1 [&_.ProseMirror_ul[data-type='taskList']_li_>_label]:cursor-pointer [&_.ProseMirror_ul[data-type='taskList']_li_>_label]:min-h-[1.5rem] [&_.ProseMirror_ul[data-type='taskList']_li_>_label]:flex-shrink-0 [&_.ProseMirror_ul[data-type='taskList']_li_>_label]:mt-[0.25rem] [&_.ProseMirror_ul[data-type='taskList']_li_>_label_>_input[type='checkbox']]:m-0 [&_.ProseMirror_ul[data-type='taskList']_li_>_label_>_input[type='checkbox']]:accent-primary [&_.ProseMirror_ul[data-type='taskList']_li_>_label_>_input[type='checkbox']]:w-4 [&_.ProseMirror_ul[data-type='taskList']_li_>_label_>_input[type='checkbox']]:h-4 [&_.ProseMirror_ul[data-type='taskList']_li_>_div]:flex-1 [&_.ProseMirror_ul[data-type='taskList']_li_>_div]:min-w-0 [&_.ProseMirror_ul[data-type='taskList']_li_>_div]:break-words [&_.ProseMirror_ul[data-type='taskList']_li_>_div]:mt-[-0.125rem] [&_.ProseMirror_ul[data-type='taskList']_li_>_div_>_p]:break-words [&_.ProseMirror_ul[data-type='taskList']_li_>_div_>_p]:leading-relaxed [&_.ProseMirror_ul[data-type='taskList']_li[data-checked='true']_>_div]:!text-muted-foreground [&_.ProseMirror_ul[data-type='taskList']_li[data-checked='true']_>_div]:!line-through [&_.ProseMirror_ul[data-type='taskList']_li[data-checked='true']_>_div_>_p]:!text-muted-foreground [&_.ProseMirror_ul[data-type='taskList']_li[data-checked='true']_>_div_>_p]:!line-through
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
