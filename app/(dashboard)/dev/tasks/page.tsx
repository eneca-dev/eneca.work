import { DevTasksPage } from '@/modules/dev-tasks'

export const metadata = {
  title: 'Development Tasks | eneca.work',
  description: 'Задачи разработки из module.meta.json файлов',
}

export default function DevTasksRoute() {
  return <DevTasksPage />
}
