import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProjectsList, ProjectStructureView } from '@/modules/cache-test'

export const metadata = {
  title: 'Cache Test | eneca.work',
  description: 'Тестовая страница для проверки системы кеширования',
}

export default function CacheTestPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">
          Тест кеширования
        </h1>
        <p className="text-muted-foreground">
          Тестовая страница для проверки работы TanStack Query + Server Actions.
          Данные загружаются через Server Action и кешируются на клиенте.
        </p>
      </div>

      {/* Информация о кеше */}
      <div className="rounded-lg border bg-muted/50 p-4 text-sm">
        <h3 className="font-medium mb-2">Как это работает:</h3>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>Данные загружаются через Server Action (безопасно на сервере)</li>
          <li>TanStack Query кеширует результат на клиенте</li>
          <li>При повторном посещении данные берутся из кеша (instant)</li>
          <li>Фоновое обновление происходит если данные устарели (staleTime: 3 мин)</li>
          <li>DevTools в левом нижнем углу для отладки (только в dev)</li>
        </ul>
      </div>

      {/* Tabs для переключения между режимами */}
      <Tabs defaultValue="structure" className="w-full">
        <TabsList>
          <TabsTrigger value="structure">
            Структура проектов (v_cache_projects)
          </TabsTrigger>
          <TabsTrigger value="list">
            Список проектов (таблица)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="structure" className="mt-4">
          <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground mb-4">
            Данные загружаются из view <code className="bg-muted px-1 rounded">v_cache_projects</code>.
            Выберите проект слева для просмотра иерархии: Стадия → Объект → Раздел.
          </div>
          <ProjectStructureView />
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground mb-4">
            Данные загружаются напрямую из таблицы <code className="bg-muted px-1 rounded">projects</code> с JOIN.
            Наведите на карточку и нажмите карандаш для редактирования (optimistic update).
          </div>
          <ProjectsList />
        </TabsContent>
      </Tabs>
    </div>
  )
}
