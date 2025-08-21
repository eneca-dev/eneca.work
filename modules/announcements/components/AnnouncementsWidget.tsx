"use client"

import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/modules/calendar/components/ui/dialog"
import { AnnouncementForm } from "./AnnouncementForm"
import { useAnnouncements } from "@/modules/announcements/hooks/useAnnouncements"
import { useUserStore } from "@/stores/useUserStore"
import { Announcement } from "@/modules/announcements/types"

export function AnnouncementsWidget() {
  const { fetchAnnouncements, removeAnnouncement } = useAnnouncements()
  const userStore = useUserStore()
  const isAuthenticated = userStore.isAuthenticated

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)
  const [isPermissionsLoading, setIsPermissionsLoading] = useState(true)

  useEffect(() => {
    if (isAuthenticated) {
      setIsPermissionsLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (isAuthenticated && !isPermissionsLoading) {
      fetchAnnouncements()
    }
  }, [isAuthenticated, isPermissionsLoading, fetchAnnouncements])

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 animate-fade-in transition-colors duration-200 h-[calc(100vh-58px)] flex flex-col max-h-[calc(100vh-58px)]"></div>

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