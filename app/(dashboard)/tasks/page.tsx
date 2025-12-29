import { TasksView } from '@/modules/tasks'

export const metadata = {
  title: 'Задачи | eneca.work',
  description: 'Управление задачами: Канбан, График, Бюджеты',
}

// Страница должна рендериться динамически, так как
// диапазон дат графика зависит от текущего времени
export const dynamic = 'force-dynamic'

export default function TasksPage() {
  return <TasksView />
}
