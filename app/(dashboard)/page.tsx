'use client'

import { MyWorkWidget } from '@/modules/my-work'
import { useUserStore } from '@/stores/useUserStore'

export default function DashboardPage() {
  const profile = useUserStore((state) => state.profile)
  const firstName = profile?.first_name || 'Пользователь'

  return (
    <main className="w-full h-screen flex flex-col bg-card animate-fade-in transition-colors duration-200">
      {/* Виджет "Моя работа" - на всю ширину */}
      <div className="w-full h-full">
        <MyWorkWidget />
      </div>
    </main>
  )
}
