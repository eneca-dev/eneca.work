'use client'

import { AnnouncementsWidget } from '@/modules/announcements'
import { useUserStore } from '@/stores/useUserStore'

export default function DashboardPage() {
  const profile = useUserStore((state) => state.profile)
  const firstName = profile?.firstName || 'Пользователь'

  return (
    <main className="w-full h-full flex flex-col px-4 md:px-0">
      <div className="grid grid-cols-1 gap-6 w-full h-full">
        {/* Виджет объявлений */}
        <div className="animate-fade-in transition-colors duration-200 w-full">
          <AnnouncementsWidget />
        </div>
      </div>
    </main>
  )
}
