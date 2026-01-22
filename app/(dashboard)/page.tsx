'use client'

import { useState } from 'react'
import { MyWorkWidget } from '@/modules/my-work'
import { NotesSidebar, NotesTabButton } from '@/modules/notions'
import { useUserStore } from '@/stores/useUserStore'

export default function DashboardPage() {
  const profile = useUserStore((state) => state.profile)
  const firstName = profile?.first_name || 'Пользователь'
  const [isNotesSidebarOpen, setIsNotesSidebarOpen] = useState(false)

  return (
    <main className="w-full h-screen flex flex-col bg-card animate-fade-in transition-colors duration-200">
      {/* Виджет "Моя работа" - на всю ширину */}
      <div className="w-full h-full">
        <MyWorkWidget />
      </div>

      {/* Кнопка-язычок для заметок */}
      <NotesTabButton
        onClick={() => setIsNotesSidebarOpen(true)}
        isOpen={isNotesSidebarOpen}
      />

      {/* Боковая панель с заметками */}
      <NotesSidebar
        isOpen={isNotesSidebarOpen}
        onClose={() => setIsNotesSidebarOpen(false)}
      />
    </main>
  )
}
