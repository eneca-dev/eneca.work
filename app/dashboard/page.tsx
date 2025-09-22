'use client'

import { MyWorkWidget } from '@/modules/my-work'
import { useUserStore } from '@/stores/useUserStore'

export default function DashboardPage() {
  const profile = useUserStore((state) => state.profile)
  const firstName = profile?.firstName || 'Пользователь'

  return (
    <main className="w-full h-screen flex flex-col px-4 md:px-0 bg-white dark:bg-gray-800 animate-fade-in transition-colors duration-200">
      {/* Виджет "Моя работа" - на всю ширину */}
      <div className="w-full h-full">
        <MyWorkWidget />
      </div>
    </main>
  )
}
