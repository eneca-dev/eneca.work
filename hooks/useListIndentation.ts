import { useEffect } from 'react'
import type { Editor } from '@tiptap/react'

/**
 * Hook for handling Tab key indentation in lists for TipTap editors
 * @param editor - The TipTap editor instance
 */
export function useListIndentation(editor: Editor | null) {
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
} 