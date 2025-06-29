'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { NoteCard } from '@/modules/notions/components/NoteCard'
import { BulkDeleteConfirm } from '@/modules/notions/components/BulkDeleteConfirm'
import { TipTapEditor } from '@/modules/text-editor'
import type { EditorRef } from '@/modules/text-editor'
import { useNotionsStore } from '@/modules/notions/store'
import { Plus, Search, Trash2, Loader2, CheckSquare, Square, Check, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { parseNotionContent } from '@/modules/notions/utils'
import type { Notion } from '@/modules/notions/types'

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
    markNotionsAsDone,
    markNotionsAsUndone
  } = useNotionsStore()

  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false)
  const [fullViewNotion, setFullViewNotion] = useState<Notion | null>(null)
  const [isCreatingNewNote, setIsCreatingNewNote] = useState(false)

  const editorRef = useRef<EditorRef>(null)
  
  const router = useRouter()
  const pathname = usePathname()
  const previousPathnameRef = useRef(pathname)

  // Загружаем заметки при монтировании компонента
  useEffect(() => {
    fetchNotions()
  }, [fetchNotions])

  const handleCreateNote = () => {
    // Создаем новую пустую заметку для редактирования
    setIsCreatingNewNote(true)
    setFullViewNotion({
      notion_id: 'new',
      notion_content: '',
      notion_done: false,
      notion_created_by: '',
      notion_created_at: new Date().toISOString(),
      notion_updated_at: new Date().toISOString()
    })
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

  const handleMarkAsUndone = async () => {
    if (selectedNotions.length > 0) {
      await markNotionsAsUndone(selectedNotions)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedNotions.length > 0) {
      await deleteNotions(selectedNotions)
      setShowBulkDeleteModal(false)
    }
  }

  const handleOpenFullView = (notion: Notion) => {
    setFullViewNotion(notion)
  }

  const handleCloseFullView = () => {
    // Сохраняем перед закрытием
    if (editorRef.current) {
      editorRef.current.save()
    }
    if (isCreatingNewNote) {
      setIsCreatingNewNote(false)
    }
    setFullViewNotion(null)
  }

  const handleSaveFullView = async (content: string) => {
    if (!fullViewNotion) return
    
    // Проверяем, пустая ли заметка (нет ни заголовка, ни контента)
    const trimmedContent = content.trim()
    if (!trimmedContent) {
      // Если контент пустой, просто закрываем редактор без сохранения
      if (isCreatingNewNote) {
        setIsCreatingNewNote(false)
      }
      setFullViewNotion(null)
      return
    }
    
    if (isCreatingNewNote) {
      // Создаем новую заметку
      try {
        await createNotion({ notion_content: content })
        setIsCreatingNewNote(false)
        setFullViewNotion(null)
      } catch (error) {
        console.error('Ошибка при создании заметки:', error)
      }
    } else {
      // Обновляем существующую заметку
      handleUpdateNote(fullViewNotion.notion_id, content)
    }
  }

  // Обновляем fullViewNotion когда изменяется список заметок
  useEffect(() => {
    if (fullViewNotion) {
      const updatedNotion = notions.find(n => n.notion_id === fullViewNotion.notion_id)
      if (updatedNotion) {
        setFullViewNotion(updatedNotion)
      }
    }
  }, [notions, fullViewNotion])

  // Автосохранение при изменении маршрута или закрытии приложения
  useEffect(() => {
    if (!fullViewNotion) return

    let isNavigating = false

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (editorRef.current) {
        editorRef.current.save()
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && editorRef.current) {
        editorRef.current.save()
      }
    }

    // Отслеживание изменения URL для автосохранения при навигации
    const handlePopState = () => {
      if (editorRef.current) {
        editorRef.current.save()
      }
    }

    // Глобальное отслеживание кликов по ссылкам для автосохранения
    const handleLinkClick = (e: MouseEvent) => {
      if (isNavigating) return
      
      const target = e.target as HTMLElement
      
      // Проверяем, является ли цель или её родитель ссылкой
      const link = target.closest('a[href]') as HTMLAnchorElement
      if (link && editorRef.current) {
        // Проверяем, что это внутренняя навигация (не внешняя ссылка)
        const href = link.getAttribute('href')
        if (href && (href.startsWith('/') || href.startsWith('#'))) {
          isNavigating = true
          editorRef.current.save()
          
          // Сбрасываем флаг через небольшое время
          setTimeout(() => {
            isNavigating = false
          }, 100)
        }
      }
    }

    // Отслеживание кликов по любым элементам навигации и интерактивным элементам
    const handleNavigationClick = (e: MouseEvent) => {
      if (isNavigating) return
      
      const target = e.target as HTMLElement
      
      // Расширенный список селекторов для всех возможных элементов навигации
      const navigationElement = target.closest(`
        button[data-navigate],
        .nav-button,
        .nav-item,
        nav a,
        [role="menuitem"],
        [data-testid*="nav"],
        .sidebar a,
        .menu-item,
        .navigation-link,
        [href="/dashboard/planning"],
        [href="/dashboard/decomposition"],
        [href="/dashboard/projects"],
        [href="/dashboard/tasks"],
        [href="/dashboard/users"],
        [href="/dashboard/settings"],
        [href="/dashboard/calendar"],
        [href*="/dashboard"],
        .weekly-calendar,
        [title*="календарю"],
        [title*="календарь"],
        .calendar-grid,
        button[title*="неделя"],
        button[title*="текущая"],
        [onclick*="calendar"],
        [onclick*="router"],
        .cursor-pointer
      `) as HTMLElement
      
      // Специальная проверка для календарных элементов
      const isCalendarElement = target.closest('.weekly-calendar, .calendar-grid, [title*="календарю"], [title*="календарь"]')
      
      if ((navigationElement || isCalendarElement) && editorRef.current) {
        console.log('🔄 Обнаружена навигация, сохраняем заметку:', {
          targetElement: target.tagName,
          targetClasses: target.className,
          targetTitle: target.title,
          isCalendarElement: !!isCalendarElement,
          navigationElement: navigationElement?.tagName,
          navigationClasses: navigationElement?.className
        })
        
        isNavigating = true
        
        // Синхронное сохранение для критических переходов
        try {
          editorRef.current.save()
        } catch (error) {
          console.warn('Failed to save note during navigation:', error)
        }
        
        // Сбрасываем флаг через небольшое время
        setTimeout(() => {
          isNavigating = false
        }, 200)
      }
    }

    // Перехватываем router.push вызовы
    const originalPush = router.push
    router.push = (...args) => {
      if (editorRef.current && !isNavigating) {
        console.log('🔄 router.push обнаружен, сохраняем заметку:', args[0])
        isNavigating = true
        editorRef.current.save()
        
        setTimeout(() => {
          isNavigating = false
        }, 100)
      }
      return originalPush.apply(router, args)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)  
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('popstate', handlePopState)
    document.addEventListener('click', handleLinkClick, true) // capture phase
    document.addEventListener('click', handleNavigationClick, true) // capture phase

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('popstate', handlePopState)
      document.removeEventListener('click', handleLinkClick, true)
      document.removeEventListener('click', handleNavigationClick, true)
      
      // Восстанавливаем оригинальный router.push
      router.push = originalPush
    }
  }, [fullViewNotion, router])

  // Отслеживание изменения pathname для автосохранения при навигации через Link
  useEffect(() => {
    if (fullViewNotion && pathname !== previousPathnameRef.current) {
      if (editorRef.current) {
        editorRef.current.save()
      }
      previousPathnameRef.current = pathname
    }
  }, [pathname, fullViewNotion])

  // Дополнительное автосохранение каждые 30 секунд при активном редактировании
  useEffect(() => {
    if (!fullViewNotion) return

    const intervalId = setInterval(() => {
      if (editorRef.current) {
        editorRef.current.save()
      }
    }, 30000) // каждые 30 секунд

    return () => clearInterval(intervalId)
  }, [fullViewNotion])

  const selectedNotionsData = notions.filter(notion => 
    selectedNotions.includes(notion.notion_id)
  )

  // Считаем количество выполненных и невыполненных среди выбранных
  const selectedDoneCount = selectedNotionsData.filter(notion => notion.notion_done).length
  const selectedNotDoneCount = selectedNotionsData.length - selectedDoneCount
  const shouldShowMarkAsUndone = selectedDoneCount > selectedNotDoneCount

  const completedCount = notions.filter(notion => notion.notion_done).length
  const totalCount = notions.length

  // Если открыта полная версия заметки
  if (fullViewNotion) {
    const parsed = parseNotionContent(fullViewNotion)
    
          return (
        <Card className="p-6 h-[calc(100vh-58px)] flex flex-col max-h-[calc(100vh-58px)]">
        {/* Заголовок */}
        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCloseFullView}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Назад к списку
            </Button>
          </div>
          
          {!isCreatingNewNote && (
            <div className="flex items-center gap-2">
              {/* Кнопка отметки выполнения */}
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await toggleNotionDone(fullViewNotion.notion_id)
                  // Обновляем локальное состояние fullViewNotion
                  setFullViewNotion(prev => prev ? { ...prev, notion_done: !prev.notion_done } : null)
                }}
                className="gap-2"
              >
                <Check className={cn(
                  "h-4 w-4",
                  fullViewNotion.notion_done ? "text-green-600" : "text-gray-400"
                )} />
                {fullViewNotion.notion_done ? "Выполнено" : "Отметить выполненным"}
              </Button>
            </div>
          )}
        </div>

        {/* Содержимое заметки */}
        <div className="flex-1 overflow-hidden min-h-0 pb-[10px]">
          <TipTapEditor
            ref={editorRef}
            initialTitle={parsed.title}
            initialValue={parsed.content}
            onSave={handleSaveFullView}
            onCancel={handleCloseFullView}
            showTitle={true}
          />
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6 h-[calc(100vh-58px)] flex flex-col max-h-[calc(100vh-58px)]">
      {/* Заголовок блока */}
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
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
        
        <div className="flex gap-2">
          <Button
            onClick={handleCreateNote}
            size="sm"
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Добавить
          </Button>
        </div>
      </div>

      {/* Панель управления */}
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
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

            {/* Отметить выполненным/невыполненным */}
            <Button
              variant="outline"
              size="sm"
              onClick={shouldShowMarkAsUndone ? handleMarkAsUndone : handleMarkAsDone}
              className="gap-2"
            >
              <Check className="h-4 w-4" />
              {shouldShowMarkAsUndone ? 'Отметить невыполненным' : 'Отметить выполненным'}
            </Button>

            {/* Удалить выделенное */}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowBulkDeleteModal(true)}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Удалить ({selectedNotions.length})
            </Button>
          </>
        )}
      </div>

      {/* Список заметок с скроллом */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="space-y-3 pr-2">
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
                onOpenFullView={handleOpenFullView}

                showSelection={true}
              />
            ))
          )}
        </div>
      </div>

      {/* Модальные окна */}
      <BulkDeleteConfirm
        open={showBulkDeleteModal}
        onOpenChange={setShowBulkDeleteModal}
        selectedNotions={selectedNotionsData}
        onConfirm={handleBulkDelete}
      />
    </Card>
  )
} 