import { WsTaskReportView } from '@/modules/ws-task-report'

export const metadata = {
  title: 'Отчёт по задачам | eneca.work',
  description: 'Трудозатраты, суммы и статусы задач из Worksection',
}

// Данные зависят от последней синхронизации — не кешируем страницу
export const dynamic = 'force-dynamic'

export default function WsTaskReportPage() {
  return (
    <main className="w-full h-screen flex flex-col">
      <WsTaskReportView />
    </main>
  )
}
