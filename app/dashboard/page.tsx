'use client'

import { useUserStore } from '@/stores/useUserStore'

export default function DashboardPage() {
  const profile = useUserStore((state) => state.profile)
  const firstName = profile?.firstName || 'Пользователь'

}
