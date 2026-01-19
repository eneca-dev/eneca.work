"use client"

import React, { useState, useRef } from "react"
import { Button } from "@/modules/calendar/components/ui/button"
import { Label } from "@/modules/calendar/components/ui/label"
import { Bold, Italic, Underline } from "lucide-react"

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  required?: boolean
}

export function RichTextEditor({ value, onChange, placeholder, label, required }: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const insertMarkdown = (before: string, after: string = before) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = value.substring(start, end)
    
    let newText
    if (selectedText) {
      // Если есть выделенный текст, оборачиваем его
      newText = value.substring(0, start) + before + selectedText + after + value.substring(end)
    } else {
      // Если нет выделения, просто вставляем разметку
      newText = value.substring(0, start) + before + after + value.substring(end)
    }
    
    onChange(newText)
    
    // Устанавливаем курсор в правильное место
    setTimeout(() => {
      if (selectedText) {
        textarea.setSelectionRange(start + before.length + selectedText.length + after.length, start + before.length + selectedText.length + after.length)
      } else {
        textarea.setSelectionRange(start + before.length, start + before.length)
      }
      textarea.focus()
    }, 0)
  }

  const applyBold = () => insertMarkdown('**')
  const applyItalic = () => insertMarkdown('*')
  const applyUnderline = () => insertMarkdown('__')

  return (
    <div className="space-y-2">
      {label && <Label>{label} {required && '*'}</Label>}
      
      {/* Панель форматирования */}
      <div className="flex gap-1 p-2 border border-border rounded-t-md bg-muted">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={applyBold}
          className="h-8 w-8 p-0"
          title="Жирный текст (**текст**)"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={applyItalic}
          className="h-8 w-8 p-0"
          title="Курсив (*текст*)"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={applyUnderline}
          className="h-8 w-8 p-0"
          title="Подчеркивание (__текст__)"
        >
          <Underline className="h-4 w-4" />
        </Button>
      </div>

      {/* Текстовое поле */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="min-h-[100px] w-full p-3 border border-border rounded-b-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary text-foreground resize-vertical"
        style={{ fontFamily: 'inherit' }}
      />
      
      {/* Подсказка по форматированию */}
      <div className="text-xs text-muted-foreground">
        Используйте: **жирный**, *курсив*, __подчеркнутый__
      </div>
    </div>
  )
} 