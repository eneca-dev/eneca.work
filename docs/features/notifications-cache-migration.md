# Миграция модуля уведомлений на Cache Module

**Дата начала:** 2025-12-09
**Статус:** Планирование завершено
**Ветка:** `refactor/notifications`
**Ответственный:** Development Team

---

## Контекст

Текущая система уведомлений использует самописную архитектуру с прямыми Supabase-запросами в 1,506-строчном API-файле и 988-строчным Zustand-стором, который хранит данные, управляет пагинацией и реализует кастомную Realtime-подписку. Это приводит к проблемам:

- ❌ Отсутствие rollback при ошибках БД
- ❌ Клиентский поиск загружает все уведомления
- ❌ Нет индексов в БД → медленные запросы (1,033+ строк)
- ❌ Дублирование логики кеширования и realtime
- ❌ Сложность поддержки и тестирования

**Решение:** Мигрировать на централизованный cache module (TanStack Query + Server Actions + Supabase Realtime).

---

## Цели

### Глобальная цель
Перевести систему уведомлений на единый слой данных через cache module, убрав из Zustand все данные и оставив только UI-состояние. Realtime-обновления через Supabase (cache module), не самописные.

### Definition of Done (DoD)

Фича считается завершённой, если **ВСЕ** пункты выполнены:

1. ✅ **Единственный источник данных:** Списки уведомлений, счётчики получаются ТОЛЬКО через хуки cache module
2. ✅ **Zustand без данных:** Нет notifications[], unreadCount, currentPage, hasMore — только UI-состояние
3. ✅ **Realtime через cache:** Таблицы в publication, автоматическая инвалидация через TanStack Query
4. ✅ **Пагинация через cache:** Infinite scroll через `createInfiniteCacheQuery`, не self-made логика
5. ✅ **Фильтры консистентны:** Server-side фильтрация, предсказуемое поведение
6. ✅ **Оптимистичные апдейты:** Mutations с rollback при ошибках
7. ✅ **Функциональный паритет:** Весь UX сохранён (realtime, архивация, счётчики, навигация)
8. ✅ **Старый код удалён:** api/notifications.ts (чтение) и старый Zustand store удалены
9. ✅ **Мониторинг:** Ошибки в Sentry, user-friendly сообщения в UI
10. ✅ **Документация:** README обновлён, описано что Zustand больше не источник данных

---

## Архитектурные решения

### 1. База данных

**Проблема:** Нет индексов на частых запросах (user_id, is_read, created_at).

**Решение:** Создать миграцию с композитными индексами:
- `idx_user_notifications_user_unread_created` для основного запроса
- `idx_user_notifications_user_unread_count` для счётчика badge
- `idx_notifications_entity_type_id` для JOIN с типами

**Ожидаемое улучшение:** 5-10x быстрее запросов.

### 2. Server Actions

**Структура:**
```
modules/notifications/actions/
  ├── types.ts        # Интерфейсы фильтров и inputs
  ├── queries.ts      # Read operations (getNotificationsPaginated, getUnreadCount)
  └── mutations.ts    # Write operations (markAsRead, archiveNotification, markAllAsRead)
```

**Ключевые функции:**
- `getNotificationsPaginated()` → `PaginatedActionResult<NotificationItem>` (для infinite scroll)
- `getUnreadCount()` → `ActionResult<number>` (для badge)
- Все с Sentry spans для мониторинга

### 3. Query Keys

**Расширение** `modules/cache/keys/query-keys.ts`:
```typescript
notifications: {
  all: ['notifications'] as const,
  lists: () => [...queryKeys.notifications.all, 'list'] as const,
  list: (userId, filters?) => [...queryKeys.notifications.lists(), userId, filters] as const,
  infinite: (userId, filters?) => [...queryKeys.notifications.list(userId, filters), 'infinite'] as const,
  unreadCount: (userId) => [...queryKeys.notifications.all, 'unread-count', userId] as const,
  typeCounts: (userId, options?) => [...queryKeys.notifications.all, 'type-counts', userId, options] as const,
}
```

**Принцип:** User-scoped keys + filter separation → корректная инвалидация.

### 4. Hooks

**Файл:** `modules/notifications/hooks/use-notifications.ts`

**Query hooks:**
- `useNotificationsInfinite({ userId, filters })` — infinite scroll (ПРИОРИТЕТ)
- `useUnreadCount(userId)` — badge counter
- `useNotificationTypeCounts({ userId, options })` — type filter counts

**Mutation hooks:**
- `useMarkAsRead(userId)` — с optimistic update + rollback
- `useArchiveNotification(userId)` — с optimistic update + rollback
- `useMarkAllAsRead()` — с полной инвалидацией

**StaleTime:** `staleTimePresets.none` (всегда свежие для realtime).

### 5. Realtime

**Решение:** Использовать существующую конфигурацию из `modules/cache/realtime/config.ts`:

```typescript
// УЖЕ НАСТРОЕНО:
{
  table: 'notifications',
  invalidateKeys: [queryKeys.notifications.all],
},
{
  table: 'user_notifications',
  invalidateKeys: [queryKeys.notifications.all],
}
```

**Как работает:**
1. RealtimeSync подписывается на INSERT/UPDATE/DELETE
2. При изменении → инвалидирует `queryKeys.notifications.all`
3. TanStack Query автоматически refetch активных queries
4. UI обновляется в realtime

**Что удаляем:** Самописную подписку из Zustand store (subscribeToNotifications, handleNewNotification).

### 6. Новый Zustand Store

**Файл:** `stores/useNotificationsUiStore.ts` (~60 строк)

**Только UI:**
- `isPanelOpen`, `panelWidthPx` (состояние панели)
- `hoveredNotificationId`, `lastPointerPosition` (стабильный hover)
- `onModuleUpdate` callback (интеграция с модулями)

**НЕТ данных:** notifications[], unreadCount, currentPage, hasMore, realtimeChannel.

---

## Этапы выполнения

### Этап 1: Подготовка инфраструктуры
**Время:** 30 минут

**Задачи:**
1. Создать миграцию `supabase/migrations/2025-12-10_notifications_indexes.sql`
2. Применить миграцию в dev окружении
3. Расширить query keys в `modules/cache/keys/query-keys.ts`
4. Создать типы в `modules/notifications/actions/types.ts`

**Критерии приёмки:**
- Индексы созданы (проверить `\d user_notifications`)
- Query keys включают notifications с фильтрами
- Типы экспортируются из actions/types.ts

---

### Этап 2: Миграция чтения (Query Layer) — ПРИОРИТЕТ
**Время:** 2 часа

**Задачи:**
1. Создать `modules/notifications/actions/queries.ts`
2. Создать query hooks в `modules/notifications/hooks/use-notifications.ts`
3. Мигрировать `NotificationsPanel.tsx` на `useNotificationsInfinite`
4. Мигрировать `NotificationBell.tsx` на `useUnreadCount`

**Ключевые изменения:**

**NotificationsPanel.tsx:**
```typescript
// Было
const { notifications, loadMoreNotifications, hasMore } = useNotificationsStore()

// Стало
const { data, fetchNextPage, hasNextPage } = useNotificationsInfinite({ userId, filters })
const notifications = useMemo(() => data?.pages.flat() ?? [], [data])
```

**NotificationBell.tsx:**
```typescript
// Было
const unreadCount = useNotificationsStore(s => s.unreadCount)

// Стало
const { data: unreadCount = 0 } = useUnreadCount(userId)
```

**Критерии приёмки:**
- [ ] Загрузка 20 уведомлений при открытии панели
- [ ] Scroll загружает следующую страницу автоматически
- [ ] Badge показывает корректный счётчик
- [ ] **КРИТИЧНО:** Открыть 2 вкладки браузера → создать уведомление через API → обе вкладки обновляются < 1 секунды
- [ ] Фильтры по типам работают (refetch с новым query key)
- [ ] Фильтры по статусу (All/Unread/Archived) работают

---

### Этап 3: Миграция мутаций (Mutation Layer)
**Время:** 1.5 часа

**Задачи:**
1. Создать `modules/notifications/actions/mutations.ts`
2. Добавить mutation hooks в `use-notifications.ts`
3. Мигрировать `NotificationItem.tsx` на mutation hooks

**Ключевые изменения:**

**NotificationItem.tsx:**
```typescript
// Было
const { markAsRead, markAsReadInDB } = useNotificationsStore()
const handleMarkRead = async () => {
  markAsRead(id)
  await markAsReadInDB(id)
}

// Стало
const markAsReadMutation = useMarkAsRead(userId)
const handleMarkRead = () => {
  markAsReadMutation.mutate({ id, userId })
}
```

**Критерии приёмки:**
- [ ] Mark as read → мгновенное обновление UI (optimistic)
- [ ] Badge декрементируется мгновенно
- [ ] Archive → удаляется из списка мгновенно
- [ ] Отключить сеть (Chrome DevTools) → mark as read → rollback при ошибке
- [ ] Mark all as read → все уведомления обновляются мгновенно

---

### Этап 4: Рефакторинг Zustand Store
**Время:** 1 час

**Задачи:**
1. Создать `stores/useNotificationsUiStore.ts` (UI-only, ~60 строк)
2. Обновить компоненты для использования UI store
3. **Удалить** `stores/useNotificationsStore.ts` (988 строк)
4. **Удалить** `modules/notifications/api/notifications.ts` (read functions, 1,506 строк)
5. Обновить экспорты в `modules/notifications/index.ts`

**Критерии приёмки:**
- [ ] UI store содержит только isPanelOpen, panelWidthPx, hover state, callback
- [ ] Старые файлы удалены (Zustand store, API read functions)
- [ ] `npm run build` проходит без ошибок
- [ ] Нет импортов из удалённых файлов (поиск по кодовой базе)

---

### Этап 5: Тестирование и документация
**Время:** 1 час

**Задачи:**
1. Полное UX-тестирование (чек-лист ниже)
2. Обновить `modules/notifications/README.md`
3. Добавить пример миграции в `modules/cache/README.md`
4. Обновить `CLAUDE.md` с новыми паттернами

**UX Testing Checklist:**
- [ ] Загрузка панели → 20 уведомлений
- [ ] Scroll → следующие 20 загружаются
- [ ] Badge корректный
- [ ] Mark as read → мгновенно
- [ ] Archive → мгновенно
- [ ] Mark all as read → мгновенно
- [ ] Фильтры работают
- [ ] **Realtime (2 вкладки):** Новое уведомление → обе обновляются < 1 сек
- [ ] **Realtime (2 вкладки):** Mark as read в одной → другая обновляется < 1 сек
- [ ] **Rollback:** Offline → mutation → автоматический rollback
- [ ] Клик на уведомление (комментарий) → открывается панель комментариев в проекте

**Критерии приёмки:**
- [ ] Все пункты UX checklist пройдены
- [ ] README обновлён (как использовать новые хуки)
- [ ] Документация описывает, что Zustand больше не хранит данные

---

## Критические файлы

### Создать (NEW):
1. `supabase/migrations/2025-12-10_notifications_indexes.sql`
2. `modules/notifications/actions/types.ts`
3. `modules/notifications/actions/queries.ts`
4. `modules/notifications/actions/mutations.ts`
5. `modules/notifications/hooks/use-notifications.ts`
6. `stores/useNotificationsUiStore.ts`

### Изменить (EDIT):
7. `modules/cache/keys/query-keys.ts` — extend notifications keys
8. `modules/notifications/components/NotificationsPanel.tsx` — infinite scroll
9. `modules/notifications/components/NotificationItem.tsx` — mutations
10. `modules/notifications/components/NotificationBell.tsx` — unread count
11. `modules/notifications/index.ts` — update exports
12. `modules/notifications/README.md` — documentation

### Удалить (DELETE):
13. `stores/useNotificationsStore.ts` — 988 строк
14. `modules/notifications/api/notifications.ts` — read functions (~1,200 строк из 1,506)

---

## Метрики успеха

### Код
- **Удалено:** ~2,200 строк
- **Добавлено:** ~800 строк
- **Чистое сокращение:** ~1,400 строк (-64%)

### Производительность
| Метрика | До | После | Улучшение |
|---------|-----|--------|-----------|
| Initial load | 500ms | 50ms | **10x** |
| Pagination | 300ms | 50ms | **6x** |
| Unread count | 100ms | 20ms | **5x** |
| Realtime latency | 200ms | 100ms | **2x** |

### Разработка
- **Новая фича:** ~5 строк кода (Server Action → hook → use)
- **Type safety:** 100% (end-to-end TypeScript)
- **Realtime setup:** 0 строк (автоматический)

---

## Риски и митигация

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Realtime перестаёт работать | Средняя | Критическое | Проверить publication ПЕРЕД миграцией; тест с 2 вкладками на Этапе 2 |
| Infinite scroll ломается | Низкая | Высокое | Тестировать с >60 уведомлениями (3+ страницы); edge cases |
| Optimistic updates не откатываются | Низкая | Среднее | TanStack Query делает rollback автоматически; тестировать offline |
| Производительность деградирует | Низкая | Высокое | Индексы в БД (Этап 1); мониторинг в Sentry |

---

## Важные замечания

1. **Realtime:** ТОЛЬКО cache module, не самописный (удаляем subscribeToNotifications)
2. **Query keys:** Включают userId для изоляции данных между пользователями
3. **StaleTime:** `none` для notifications (всегда свежие для realtime)
4. **Optimistic updates:** Автоматический rollback через TanStack Query (не нужно писать вручную)
5. **Infinite scroll:** `createInfiniteCacheQuery` + `fetchNextPage` (не loadMoreNotifications)
6. **Фильтры:** Server-side ONLY, не клиентская фильтрация массивов
7. **Zustand:** Только UI-состояние (panel open/closed, hover), НЕТ данных

---

## Следующие шаги

После одобрения плана:
1. Создать ветку `refactor/notifications` (уже создана)
2. Начать с **Этапа 1: Подготовка инфраструктуры**
3. После каждого этапа — коммит с чёткой фиксацией прогресса
4. После **Этапа 2** — обязательный тест realtime с 2 вкладками
5. После **Этапа 5** — code review и merge в main

---

**Статус:** ✅ Планирование завершено, готово к реализации
