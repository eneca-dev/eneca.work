# Модуль уведомлений (Notifications)

Модуль уведомлений предоставляет систему real-time уведомлений для пользователей приложения с поддержкой infinite scroll, фильтрации, optimistic updates и автоматической синхронизации через Supabase Realtime.

## Архитектура

**ВАЖНО:** После миграции на Cache Module (декабрь 2024), модуль уведомлений больше НЕ управляет данными напрямую. Все данные и Realtime синхронизация управляются централизованно через:
- **TanStack Query** - для кеширования и запросов данных
- **Cache Module Realtime** - для автоматической синхронизации с БД
- **Server Actions** - для безопасных операций с БД

Zustand store (`useNotificationsUiStore`) теперь содержит **ТОЛЬКО UI состояние** (panel open/close, hover tracking), без данных.

### Структура базы данных

Модуль работает с тремя основными таблицами:

1. **`entity_types`** - типы сущностей для категоризации уведомлений
   - `id` (uuid) - первичный ключ
   - `entity_name` (text) - название типа (например: `announcement`, `assignment`, `section_comment`)
   - `created_at` (timestamp)

2. **`notifications`** - глобальная таблица уведомлений
   - `id` (uuid) - первичный ключ
   - `entity_type_id` (uuid) - внешний ключ на `entity_types`
   - `payload` (jsonb) - данные уведомления (title, message, type, action и т.д.)
   - `rendered_text` (text) - готовый текст уведомления
   - `created_at` (timestamp)

3. **`user_notifications`** - связь уведомлений с пользователями
   - `id` (uuid) - первичный ключ
   - `notification_id` (uuid) - внешний ключ на `notifications`
   - `user_id` (uuid) - внешний ключ на `profiles`
   - `is_read` (boolean) - прочитано ли уведомление
   - `is_archived` (boolean) - архивировано ли уведомление
   - `created_at` (timestamp)
   - `updated_at` (timestamp)

### Структура модуля

```
modules/notifications/
├── actions/                 # Server Actions (Next.js App Router)
│   ├── queries.ts          # Запросы (getNotificationsPaginated, getUnreadCount, getNotificationTypeCounts)
│   ├── mutations.ts        # Мутации (markAsRead, archiveNotification, markAllAsRead)
│   ├── types.ts            # TypeScript типы для actions
│   └── validate-user.ts    # Валидация пользователя с Sentry
├── components/             # React компоненты
│   ├── NotificationBell.tsx      # Иконка колокольчика с badge
│   ├── NotificationItem.tsx      # Элемент списка уведомлений
│   ├── NotificationsPanel.tsx    # Панель с уведомлениями (infinite scroll)
│   └── NotificationsProvider.tsx # Провайдер для module update callbacks
├── hooks/                  # React hooks
│   └── use-notifications.ts      # TanStack Query хуки (useNotificationsInfinite, useUnreadCount, mutations)
├── utils/                  # Утилиты
│   └── transform.ts        # Трансформация данных из БД в UI-формат
└── index.ts                # Публичный API модуля

stores/
└── useNotificationsUiStore.ts   # UI-only store (panel state, hover tracking)
```

**Удалённые файлы** (после миграции):
- ~~`modules/notifications/api/notifications.ts`~~ - функции чтения удалены (заменены Server Actions)
- ~~`stores/useNotificationsStore.ts`~~ - старый store с данными удалён (заменён UI-only store)

## Основные компоненты

### NotificationsProvider

**Путь:** [modules/notifications/components/NotificationsProvider.tsx](components/NotificationsProvider.tsx)

**Упрощённый провайдер** (после миграции на Cache Module). Больше НЕ управляет данными или Realtime подписками.

**Что делает:**
- Регистрирует колбэк `onModuleUpdate` для обновления других модулей при клике на уведомление
- Все остальное (данные, Realtime, авторизация) управляется автоматически через Cache Module

**Использование:**
```tsx
// app/dashboard/layout.tsx
import { NotificationsProvider } from '@/modules/notifications'

export default function DashboardLayout({ children }) {
  return (
    <NotificationsProvider>
      {children}
    </NotificationsProvider>
  )
}
```

**Что удалено** (после миграции):
- ~~Инициализация Realtime~~ → автоматическая через `modules/cache/realtime/config.ts`
- ~~Загрузка уведомлений~~ → через TanStack Query hooks
- ~~Управление `currentUserId`~~ → получается из `useUserStore`

### NotificationBell

**Путь:** [modules/notifications/components/NotificationBell.tsx](components/NotificationBell.tsx)

Компонент иконки колокольчика с badge, показывающий количество непрочитанных уведомлений.

**Зависимости:**
- Использует хук `useUnreadCount` для получения количества непрочитанных
- Автоматически обновляется через Realtime синхронизацию

**Использование:**
```tsx
import { NotificationBell } from '@/modules/notifications'

export function Header() {
  return (
    <header>
      <NotificationBell />
    </header>
  )
}
```

### NotificationsPanel

**Путь:** [modules/notifications/components/NotificationsPanel.tsx](components/NotificationsPanel.tsx)

Панель со списком уведомлений с поддержкой infinite scroll, фильтрации и поиска.

**Возможности:**
- ✅ Infinite scroll пагинация
- ✅ Фильтрация по типам (`announcement`, `assignment`, `section_comment`)
- ✅ Фильтрация по статусу (все / только непрочитанные / архивированные)
- ✅ Поиск по тексту уведомления
- ✅ Отметка как прочитано/непрочитано
- ✅ Архивирование/разархивирование
- ✅ Отметить все как прочитанные
- ✅ Realtime обновления

**Использование:**
```tsx
import { NotificationsPanel } from '@/modules/notifications'

export function NotificationsPage() {
  return <NotificationsPanel />
}
```

### NotificationItem

**Путь:** [modules/notifications/components/NotificationItem.tsx](components/NotificationItem.tsx)

Отдельный элемент списка уведомлений.

**Что отображает:**
- Заголовок уведомления
- Текст сообщения
- Дату создания (относительную, например "5 минут назад")
- Индикатор прочитанности
- Кнопки действий (отметить прочитано, архивировать)

## Hooks

### useNotificationsInfinite

Хук для получения уведомлений с infinite scroll.

**Параметры:**
```typescript
{
  userId: string
  filters?: {
    onlyUnread?: boolean       // Только непрочитанные
    includeArchived?: boolean  // Включая архивированные
    types?: string[]           // Фильтр по типам
  }
}
```

**Возвращает:**
```typescript
{
  data: InfiniteData<Notification[]>  // Страницы с уведомлениями
  fetchNextPage: () => void            // Загрузить следующую страницу
  hasNextPage: boolean                 // Есть ли ещё страницы
  isFetchingNextPage: boolean          // Идёт ли загрузка
  isLoading: boolean                   // Первоначальная загрузка
  error: Error | null                  // Ошибка если есть
}
```

**Пример использования:**
```typescript
const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useNotificationsInfinite({
  userId: 'user-123',
  filters: {
    types: ['announcement'],
    includeArchived: false,
  }
})

const notifications = useMemo(() => data?.pages.flat() ?? [], [data])
```

### useUnreadCount

Хук для получения количества непрочитанных уведомлений.

**Параметры:**
```typescript
userId: string
```

**Возвращает:**
```typescript
{
  data: number      // Количество непрочитанных
  isLoading: boolean
  error: Error | null
}
```

**Пример использования:**
```typescript
const { data: unreadCount = 0 } = useUnreadCount('user-123')

return <Badge>{unreadCount}</Badge>
```

### useNotificationTypeCounts

Хук для получения счётчиков уведомлений по типам (для фильтров).

**Параметры:**
```typescript
{
  userId: string
  options?: {
    includeArchived?: boolean
  }
}
```

**Возвращает:**
```typescript
{
  data: Record<string, number>  // { announcement: 5, assignment: 3, ... }
  isLoading: boolean
  error: Error | null
}
```

**Пример использования:**
```typescript
const { data: typeCounts = {} } = useNotificationTypeCounts({
  userId: 'user-123',
  options: { includeArchived: false }
})

console.log(typeCounts.announcement) // 5
```

### useMarkAsRead

Mutation хук для отметки уведомления как прочитанного.

**Возвращает:**
```typescript
{
  mutate: (input: { id: string }) => void
  isLoading: boolean
  error: Error | null
}
```

**Особенности:**
- ✅ Optimistic update - мгновенно обновляет UI
- ✅ Автоматический rollback при ошибке
- ✅ Realtime синхронизация после успешной мутации

**Пример использования:**
```typescript
const markAsReadMutation = useMarkAsRead()

const handleMarkAsRead = (notificationId: string) => {
  markAsReadMutation.mutate({ id: notificationId })
}
```

### useMarkAsUnread

Mutation хук для отметки уведомления как непрочитанного.

**Аналогичен `useMarkAsRead`**, но помечает как непрочитанное.

### useArchiveNotification

Mutation хук для архивирования/разархивирования уведомления.

**Возвращает:**
```typescript
{
  mutate: (input: {
    id: string
    isArchived: boolean
    notification?: Notification  // Опционально для разархивирования
  }) => void
  isLoading: boolean
  error: Error | null
}
```

**Пример использования:**
```typescript
const archiveMutation = useArchiveNotification()

// Архивировать
archiveMutation.mutate({ id: 'notif-123', isArchived: true })

// Разархивировать
archiveMutation.mutate({
  id: 'notif-123',
  isArchived: false,
  notification // Передаём объект для добавления обратно в список
})
```

### useMarkAllAsRead

Mutation хук для отметки всех уведомлений пользователя как прочитанных.

**Пример использования:**
```typescript
const markAllAsReadMutation = useMarkAllAsRead()

const handleMarkAllAsRead = () => {
  markAllAsReadMutation.mutate()
}
```

## Server Actions

### getNotificationsPaginated

**Путь:** [modules/notifications/actions/queries.ts](actions/queries.ts)

Server Action для получения уведомлений с пагинацией и фильтрами.

**Параметры:**
```typescript
{
  userId: string
  page: number
  limit?: number              // По умолчанию 20
  filters?: {
    onlyUnread?: boolean
    includeArchived?: boolean
    types?: string[]
  }
}
```

**Возвращает:**
```typescript
ActionResult<Notification[]>  // { success: boolean, data?: T, error?: string }
```

**Процесс работы:**
1. Проверяет фильтры
2. Если есть фильтр по типам - использует `getUserNotificationsByTypes`
3. Иначе - выполняет прямой запрос с `includeArchived`
4. Трансформирует данные через `transformNotificationData`
5. Возвращает массив уведомлений в UI-формате

### getUnreadCount

Server Action для получения количества непрочитанных уведомлений.

**Параметры:**
```typescript
userId: string
```

**Возвращает:**
```typescript
ActionResult<number>
```

### getNotificationTypeCounts

Server Action для получения счётчиков уведомлений по типам.

**Параметры:**
```typescript
{
  userId: string
  options?: {
    includeArchived?: boolean
  }
}
```

**Возвращает:**
```typescript
ActionResult<Record<string, number>>
```

### markAsRead / markAsUnread

Server Action для отметки уведомления как прочитанного/непрочитанного.

**Параметры:**
```typescript
{
  id: string  // ID из user_notifications
}
```

**Возвращает:**
```typescript
ActionResult<void>
```

**Процесс работы:**
1. Валидация авторизации через `validateUserWithSpan`
2. Проверка что пользователь может изменять только свои уведомления
3. Обновление поля `is_read` в БД
4. Sentry трейсинг для мониторинга

### archiveNotification

Server Action для архивирования/разархивирования уведомления.

**Параметры:**
```typescript
{
  id: string
  isArchived: boolean
}
```

**Возвращает:**
```typescript
ActionResult<void>
```

### markAllAsRead

Server Action для отметки всех уведомлений пользователя как прочитанных.

**Возвращает:**
```typescript
ActionResult<void>
```

**Процесс работы:**
1. Валидация авторизации
2. Массовое обновление всех `is_read = false` на `is_read = true` для текущего пользователя

## Отправка уведомлений

**ВАЖНО:** После миграции, модуль уведомлений больше НЕ предоставляет API функции для отправки. Отправка происходит напрямую через Supabase Edge Function.

### Как отправить уведомление

Используйте прямой `fetch` запрос к Edge Function (см. пример в `modules/announcements/hooks/useAnnouncements.ts`):

**Пример (из `modules/announcements/hooks/useAnnouncements.ts`):**

```typescript
const sendNotification = async (
  payload: {
    entityType: string
    payload: Record<string, unknown>
    userIds?: string[]
  },
  supabase: any
) => {
  try {
    // Получаем токен пользователя
    const { data: { session } } = await supabase.auth.getSession()

    // Прямой fetch запрос к Edge Function
    const response = await fetch(
      'https://gvrcbvifirhxxdnvrwlz.supabase.co/functions/v1/notifications',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      }
    )

    const result = await response.json()
    return result
  } catch (error) {
    console.error('Ошибка отправки уведомления:', error)
    throw error
  }
}

// Использование
await sendNotification({
  entityType: 'announcement',
  payload: {
    title: announcementData.header,
    body: announcementData.text || '',
    user_name: userName,
    announcement_id: data.id,
    action: {
      type: 'navigate',
      url: '/dashboard',
      data: { announcementId: data.id }
    }
  },
  userIds: userIds, // массив ID пользователей
}, supabase)
```

### Параметры Edge Function

**URL:** `https://gvrcbvifirhxxdnvrwlz.supabase.co/functions/v1/notifications`

**Метод:** `POST`

**Headers:**
- `Content-Type: application/json`
- `Authorization: Bearer {access_token}`

**Body:**
```typescript
{
  entityType: string  // Тип уведомления ('announcement', 'task', etc.)
  payload: {
    title: string           // Заголовок
    body?: string           // Текст сообщения
    user_name?: string      // Имя отправителя
    action?: {              // Действие при клике
      type: 'navigate'
      url: string
      data?: Record<string, any>
    }
    [key: string]: any      // Дополнительные поля
  }
  userIds?: string[]        // Конкретные пользователи
  filters?: {               // Или фильтры для групп
    departmentId?: string
    teamId?: string
    roleId?: string
    cityId?: string
    countryId?: string
  }
}
```

**Удалённые функции** (больше не доступны):
- ~~`sendNotification()`~~ → используйте прямой fetch
- ~~`sendNotificationToUsers()`~~ → используйте прямой fetch с `userIds`
- ~~`sendNotificationToDepartment()`~~ → используйте прямой fetch с `filters.departmentId`
- ~~`sendAssignmentNotification()`~~ → используйте прямой fetch с `entityType: 'assignment'`

## Realtime синхронизация

Модуль автоматически синхронизируется с базой данных через Supabase Realtime.

**Настройка:** `modules/cache/realtime/config.ts`

**Таблица:** `user_notifications`

**События:**
- `INSERT` - новое уведомление
- `UPDATE` - обновление уведомления (прочитано/архивировано)
- `DELETE` - удаление уведомления

**Что происходит при изменении:**
1. Realtime получает событие от Supabase
2. Cache модуль инвалидирует все связанные query keys:
   - `queryKeys.notifications.lists()` - списки уведомлений
   - `queryKeys.notifications.unreadCount(userId)` - счётчик непрочитанных
   - `queryKeys.notifications.typeCounts(...)` - счётчики по типам
3. TanStack Query автоматически перезапрашивает данные
4. UI обновляется без перезагрузки страницы

**Дополнительно:**
При получении нового уведомления вызывается колбэк `updateModuleByEntityType`, который обновляет соответствующие модули приложения (например, модуль объявлений при получении `announcement`).

## Optimistic Updates

Все mutation хуки используют optimistic updates для мгновенного отклика UI:

### Процесс optimistic update

1. **onMutate** (до отправки запроса):
   - Отменяем все активные refetch для уведомлений
   - Сохраняем текущее состояние кеша для rollback
   - Обновляем кеш оптимистично (например, помечаем уведомление прочитанным)
   - Обновляем счётчики (например, уменьшаем `unreadCount`)

2. **Мутация выполняется:**
   - Server Action отправляет запрос к БД
   - БД обновляется

3. **onError** (если ошибка):
   - Восстанавливаем сохранённое состояние кеша
   - Очищаем Map для предотвращения memory leak

4. **onSuccess** (если успех):
   - Очищаем сохранённые данные
   - Realtime синхронизация автоматически инвалидирует кеш для актуализации

5. **Realtime событие:**
   - Supabase отправляет событие об изменении
   - Cache модуль инвалидирует все связанные queries
   - TanStack Query перезапрашивает данные
   - UI получает актуальные данные с сервера

### Оптимизация производительности

**Проблема 7 (решена):** Потенциальная утечка памяти с `previousData Map`

**Решение:**
- Используем `Map.clear()` в `onError` и `onSuccess`
- Сохраняем только необходимые данные (`infiniteQueries` и `unreadCount`)
- Не сохраняем `typeCounts` (можно пересчитать из `infiniteQueries`)

**Early Exit оптимизация:**

Функция `updateInfiniteQueriesWithEarlyExit` прекращает обработку страниц после того, как найдёт целевое уведомление:

```typescript
updateInfiniteQueriesWithEarlyExit(
  queryClient,
  queryKeys.notifications.lists(),
  (page) => {
    const notification = page.find((n) => n.id === targetId)
    if (!notification) return { page, found: false }

    const newPage = page.map((n) =>
      n.id === targetId ? { ...n, isRead: true } : n
    )
    return { page: newPage, found: true }  // Early exit
  }
)
```

Это значительно ускоряет обработку когда уведомление находится на первых страницах.

## Трансформация данных

**Файл:** [modules/notifications/utils/transform.ts](utils/transform.ts)

Функция `transformNotificationData` преобразует данные из БД в UI-формат.

**Вход (БД формат):**
```typescript
{
  id: string                    // user_notifications.id
  notification_id: string       // user_notifications.notification_id
  is_read: boolean
  is_archived: boolean
  created_at: string
  notifications: {              // JOIN
    id: string
    payload: {
      title?: string
      message?: string
      type?: string
      assignment?: {...}
      announcement?: {...}
    }
    entity_types: {
      entity_name: string       // 'announcement', 'assignment', etc.
    }
  }
}
```

**Выход (UI формат):**
```typescript
{
  id: string                    // user_notifications.id
  notificationId: string        // notifications.id
  title: string                 // Сгенерированный заголовок
  message: string               // Сгенерированное сообщение
  createdAt: Date
  isRead: boolean
  isArchived: boolean
  type: 'info' | 'warning' | 'error' | 'success'
  payload: Record<string, any>
  entityType: string
}
```

**Логика генерации текста:**

- **`assignment`**: Использует `generateAssignmentNotificationText()`
  ```
  Заголовок: "Передача заданий: {project}"
  Сообщение: "Вам передано {amount} заданий из раздела {from_section} в проекте {project}"
  ```

- **`announcement`**: Использует `generateAnnouncementNotificationText()`
  ```
  Заголовок: "Объявление: {title}"
  Сообщение: "{user_name}: {body}"
  ```

- **`section_comment`**: Генерируется локально
  ```
  Заголовок: "Комментарий к разделу "{section_name}""
  Сообщение: "{author_name}: "{comment_preview}""
  ```

- **Другие типы**: Используют `payload.title` и `payload.message`

## Интеграция с Cache модулем

Модуль уведомлений полностью интегрирован с централизованной системой кеширования.

**Query Keys:** `modules/cache/keys/query-keys.ts`

```typescript
queryKeys.notifications = {
  all: ['notifications'],
  lists: () => [...queryKeys.notifications.all, 'list'],
  list: (filters) => [...queryKeys.notifications.lists(), { filters }],
  infinite: (userId, filters) => [...queryKeys.notifications.lists(), userId, { filters }],
  unreadCount: (userId) => [...queryKeys.notifications.all, 'unread-count', userId],
  typeCounts: (userId, options) => [...queryKeys.notifications.all, 'type-counts', userId, options],
}
```

**Realtime конфигурация:** `modules/cache/realtime/config.ts`

```typescript
{
  table: 'user_notifications',
  queryKeys: (payload) => [
    queryKeys.notifications.all,
  ],
  getUserId: (payload) => payload.new?.user_id || payload.old?.user_id,
}
```

**Stale time:** `modules/cache/stale-time.ts`

```typescript
staleTimePresets.none  // Всегда свежие данные (для realtime)
```

## Sentry интеграция

Все критические операции модуля обернуты в Sentry spans для мониторинга производительности и ошибок.

**Примеры:**

```typescript
// API функция
Sentry.startSpan({
  op: "notifications.send_notification",
  name: "Send Notification",
}, async (span) => {
  span.setAttribute("notification.entity_type", entityType)
  span.setAttribute("notification.user_count", userIds.length)
  // ...
})

// Server Action
Sentry.startSpan({
  op: "notifications.mark_as_read_action",
  name: "Mark Notification As Read (Action)",
}, async (span) => {
  span.setAttribute("user_notification.id", id)
  // ...
})

// Provider
Sentry.startSpan({
  op: "notifications.update_module",
  name: "Update Module By Entity Type",
}, async (span) => {
  span.setAttribute("entity.type", entityType)
  span.setAttribute("module.name", moduleName)
  // ...
})
```

## Типы уведомлений

### Встроенные типы

1. **`announcement`** - Объявления
   - Payload: `{ user_name, title, body }`
   - Используется модулем объявлений

2. **`assignment`** - Передача заданий
   - Payload: `{ project, from_section, amount }`
   - Используется модулем планирования

3. **`section_comment`** - Комментарии к разделам
   - Payload: `{ section_name, author_name, comment_preview }`
   - Используется модулем планирования

4. **`test`** - Тестовые уведомления
   - Для отладки системы

### Добавление нового типа

1. Добавить запись в таблицу `entity_types`:
   ```sql
   INSERT INTO entity_types (entity_name) VALUES ('my_new_type');
   ```

2. Добавить обработку в `transformNotificationData`:
   ```typescript
   else if (entityType === 'my_new_type') {
     title = payload.title || 'Заголовок по умолчанию'
     message = payload.message || 'Сообщение по умолчанию'
   }
   ```

3. (Опционально) Создать удобную функцию отправки:
   ```typescript
   export async function sendMyNewTypeNotification(
     data: MyNewTypeData,
     userIds: string[]
   ): Promise<CreateNotificationResponse> {
     return sendNotification({
       entityType: 'my_new_type',
       payload: {
         title: data.title,
         message: data.message,
         type: 'info',
       },
       userIds,
     })
   }
   ```

4. (Опционально) Добавить обработку в `NotificationsProvider.updateModuleByEntityType`:
   ```typescript
   case 'my_new_type':
     console.log('Обновляем мой модуль')
     await fetchMyModuleData()
     break
   ```

## Примеры использования

### Базовое использование

```tsx
'use client'

import {
  NotificationBell,
  NotificationsPanel,
  useNotificationsInfinite,
  useUnreadCount
} from '@/modules/notifications'

export function MyPage() {
  const userId = 'user-123'

  // Получение счётчика
  const { data: unreadCount = 0 } = useUnreadCount(userId)

  // Получение уведомлений с infinite scroll
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useNotificationsInfinite({
    userId,
    filters: {
      onlyUnread: false,
      includeArchived: false,
    }
  })

  const notifications = useMemo(() => data?.pages.flat() ?? [], [data])

  return (
    <div>
      <h1>Уведомления ({unreadCount})</h1>

      {/* Вариант 1: Готовая панель */}
      <NotificationsPanel />

      {/* Вариант 2: Свой список */}
      <div>
        {notifications.map((notification) => (
          <div key={notification.id}>
            <h3>{notification.title}</h3>
            <p>{notification.message}</p>
          </div>
        ))}

        {hasNextPage && (
          <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? 'Загрузка...' : 'Загрузить ещё'}
          </button>
        )}
      </div>
    </div>
  )
}
```

### Отправка уведомлений

```typescript
import {
  sendNotificationToUsers,
  sendNotificationToTeam,
  sendAssignmentNotification,
  sendAnnouncementNotification
} from '@/modules/notifications'

// Отправить конкретным пользователям
await sendNotificationToUsers(
  'task_assigned',
  {
    title: 'Новая задача',
    message: 'Вам назначена задача "Разработка API"',
    type: 'info',
    action: {
      type: 'navigate',
      url: '/dashboard/tasks'
    }
  },
  ['user-1', 'user-2']
)

// Отправить команде
await sendNotificationToTeam(
  'announcement',
  {
    title: 'Совещание',
    message: 'Завтра в 10:00 общее совещание',
    type: 'warning'
  },
  'team-123'
)

// Отправить типизированное уведомление о передаче заданий
await sendAssignmentNotification({
  project: 'Проект X',
  from_section: 'Раздел 1',
  amount: 5,
  userIds: ['user-1', 'user-2']
})

// Отправить объявление всему отделу
await sendAnnouncementNotification({
  user_name: 'Иван Иванов',
  title: 'Важное объявление',
  body: 'Текст объявления',
  filters: { departmentId: 'dept-1' }
})
```

### Мутации с optimistic updates

```tsx
'use client'

import { useMarkAsRead, useArchiveNotification } from '@/modules/notifications'

export function NotificationActions({ notification }) {
  const markAsReadMutation = useMarkAsRead()
  const archiveMutation = useArchiveNotification()

  const handleMarkAsRead = () => {
    markAsReadMutation.mutate({ id: notification.id })
  }

  const handleArchive = () => {
    archiveMutation.mutate({
      id: notification.id,
      isArchived: true
    })
  }

  return (
    <div>
      <button
        onClick={handleMarkAsRead}
        disabled={markAsReadMutation.isLoading}
      >
        {notification.isRead ? 'Отметить непрочитанным' : 'Отметить прочитанным'}
      </button>

      <button
        onClick={handleArchive}
        disabled={archiveMutation.isLoading}
      >
        Архивировать
      </button>
    </div>
  )
}
```

## Диагностика и отладка

### Debug режим

Включить логирование:
```bash
# .env.local
DEBUG_NOTIFICATIONS=true
```

Это включит детальное логирование в консоль браузера:
- 🔍 Запросы к БД с параметрами
- 🔄 Трансформация уведомлений
- 📡 Realtime события
- 👤 Авторизация пользователя

### Тестовое уведомление

```typescript
import { createTestNotification } from '@/modules/notifications/api/notifications'

// Создать тестовое уведомление для пользователя
await createTestNotification('user-123')
```

### Проверка БД

```typescript
import { debugUserNotifications } from '@/modules/notifications/api/notifications'

// Вывести в консоль всю структуру уведомлений пользователя
await debugUserNotifications('user-123')
```

Это выведет:
- Записи в `user_notifications`
- Записи в `notifications`
- Записи в `entity_types`
- JOIN запросы с полной структурой

## Производительность

### Оптимизации

1. **Early exit в optimistic updates** - прекращаем обработку страниц после нахождения цели
2. **Минимальный previousData** - сохраняем только необходимые данные для rollback
3. **Memory leak prevention** - очищаем Map после мутаций
4. **Stale time = none** - данные всегда актуальны благодаря Realtime
5. **Избирательная инвалидация** - инвалидируем только затронутые queries
6. **Пагинация 20 элементов** - баланс между производительностью и UX

### Query Keys иерархия

```
notifications.all = ['notifications']
  ├─ notifications.lists() = ['notifications', 'list']
  │   ├─ notifications.list(filters) = ['notifications', 'list', { filters }]
  │   └─ notifications.infinite(userId, filters) = ['notifications', 'list', userId, { filters }]
  ├─ notifications.unreadCount(userId) = ['notifications', 'unread-count', userId]
  └─ notifications.typeCounts(userId, options) = ['notifications', 'type-counts', userId, options]
```

Это позволяет инвалидировать:
- Все уведомления: `queryKeys.notifications.all`
- Все списки: `queryKeys.notifications.lists()`
- Конкретный список: `queryKeys.notifications.infinite(userId, filters)`

## Troubleshooting

### Уведомления не отображаются

1. Проверить что `NotificationsProvider` добавлен в layout
2. Проверить что пользователь авторизован
3. Проверить консоль браузера на ошибки
4. Включить `DEBUG_NOTIFICATIONS=true` и проверить логи
5. Запустить `debugUserNotifications(userId)` для проверки БД

### Realtime не работает

1. Проверить что Supabase Realtime включен в проекте
2. Проверить что таблица `user_notifications` имеет включенный Realtime
3. Проверить консоль браузера на ошибки подключения
4. Проверить `modules/cache/realtime/config.ts` на корректность настроек

### Optimistic update откатывается

Это нормальное поведение если:
- Сервер вернул ошибку (rollback)
- Нет интернета (rollback)
- После успешной мутации Realtime инвалидировал кеш (актуализация)

Если откат происходит всегда - проверить Server Action на ошибки.

### Счётчик непрочитанных не обновляется

1. Проверить что Realtime работает
2. Проверить что мутации используют правильные hooks (`useMarkAsRead`, и т.д.)
3. Проверить что в optimistic update обновляется `unreadCount`

## История миграции

### Миграция на Cache Module (декабрь 2024)

**Цель:** Унификация работы с данными, удаление дублирования, упрощение архитектуры.

**Что изменилось:**

**Удалено (~2494 строки кода, -98%!):**
- `stores/useNotificationsStore.ts` (988 строк) - старый store с данными и Realtime
- `modules/notifications/api/notifications.ts` (1506 строк) - функции чтения данных

**Добавлено (~67 строк):**
- `stores/useNotificationsUiStore.ts` - минимальный UI-only store

**Архитектура до миграции:**
```
Zustand Store (988 строк)
  ├─ Данные: notifications[], unreadCount
  ├─ Realtime: самописная подписка
  ├─ Пагинация: currentPage, hasMore
  └─ API: прямые вызовы к Supabase

API файл (1506 строк)
  ├─ getUserNotifications()
  ├─ getUnreadCount()
  └─ sendNotification() (не использовалось!)
```

**Архитектура после миграции:**
```
TanStack Query (modules/cache)
  ├─ Кеширование данных
  ├─ Infinite scroll
  └─ Optimistic updates

Cache Module Realtime
  ├─ Автоматическая подписка
  └─ Инвалидация кеша

Server Actions (actions/)
  ├─ getNotificationsPaginated()
  ├─ getUnreadCount()
  ├─ markAsRead()
  └─ archiveNotification()

Zustand UI Store (67 строк)
  ├─ isPanelOpen
  ├─ panelWidthPx
  └─ hoveredNotificationId
```

**Преимущества:**
- ✅ Автоматическая Realtime синхронизация (0 строк кода)
- ✅ Optimistic updates с rollback из коробки
- ✅ Типобезопасность end-to-end
- ✅ Консистентные паттерны с другими модулями
- ✅ -98% кода (-2427 строк!)

## Связанные модули

- **`modules/cache`** - Система кеширования и Realtime (ОСНОВА)
- **`modules/announcements`** - Модуль объявлений (отправляет уведомления)
- **`modules/planning`** - Модуль планирования (отправляет уведомления о заданиях)
- **`stores/useNotificationsUiStore`** - UI-only Zustand store
- **`stores/useUserStore`** - Информация о текущем пользователе

## Дальнейшее развитие

Возможные улучшения:

1. **Push уведомления** - отправка браузерных уведомлений через Web Push API
2. **Email уведомления** - отправка на почту через Supabase Edge Functions
3. **Группировка** - объединение похожих уведомлений ("Вам передано 5 заданий" вместо 5 отдельных)
4. **Приоритеты** - срочные/обычные/низкоприоритетные
5. **Настройки пользователя** - отключение определённых типов уведомлений
6. **Звуковые оповещения** - проигрывание звука при новом уведомлении
7. **Markdown в тексте** - поддержка форматирования в сообщениях

## Лицензия

Частная разработка для ENECA Work.
