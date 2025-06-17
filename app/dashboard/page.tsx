'use client'

import { AnnouncementsWidget } from '@/modules/announcements'
import { NotesBlock } from '@/modules/notions'
import { useUserStore } from '@/stores/useUserStore'

export default function DashboardPage() {
  const profile = useUserStore((state) => state.profile)
  const firstName = profile?.firstName || 'Пользователь'

  return (
    <main className="w-full py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full min-w-[1200px]">
        {/* Блок заметок */}
        <div className="animate-fade-in transition-colors duration-200 w-full">
          <NotesBlock />
        </div>
        
        {/* Виджет объявлений */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-xl p-6 animate-fade-in transition-colors duration-200 w-full">
          <AnnouncementsWidget />
        </div>
      </div>
    </main>
  )
}
