import { AIAnalyticsPage } from '@/modules/ai-dashboard'

export const metadata = {
  title: 'AI Dashboard | eneca.work',
  description: 'Аналитика данных с использованием искусственного интеллекта',
}

export const dynamic = 'force-dynamic'

export default function Page() {
  return <AIAnalyticsPage />
}
