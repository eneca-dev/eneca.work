"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/modules/calendar/components/ui/button"
import { Input } from "@/modules/calendar/components/ui/input"
import { Label } from "@/modules/calendar/components/ui/label"

import { RichTextEditor } from "./RichTextEditor"

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
import { useAnnouncements } from "@/modules/announcements/hooks/useAnnouncements"
import { useUserStore } from "@/stores/useUserStore"
import { Announcement } from "@/modules/announcements/types"
import { TrashIcon } from "lucide-react"

interface AnnouncementFormProps {
  onClose: () => void
  editingAnnouncement?: Announcement | null
  onDelete?: (id: string) => Promise<void>
}

export function AnnouncementForm({ onClose, editingAnnouncement, onDelete }: AnnouncementFormProps) {
  const { createAnnouncement, editAnnouncement } = useAnnouncements()
  const userStore = useUserStore()
  const currentUserId = userStore.id
  const isAuthenticated = userStore.isAuthenticated

  const [header, setHeader] = useState("")
  const [text, setText] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Заполняем форму данными для редактирования
  useEffect(() => {
    if (editingAnnouncement) {
      setHeader(editingAnnouncement.header)
      setText(editingAnnouncement.text || "")
    }
  }, [editingAnnouncement])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isAuthenticated || !currentUserId || !header.trim()) return

    setIsSubmitting(true)

    try {
      const announcementData = {
        header: header.trim(),
        text: text.trim() || undefined,
      }

      if (editingAnnouncement) {
        await editAnnouncement(editingAnnouncement.id, announcementData)
      } else {
        await createAnnouncement(announcementData, currentUserId)
      }

      onClose()
    } catch (error) {
      // Ошибка уже обрабатывается в хуке
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = () => {
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (editingAnnouncement && onDelete) {
      try {
        await onDelete(editingAnnouncement.id)
        setDeleteDialogOpen(false)
        onClose()
      } catch (error) {
        // Ошибка уже обрабатывается в хуке
      }
    }
  }

  if (!isAuthenticated || !currentUserId) {
    return (
      <div className="p-4 text-center">
        <p>Для работы с объявлениями необходимо быть авторизованным</p>
      </div>
    )
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="header">Заголовок *</Label>
          <Input
            id="header"
            value={header}
            onChange={(e) => setHeader(e.target.value)}
            placeholder="Введите заголовок объявления"
            required
          />
        </div>

        <div className="space-y-2">
          <RichTextEditor
            value={text}
            onChange={setText}
            placeholder="Введите текст объявления (необязательно)"
            label="Текст"
          />
        </div>

        <div className="flex justify-between">
          <div>
            {editingAnnouncement && onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isSubmitting}
              >
                <TrashIcon className="h-4 w-4 mr-2" />
                Удалить
              </Button>
            )}
          </div>
          
          <div className="flex space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" disabled={isSubmitting || !header.trim()}>
              {isSubmitting 
                ? (editingAnnouncement ? "Сохранение..." : "Создание...") 
                : (editingAnnouncement ? "Сохранить" : "Создать")
              }
            </Button>
          </div>
        </div>
      </form>

      {/* Диалог подтверждения удаления */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить объявление?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Объявление "{editingAnnouncement?.header}" будет удалено навсегда.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
} 