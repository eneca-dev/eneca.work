'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { NoteCard } from './NoteCard'
import { NewNoteModal } from './NewNoteModal'
import { BulkDeleteConfirm } from './BulkDeleteConfirm'
import { useNotionsStore } from '../store'
import { Plus, Search, Trash2, Loader2, CheckSquare, Square, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export function NotesBlock() {
  const {
    notions,
    selectedNotions,
    searchQuery,
    isLoading,
    fetchNotions,
    createNotion,
    updateNotion,
    deleteNotion,
    deleteNotions,
    toggleNotionDone,
    setSelectedNotions,
    setSearchQuery,
    selectAllNotions,
    clearSelectedNotions,
    markNotionsAsDone
  } = useNotionsStore()

  const [showNewNoteModal, setShowNewNoteModal] = useState(false)
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false)

  // Загружаем заметки при монтировании компонента
  useEffect(() => {
    fetchNotions()
  }, [fetchNotions])

  const handleCreateNote = async (content: string) => {
    await createNotion({ notion_content: content })
  }

  const handleUpdateNote = async (id: string, content: string) => {
    await updateNotion(id, { notion_content: content })
  }

  const handleToggleSelect = (id: string) => {
    const newSelected = selectedNotions.includes(id)
      ? selectedNotions.filter(notionId => notionId !== id)
      : [...selectedNotions, id]
    setSelectedNotions(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedNotions.length === notions.length) {
      clearSelectedNotions()
    } else {
      selectAllNotions()
    }
  }

  const handleMarkAsDone = async () => {
    if (selectedNotions.length > 0) {
      await markNotionsAsDone(selectedNotions)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedNotions.length > 0) {
      await deleteNotions(selectedNotions)
      setShowBulkDeleteModal(false)
    }
  }

  const selectedNotionsData = notions.filter(notion => 
    selectedNotions.includes(notion.notion_id)
  )

  const completedCount = notions.filter(notion => notion.notion_done).length
  const totalCount = notions.length

  return (
    <Card className="p-6">
      {/* Заголовок блока */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Заметки</h2>
          {totalCount > 0 && (
            <Badge variant="secondary">
              {totalCount} {totalCount === 1 ? 'заметка' : 
                          totalCount <= 4 ? 'заметки' : 'заметок'}
              {completedCount > 0 && (
                <span className="ml-1 text-green-600">
                  ({completedCount} выполнено)
                </span>
              )}
            </Badge>
          )}
        </div>
        
        <Button
          onClick={() => setShowNewNoteModal(true)}
          size="sm"
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Добавить
        </Button>
      </div>

      {/* Панель управления */}
      <div className="flex items-center gap-3 mb-4">
        {/* Поиск */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Поиск по заметкам..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Кнопки управления выбранными заметками */}
        {selectedNotions.length > 0 && (
          <>
            {/* Выбрать все / Снять выделение */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              className="gap-2"
            >
              {selectedNotions.length === notions.length ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
              {selectedNotions.length === notions.length ? 'Снять выделение' : 'Выбрать все'}
            </Button>

            {/* Отметить выполненным */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAsDone}
              className="gap-2"
            >
              <Check className="h-4 w-4" />
              Отметить выполненным
            </Button>

            {/* Удалить выделенное */}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowBulkDeleteModal(true)}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Удалить выделенное ({selectedNotions.length})
            </Button>
          </>
        )}
      </div>

      {/* Список заметок */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Загрузка заметок...</span>
          </div>
        ) : notions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {searchQuery ? (
              <div>
                <p>Заметки не найдены</p>
                <p className="text-sm mt-1">Попробуйте изменить поисковый запрос</p>
              </div>
            ) : (
              <div>
                <p>У вас пока нет заметок</p>
                <p className="text-sm mt-1">Нажмите "Добавить", чтобы создать первую заметку</p>
              </div>
            )}
          </div>
        ) : (
          notions.map((notion) => (
            <NoteCard
              key={notion.notion_id}
              notion={notion}
              isSelected={selectedNotions.includes(notion.notion_id)}
              onToggleSelect={handleToggleSelect}
              onUpdate={handleUpdateNote}
              onToggleDone={toggleNotionDone}
              onDelete={deleteNotion}
              showSelection={true}
            />
          ))
        )}
      </div>

      {/* Модальные окна */}
      <NewNoteModal
        open={showNewNoteModal}
        onOpenChange={setShowNewNoteModal}
        onSave={handleCreateNote}
      />

      <BulkDeleteConfirm
        open={showBulkDeleteModal}
        onOpenChange={setShowBulkDeleteModal}
        selectedNotions={selectedNotionsData}
        onConfirm={handleBulkDelete}
      />
    </Card>
  )
} 