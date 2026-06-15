import { Suspense } from 'react'
import { TasksView } from '@/modules/tasks'

export const metadata = {
  title: 'Задачи | eneca.work',
  description: 'Управление задачами: Канбан, График, Бюджеты',
}

// Страница должна рендериться динамически, так как
// диапазон дат графика зависит от текущего времени
export const dynamic = 'force-dynamic'

export default function TasksPage() {
  // TasksView/TasksTabs читают useSearchParams() — оборачиваем в Suspense,
  // чтобы избежать CSR-bailout всего поддерева (Next.js App Router).
  return (
    <Suspense>
      <TasksView />
    </Suspense>
  )
}
