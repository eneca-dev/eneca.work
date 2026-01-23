'use client'

import { useEffect, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { TipTapEditor } from '@/modules/text-editor/components/client'
import type { EditorRef } from '@/modules/text-editor'
import { useNotionsStore } from '@/modules/notions/store'
import { parseNotionContent } from '@/modules/notions/utils'
import { Plus, X, Loader2, StickyNote } from 'lucide-react'
import { cn } from '@/lib/utils'

// Константы
const MAX_VISIBLE_TABS = 10
const MAX_TITLE_LENGTH = 15

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
      // Берем первую заметку (они уже отсортированы по updated_at в store)
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

  const handleDeleteNote = async (notionId: string) => {
    try {
      await deleteNotion(notionId)
      // После удаления переключаемся на первую доступную заметку
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

  const handleTabClick = async (notionId: string) => {
    // Сохраняем текущую заметку перед переключением
    if (activeNotionId && editorRef.current) {
      // Сохраняем реальный контент редактора
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

      {/* Sidebar */}
      <div
        className={cn(
          'fixed right-0 top-0 h-screen bg-card border-l border-border shadow-2xl z-50 flex flex-col transition-all duration-300',
          isOpen ? 'translate-x-0 w-[500px]' : 'translate-x-full w-[500px]'
        )}
      >
        {/* Вкладки заметок (как в браузере) */}
        <div className="flex-shrink-0 border-b border-border bg-muted/30">
          <div className="flex items-center overflow-x-auto">
            {/* Вкладки */}
            {notions.slice(0, MAX_VISIBLE_TABS).map((notion) => {
              const parsed = parseNotionContent(notion)
              const title = parsed.title || 'Без названия'
              const isActive = activeNotionId === notion.notion_id

              return (
                <div
                  key={notion.notion_id}
                  className={cn(
                    'group flex items-center gap-2 px-3 py-2 border-r border-border cursor-pointer transition-colors min-w-[140px] max-w-[180px]',
                    isActive
                      ? 'bg-card border-b-2 border-b-primary'
                      : 'bg-muted/20 hover:bg-muted/40'
                  )}
                  onClick={() => handleTabClick(notion.notion_id)}
                >
                  <StickyNote className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                  <span className="flex-1 text-xs truncate text-foreground">
                    {title.substring(0, MAX_TITLE_LENGTH)}
                    {title.length > MAX_TITLE_LENGTH ? '...' : ''}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteNote(notion.notion_id)
                    }}
                    className="opacity-0 group-hover:opacity-100 hover:bg-destructive/20 rounded p-0.5 transition-opacity"
                    title="Удалить заметку"
                  >
                    <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              )
            })}

            {/* Кнопка создания новой заметки */}
            <button
              onClick={handleCreateNote}
              disabled={isCreatingNewNote}
              className="flex items-center justify-center px-3 py-2 bg-muted/20 hover:bg-muted/40 transition-colors border-r border-border"
              title="Создать заметку"
            >
              {isCreatingNewNote ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Plus className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>

        {/* Содержимое: редактор */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {isLoading && !activeNotion ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : activeNotion ? (
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
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <StickyNote className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-sm">Нет заметок</p>
              <p className="text-xs mt-2">Нажмите + чтобы создать</p>
            </div>
          )}
        </div>

      </div>
    </>
  )
}
