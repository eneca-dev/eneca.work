"use client"

import React, { useState, useRef, useEffect } from "react"
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
  const [isActive, setIsActive] = useState({ bold: false, italic: false, underline: false })
  const editorRef = useRef<HTMLDivElement>(null)

  // Конвертируем markdown в HTML для отображения
  const markdownToHtml = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/__(.*?)__/g, '<u>$1</u>')
      .replace(/\n/g, '<br>')
  }

  // Конвертируем HTML обратно в markdown
  const htmlToMarkdown = (html: string) => {
    return html
      .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
      .replace(/<em>(.*?)<\/em>/g, '*$1*')
      .replace(/<u>(.*?)<\/u>/g, '__$1__')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<div><br><\/div>/g, '\n')
      .replace(/<div>(.*?)<\/div>/g, '\n$1')
  }

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== markdownToHtml(value)) {
      editorRef.current.innerHTML = markdownToHtml(value)
    }
  }, [value])

  const handleInput = () => {
    if (editorRef.current) {
      const htmlContent = editorRef.current.innerHTML
      const markdownContent = htmlToMarkdown(htmlContent)
      onChange(markdownContent)
    }
  }

  const applyFormat = (format: 'bold' | 'italic' | 'underline') => {
    document.execCommand(format, false)
    setIsActive(prev => ({ ...prev, [format]: !prev[format] }))
    handleInput()
  }

  const handleSelectionChange = () => {
    setIsActive({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline')
    })
  }

  return (
    <div className="space-y-2">
      {label && <Label>{label} {required && '*'}</Label>}
      
      {/* Панель форматирования */}
      <div className="flex gap-1 p-2 border border-gray-200 dark:border-gray-700 rounded-t-md bg-gray-50 dark:bg-gray-800">
        <Button
          type="button"
          variant={isActive.bold ? "default" : "ghost"}
          size="sm"
          onClick={() => applyFormat('bold')}
          className="h-8 w-8 p-0"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={isActive.italic ? "default" : "ghost"}
          size="sm"
          onClick={() => applyFormat('italic')}
          className="h-8 w-8 p-0"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={isActive.underline ? "default" : "ghost"}
          size="sm"
          onClick={() => applyFormat('underline')}
          className="h-8 w-8 p-0"
        >
          <Underline className="h-4 w-4" />
        </Button>
      </div>

      {/* Редактор */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onMouseUp={handleSelectionChange}
        onKeyUp={handleSelectionChange}
        className="min-h-[100px] p-3 border border-gray-200 dark:border-gray-700 rounded-b-md bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100"
        style={{ whiteSpace: 'pre-wrap' }}
        data-placeholder={placeholder}
        suppressContentEditableWarning={true}
      />
      
      <style jsx>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
      `}</style>
    </div>
  )
} 