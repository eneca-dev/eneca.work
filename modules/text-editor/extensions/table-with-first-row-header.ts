'use client'

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Node as ProseMirrorNode } from '@tiptap/pm/model'

// Функция для проверки, является ли узел таблицей
function isTableNode(node: ProseMirrorNode): boolean {
  return node.type.name === 'table'
}

// Функция для проверки, является ли узел строкой таблицы
function isTableRowNode(node: ProseMirrorNode): boolean {
  return node.type.name === 'tableRow'
}

// Функция для проверки, является ли узел ячейкой заголовка
function isTableHeaderNode(node: ProseMirrorNode): boolean {
  return node.type.name === 'tableHeader'
}

// Функция для проверки, является ли узел обычной ячейкой
function isTableCellNode(node: ProseMirrorNode): boolean {
  return node.type.name === 'tableCell'
}

// Функция для обеспечения того, что первая строка таблицы содержит только заголовочные ячейки
function ensureFirstRowIsHeader(tableNode: ProseMirrorNode, schema: any) {
  if (!isTableNode(tableNode) || tableNode.childCount === 0) {
    return tableNode
  }

  let hasChanges = false
  const newChildren: ProseMirrorNode[] = []

  tableNode.content.forEach((row, index) => {
    if (!isTableRowNode(row)) {
      newChildren.push(row)
      return
    }

    // Первая строка должна содержать только заголовочные ячейки
    if (index === 0) {
      const newRowChildren: ProseMirrorNode[] = []
      let rowHasChanges = false

      row.content.forEach((cell) => {
        if (isTableCellNode(cell)) {
          // Конвертируем обычную ячейку в заголовочную
          const headerCell = schema.nodes.tableHeader.create(
            cell.attrs,
            cell.content,
            cell.marks
          )
          newRowChildren.push(headerCell)
          rowHasChanges = true
          hasChanges = true
        } else {
          newRowChildren.push(cell)
        }
      })

      if (rowHasChanges) {
        const newRow = schema.nodes.tableRow.create(
          row.attrs,
          newRowChildren,
          row.marks
        )
        newChildren.push(newRow)
      } else {
        newChildren.push(row)
      }
    } else {
      // Все остальные строки должны содержать только обычные ячейки
      const newRowChildren: ProseMirrorNode[] = []
      let rowHasChanges = false

      row.content.forEach((cell) => {
        if (isTableHeaderNode(cell)) {
          // Конвертируем заголовочную ячейку в обычную
          const normalCell = schema.nodes.tableCell.create(
            cell.attrs,
            cell.content,
            cell.marks
          )
          newRowChildren.push(normalCell)
          rowHasChanges = true
          hasChanges = true
        } else {
          newRowChildren.push(cell)
        }
      })

      if (rowHasChanges) {
        const newRow = schema.nodes.tableRow.create(
          row.attrs,
          newRowChildren,
          row.marks
        )
        newChildren.push(newRow)
      } else {
        newChildren.push(row)
      }
    }
  })

  if (hasChanges) {
    return schema.nodes.table.create(
      tableNode.attrs,
      newChildren,
      tableNode.marks
    )
  }

  return tableNode
}

export const TableWithFirstRowHeader = Extension.create({
  name: 'tableWithFirstRowHeader',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('tableWithFirstRowHeader'),
        
        appendTransaction(transactions, oldState, newState) {
          const { tr } = newState
          let hasChanges = false

          // Проходим по всему документу и ищем таблицы
          newState.doc.descendants((node, pos) => {
            if (isTableNode(node)) {
              const correctedTable = ensureFirstRowIsHeader(node, newState.schema)
              
              if (correctedTable !== node) {
                tr.replaceWith(pos, pos + node.nodeSize, correctedTable)
                hasChanges = true
              }
            }
          })

          return hasChanges ? tr : null
        }
      }),
      
      // Плагин для автоматического экранирования символов "|" в ячейках таблиц
      new Plugin({
        key: new PluginKey('tablePipeEscaping'),
        
        props: {
          handleTextInput(view, from, to, text) {
            // Проверяем, находимся ли мы в ячейке таблицы
            const { state } = view
            const { $from } = state.selection
            
            // Ищем родительскую ячейку таблицы
            let inTableCell = false
            for (let i = $from.depth; i > 0; i--) {
              const node = $from.node(i)
              if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
                inTableCell = true
                break
              }
            }
            
            // Если мы в ячейке таблицы и вводим символ "|", заменяем на визуально идентичный символ
            if (inTableCell && text === '|') {
              // Используем символ U+2502 (BOX DRAWINGS LIGHT VERTICAL) который выглядит как "|"
              const tr = state.tr.insertText('│', from, to)
              view.dispatch(tr)
              return true // Предотвращаем обычную вставку
            }
            
            // Если вставляем текст, который содержит "|", заменяем их на "│"
            if (inTableCell && text.includes('|')) {
              const replacedText = text.replace(/\|/g, '│')
              const tr = state.tr.insertText(replacedText, from, to)
              view.dispatch(tr)
              return true // Предотвращаем обычную вставку
            }
            
            return false // Позволяем обычную обработку
          }
        }
      })
    ]
  },


}) 