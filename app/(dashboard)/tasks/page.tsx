import { TasksView } from '@/modules/tasks'

export const metadata = {
  title: 'Задачи | eneca.work',
  description: 'Управление задачами: Канбан, График, Бюджеты',
}

export default function TasksPage() {
  return <TasksView />
}
