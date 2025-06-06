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
import { PlusIcon, PencilIcon, Loader2, UserIcon } from "lucide-react"

export function AnnouncementsWidget() {
  const { announcements, fetchAnnouncements, removeAnnouncement } = useAnnouncements()
  const userStore = useUserStore()
  const isAuthenticated = userStore.isAuthenticated
  const permissions = userStore.permissions

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)
  const [isPermissionsLoading, setIsPermissionsLoading] = useState(true)

  // Проверяем разрешение на создание и редактирование объявлений
  const canCreateAndEdit = useMemo(() => {
    return userStore.hasPermission("announcements_can_create_and_edit")
  }, [userStore.id, userStore.permissions])

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

  if (!isAuthenticated) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-xl p-6 animate-fade-in transition-colors duration-200">
        <div className="flex items-center space-x-2 mb-4">
          <span className="h-5 w-5 text-primary flex items-center justify-center">📢</span>
          <h2 className="text-lg font-medium dark:text-gray-200">Объявления</h2>
        </div>
        <p className="text-gray-500 dark:text-gray-400">
          Для просмотра объявлений необходимо войти в систему
        </p>
      </div>
    )
  }

  if (isPermissionsLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-xl p-6 animate-fade-in transition-colors duration-200">
        <div className="flex items-center space-x-2 mb-4">
          <span className="h-5 w-5 text-primary flex items-center justify-center">📢</span>
          <h2 className="text-lg font-medium dark:text-gray-200">Объявления</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span className="text-gray-500 dark:text-gray-400">Загрузка...</span>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-800 shadow rounded-xl p-6 animate-fade-in transition-colors duration-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <span className="h-5 w-5 text-primary flex items-center justify-center">📢</span>
            <h2 className="text-lg font-medium dark:text-gray-200">Объявления</h2>
          </div>
          {canCreateAndEdit && (
            <Button size="sm" onClick={handleCreateNew}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Добавить
            </Button>
          )}
        </div>

        <div className="space-y-4 max-h-96 overflow-y-auto">
          {announcements.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              Пока нет объявлений
            </p>
          ) : (
            announcements.map((announcement) => (
              <div
                key={announcement.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                      {announcement.header}
                    </h3>
                    {announcement.text && (
                      <p className="text-gray-600 dark:text-gray-300 text-sm mb-2">
                        {announcement.text}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
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