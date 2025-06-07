"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Button } from "@/modules/calendar/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/modules/calendar/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/modules/calendar/components/ui/alert-dialog"
import { AnnouncementForm } from "./AnnouncementForm"
import { useAnnouncements } from "@/modules/announcements/hooks/useAnnouncements"
import { useUserStore } from "@/stores/useUserStore"
import { Announcement } from "@/modules/announcements/types"
import { PlusIcon, PencilIcon, Loader2, UserIcon, SearchIcon, MegaphoneIcon } from "lucide-react"

export function AnnouncementsWidget() {
  const { announcements, fetchAnnouncements, removeAnnouncement } = useAnnouncements()
  const userStore = useUserStore()
  const isAuthenticated = userStore.isAuthenticated
  const permissions = userStore.permissions

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)
  const [isPermissionsLoading, setIsPermissionsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  // Проверяем разрешение на создание и редактирование объявлений
  const canCreateAndEdit = useMemo(() => {
    return userStore.hasPermission("announcements_can_create_and_edit")
  }, [userStore.id, userStore.permissions])

  // Фильтруем и сортируем объявления
  const filteredAndSortedAnnouncements = useMemo(() => {
    let filtered = announcements

    // Фильтрация по поисковому запросу
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = announcements.filter((announcement) => {
        const headerMatch = announcement.header.toLowerCase().includes(query)
        const textMatch = announcement.text?.toLowerCase().includes(query) || false
        return headerMatch || textMatch
      })
    }

    // Сортировка по дате создания (самые новые сверху)
    return filtered.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }, [announcements, searchQuery])

  // Ждем загрузки разрешений
  useEffect(() => {
    if (isAuthenticated && permissions !== null) {
      setIsPermissionsLoading(false)
    }
  }, [isAuthenticated, permissions])

  // Загружаем объявления при монтировании компонента
  useEffect(() => {
    if (isAuthenticated && !isPermissionsLoading) {
      fetchAnnouncements()
    }
  }, [isAuthenticated, isPermissionsLoading, fetchAnnouncements])

  const handleCreateNew = () => {
    setEditingAnnouncement(null)
    setIsFormOpen(true)
  }

  const handleEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement)
    setIsFormOpen(true)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatText = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/__(.*?)__/g, '<u>$1</u>')
  }

  if (!isAuthenticated) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 animate-fade-in transition-colors duration-200">
        <div className="flex items-center space-x-2 mb-4">
          <MegaphoneIcon className="h-5 w-5 text-primary" />
          <h2 className="card-title dark:text-gray-200">Объявления</h2>
        </div>
        <p className="secondary-text">
          Для просмотра объявлений необходимо войти в систему
        </p>
      </div>
    )
  }

  if (isPermissionsLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 animate-fade-in transition-colors duration-200">
        <div className="flex items-center space-x-2 mb-4">
          <MegaphoneIcon className="h-5 w-5 text-primary" />
          <h2 className="card-title dark:text-gray-200">Объявления</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span className="secondary-text">Загрузка...</span>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 animate-fade-in transition-colors duration-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <MegaphoneIcon className="h-5 w-5 text-primary" />
            <h2 className="card-title dark:text-gray-200">Объявления</h2>
          </div>
          {canCreateAndEdit && (
            <Button size="sm" onClick={handleCreateNew}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Добавить
            </Button>
          )}
        </div>

        {/* Поле поиска */}
        <div className="relative mb-4">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск по объявлениям..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar">
          {filteredAndSortedAnnouncements.length === 0 ? (
            <p className="secondary-text text-center py-8">
              {searchQuery.trim() ? "Ничего не найдено" : "Пока нет объявлений"}
            </p>
          ) : (
            filteredAndSortedAnnouncements.map((announcement) => (
              <div
                key={announcement.id}
                className="rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="subsection-title text-gray-900 dark:text-gray-100 mb-2">
                      {announcement.header}
                    </h3>
                    {announcement.text && (
                      <div 
                        className="body-text text-gray-600 dark:text-gray-300 mb-2 whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{ __html: formatText(announcement.text) }}
                      />
                    )}
                    <div className="flex items-center gap-4 metadata">
                      <span>{formatDate(announcement.created_at)}</span>
                      {announcement.author_name && (
                        <div className="flex items-center gap-1">
                          <UserIcon className="h-3 w-3" />
                          <span>{announcement.author_name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {canCreateAndEdit && (
                    <div className="flex space-x-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(announcement)}
                      >
                        <PencilIcon className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Диалог создания/редактирования */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAnnouncement ? "Редактировать объявление" : "Создать объявление"}
            </DialogTitle>
          </DialogHeader>
          <AnnouncementForm
            onClose={() => setIsFormOpen(false)}
            editingAnnouncement={editingAnnouncement}
            onDelete={removeAnnouncement}
          />
        </DialogContent>
      </Dialog>
    </>
  )
} 