import { AnnouncementsWidget } from '@/modules/announcements'

export default function DashboardPage() {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white dark:bg-gray-800 shadow rounded-xl p-6 animate-fade-in transition-colors duration-200">
          <div className="flex items-center space-x-2 mb-4">
            <span className="h-5 w-5 text-primary">🏠</span>
            <h2 className="text-lg font-medium dark:text-gray-200">Панель управления</h2>
          </div>

          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Добро пожаловать в систему eneca.work! Вы успешно вошли в аккаунт.
          </p>
        </div>
        
        {/* Виджет объявлений */}
        <AnnouncementsWidget />
      </div>
    </main>
  )
}
