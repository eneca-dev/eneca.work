'use client'

import React from 'react'
import { BubbleMenu, Editor } from '@tiptap/react'
import { ToolbarButton } from './ToolbarButton'
import { toolbarButtonsMap, toolbarGroups } from '@/modules/text-editor/config/toolbar-config'

interface BubbleMenuToolbarProps {
  editor: Editor
}

export function BubbleMenuToolbar({ editor }: BubbleMenuToolbarProps) {
  if (!editor) {
    return null
  }

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{
        duration: 100,
        placement: 'top',
        animation: 'shift-away'
      }}
      className="flex items-center gap-1 bg-popover border border-border rounded-lg shadow-lg p-1"
    >
      {toolbarGroups.map((group, groupIndex) => (
        <React.Fragment key={groupIndex}>
          {groupIndex > 0 && <div className="w-px h-6 bg-border mx-1" />}
          {group.buttons.map((buttonId) => (
            <ToolbarButton
              key={buttonId}
              editor={editor}
              config={toolbarButtonsMap[buttonId]}
            />
          ))}
        </React.Fragment>
      ))}
    </BubbleMenu>
  )
}
