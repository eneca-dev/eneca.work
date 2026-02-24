import type { Editor } from '@tiptap/react'

/**
 * Проверяет, находится ли курсор внутри узла определенного типа
 */
export function isInsideNode(editor: Editor | null, nodeType: string): boolean {
  if (!editor) return false

  const { selection } = editor.state
  const { $anchor } = selection

  // Проверяем все уровни вверх от текущей позиции
  for (let depth = $anchor.depth; depth > 0; depth--) {
    const node = $anchor.node(depth)
    if (node.type.name === nodeType) {
      return true
    }
  }

  return false
}

/**
 * Проверяет, находится ли курсор внутри цитаты
 */
export function isInsideBlockquote(editor: Editor | null): boolean {
  return isInsideNode(editor, 'blockquote')
}

/**
 * Проверяет, находится ли курсор внутри блока кода
 */
export function isInsideCodeBlock(editor: Editor | null): boolean {
  return isInsideNode(editor, 'codeBlock')
}

/**
 * Проверяет, находится ли курсор внутри ячейки таблицы
 */
export function isInsideTableCell(editor: Editor | null): boolean {
  if (!editor) return false

  const { selection } = editor.state
  const { $anchor } = selection

  for (let depth = $anchor.depth; depth > 0; depth--) {
    const node = $anchor.node(depth)
    if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
      return true
    }
  }

  return false
}
