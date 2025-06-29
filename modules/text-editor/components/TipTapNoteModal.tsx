'use client'

import React, { useRef, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TipTapEditor } from '@/modules/text-editor/components/TipTapEditor'
import type { TipTapEditorRef, TipTapNoteModalProps } from '@/modules/text-editor/types'

export function TipTapNoteModal({
  open,
  onOpenChange,
  notion,
  onSave,
  mode
}: TipTapNoteModalProps) {
  const editorRef = useRef<TipTapEditorRef>(null)

  // Фокус при открытии
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        editorRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [open])

  const handleSave = (content: string) => {
    onSave(content)
    onOpenChange(false)
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  // Горячие клавиши для модального окна
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        e.preventDefault()
        handleCancel()
      }
    }

    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-full h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="text-lg font-semibold">
            {mode === 'create' ? 'Создать заметку' : 'Редактировать заметку'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {open && (
            <TipTapEditor
              ref={editorRef}
              initialValue={notion?.notion_content || ''}
              onSave={handleSave}
              onCancel={handleCancel}
              showTitle={true}
              autoFocus={true}
              className="h-full"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 