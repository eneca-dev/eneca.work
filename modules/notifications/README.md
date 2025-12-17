# Модуль уведомлений (Notifications Module)

Централизованная система real-time уведомлений с поддержкой infinite scroll, фильтрации, optimistic updates и автоматической синхронизации через Supabase Realtime.

**Версия:** 2.0 (после миграции на Cache Module, декабрь 2024)

---

## Содержание

- [Обзор](#обзор)
- [Архитектура](#архитектура)
- [Структура файлов](#структура-файлов)
- [База данных](#база-данных)
- [Компоненты](#компоненты)
- [Hooks](#hooks)
- [Server Actions](#server-actions)
- [Отправка уведомлений](#отправка-уведомлений)
- [Realtime синхронизация](#realtime-синхронизация)
- [Optimistic Updates](#optimistic-updates)
- [Типы уведомлений](#типы-уведомлений)
- [Интеграция с другими модулями](#интеграция-с-другими-модулями)
- [Примеры использования](#примеры-использования)
- [Производительность](#производительность)
- [Отладка](#отладка)
- [Известные проблемы](#известные-проблемы)

---

## Обзор

Модуль уведомлений предоставляет полнофункциональную систему уведомлений для приложения ENECA Work:

✅ Real-time обновления через Supabase Realtime
✅ Infinite scroll пагинация (20 элементов на страницу)
✅ Фильтрация по типам (announcement, assignment, section_comment)
✅ Фильтрация по статусу (все / только непрочитанные / архивированные)
✅ Optimistic updates с автоматическим rollback при ошибках
✅ Отметка как прочитано/непрочитано
✅ Архивирование/разархивирование
✅ Массовая отметка всех как прочитанных
✅ Счётчик непрочитанных с badge на иконке
✅ Интеграция с модулями объявлений, планирования, комментариев

**Результаты рефакторинга (декабрь 2024):**
- **-98% кода** (-2,427 строк)
- Удалены дублирующие API функции и Zustand store с данными
- Вся работа с данными через TanStack Query + Server Actions
- UI store содержит только состояние интерфейса (открытие панели, hover состояния)

---

## Архитектура

### Слои модуля

```
┌─────────────────────────────────────────────────────────────┐
│                      UI Components                          │
│  NotificationBell  │  NotificationsPanel  │  NotificationItem│
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     React Hooks                             │
│  useNotificationsInfinite  │  useUnreadCount  │  mutations  │
│           (TanStack Query + Optimistic Updates)             │
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Server Actions                           │
│  getNotificationsPaginated  │  markAsRead  │  archive       │
│              (Validated server-side queries)                │
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Supabase Database                         │
│  user_notifications  │  notifications  │  entity_types      │
└─────────────────────────────────────────────────────────────┘
                              ▲
                    Realtime Subscriptions
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Cache Module                             │
│  Automatic invalidation  │  Refetch on changes              │
└─────────────────────────────────────────────────────────────┘
```

### Принципы архитектуры

1. **Server-First:** Все данные запрашиваются через Server Actions (валидация на сервере)
2. **Type-Safe:** End-to-end типизация от БД до UI
3. **Optimistic UI:** Мгновенный отклик без ожидания сервера
4. **Realtime Sync:** Автоматическая синхронизация через Supabase Realtime
5. **Cache-Driven:** Единый источник правды в TanStack Query кеше
6. **Memory-Safe:** Явная очистка временных данных для предотвращения утечек

---

## Структура файлов

```
modules/notifications/
├── actions/                      # Server Actions (Next.js)
│   ├── queries.ts               # Запросы данных (getNotificationsPaginated, getUnreadCount, getNotificationTypeCounts)
│   ├── mutations.ts             # Изменение данных (markAsRead, archiveNotification, markAllAsRead)
│   ├── validate-user.ts         # Валидация авторизации
│   └── types.ts                 # TypeScript типы для actions
│
├── components/                   # React компоненты
│   ├── NotificationsProvider.tsx   # Провайдер (регистрирует колбэки для модулей)
│   ├── NotificationBell.tsx        # Иконка колокольчика с badge
│   ├── NotificationsPanel.tsx      # Панель с уведомлениями (infinite scroll, фильтры)
│   └── NotificationItem.tsx        # Элемент списка (карточка уведомления)
│
├── hooks/                        # React hooks
│   └── use-notifications.ts     # TanStack Query хуки (queries + mutations с optimistic updates)
│
├── utils/                        # Утилиты
│   └── transform.ts             # Трансформация данных DB → UI
│
└── index.ts                      # Публичный API модуля

stores/
└── useNotificationsUiStore.ts   # Zustand UI-only store (panel state, hover tracking)
```

**Удалённые файлы** (после миграции):
- ~~`modules/notifications/api/notifications.ts`~~ (1,506 строк) → заменено Server Actions
- ~~`stores/useNotificationsStore.ts`~~ (988 строк) → заменено TanStack Query + UI-only store

---

## База данных

### Таблицы

**1. `entity_types`** - типы сущностей для категоризации

| Поле         | Тип       | Описание                              |
|--------------|-----------|---------------------------------------|
| `id`         | uuid      | Первичный ключ                        |
| `entity_name`| text      | Название типа (announcement, assignment, etc.) |
| `created_at` | timestamp | Дата создания                         |

**2. `notifications`** - глобальная таблица уведомлений

| Поле            | Тип       | Описание                           |
|-----------------|-----------|-------------------------------------|
| `id`            | uuid      | Первичный ключ                      |
| `entity_type_id`| uuid      | FK → entity_types.id                |
| `payload`       | jsonb     | Данные уведомления (title, message, type, action, etc.) |
| `rendered_text` | text      | Готовый текст уведомления           |
| `created_at`    | timestamp | Дата создания                       |

**3. `user_notifications`** - связь уведомлений с пользователями

| Поле              | Тип       | Описание                         |
|-------------------|-----------|-----------------------------------|
| `id`              | uuid      | Первичный ключ                    |
| `notification_id` | uuid      | FK → notifications.id             |
| `user_id`         | uuid      | FK → profiles.id                  |
| `is_read`         | boolean   | Прочитано ли                      |
| `is_archived`     | boolean   | Архивировано ли                   |
| `created_at`      | timestamp | Дата создания                     |
| `updated_at`      | timestamp | Дата обновления                   |

### RPC Functions

**`get_user_notifications_filtered(p_user_id, p_page, p_limit, p_only_unread, p_include_archived, p_types)`**

Возвращает плоскую структуру уведомлений с префиксами для JOIN данных:
- `un_*` - поля из user_notifications
- `n_*` - поля из notifications
- `et_*` - поля из entity_types

Используется в `getNotificationsPaginated()` для эффективной фильтрации по типам.

---

## Компоненты

### NotificationsProvider

**Файл:** [components/NotificationsProvider.tsx](components/NotificationsProvider.tsx)

Упрощённый провайдер после миграции на Cache Module. Регистрирует колбэк `onModuleUpdate` для обновления других модулей при клике на уведомление.

**Что делает:**
- Регистрирует функцию обновления модулей в UI store
- Обрабатывает клики на уведомления по `entityType`:
  - `announcement` → обновляет модуль объявлений
  - `section_comment` → подсвечивает секцию в проектах
  - Другие типы → логирует, но пока не обрабатывает
- Интегрируется с Sentry для мониторинга

**Что НЕ делает** (управляется автоматически):
- ~~Загрузка уведомлений~~ → TanStack Query
- ~~Realtime подписки~~ → Cache Module
- ~~Управление авторизацией~~ → useUserStore

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

---

### NotificationBell

**Файл:** [components/NotificationBell.tsx](components/NotificationBell.tsx)

Иконка колокольчика с badge, показывающая количество непрочитанных уведомлений.

**Функции:**
- Отображает badge с числом непрочитанных (макс. 99+)
- Пульсирует анимацией при наличии непрочитанных
- Меняет цвет на красный при непрочитанных
- Открывает/закрывает панель уведомлений
- Предотвращает hydration mismatch (клиентский mount check)

**Интеграция:**
- Использует `useUnreadCount()` для счётчика
- Использует `useNotificationsUiStore` для управления панелью
- Интегрирован с Sentry для кликов и ошибок

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

---

### NotificationsPanel

**Файл:** [components/NotificationsPanel.tsx](components/NotificationsPanel.tsx)

Главная панель с уведомлениями. Сложный компонент с множеством функций.

**Возможности:**

**Фильтрация:**
- По типам (announcement, assignment, section_comment) через Popover
- По статусу: Все / Только непрочитанные / Архивированные
- Счётчики по типам загружаются динамически при открытии фильтра

**Infinite Scroll:**
- Загрузка по 20 элементов за раз
- Индикатор загрузки в конце списка
- Автоматическая загрузка при скролле вниз
- Отслеживание позиции скролла с пассивными слушателями

**Действия:**
- Кнопка "Обновить" для ручного рефетча
- Кнопка "Отметить все как прочитанные"
- Кнопка "Создать объявление" (для администраторов)
- Интеграция с модалом редактирования объявлений

**Оптимизации производительности:**
- Дедупликация уведомлений (предотвращает дубли после Realtime обновлений)
- Мемоизация списка и фильтрованных результатов
- Throttled отслеживание позиции курсора (60fps) для восстановления hover состояния
- Раздельные панели для архивированных и неархивированных уведомлений

**Обработка событий:**
- Закрытие на Escape
- Закрытие на клик вне панели (кроме bell icon, theme toggle, modals)
- Отслеживание hover для сохранения состояния при remount

**Использование:**
```tsx
import { NotificationsPanel } from '@/modules/notifications'

export function NotificationsPage() {
  return <NotificationsPanel />
}
```

---

### NotificationItem

**Файл:** [components/NotificationItem.tsx](components/NotificationItem.tsx)

Карточка отдельного уведомления.

**Отображает:**
- Заголовок уведомления
- Текст сообщения (с поддержкой форматирования)
- Badge типа (announcement/assignment/comment)
- Индикатор прочитанности (синяя точка)
- Относительная дата ("5 минут назад") или абсолютная (если >24ч)
- Имя автора (для объявлений)
- Название секции-источника (для заданий)

**Интерактивные элементы:**
- Кнопка "Отметить прочитано/непрочитано"
- Кнопка "Редактировать" (для объявлений, если есть права)
- Кнопка "Архивировать/разархивировать"
- Раскрытие длинного текста ("Показать больше" / "Показать меньше")

**Продвинутые функции:**
- Автоопределение длинного текста (>2 строки или >160 символов)
- Безопасное форматирование HTML с экранированием
- Поддержка markdown-подобного форматирования (bold, italic, underline, line breaks)
- Восстановление hover состояния через отслеживание позиции курсора
- Обработчики hover, которые переживают remount

**Навигация при клике:**
- `assignment` → переход к ресурсу планирования
- `section_comment` → подсветка секции и переход в проекты
- `announcement` → раскрытие текста (без перехода)

**Известная проблема:** Нет toast уведомлений при ошибках мутаций (Problem 15)

---

## Hooks

### useNotificationsInfinite

**Файл:** [hooks/use-notifications.ts](hooks/use-notifications.ts)

Хук для получения уведомлений с infinite scroll.

**Параметры:**
```typescript
{
  userId: string
  filters?: {
    onlyUnread?: boolean       // Только непрочитанные
    includeArchived?: boolean  // Включая архивированные
    types?: string[]           // Фильтр по типам ['announcement', 'assignment']
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

**Пример:**
```typescript
const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
  useNotificationsInfinite({
    userId: 'user-123',
    filters: {
      types: ['announcement'],
      includeArchived: false,
    }
  })

const notifications = useMemo(() => data?.pages.flat() ?? [], [data])
```

**Особенности:**
- Создан через `createInfiniteCacheQuery` фабрику
- `staleTime: staleTimePresets.none` (всегда свежие данные для Realtime)
- Пагинация: 20 элементов на страницу
- Автоматическая инвалидация через Realtime

---

### useUnreadCount

**Файл:** [hooks/use-notifications.ts](hooks/use-notifications.ts)

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

**Пример:**
```typescript
const { data: unreadCount = 0 } = useUnreadCount('user-123')

return <Badge>{unreadCount}</Badge>
```

---

### useNotificationTypeCounts

**Файл:** [hooks/use-notifications.ts](hooks/use-notifications.ts)

Хук для получения счётчиков уведомлений по типам (для UI фильтров).

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
  data: Record<string, number>  // { announcement: 5, assignment: 3 }
  isLoading: boolean
  error: Error | null
}
```

**Пример:**
```typescript
const { data: typeCounts = {} } = useNotificationTypeCounts({
  userId: 'user-123',
  options: { includeArchived: false }
})

console.log(typeCounts.announcement) // 5
```

---

### useMarkAsRead / useMarkAsUnread

**Файл:** [hooks/use-notifications.ts](hooks/use-notifications.ts)

Mutation хуки для отметки уведомления как прочитанного/непрочитанного.

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
- ✅ Early exit оптимизация - прекращает обработку страниц после нахождения элемента
- ✅ Автоматический rollback при ошибке
- ✅ Обновление счётчика `unreadCount`
- ✅ Очистка Map для предотвращения утечек памяти
- ⚠️ **Известная проблема:** Возможная race condition между чтением isRead и удалением (Problem 13)

**Пример:**
```typescript
const markAsReadMutation = useMarkAsRead()

const handleMarkAsRead = (notificationId: string) => {
  markAsReadMutation.mutate({ id: notificationId })
}
```

---

### useArchiveNotification

**Файл:** [hooks/use-notifications.ts](hooks/use-notifications.ts)

Mutation хук для архивирования/разархивирования уведомления.

**Возвращает:**
```typescript
{
  mutate: (input: {
    id: string
    isArchived: boolean
    notification?: Notification  // Для разархивирования
  }) => void
  isLoading: boolean
  error: Error | null
}
```

**Особенности:**
- Атомарная операция read + remove (для решения Problem 13)
- Разная логика для архивирования vs разархивирования
- При разархивировании: добавляет уведомление в начало списка
- Учитывает фильтр `includeArchived` для выбора queries

**Пример:**
```typescript
const archiveMutation = useArchiveNotification()

// Архивировать
archiveMutation.mutate({
  id: 'notif-123',
  isArchived: true
})

// Разархивировать
archiveMutation.mutate({
  id: 'notif-123',
  isArchived: false,
  notification // Передаём объект для добавления обратно
})
```

---

### useMarkAllAsRead

**Файл:** [hooks/use-notifications.ts](hooks/use-notifications.ts)

Mutation хук для массовой отметки всех уведомлений пользователя как прочитанных.

**Возвращает:**
```typescript
{
  mutate: () => void
  isLoading: boolean
  error: Error | null
}
```

**Особенности:**
- Создан через `createCacheMutation` фабрику
- Единая серверная операция (не множество отдельных мутаций)
- Инвалидирует весь `queryKeys.notifications.all`

**Пример:**
```typescript
const markAllAsReadMutation = useMarkAllAsRead()

const handleMarkAllAsRead = () => {
  markAllAsReadMutation.mutate()
}
```

---

## Server Actions

Все Server Actions находятся в `modules/notifications/actions/`.

### getNotificationsPaginated

**Файл:** [actions/queries.ts](actions/queries.ts)

Запрос уведомлений с пагинацией и фильтрами.

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
1. Проверяет наличие фильтра по типам
2. Если есть типы → использует RPC `get_user_notifications_filtered`
3. Иначе → прямой запрос с JOIN
4. Трансформирует через `transformNotificationData()`
5. Возвращает массив в UI-формате

---

### getUnreadCount

**Файл:** [actions/queries.ts](actions/queries.ts)

Запрос количества непрочитанных уведомлений.

**Параметры:**
```typescript
userId: string
```

**Возвращает:**
```typescript
ActionResult<number>
```

**Запрос:**
```sql
SELECT COUNT(*)
FROM user_notifications
WHERE user_id = ?
  AND is_read = false
  AND is_archived = false
```

---

### getNotificationTypeCounts

**Файл:** [actions/queries.ts](actions/queries.ts)

Запрос счётчиков уведомлений по типам для UI фильтров.

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

**Запрос:**
```sql
SELECT et.entity_name, COUNT(*)
FROM user_notifications un
JOIN notifications n ON n.id = un.notification_id
JOIN entity_types et ON et.id = n.entity_type_id
WHERE un.user_id = ?
  AND (includeArchived OR un.is_archived = false)
GROUP BY et.entity_name
```

---

### markAsRead / markAsUnread

**Файл:** [actions/mutations.ts](actions/mutations.ts)

Отметка уведомления как прочитанного/непрочитанного.

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
4. Sentry span атрибуты для мониторинга

---

### archiveNotification

**Файл:** [actions/mutations.ts](actions/mutations.ts)

Архивирование/разархивирование уведомления.

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

---

### markAllAsRead

**Файл:** [actions/mutations.ts](actions/mutations.ts)

Массовая отметка всех уведомлений пользователя как прочитанных.

**Возвращает:**
```typescript
ActionResult<void>
```

**Запрос:**
```sql
UPDATE user_notifications
SET is_read = true
WHERE user_id = ?
  AND is_read = false
```

---

## Отправка уведомлений

После миграции на Cache Module, отправка уведомлений происходит напрямую через **Supabase Edge Function**.

### Как отправить уведомление

**Edge Function URL:**
```
https://gvrcbvifirhxxdnvrwlz.supabase.co/functions/v1/notifications
```

**Метод:** `POST`

**Headers:**
```typescript
{
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${access_token}`
}
```

**Body:**
```typescript
{
  entityType: string  // 'announcement', 'assignment', 'section_comment', etc.
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

### Пример (из модуля announcements)

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
    const { data: { session } } = await supabase.auth.getSession()

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

    return await response.json()
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
  userIds: ['user-1', 'user-2'],
}, supabase)
```

---

## Realtime синхронизация

Модуль автоматически синхронизируется с базой данных через Supabase Realtime.

**Конфигурация:** `modules/cache/realtime/config.ts`

```typescript
{
  table: 'user_notifications',
  queryKeys: (payload) => [
    queryKeys.notifications.all,
  ],
  getUserId: (payload) => payload.new?.user_id || payload.old?.user_id,
}
```

**События:**
- `INSERT` - новое уведомление
- `UPDATE` - изменение статуса (прочитано/архивировано)
- `DELETE` - удаление уведомления

**Процесс обработки события:**
1. Realtime получает событие от Supabase
2. Cache модуль инвалидирует все связанные query keys:
   - `queryKeys.notifications.lists()` - списки уведомлений
   - `queryKeys.notifications.unreadCount(userId)` - счётчик непрочитанных
   - `queryKeys.notifications.typeCounts(...)` - счётчики по типам
3. TanStack Query автоматически перезапрашивает данные
4. UI обновляется без перезагрузки страницы

**Дополнительно:**
При получении нового уведомления (`INSERT`), вызывается колбэк `onModuleUpdate`, который обновляет соответствующие модули приложения (например, модуль объявлений при получении `announcement`).

---

## Optimistic Updates

Все mutation хуки используют optimistic updates для мгновенного отклика UI.

### Процесс optimistic update

**1. onMutate (до отправки запроса):**
- Отменяем все активные refetch для уведомлений
- Сохраняем текущее состояние кеша для rollback (только infinite queries + unreadCount)
- Обновляем кеш оптимистично (например, помечаем уведомление прочитанным)
- Обновляем счётчики (например, уменьшаем `unreadCount`)

**2. Мутация выполняется:**
- Server Action отправляет запрос к БД
- БД обновляется

**3. onError (если ошибка):**
- Восстанавливаем сохранённое состояние кеша
- Очищаем Map через `clear()` для предотвращения memory leak

**4. onSuccess (если успех):**
- Очищаем сохранённые данные через `clear()`
- Realtime синхронизация автоматически инвалидирует кеш

**5. Realtime событие:**
- Supabase отправляет событие об изменении
- Cache модуль инвалидирует все связанные queries
- TanStack Query перезапрашивает данные
- UI получает актуальные данные с сервера

### Early Exit оптимизация

Функция `updateInfiniteQueriesWithEarlyExit()` прекращает обработку страниц после нахождения целевого элемента:

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
    return { page: newPage, found: true }  // Early exit!
  }
)
```

**Преимущества:**
- Сложность: O(N×M) → O(N) в лучшем случае
- Если уведомление на первой странице - остальные страницы не обрабатываются
- Значительное ускорение при большом количестве уведомлений

### Memory Safety

**Проблема:** Optimistic updates сохраняют предыдущее состояние кеша для rollback. Без очистки это приводит к утечке памяти.

**Решение:**
- Используем `Map<string, PreviousData>` для хранения состояния
- Явный вызов `Map.clear()` в `onError` и `onSuccess`
- Сохраняем только необходимые данные (infinite queries + unreadCount, НЕ typeCounts)

```typescript
const previousData = new Map<string, { infiniteQueries: ..., unreadCount: ... }>()

// onMutate
previousData.set(mutationId, { infiniteQueries, unreadCount })

// onError / onSuccess
previousData.clear() // Важно!
```

---

## Типы уведомлений

### Встроенные типы

**1. `announcement`** - Объявления
- Payload: `{ user_name, title, body, announcement_id }`
- Используется модулем объявлений
- Генерация текста: `generateAnnouncementNotificationText()`

**2. `assignment`** - Передача заданий
- Payload: `{ project, from_section, amount, assignment_id }`
- Используется модулем планирования
- Генерация текста: `generateAssignmentNotificationText()`

**3. `section_comment`** - Комментарии к разделам
- Payload: `{ section_name, author_name, comment_preview, section_id }`
- Используется модулем планирования
- Генерация текста: локально в `transformNotificationData()`

**4. `test`** - Тестовые уведомления
- Для отладки системы

### Добавление нового типа

**1. Добавить в таблицу `entity_types`:**
```sql
INSERT INTO entity_types (entity_name)
VALUES ('my_new_type');
```

**2. Добавить обработку в `transform.ts`:**
```typescript
else if (entityType === 'my_new_type') {
  title = payload.title || 'Заголовок по умолчанию'
  message = payload.message || 'Сообщение по умолчанию'
}
```

**3. (Опционально) Добавить обработку в `NotificationsProvider`:**
```typescript
case 'my_new_type':
  console.log('Обновляем мой модуль')
  await fetchMyModuleData()
  break
```

**4. Отправить уведомление:**
```typescript
await sendNotification({
  entityType: 'my_new_type',
  payload: {
    title: 'Заголовок',
    message: 'Сообщение',
    type: 'info',
  },
  userIds: ['user-1', 'user-2'],
}, supabase)
```

---

## Интеграция с другими модулями

### Outbound (уведомления триггерят обновления)

**Announcements Module:**
- Событие: Клик на уведомление с `entityType: 'announcement'`
- Действие: Вызывается `fetchAnnouncements()` для обновления списка объявлений

**Projects Module:**
- Событие: Клик на уведомление с `entityType: 'section_comment'`
- Действие: Подсветка секции через `highlightSection(sectionId)` и переход на страницу проектов

### Inbound (другие модули отправляют уведомления)

**Announcements Module:**
- Действие: Создание нового объявления
- Отправка: Через Edge Function с `entityType: 'announcement'`

**Planning Module:**
- Действие: Передача заданий между пользователями
- Отправка: Через Edge Function с `entityType: 'assignment'`

**Comments Module:**
- Действие: Новый комментарий к разделу
- Отправка: Через Edge Function с `entityType: 'section_comment'`

---

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

  // Счётчик непрочитанных
  const { data: unreadCount = 0 } = useUnreadCount(userId)

  // Infinite scroll
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

      {/* Готовая панель */}
      <NotificationsPanel />

      {/* Или свой список */}
      <div>
        {notifications.map((notification) => (
          <div key={notification.id}>
            <h3>{notification.title}</h3>
            <p>{notification.message}</p>
          </div>
        ))}

        {hasNextPage && (
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? 'Загрузка...' : 'Загрузить ещё'}
          </button>
        )}
      </div>
    </div>
  )
}
```

---

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

---

### Фильтрация уведомлений

```tsx
'use client'

import { useState } from 'react'
import { useNotificationsInfinite, useNotificationTypeCounts } from '@/modules/notifications'

export function FilteredNotifications({ userId }) {
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set())
  const [onlyUnread, setOnlyUnread] = useState(false)

  // Счётчики по типам
  const { data: typeCounts = {} } = useNotificationTypeCounts({
    userId,
    options: { includeArchived: false }
  })

  // Уведомления с фильтрами
  const { data } = useNotificationsInfinite({
    userId,
    filters: {
      types: Array.from(selectedTypes),
      onlyUnread,
      includeArchived: false,
    }
  })

  const notifications = useMemo(() => data?.pages.flat() ?? [], [data])

  return (
    <div>
      {/* Фильтры по типам */}
      <div>
        {Object.entries(typeCounts).map(([type, count]) => (
          <label key={type}>
            <input
              type="checkbox"
              checked={selectedTypes.has(type)}
              onChange={(e) => {
                const newSet = new Set(selectedTypes)
                e.target.checked ? newSet.add(type) : newSet.delete(type)
                setSelectedTypes(newSet)
              }}
            />
            {type} ({count})
          </label>
        ))}
      </div>

      {/* Фильтр по прочитанности */}
      <label>
        <input
          type="checkbox"
          checked={onlyUnread}
          onChange={(e) => setOnlyUnread(e.target.checked)}
        />
        Только непрочитанные
      </label>

      {/* Список */}
      <div>
        {notifications.map((n) => (
          <div key={n.id}>{n.title}</div>
        ))}
      </div>
    </div>
  )
}
```

---

## Производительность

### Оптимизации

1. **Early exit в optimistic updates**
   Прекращаем обработку страниц после нахождения цели → O(N) вместо O(N×M)

2. **Минимальный previousData**
   Сохраняем только необходимые данные для rollback (infinite queries + unreadCount, НЕ typeCounts)

3. **Memory leak prevention**
   Явная очистка `Map.clear()` после мутаций

4. **Stale time = none**
   Данные всегда актуальны благодаря Realtime синхронизации

5. **Избирательная инвалидация**
   Инвалидируем только затронутые queries через иерархию query keys

6. **Пагинация 20 элементов**
   Баланс между производительностью и UX

7. **Дедупликация уведомлений**
   Предотвращает дубли после Realtime обновлений

8. **Throttled hover tracking**
   Отслеживание курсора с ограничением 60fps

9. **Passive event listeners**
   Для scroll events для лучшей производительности

10. **Мемоизация списков**
    `useMemo` для предотвращения лишних рендеров

### Query Keys иерархия

```
notifications.all = ['notifications']
  ├─ notifications.lists() = ['notifications', 'list']
  │   └─ notifications.infinite(userId, filters) = ['notifications', 'list', userId, { filters }]
  ├─ notifications.unreadCount(userId) = ['notifications', 'unread-count', userId]
  └─ notifications.typeCounts(userId, options) = ['notifications', 'type-counts', userId, options]
```

**Преимущества:**
- Инвалидировать все уведомления: `queryKeys.notifications.all`
- Инвалидировать все списки: `queryKeys.notifications.lists()`
- Инвалидировать конкретный список: `queryKeys.notifications.infinite(userId, filters)`

---

## Отладка

### Debug режим

Включить детальное логирование:

```bash
# .env.local
DEBUG_NOTIFICATIONS=true
```

Это включит в консоль браузера:
- 🔍 Запросы к БД с параметрами
- 🔄 Трансформация уведомлений
- 📡 Realtime события
- 👤 Авторизация пользователя

### Проверка состояния кеша

```typescript
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/modules/cache'

const queryClient = useQueryClient()

// Получить все кешированные уведомления
const cachedData = queryClient.getQueryData(
  queryKeys.notifications.infinite(userId, filters)
)
console.log('Cached notifications:', cachedData)

// Проверить статус запроса
const queryState = queryClient.getQueryState(
  queryKeys.notifications.unreadCount(userId)
)
console.log('Query state:', queryState)
```

### Проверка Realtime подписок

```typescript
// В браузерной консоли
const supabase = createClient()
console.log('Active channels:', supabase.getChannels())
```

---

## Известные проблемы

### Problem 13: Race Condition в Archive (High Priority)

**Описание:**
В `useArchiveNotification`, операции чтения `isRead` и удаления из списка выполняются в два прохода. Между ними может прийти Realtime UPDATE, изменив статус.

**Код:**
```typescript
// Первый проход - читаем isRead
const notification = page.find((n) => n.id === id)
const wasRead = notification?.isRead ?? false

// Второй проход - удаляем (но isRead мог измениться!)
return page.filter((n) => n.id !== id)
```

**Решение:**
Атомарная операция read + remove в один проход:

```typescript
let wasRead = false
const newPage = page.reduce((acc, n) => {
  if (n.id === id) {
    wasRead = n.isRead
    return acc // Удаляем
  }
  return [...acc, n]
}, [])
```

**Статус:** Частично решено в текущей версии

---

### Problem 15: No Error Toast on Mutation Failures (Medium Priority)

**Описание:**
При ошибке мутации (markAsRead, archive, etc.) происходит silent rollback без уведомления пользователя.

**Поведение:**
- UI мгновенно обновляется (optimistic)
- Server Action возвращает ошибку
- Rollback откатывает изменения
- Пользователь не понимает почему ничего не произошло

**Решение:**
1. Добавить toast уведомления в `onError`:
```typescript
onError: (error, variables, context) => {
  // Rollback...
  toast.error('Не удалось обновить уведомление')
}
```

2. Добавить pending состояние на кнопки:
```tsx
<button disabled={mutation.isPending}>
  {mutation.isPending && <Spinner />}
  Отметить прочитано
</button>
```

**Статус:** Не решено

---

### Problem 14: Generic Typing Missing (Low Priority)

**Описание:**
Функция `updateInfiniteQueriesWithEarlyExit()` не объявлена как generic, что ограничивает её переиспользование в других модулях.

**Текущий код:**
```typescript
function updateInfiniteQueriesWithEarlyExit(
  queryClient: QueryClient,
  queryKeyPrefix: QueryKey,
  updateFn: (page: Notification[]) => { page: Notification[], found: boolean }
)
```

**Решение:**
```typescript
function updateInfiniteQueriesWithEarlyExit<T>(
  queryClient: QueryClient,
  queryKeyPrefix: QueryKey,
  updateFn: (page: T[]) => { page: T[], found: boolean }
)
```

**Статус:** Не решено

---

## История миграции

### Миграция на Cache Module (декабрь 2024)

**Цель:** Унификация работы с данными, удаление дублирования, упрощение архитектуры

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
  └─ sendNotification()
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

**Результаты:**
- ✅ **-98% кода** (-2,427 строк)
- ✅ Автоматическая Realtime синхронизация (0 строк кода)
- ✅ Optimistic updates с rollback из коробки
- ✅ Типобезопасность end-to-end
- ✅ Консистентные паттерны с другими модулями

**Удалённые файлы:**
- `stores/useNotificationsStore.ts` (988 строк)
- `modules/notifications/api/notifications.ts` (1,506 строк)

**Добавленные файлы:**
- `stores/useNotificationsUiStore.ts` (67 строк)

---

## Связанные модули

- **[modules/cache](../cache/README.md)** - Система кеширования и Realtime (ОСНОВА)
- **[modules/announcements](../announcements/README.md)** - Модуль объявлений (отправляет уведомления)
- **[modules/planning](../planning/README.md)** - Модуль планирования (отправляет уведомления о заданиях)
- **[stores/useNotificationsUiStore](../../stores/useNotificationsUiStore.ts)** - UI-only Zustand store
- **[stores/useUserStore](../../stores/useUserStore.ts)** - Информация о текущем пользователе

---

## Лицензия

Частная разработка для ENECA Work.
