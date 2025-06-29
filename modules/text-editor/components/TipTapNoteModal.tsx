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
  
  // Обработчик закрытия модального окна с автосохранением
  const handleOpenChange = async (newOpen: boolean) => {
    if (!newOpen && open) {
      // Закрываем модальное окно, сохраняем если нужно
      await handleCancel()
    } else {
      onOpenChange(newOpen)
    }
  }

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

  const handleCancel = async () => {
    // Если это режим редактирования с автосохранением, принудительно сохраняем перед закрытием
    if (mode === 'edit' && notion?.notion_id && editorRef.current) {
      try {
        const content = editorRef.current.getContent()
        if (content !== notion.notion_content) {
          // Есть изменения, сохраняем их
          onSave(content)
        }
      } catch (error) {
        console.error('Ошибка при сохранении перед закрытием:', error)
      }
    }
    onOpenChange(false)
  }

  // Горячие клавиши для модального окна
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        e.preventDefault()
        await handleCancel()
      }
    }

    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, handleCancel])

      return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
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
              notionId={notion?.notion_id}
              enableAutoSave={!!notion?.notion_id}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 