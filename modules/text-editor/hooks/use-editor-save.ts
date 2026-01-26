import { useCallback, useEffect } from 'react'
import type { Editor } from '@tiptap/react'
import { htmlToMarkdown } from '@/modules/notions'
import { combineContent } from '@/modules/text-editor/utils/content-utils'

type UseEditorSaveParams = {
  editor: Editor | null
  title: string
  enableAutoSave: boolean
  notionId?: string
  hasChanges: boolean
  forceSave: (content: string) => Promise<void>
  triggerSave: (content: string) => void
}

/**
 * Хук для управления автосохранением редактора
 */
export function useEditorSave({
  editor,
  title,
  enableAutoSave,
  notionId,
  hasChanges,
  forceSave,
  triggerSave
}: UseEditorSaveParams) {
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
  }, [enableAutoSave, notionId, editor, title, forceSave])

  // Обработчик изменения заголовка
  const handleTitleChange = useCallback((value: string, setTitle: (v: string) => void, setHasChanges: (v: boolean) => void) => {
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
  }, [enableAutoSave, notionId, editor, triggerSave])

  // Обработчик blur заголовка
  const handleTitleBlur = useCallback(() => {
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
  }, [enableAutoSave, notionId, hasChanges, editor, title, forceSave])

  // Принудительное сохранение при различных событиях
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Если автосохранение включено, принудительно сохраняем
      if (enableAutoSave && notionId && hasChanges) {
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
  }, [hasChanges, enableAutoSave, notionId, performForceSave])

  return {
    performForceSave,
    handleTitleChange,
    handleTitleBlur
  }
}
