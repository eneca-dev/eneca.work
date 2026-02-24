import { useRef } from 'react'
import type { Editor } from '@tiptap/react'
import type { Transaction } from '@tiptap/pm/state'
import { isInsideBlockquote } from '@/modules/text-editor/utils/editor-context-utils'
import { htmlToMarkdown } from '@/modules/notions'
import { combineContent } from '@/modules/text-editor/utils/content-utils'

type TooltipHelpers = {
  showBlockquoteListWarningTooltip: () => void
  showBlockquoteHeaderWarningTooltip: () => void
  showBlockquoteTaskBlockedTooltip: () => void
}

type UseEditorUpdateParams = {
  isComposing: boolean
  tooltipHelpers: TooltipHelpers
  enableAutoSave: boolean
  notionId?: string
  title: string
  triggerSave: (content: string) => void
  setHasChanges: (value: boolean) => void
}

/**
 * Хук для обработки события onUpdate редактора
 * Включает: валидацию blockquote, markdown shortcuts, автосохранение
 */
export function useEditorUpdate({
  isComposing,
  tooltipHelpers,
  enableAutoSave,
  notionId,
  title,
  triggerSave,
  setHasChanges
}: UseEditorUpdateParams) {
  // Отслеживание предыдущего состояния списков для цитаты
  const prevListState = useRef({ bulletList: false, orderedList: false })

  // Отслеживание предыдущего состояния заголовков для цитаты
  const prevHeaderState = useRef({ h1: false, h2: false, h3: false })

  const handleUpdate = ({ editor, transaction }: { editor: Editor; transaction: Transaction }) => {
    if (isComposing) return

    // Проверяем активацию списков через кнопки в цитате
    if (transaction?.docChanged) {
      const inBlockquote = isInsideBlockquote(editor)

      if (inBlockquote) {
        const isBulletListNow = editor.isActive('bulletList')
        const isOrderedListNow = editor.isActive('orderedList')

        // Если список был активирован в цитате (переход из не-списка в список), показываем предупреждение
        if ((isBulletListNow && !prevListState.current.bulletList) || (isOrderedListNow && !prevListState.current.orderedList)) {
          tooltipHelpers.showBlockquoteListWarningTooltip()
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
          tooltipHelpers.showBlockquoteHeaderWarningTooltip()
        }

        // Обновляем предыдущее состояние заголовков
        prevHeaderState.current = { h1: isH1Now, h2: isH2Now, h3: isH3Now }
      }
    }

    setHasChanges(true)

    // Проверяем, не пытается ли пользователь создать чекбокс внутри цитаты через markdown синтаксис
    if (transaction?.docChanged) {
      const inBlockquote = isInsideBlockquote(editor)

      if (inBlockquote) {
        // Получаем текущий контент и проверяем на наличие паттернов чекбоксов
        const currentContent = editor.getText()
        const contentLines = currentContent.split('\n')

        // Ищем строки, которые могут содержать чекбоксы
        for (let i = 0; i < contentLines.length; i++) {
          const line = contentLines[i]
          if (/^\s*- \[ \]/.test(line) || /^\s*- \[x\]/.test(line)) {
            // Нашли чекбокс внутри цитаты - показываем предупреждение
            tooltipHelpers.showBlockquoteTaskBlockedTooltip()

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
            const headerText = headerMatch[2]

            const textBeforeLine = contentLines.slice(0, i).join('\n') + (i > 0 ? '\n' : '')
            const from = textBeforeLine.length
            const to = from + line.length

            // Конвертируем заголовок в обычный текст и показываем предупреждение
            editor.chain()
              .deleteRange({ from, to })
              .insertContentAt(from, headerText)
              .run()

            tooltipHelpers.showBlockquoteHeaderWarningTooltip()
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

            tooltipHelpers.showBlockquoteListWarningTooltip()
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

            tooltipHelpers.showBlockquoteListWarningTooltip()
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
  }

  const handleBlur = ({ editor }: { editor: Editor }, hasChanges: boolean, onSave: (content: string) => void, forceSave: (content: string) => Promise<void>) => {
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
  }

  return {
    handleUpdate,
    handleBlur,
    prevListState,
    prevHeaderState
  }
}
