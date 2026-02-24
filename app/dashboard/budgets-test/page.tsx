import { BudgetsTestView } from '@/modules/budgets'

export const metadata = {
  title: 'Budgets Test | eneca.work',
  description: 'Тестовая страница для проверки модуля бюджетов',
}

export default function BudgetsTestPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">
          Тест бюджетов
        </h1>
        <p className="text-muted-foreground">
          Тестовая страница для проверки работы модуля бюджетов.
          Данные загружаются из view v_cache_budgets_current и v_cache_section_budget_summary.
        </p>
      </div>

      {/* Информация */}
      <div className="rounded-lg border bg-muted/50 p-4 text-sm">
        <h3 className="font-medium mb-2">Функционал:</h3>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>Просмотр сводки бюджетов по разделам</li>
          <li>Создание новых бюджетов для разделов</li>
          <li>Изменение суммы бюджета (создаёт новую версию)</li>
          <li>Отображение прогресса расхода</li>
          <li>Теги бюджетов</li>
        </ul>
      </div>

      {/* Предупреждение */}
      <div className="rounded-lg border border-orange-500/50 bg-orange-500/10 p-4 text-sm">
        <h3 className="font-medium text-orange-600 mb-1">Тестовая страница</h3>
        <p className="text-muted-foreground">
          Эта страница создана для тестирования и будет удалена.
          Для работы требуется наличие RLS-политик и прав доступа к бюджетам.
        </p>
      </div>

      {/* Main content */}
      <BudgetsTestView />
    </div>
  )
}
