'use client'

import { AnnouncementsWidget } from '@/modules/announcements'
import { useUserStore } from '@/stores/useUserStore'

export default function DashboardPage() {
  const profile = useUserStore((state) => state.profile)
  const firstName = profile?.firstName || 'Пользователь'

  return (
    <main className="w-full py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full min-w-[1200px]">
        <div className="bg-white dark:bg-gray-800 shadow rounded-xl p-6 animate-fade-in transition-colors duration-200 w-full">
          <div className="flex items-center space-x-2 mb-4">
            <span className="h-5 w-5 text-primary flex items-center justify-center">🏠</span>
            <h2 className="card-title dark:text-gray-200">Добро пожаловать, {firstName}!</h2>
          </div>

          <p className="body-text text-gray-500 dark:text-gray-400 mb-4">
            eneca.work — это внутреннее корпоративное приложение для удобной и скоординированной работы внутри компании.
          </p>
        </div>
        
        {/* Виджет объявлений */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-xl p-6 animate-fade-in transition-colors duration-200 w-full">
          <AnnouncementsWidget />
        </div>
      </div>
    </main>
  )
}
