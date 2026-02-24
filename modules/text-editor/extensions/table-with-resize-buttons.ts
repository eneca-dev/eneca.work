'use client'

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { ResolvedPos } from '@tiptap/pm/model'

// Function to check if a node is a table header
function isTableHeaderNode(node: ProseMirrorNode): boolean {
  return node.type.name === 'tableHeader'
}

// Function to check if a node is a table row
function isTableRowNode(node: ProseMirrorNode): boolean {
  return node.type.name === 'tableRow'
}

// Function to check if a node is a table
function isTableNode(node: ProseMirrorNode): boolean {
  return node.type.name === 'table'
}

// Function to check if a table header is not the last one in its row
function isNotLastHeaderInRow(node: ProseMirrorNode, pos: number, doc: ProseMirrorNode): boolean {
  // Find the parent row
  let currentPos = pos
  let currentDepth = doc.resolve(pos).depth
  
  // Go up to find the table row
  while (currentDepth > 0) {
    const nodeAtDepth = doc.resolve(currentPos).node(currentDepth)
    if (isTableRowNode(nodeAtDepth)) {
      const rowPos = doc.resolve(currentPos).start(currentDepth)
      const rowNode = doc.nodeAt(rowPos)
      if (!rowNode) return false;
      // Find the index of our header in the row
      let headerIndex = -1
      let currentChildPos = rowPos + 1
      
      for (let i = 0; i < rowNode.childCount; i++) {
        const child = rowNode.child(i)
        if (isTableHeaderNode(child)) {
          if (currentChildPos <= pos && pos < currentChildPos + child.nodeSize) {
            headerIndex = i
            break
          }
        }
        currentChildPos += child.nodeSize
      }
      
      // Check if this is not the last header in the row
      return headerIndex >= 0 && headerIndex < rowNode.childCount - 1
    }
    currentDepth--
  }
  
  return false
}

export const TableWithResizeButtons = Extension.create({
  name: 'tableWithResizeButtons',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('tableWithResizeButtons'),
        
        props: {
          decorations(state) {
            const { doc } = state
            const decorations: Decoration[] = []
            
            doc.descendants((node, pos) => {
              if (isTableHeaderNode(node)) {
                // Only add resize button to headers that are not the last in their row
                if (isNotLastHeaderInRow(node, pos, doc)) {
                  // Create a decoration that wraps the header content
                  const resizeButton = document.createElement('button')
                  resizeButton.className = 'col-resize-handle'
                  resizeButton.setAttribute('type', 'button')
                  resizeButton.setAttribute('aria-label', 'Resize column')
                  resizeButton.setAttribute('aria-describedby', 'resize-instructions')
                  resizeButton.innerHTML = '↔'
                  
                  // Add the button after the header content
                  const decoration = Decoration.widget(pos + node.nodeSize, resizeButton, {
                    side: 1,
                    key: `resize-${pos}`
                  })
                  decorations.push(decoration)
                }
              }
            })
            
            return DecorationSet.create(doc, decorations)
          },
          
          handleDOMEvents: {
            mousedown(view, event) {
              const target = event.target as HTMLElement
              if (target.classList.contains('col-resize-handle')) {
                event.preventDefault()
                event.stopPropagation()
                
                // Handle column resizing logic here
                const header = target.closest('th')
                if (header) {
                  // Start resize operation
                  // You can implement the actual resize logic here
                }
                
                return true
              }
              return false
            },
            
            keydown(view, event) {
              const target = event.target as HTMLElement
              if (target.classList.contains('col-resize-handle')) {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  event.stopPropagation()
                  
                  // Handle keyboard resize
                  const header = target.closest('th')
                  if (header) {
                    // You can implement the actual resize logic here
                  }
                  
                  return true
                }
              }
              return false
            }
          }
        }
      })
    ]
  }
}) 