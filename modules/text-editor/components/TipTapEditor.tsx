'use client'

import React, { forwardRef, useImperativeHandle, useEffect, useState, useCallback, useMemo } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'
import { Transaction } from '@tiptap/pm/state'
import { EditorState } from '@tiptap/pm/state'
import { ChainedCommands } from '@tiptap/react'
import { BubbleMenuToolbar } from '@/modules/text-editor/components/BubbleMenuToolbar'
import { createEditorExtensions, editorPropsConfig, createEditorDOMHandlers, EDITOR_CONSTANTS } from '@/modules/text-editor/config/editor-config'
import { createTooltipHelpers, type TooltipState } from '@/modules/text-editor/utils/tooltip-utils'
import { isInsideTableCell } from '@/modules/text-editor/utils/editor-context-utils'
import { combineContent, parseInitialContent } from '@/modules/text-editor/utils/content-utils'
import { useEditorKeyboard } from '@/modules/text-editor/hooks/use-editor-keyboard'
import { useEditorSave } from '@/modules/text-editor/hooks/use-editor-save'
import { useEditorUpdate } from '@/modules/text-editor/hooks/use-editor-update'
import '@/styles/editor-tables.css'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
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
  titlePlaceholder = EDITOR_CONSTANTS.DEFAULT_TITLE_PLACEHOLDER,
  showTitle = true,
  autoFocus = true,
  className,
  notionId,
  enableAutoSave = true
}, ref) => {
  const [title, setTitle] = useState(initialTitle)
  const [hasChanges, setHasChanges] = useState(false)
  const [tooltipState, setTooltipState] = useState<TooltipState>({
    show: false,
    message: '',
    duration: 0
  })

  // Хук автосохранения
  const { saveStatus, triggerSave, forceSave } = useAutoSave({
    notionId,
    enabled: enableAutoSave && !!notionId,
    delay: EDITOR_CONSTANTS.AUTOSAVE_DELAY
  })

  // Хелперы для tooltip уведомлений
  const tooltipHelpers = useMemo(
    () => createTooltipHelpers(setTooltipState),
    []
  )

  // Флаг набора через IME/композицию
  const [isComposing, setIsComposing] = useState(false)

  const { title: parsedTitle, editorContent: parsedContent } = parseInitialContent(initialValue, !!initialTitle)

  // Инициализируем заголовок
  useEffect(() => {
    if (initialTitle) {
      setTitle(initialTitle)
    } else {
      setTitle(parsedTitle)
    }
  }, [initialTitle, parsedTitle])

  // Хук для обработки onUpdate
  const editorUpdateHook = useEditorUpdate({
    isComposing,
    tooltipHelpers,
    enableAutoSave,
    notionId,
    title,
    triggerSave,
    setHasChanges
  })

  const editor = useEditor({
    immediatelyRender: false,
    extensions: createEditorExtensions(),
    content: parsedContent ? markdownToTipTapHTML(parsedContent) : '<p></p>',
    editorProps: {
      ...editorPropsConfig,
      handleDOMEvents: createEditorDOMHandlers(setIsComposing)
    },
    onUpdate: editorUpdateHook.handleUpdate,
    onBlur: ({ editor }) => editorUpdateHook.handleBlur({ editor }, hasChanges, onSave, forceSave),
    autofocus: autoFocus && !showTitle
  })

  // Хук для автосохранения
  const editorSaveHook = useEditorSave({
    editor,
    title,
    enableAutoSave,
    notionId,
    hasChanges,
    forceSave,
    triggerSave
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
    editorUpdateHook.prevListState.current = { bulletList: false, orderedList: false }
    editorUpdateHook.prevHeaderState.current = { h1: false, h2: false, h3: false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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



  // Обёртка для handleTitleChange из хука
  const handleTitleChange = useCallback((value: string) => {
    editorSaveHook.handleTitleChange(value, setTitle, setHasChanges)
  }, [editorSaveHook])

  // Горячие клавиши
  useEditorKeyboard(editor, tooltipHelpers, onCancel)

  // Обработчик клавиш для отступов в списках
  useListIndentation(editor)

  // Функция для вставки таблицы с проверками и дополнительной логикой
  const handleTableInsertion = useCallback((rows: number, cols: number, editor: any) => {
    // Если мы в ячейке таблицы, не создаем новую таблицу
    if (isInsideTableCell(editor)) {
      tooltipHelpers.showTableBlockedTooltip()
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
    tooltipHelpers.showTablePipeWarningTooltip()
  }, [tooltipHelpers])

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
            onBlur={editorSaveHook.handleTitleBlur}
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
