'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MarkdownEditor } from './MarkdownEditor'

interface NewNoteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (content: string) => void
}

export function NewNoteModal({ open, onOpenChange, onSave }: NewNoteModalProps) {
  const [isCreating, setIsCreating] = useState(false)

  const handleSave = async (content: string) => {
    if (!content.trim()) return
    
    setIsCreating(true)
    try {
      await onSave(content)
      onOpenChange(false)
    } finally {
      setIsCreating(false)
    }
  }

  const handleCancel = () => {
    if (!isCreating) {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Новая заметка</DialogTitle>
        </DialogHeader>
        
        <div className="mt-4">
          <MarkdownEditor
            initialValue=""
            onSave={handleSave}
            onCancel={handleCancel}
            placeholder="Введите текст заметки. Поддерживается Markdown форматирование..."
            autoFocus={true}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
} 