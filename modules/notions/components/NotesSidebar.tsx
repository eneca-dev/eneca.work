'use client'

import { useEffect, useState, useRef } from 'react'
import { TipTapEditor } from '@/modules/text-editor/components/client'
import type { EditorRef } from '@/modules/text-editor'
import { useNotionsStore } from '@/modules/notions/store'
import { parseNotionContent } from '@/modules/notions/utils'
import { Plus, Trash2, Loader2, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NotesSidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function NotesSidebar({ isOpen, onClose }: NotesSidebarProps) {
  const {
    notions,
    isLoading,
    fetchNotions,
    createNotionSilent,
    updateNotionSilent,
    deleteNotion
  } = useNotionsStore()

  const [activeNotionId, setActiveNotionId] = useState<string | null>(null)
  const [isCreatingNewNote, setIsCreatingNewNote] = useState(false)
  const editorRef = useRef<EditorRef>(null)

  // Загружаем заметки при монтировании
  useEffect(() => {
    if (isOpen) {
      fetchNotions()
    }
  }, [isOpen, fetchNotions])

  // Автоматически открываем последнюю заметку
  useEffect(() => {
    if (!activeNotionId && notions.length > 0 && !isCreatingNewNote) {
      setActiveNotionId(notions[0].notion_id)
    }
  }, [notions, activeNotionId, isCreatingNewNote])

  const activeNotion = notions.find(n => n.notion_id === activeNotionId)

  const handleCreateNote = async () => {
    try {
      setIsCreatingNewNote(true)
      const newNotion = await createNotionSilent({ notion_content: '# Новая заметка\n\n' })
      setActiveNotionId(newNotion.notion_id)
      setIsCreatingNewNote(false)
    } catch (error) {
      console.error('Failed to create note:', error)
      setIsCreatingNewNote(false)
    }
  }

  const handleSaveNote = async (content: string) => {
    if (!activeNotionId) return
    try {
      await updateNotionSilent(activeNotionId, { notion_content: content })
    } catch (error) {
      console.error('Failed to save note:', error)
    }
  }

  const handleDeleteNote = async (notionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await deleteNotion(notionId)
      if (activeNotionId === notionId) {
        const remainingNotions = notions.filter(n => n.notion_id !== notionId)
        if (remainingNotions.length > 0) {
          setActiveNotionId(remainingNotions[0].notion_id)
        } else {
          setActiveNotionId(null)
        }
      }
    } catch (error) {
      console.error('Failed to delete note:', error)
    }
  }

  const handleNoteClick = async (notionId: string) => {
    if (activeNotionId && editorRef.current) {
      editorRef.current.save()
    }
    setActiveNotionId(notionId)
  }

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar - горизонтальный layout: список слева, редактор справа */}
      <div
        className={cn(
          'fixed right-0 top-0 h-screen bg-card border-l border-border shadow-2xl z-50 flex transition-all duration-300',
          isOpen ? 'translate-x-0 w-[700px]' : 'translate-x-full w-[700px]'
        )}
      >
        {/* Левая панель: список заметок (вертикальный, как в Obsidian) */}
        <div className="w-[200px] flex-shrink-0 border-r border-border bg-muted/20 flex flex-col">
          {/* Заголовок списка + кнопка создания */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Заметки
            </span>
            <button
              onClick={handleCreateNote}
              disabled={isCreatingNewNote}
              className="p-1 rounded hover:bg-muted transition-colors"
              title="Создать заметку"
            >
              {isCreatingNewNote ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Plus className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </div>

          {/* Список заметок с вертикальным скроллом */}
          <div className="flex-1 overflow-y-auto">
            {isLoading && notions.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : notions.length === 0 ? (
              <div className="px-3 py-4 text-center text-muted-foreground">
                <p className="text-xs">Нет заметок</p>
              </div>
            ) : (
              notions.map((notion) => {
                const parsed = parseNotionContent(notion)
                const title = parsed.title || 'Без названия'
                const isActive = activeNotionId === notion.notion_id

                return (
                  <div
                    key={notion.notion_id}
                    onClick={() => handleNoteClick(notion.notion_id)}
                    className={cn(
                      'group flex items-start gap-2 px-3 py-2 cursor-pointer transition-colors border-l-2',
                      isActive
                        ? 'bg-primary/10 border-l-primary'
                        : 'border-l-transparent hover:bg-muted/50'
                    )}
                  >
                    <FileText className={cn(
                      'h-4 w-4 flex-shrink-0 mt-0.5',
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    )} />
                    <span className={cn(
                      'flex-1 text-sm leading-tight break-words',
                      isActive ? 'text-foreground font-medium' : 'text-muted-foreground'
                    )}>
                      {title}
                    </span>
                    <button
                      onClick={(e) => handleDeleteNote(notion.notion_id, e)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/20 transition-opacity flex-shrink-0"
                      title="Удалить"
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Правая панель: редактор */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeNotion ? (
            <div className="flex-1 overflow-hidden p-4">
              <TipTapEditor
                key={activeNotion.notion_id}
                ref={editorRef}
                initialTitle={parseNotionContent(activeNotion).title}
                initialValue={parseNotionContent(activeNotion).content}
                onSave={handleSaveNote}
                onCancel={onClose}
                showTitle={true}
                notionId={activeNotion.notion_id}
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <FileText className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-sm">Выберите заметку</p>
              <p className="text-xs mt-1">или создайте новую</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
