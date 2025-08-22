'use client'

import { AnnouncementsWidget } from '@/modules/announcements'
import { MyWorkWidget } from '@/modules/my-work'
import { useUserStore } from '@/stores/useUserStore'

export default function DashboardPage() {
  const profile = useUserStore((state) => state.profile)
  const firstName = profile?.firstName || 'Пользователь'

  return (
    <main className="w-full h-full flex flex-col px-4 md:px-0">
      <div className="bg-white dark:bg-gray-800 rounded-xl h-[calc(100vh-58px)] animate-fade-in transition-colors duration-200">
        {/* Виджет объявлений - скрыт */}
        <div className="hidden">
          <AnnouncementsWidget />
        </div>
        
        {/* Виджет "Моя работа" - на всю ширину */}
        <div className="w-full">
          <MyWorkWidget />
        </div>
      </div>
    </main>
  )
}
