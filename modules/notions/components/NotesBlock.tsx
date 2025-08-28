'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { NoteCard } from '@/modules/notions/components/NoteCard'
import { BulkDeleteConfirm } from '@/modules/notions/components/BulkDeleteConfirm'
import { ToggleDoneButton } from '@/modules/notions/components/ToggleDoneButton'
import { TipTapEditor } from '@/modules/text-editor/components/client'
import type { EditorRef } from '@/modules/text-editor'
import { useNotionsStore } from '@/modules/notions/store'
import { Plus, Search, Trash2, Loader2, CheckSquare, Square, Check, ArrowLeft, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { parseNotionContent } from '@/modules/notions/utils'
import type { Notion } from '@/modules/notions/types'
import { useMediaQuery } from 'usehooks-ts'

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
  const isSwitchingRef = useRef(false)
  
  const router = useRouter()
  const pathname = usePathname()
  const previousPathnameRef = useRef(pathname)
  const isLargeScreen = useMediaQuery('(min-width: 1024px)')

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

  const handleOpenFullView = async (notion: Notion) => {
    // Сохраняем текущую открытую заметку перед переключением
    if (fullViewNotion && editorRef.current) {
      try {
        isSwitchingRef.current = true
        await editorRef.current.save()
      } catch (error) {
        console.warn('Failed to save previous note before switching:', error)
      }
    }

    setIsCreatingNewNote(false)
    setFullViewNotion(notion)
    // Небольшая задержка, чтобы завершились async операции сохранения
    setTimeout(() => { isSwitchingRef.current = false }, 50)
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
      // Для новой заметки при автосохранении с пустым контентом — ничего не делаем
      if (isCreatingNewNote) {
        return
      }
      // Для существующей заметки — просто не сохраняем и не закрываем
      return
    }
    
    if (isCreatingNewNote) {
      // Создаем новую заметку
      try {
        const created = await createNotion({ notion_content: content })
        // Закрываем редактор после создания заметки
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
    if (isSwitchingRef.current || !fullViewNotion) return
    const updatedNotion = notions.find(n => n.notion_id === fullViewNotion.notion_id)
    if (!updatedNotion) {
      // Если это новая незасохраненная заметка — не закрываем редактор
      if (fullViewNotion.notion_id === 'new' || isCreatingNewNote) return
      // Текущая заметка была удалена — закрываем редактор
      setIsCreatingNewNote(false)
      setFullViewNotion(null)
      return
    }
    // Обновляем только если данные реально изменились (по updated_at, контенту или статусу)
    if (
      updatedNotion.notion_updated_at !== fullViewNotion.notion_updated_at ||
      updatedNotion.notion_content !== fullViewNotion.notion_content ||
      updatedNotion.notion_done !== fullViewNotion.notion_done
    ) {
      setFullViewNotion(updatedNotion)
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

  // Если открыта полная версия заметки и маленький экран — показываем полноэкранный режим
  if (fullViewNotion && !isLargeScreen) {
    const parsed = parseNotionContent(fullViewNotion)
    
          return (
        <div className="px-3 md:px-6 py-4 h-[calc(100vh-58px)] flex flex-col max-h-[calc(100vh-58px)]">
        {/* Заголовок */}
        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCloseFullView}
              className="gap-2 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Назад к списку
            </Button>
          </div>
          
          {!isCreatingNewNote && (
            <div className="flex items-center gap-2">
              {/* Кнопка отметки выполнения */}
              <ToggleDoneButton
                notion={fullViewNotion}
                onToggle={async () => {
                  await toggleNotionDone(fullViewNotion.notion_id)
                  // Убираем локальное обновление - пусть useEffect сам обновит
                }}
              />
            </div>
          )}
        </div>

        {/* Содержимое заметки */}
        <div className="flex-1 overflow-hidden min-h-0 pb-[10px]">
          <TipTapEditor
            key={fullViewNotion.notion_id}
            ref={editorRef}
            initialTitle={parsed.title}
            initialValue={parsed.content}
            onSave={handleSaveFullView}
            onCancel={handleCloseFullView}
            showTitle={true}
            notionId={fullViewNotion.notion_id !== 'new' ? fullViewNotion.notion_id : undefined}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="px-3 md:px-6 py-4 h-[calc(100vh-58px)] flex flex-col max-h-[calc(100vh-58px)]">
      {/* Заголовок блока */}
      <div className="flex items-center justify-between mb-4 md:mb-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Заметки</h2>
          {totalCount > 0 && (
            <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
              {totalCount} {totalCount === 1 ? 'заметка' : 
                          totalCount <= 4 ? 'заметки' : 'заметок'}
              {completedCount > 0 && (
                <span className="ml-1 text-green-600 dark:text-green-400">
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

      <div className="flex-1 min-h-0 flex gap-4">
        {/* Левая колонка: поиск, действия, список */}
        <div className={cn(
          "flex w-full flex-col min-w-[280px] transition-all duration-300",
          fullViewNotion ? "lg:w-[30%]" : "lg:w-full"
        )}>
          {/* Панель управления */}
          <div className="flex items-center gap-3 mb-3 md:mb-4 flex-shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
              <Input
                placeholder="Поиск по заметкам..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {selectedNotions.length > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  className="gap-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  {selectedNotions.length === notions.length ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
                  {selectedNotions.length === notions.length ? 'Снять выделение' : 'Выбрать все'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={shouldShowMarkAsUndone ? handleMarkAsUndone : handleMarkAsDone}
                  className="gap-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <Check className="h-4 w-4" />
                  {shouldShowMarkAsUndone ? 'Разархивировать' : 'Архивировать'}
                </Button>
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

          {/* Список заметок */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="space-y-3 pr-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400 dark:text-gray-500" />
                  <span className="ml-2 text-gray-500 dark:text-gray-400">Загрузка заметок...</span>
                </div>
              ) : notions.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
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
                isActive={!!fullViewNotion && fullViewNotion.notion_id === notion.notion_id}
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
        </div>

        {/* Правая колонка: редактор (только на больших экранах). Скрыт по умолчанию, появляется при выборе заметки */}
        {fullViewNotion && (
          <div className="hidden lg:flex lg:w-[70%] min-w-0 flex-col overflow-hidden transition-all duration-300">
            {(() => {
              const parsed = parseNotionContent(fullViewNotion)
              return (
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="flex items-center justify-between mb-3 flex-shrink-0">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Редактор</span>
                    </div>
                                          <div className="flex items-center gap-2">
                        <ToggleDoneButton
                          notion={fullViewNotion}
                          onToggle={async () => {
                            await toggleNotionDone(fullViewNotion.notion_id)
                            // Убираем локальное обновление - пусть useEffect сам обновит
                          }}
                        />
                        <Button variant="ghost" size="sm" onClick={handleCloseFullView} className="hover:bg-gray-100 dark:hover:bg-gray-700">Закрыть</Button>
                      </div>
                  </div>
                  <div className="flex-1 overflow-hidden min-h-0 pb-[10px]">
                    <TipTapEditor
                      key={fullViewNotion.notion_id}
                      ref={editorRef}
                      initialTitle={parsed.title}
                      initialValue={parsed.content}
                      onSave={handleSaveFullView}
                      onCancel={handleCloseFullView}
                      showTitle={true}
                      notionId={fullViewNotion.notion_id !== 'new' ? fullViewNotion.notion_id : undefined}
                    />
                  </div>
                </div>
              )
            })()}
          </div>
        )}
      </div>

      {/* Модальные окна */}
      <BulkDeleteConfirm
        open={showBulkDeleteModal}
        onOpenChange={setShowBulkDeleteModal}
        selectedNotions={selectedNotionsData}
        onConfirm={handleBulkDelete}
      />
    </div>
  )
} 