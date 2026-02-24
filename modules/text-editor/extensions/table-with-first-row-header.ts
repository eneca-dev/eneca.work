'use client'

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Node as ProseMirrorNode, Schema } from '@tiptap/pm/model'

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

// Функция для проверки, является ли узел пустым параграфом
function isEmptyParagraph(node: ProseMirrorNode): boolean {
  return node.type.name === 'paragraph' && node.childCount === 0
}

// Функция для проверки, является ли узел неудаляемым пустым параграфом
function isUnremovableParagraph(node: ProseMirrorNode): boolean {
  return node.type.name === 'paragraph' && 
         node.attrs && 
         node.attrs.unremovable === true
}

// Функция для обеспечения того, что первая строка таблицы содержит только заголовочные ячейки
function ensureFirstRowIsHeader(tableNode: ProseMirrorNode, schema: Schema) {
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

// Кэшированная информация о нодах в документе
interface CachedNodeInfo {
  tables: Array<{node: ProseMirrorNode, pos: number, parent: ProseMirrorNode | null, index: number}>
  unremovableParagraphs: Array<{node: ProseMirrorNode, pos: number, parent: ProseMirrorNode | null, index: number}>
}

// Функция для однократного обхода документа и кэширования информации о нодах
function cacheDocumentNodes(doc: ProseMirrorNode): CachedNodeInfo {
  const tables: Array<{node: ProseMirrorNode, pos: number, parent: ProseMirrorNode | null, index: number}> = []
  const unremovableParagraphs: Array<{node: ProseMirrorNode, pos: number, parent: ProseMirrorNode | null, index: number}> = []

  doc.descendants((node, pos, parent, index) => {
    if (isTableNode(node)) {
      tables.push({node, pos, parent, index})
    } else if (isUnremovableParagraph(node)) {
      unremovableParagraphs.push({node, pos, parent, index})
    }
  })

  return { tables, unremovableParagraphs }
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

          // Кэшируем информацию о нодах в документе за один проход
          const cachedInfo = cacheDocumentNodes(newState.doc)

          // Используем кэшированную информацию для обработки таблиц
          cachedInfo.tables.forEach(({node, pos}) => {
            const correctedTable = ensureFirstRowIsHeader(node, newState.schema)
            
            if (correctedTable !== node) {
              tr.replaceWith(pos, pos + node.nodeSize, correctedTable)
              hasChanges = true
            }
          })

          return hasChanges ? tr : null
        }
      }),
      
      // Плагин для разделения соседних таблиц
      new Plugin({
        key: new PluginKey('tableSeparation'),
        
        appendTransaction(transactions, oldState, newState) {
          const { tr } = newState
          let hasChanges = false
          const insertions: Array<{pos: number, content: ProseMirrorNode}> = []

          // Кэшируем информацию о нодах в документе за один проход
          const cachedInfo = cacheDocumentNodes(newState.doc)

          // Используем кэшированную информацию для поиска соседних таблиц
          cachedInfo.tables.forEach(({node, pos, parent, index}) => {
            if (parent) {
              // Проверяем следующий узел - если это тоже таблица, вставляем между ними параграф
              const nextIndex = index + 1
              if (nextIndex < parent.childCount) {
                const nextNode = parent.child(nextIndex)
                if (isTableNode(nextNode)) {
                  // Между таблицами нет разделителя - добавляем неудаляемый параграф
                  const unremovableParagraph = newState.schema.nodes.paragraph.create(
                    { unremovable: true },
                    [newState.schema.text(' ')]
                  )
                  insertions.push({
                    pos: pos + node.nodeSize,
                    content: unremovableParagraph
                  })
                  hasChanges = true
                }
              }

              // Также проверяем предыдущий узел для случаев, когда таблица в начале документа
              if (index > 0) {
                const prevNode = parent.child(index - 1)
                if (isTableNode(prevNode)) {
                  // Убеждаемся, что между ними есть разделитель
                  // (этот случай уже обработан выше, но добавляем для полноты)
                }
              }
            }
          })

          // Вставляем параграфы в обратном порядке (от конца к началу)
          // чтобы позиции оставались валидными
          insertions.reverse().forEach(({pos, content}) => {
            tr.insert(pos, content)
          })

          return hasChanges ? tr : null
        }
      }),

      // Плагин для защиты неудаляемых параграфов между таблицами
      new Plugin({
        key: new PluginKey('protectTableSeparators'),
        
        filterTransaction(tr, state) {
          // Проверяем, не пытается ли транзакция удалить неудаляемый параграф
          let shouldBlock = false
          
          // Проверяем все изменения в документе через mapping
          if (tr.docChanged) {
            const oldDoc = state.doc
            const newDoc = tr.doc
            
            // Кэшируем информацию о неудаляемых параграфах за один проход
            const cachedInfo = cacheDocumentNodes(oldDoc)
            
            // Используем кэшированную информацию для проверки удаленных неудаляемых параграфов
            cachedInfo.unremovableParagraphs.forEach(({node, pos, parent, index}) => {
              // Проверяем, остался ли этот узел в новом документе
              try {
                const mappedPos = tr.mapping.map(pos)
                const nodeAtMappedPos = newDoc.nodeAt(mappedPos)
                
                // Если узел исчез или изменился, блокируем транзакцию
                if (!nodeAtMappedPos || !isUnremovableParagraph(nodeAtMappedPos)) {
                  // Дополнительно проверяем, что это действительно параграф между таблицами
                  if (parent && index > 0 && index < parent.childCount - 1) {
                    const prevNode = parent.child(index - 1)
                    const nextNode = parent.child(index + 1)
                    
                    if (isTableNode(prevNode) && isTableNode(nextNode)) {
                      shouldBlock = true
                    }
                  }
                }
              } catch (e) {
                // Если mapping failed, значит узел был удален
                if (parent && index > 0 && index < parent.childCount - 1) {
                  const prevNode = parent.child(index - 1)
                  const nextNode = parent.child(index + 1)
                  
                  if (isTableNode(prevNode) && isTableNode(nextNode)) {
                    shouldBlock = true
                  }
                }
              }
            })
          }
          
          return !shouldBlock
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
            
            // Если мы в ячейке таблицы и текст содержит "|", заменяем все на "/"
            if (inTableCell && text.includes('|')) {
              const replacedText = text.replace(/\|/g, '/')
              const tr = state.tr.insertText(replacedText, from, to)
              view.dispatch(tr)
              return true
            }
            
            return false // Позволяем обычную обработку
          },

          handlePaste(view, event, slice) {
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
            
            // Если мы в ячейке таблицы, обрабатываем вставляемый текст
            if (inTableCell) {
              // Получаем текст из буфера обмена
              const text = event.clipboardData?.getData('text/plain')
              if (text && text.includes('|')) {
                const replacedText = text.replace(/\|/g, '/')
                const tr = state.tr.insertText(replacedText)
                view.dispatch(tr)
                return true
              }
            }
            
            return false
          },

          handleKeyDown(view, event) {
            // Обрабатываем Enter в ячейках таблицы для создания переносов строк
            if (event.key === 'Enter') {
              const { state } = view
              const { $from } = state.selection
              
              // Проверяем, находимся ли мы в ячейке таблицы
              let inTableCell = false
              for (let i = $from.depth; i > 0; i--) {
                const node = $from.node(i)
                if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
                  inTableCell = true
                  break
                }
              }
              
              // Если мы в ячейке таблицы и нажали Enter без модификаторов
              if (inTableCell && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
                // Вставляем hard break (перенос строки) вместо создания нового параграфа
                const tr = state.tr.replaceSelectionWith(state.schema.nodes.hardBreak.create())
                view.dispatch(tr)
                return true // Предотвращаем обычную обработку Enter
              }
            }
            
            return false // Позволяем обычную обработку
          }
        }
      })
    ]
  },


}) 