'use client'

import {
  useCheckpointTypes,
  useCreateCheckpointType,
  useUpdateCheckpointType,
  useDeleteCheckpointType,
} from '@/modules/checkpoints/hooks/use-checkpoint-types'

export default function TestCheckpointTypesPage() {
  const { data: types, isLoading } = useCheckpointTypes()
  const createMutation = useCreateCheckpointType()
  const updateMutation = useUpdateCheckpointType()
  const deleteMutation = useDeleteCheckpointType()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Загрузка типов чекпоинтов...</div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">
        Тестирование Checkpoint Types Hooks
      </h1>

      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h2 className="text-xl font-semibold mb-2">
          Типов чекпоинтов: {types?.length || 0}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Этап 6: Cache Hooks для работы с типами чекпоинтов
        </p>
      </div>

      {/* Создание нового типа */}
      <div className="mb-6">
        <button
          onClick={() =>
            createMutation.mutate({
              type: 'test_' + Date.now(),
              name: 'Тестовый тип ' + new Date().toLocaleTimeString('ru-RU'),
              icon: 'star',
              color: '#3b82f6',
            })
          }
          disabled={createMutation.isPending}
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {createMutation.isPending ? 'Создание...' : '➕ Создать новый тип'}
        </button>

        {createMutation.isError && (
          <div className="mt-2 p-3 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded">
            Ошибка: {createMutation.error.message}
          </div>
        )}

        {createMutation.isSuccess && (
          <div className="mt-2 p-3 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded">
            ✅ Тип успешно создан!
          </div>
        )}
      </div>

      {/* Список типов */}
      <div className="space-y-3">
        <h2 className="text-xl font-semibold mb-3">Список типов:</h2>

        {types?.map((type) => (
          <div
            key={type.type_id}
            className="flex items-center gap-4 p-4 border dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            {/* Иконка и цвет */}
            <div
              className="w-10 h-10 flex items-center justify-center rounded-full text-xl"
              style={{ backgroundColor: type.color + '20', color: type.color }}
            >
              {type.icon || '📌'}
            </div>

            {/* Информация */}
            <div className="flex-1">
              <div className="font-semibold">{type.name}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Код: {type.type} | ID: {type.type_id?.slice(0, 8)}...
              </div>
            </div>

            {/* Badge */}
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                type.is_custom
                  ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400'
                  : 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
              }`}
            >
              {type.is_custom ? 'Кастомный' : 'Встроенный'}
            </span>

            {/* Кнопки действий */}
            <div className="flex gap-2">
              <button
                onClick={() =>
                  updateMutation.mutate({
                    typeId: type.type_id,
                    name: type.name + ' (обновлён)',
                    color: '#ef4444',
                  })
                }
                disabled={updateMutation.isPending}
                className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm font-medium disabled:opacity-50 transition-colors"
              >
                Редактировать
              </button>

              <button
                onClick={() => {
                  if (
                    confirm(
                      `Удалить тип "${type.name}"?\n\n(Если тип используется в чекпоинтах, удаление не произойдет)`
                    )
                  ) {
                    deleteMutation.mutate(type.type_id)
                  }
                }}
                disabled={deleteMutation.isPending}
                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm font-medium disabled:opacity-50 transition-colors"
              >
                Удалить
              </button>
            </div>
          </div>
        ))}

        {types?.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Нет типов чекпоинтов
          </div>
        )}
      </div>

      {/* Состояние мутаций */}
      {(updateMutation.isError || deleteMutation.isError) && (
        <div className="mt-6 p-4 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg">
          <strong>Ошибка операции:</strong>
          <div className="mt-1">
            {updateMutation.error?.message || deleteMutation.error?.message}
          </div>
        </div>
      )}

      {(updateMutation.isSuccess || deleteMutation.isSuccess) && (
        <div className="mt-6 p-4 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg">
          ✅ Операция выполнена успешно!
        </div>
      )}

      {/* Debug JSON */}
      <details className="mt-8">
        <summary className="cursor-pointer text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200">
          📋 Debug: Raw JSON данные
        </summary>
        <pre className="mt-2 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-auto text-xs">
          {JSON.stringify(types, null, 2)}
        </pre>
      </details>

      {/* Инструкции по тестированию */}
      <div className="mt-8 p-6 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
        <h3 className="font-semibold mb-3 text-amber-900 dark:text-amber-400">
          📝 Чек-лист для проверки:
        </h3>
        <ul className="space-y-2 text-sm text-amber-800 dark:text-amber-300">
          <li>✅ Загрузка списка типов (exam, task_transfer, milestone, custom)</li>
          <li>✅ Создание нового типа → список обновился автоматически</li>
          <li>✅ Редактирование типа → optimistic update → refetch</li>
          <li>✅ Удаление неиспользуемого типа → успех</li>
          <li>✅ Попытка удалить используемый тип → ошибка "Тип используется"</li>
          <li>✅ Попытка операций НЕ админом → ошибка "Недостаточно прав"</li>
          <li>
            ✅ TanStack Query Devtools: query key ['checkpoint-types', 'list'],
            staleTime = 3600000ms
          </li>
        </ul>
      </div>
    </div>
  )
}
