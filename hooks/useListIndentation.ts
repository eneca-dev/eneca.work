import { useEffect, useCallback } from 'react'
import type { Editor } from '@tiptap/react'

/**
 * Hook for handling Tab key indentation in lists for TipTap editors
 * @param editor - The TipTap editor instance
 */
export function useListIndentation(editor: Editor | null) {
  const handleTabKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Tab') {
      const isInListItem = editor?.isActive('listItem')
      const isInTaskItem = editor?.isActive('taskItem')
      
      if (isInListItem || isInTaskItem) {
        event.preventDefault()
        
        if (event.shiftKey) {
          // Shift+Tab - decrease indent by one level
          handleDecreaseIndent(editor)
        } else {
          // Tab - increase indent by one level
          handleIncreaseIndent(editor)
        }
      }
    }
  }, [editor])

  const findListStructure = useCallback((editor: Editor) => {
    const { state } = editor
    const { selection } = state
    const { $from } = selection
    
    let currentListItem = null
    let currentListItemDepth = -1
    let parentList = null
    let parentListDepth = -1
    let rootList = null
    let rootListDepth = -1
    
    // Traverse up the document tree to find list structure
    for (let i = $from.depth; i > 0; i--) {
      const node = $from.node(i)
      
      if ((node.type.name === 'listItem' || node.type.name === 'taskItem') && currentListItem === null) {
        currentListItem = node
        currentListItemDepth = i
      }
      
      if (node.type.name === 'bulletList' || node.type.name === 'orderedList' || node.type.name === 'taskList') {
        if (parentList === null) {
          parentList = node
          parentListDepth = i
        }
        rootList = node
        rootListDepth = i
      }
    }
    
    // Calculate actual nesting level
    let nestingLevel = 0
    for (let i = currentListItemDepth; i > rootListDepth; i--) {
      const node = $from.node(i)
      if (node.type.name === 'bulletList' || node.type.name === 'orderedList' || node.type.name === 'taskList') {
        nestingLevel++
      }
    }
    
    return {
      currentListItem,
      currentListItemDepth,
      parentList,
      parentListDepth,
      rootList,
      rootListDepth,
      nestingLevel
    }
  }, [])

  const handleIncreaseIndent = useCallback((editor: Editor | null) => {
    if (!editor) return

    const { currentListItem } = findListStructure(editor)
    if (!currentListItem) return

    const itemType = currentListItem.type.name === 'taskItem' ? 'taskItem' : 'listItem'
    
    // Use the built-in sink command for indenting - this usually works fine
    if (editor.can().sinkListItem(itemType)) {
      editor.chain().focus().sinkListItem(itemType).run()
    }
  }, [findListStructure])

  const handleDecreaseIndent = useCallback((editor: Editor | null) => {
    if (!editor) return

    const { 
      currentListItem, 
      currentListItemDepth, 
      nestingLevel,
      rootListDepth
    } = findListStructure(editor)
    
    if (!currentListItem) return

    const itemType = currentListItem.type.name === 'taskItem' ? 'taskItem' : 'listItem'
    
    console.log('Nesting level:', nestingLevel, 'Current item depth:', currentListItemDepth, 'Root list depth:', rootListDepth)
    
    // If we're already at the root level of the list, don't lift
    if (nestingLevel <= 1) {
      console.log('Already at root level, not lifting')
      return
    }
    
    // Try to lift the item while preserving list structure
    if (editor.can().liftListItem(itemType)) {
      // Before lifting, check if we can do it safely
      const { state } = editor
      const { tr } = state
      
      try {
        // Attempt to lift the item
        editor.chain().focus().liftListItem(itemType).run()
        
        // After lifting, check if we're still in a list
        setTimeout(() => {
          const isStillInList = editor.isActive('listItem') || editor.isActive('taskItem')
          if (!isStillInList) {
            console.log('Item was lifted out of list, attempting to fix...')
            // Try to undo and use an alternative approach
            if (editor.can().undo()) {
              editor.chain().focus().undo().run()
            }
          }
        }, 0)
        
      } catch (error) {
        console.error('Error lifting list item:', error)
      }
    }
  }, [findListStructure])

  useEffect(() => {
    if (!editor) return

    const editorElement = editor.view.dom
    editorElement.addEventListener('keydown', handleTabKeyDown)

    return () => {
      editorElement.removeEventListener('keydown', handleTabKeyDown)
    }
  }, [editor, handleTabKeyDown])
} 