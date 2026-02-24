import type { Editor } from '@tiptap/react'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

/**
 * Комбинирует заголовок и содержимое в единый markdown
 */
export function combineContent(titleValue: string, editorContent: string): string {
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

/**
 * Парсит исходное содержимое, извлекая заголовок если он есть
 */
export function parseInitialContent(content: string, hasExternalTitle: boolean) {
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

/**
 * Вставляет блок кода с выделенным текстом
 */
export function handleCodeBlockInsertion(editor: Editor) {
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
  slice.content.forEach((node: ProseMirrorNode, index: number) => {
    if (node.isText) {
      selectedText += node.text
    } else if (node.type.name === 'paragraph' || node.type.name === 'heading') {
      // Для параграфов и заголовков добавляем их текстовое содержимое
      if (node.content && node.content.size > 0) {
        node.content.forEach((childNode: ProseMirrorNode) => {
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
}
