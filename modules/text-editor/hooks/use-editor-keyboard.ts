import { useEffect } from 'react'
import type { Editor } from '@tiptap/react'
import { isInsideBlockquote, isInsideCodeBlock } from '@/modules/text-editor/utils/editor-context-utils'
import { handleCodeBlockInsertion } from '@/modules/text-editor/utils/content-utils'

type TooltipHelpers = {
  showTaskListTabBlockedTooltip: () => void
  showBlockquoteTaskBlockedTooltip: () => void
  showCodeBlockListBlockedTooltip: () => void
  showBlockquoteHeaderWarningTooltip: () => void
  showBlockquoteListBlockedTooltip: () => void
}

/**
 * Хук для обработки клавиатурных сокращений в редакторе
 */
export function useEditorKeyboard(
  editor: Editor | null,
  tooltipHelpers: TooltipHelpers,
  onCancel: () => void
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape - закрыть редактор
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
        return
      }

      if (!editor) return

      // Tab в чекбоксах запрещён
      if (e.key === 'Tab' && editor.isActive('taskItem')) {
        e.preventDefault()
        tooltipHelpers.showTaskListTabBlockedTooltip()
        return
      }

      // Ctrl+Shift+7/9 - чекбоксы (запрещены в цитате и блоке кода)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === '7' || e.key === '9')) {
        if (isInsideBlockquote(editor)) {
          e.preventDefault()
          tooltipHelpers.showBlockquoteTaskBlockedTooltip()
          return
        }
        if (isInsideCodeBlock(editor)) {
          e.preventDefault()
          tooltipHelpers.showCodeBlockListBlockedTooltip()
          return
        }
      }

      // Ctrl+1/2/3 - заголовки (предупреждение в цитате)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === '1' || e.key === '2' || e.key === '3')) {
        if (isInsideBlockquote(editor)) {
          e.preventDefault()
          tooltipHelpers.showBlockquoteHeaderWarningTooltip()
          return
        }
      }

      // Ctrl+Shift+8/1 - списки (запрещены в цитате и блоке кода)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === '8' || e.key === '1')) {
        if (isInsideBlockquote(editor)) {
          e.preventDefault()
          tooltipHelpers.showBlockquoteListBlockedTooltip()
          return
        }
        if (isInsideCodeBlock(editor)) {
          e.preventDefault()
          tooltipHelpers.showCodeBlockListBlockedTooltip()
          return
        }
      }

      // Ctrl+Shift+C или Ctrl+Alt+C - блок кода
      if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') ||
          ((e.ctrlKey || e.metaKey) && e.altKey && e.key === 'C')) {
        e.preventDefault()
        handleCodeBlockInsertion(editor)
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel, editor, tooltipHelpers])
}
