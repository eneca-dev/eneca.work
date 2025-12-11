# Второй Code Review: Notifications Cache Migration

Дата: 2025-12-12
Статус: После исправлений проблем 1-7

---

## ✅ ЧТО ИСПРАВЛЕНО

### Исправленные проблемы из первого ревью:

1. ✅ **Проблема 1:** Использование клиентского Supabase client в Server Actions — **ИСПРАВЛЕНО**
   - Все Server Actions теперь используют серверный `createClient()` из `@/utils/supabase/server`
   - Валидация пользователя вынесена в отдельный helper `validateUserWithSpan()`

2. ✅ **Проблема 2:** Отсутствие валидации userId — **ИСПРАВЛЕНО**
   - Добавлена валидация через `supabase.auth.getUser()` во всех Server Actions
   - Создан модуль `actions/validate-user.ts` с типизированными helper-функциями

3. ✅ **Проблема 3:** Избыточное копирование previousData — **ИСПРАВЛЕНО**
   - Копируем только `infiniteQueries` Map и `unreadCount`, не все queries
   - Использован типизированный интерфейс `OptimisticUpdateContext`

4. ✅ **Проблема 4:** N×M×K сложность optimistic updates — **ИСПРАВЛЕНО**
   - Добавлена функция `updateInfiniteQueriesWithEarlyExit()` с early exit оптимизацией
   - Останавливаем обработку страниц после нахождения целевого элемента

5. ✅ **Проблема 5:** Двойная инвалидация кеша — **ИСПРАВЛЕНО**
   - Убран `onSettled` из всех mutation hooks
   - Полагаемся только на Realtime синхронизацию из `modules/cache/realtime/config.ts`

6. ✅ **Проблема 6:** Избыточный `.select()` в API-функциях — **НЕ ПРИМЕНИМО**
   - API-функции в `modules/notifications/api/notifications.ts` используются только в клиенте
   - Server Actions не вызывают эти функции после миграции

7. ✅ **Проблема 7:** Memory leak с previousData Map — **ИСПРАВЛЕНО**
   - Добавлен вызов `context.infiniteQueries.clear()` в `onError` и `onSuccess`

---

## 🔴 НОВЫЕ ПРОБЛЕМЫ

### Проблема 10: Остаточное использование клиентского Supabase в API модуле

#### Где находится:
- **Файл:** `modules/notifications/api/notifications.ts:18`
- **Файл:** `modules/notifications/components/NotificationsProvider.tsx:120`

#### Текущий код:
```typescript
// modules/notifications/api/notifications.ts:18
import { createClient } from '@/utils/supabase/client'  // ← Клиентский client

// Функции markNotificationAsRead(), markNotificationAsUnread() и др.
// всё ещё существуют в этом файле, хотя больше не используются
export async function markNotificationAsUnread(userId: string, userNotificationId: string): Promise<void> {
  const supabase = createClient()  // ← КЛИЕНТСКИЙ client

  const { error } = await supabase
    .from('user_notifications')
    .update({
      is_read: false,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .eq('id', userNotificationId)

  if (error) throw error
}
```

#### Почему это проблема:

1. **Dead code:**
   - Функции `markNotificationAsRead()`, `markNotificationAsUnread()`, `markAllNotificationsAsRead()` больше НЕ вызываются
   - После миграции на Server Actions, все мутации идут через `modules/notifications/actions/mutations.ts`
   - Старые API функции остались "висеть" в коде

2. **Confusion for developers:**
   - Новый разработчик может случайно использовать старые функции вместо новых Server Actions
   - Непонятно какие функции актуальны, какие deprecated

3. **Security risk:**
   - Если кто-то по ошибке использует старую функцию, она выполнится с клиентским client
   - Это вернёт проблему 1 (использование клиентского client вместо серверного)

4. **Maintenance overhead:**
   - Поддерживаем два набора функций для одинаковых операций
   - При изменении логики нужно обновлять в двух местах

#### Решение:

**Удалить устаревшие функции из `modules/notifications/api/notifications.ts`:**

```typescript
// УДАЛИТЬ эти функции полностью:
// - markNotificationAsRead()
// - markNotificationAsUnread()
// - markAllNotificationsAsRead()
// - archiveNotification() (если есть)

// Оставить ТОЛЬКО:
// - sendNotification() - используется для создания уведомлений
// - debugUserNotifications() - отладочная функция
// - createTestNotification() - тестовая функция
// - getUserNotifications() - если используется где-то ещё
```

**Обновить импорты в компонентах:**

```typescript
// Было (в NotificationsProvider.tsx):
import { debugUserNotifications, createTestNotification } from '../api/notifications'

// Осталось то же самое, т.к. эти функции не удаляются
```

#### Риски решения:
- ✅ **Минимальные риски** - функции не используются нигде
- ✅ Упростит кодовую базу
- ✅ Уберёт confusion для разработчиков

---

### Проблема 11: Дублирование логики в optimistic updates для архивирования

#### Где находится:
- **Файл:** `modules/notifications/hooks/use-notifications.ts:455-508`

#### Текущий код:
```typescript
// В useArchiveNotification() - архивирование (isArchived = true):
if (isArchived) {
  // Find notification to check if it was unread
  let wasUnread = false
  queryClient
    .getQueryCache()
    .findAll({ queryKey: queryKeys.notifications.lists() })
    .forEach((query) => {
      const data = query.state.data as any
      if (data?.pages) {
        const notification = data.pages
          .flat()
          .find((n: Notification) => n.id === id)
        if (notification && !notification.isRead) {
          wasUnread = true
        }
      }

      // ← ЗДЕСЬ: Цикл forEach уже завершился после нахождения,
      // но мы всё равно обрабатываем ВСЕ queries

      // Remove from list (archiving)
      updateInfiniteQueriesWithEarlyExit(...)  // ← Вызов внутри forEach
    })
}
```

#### Почему это проблема:

1. **Неправильная структура кода:**
   - Используем `forEach` для поиска `wasUnread`, но потом вызываем `updateInfiniteQueriesWithEarlyExit()` ВНУТРИ этого же `forEach`
   - Это означает что `updateInfiniteQueriesWithEarlyExit()` вызовется **N раз** (по количеству queries), а не 1 раз

2. **Performance degradation:**
   - Если queries: `[all, unread, type:announcement, type:assignment, archived]` (5 штук)
   - То `updateInfiniteQueriesWithEarlyExit()` вызовется **5 раз**
   - Каждый вызов обходит все queries заново
   - **Итого: 5 × N queries обработано вместо N**

3. **Дублирование работы:**
   - Early exit работает внутри каждого вызова, но между вызовами нет early exit
   - Обрабатываем одни и те же queries несколько раз

#### Решение:

**Переписать логику архивирования:**

```typescript
onMutate: async ({ id, isArchived, notification }) => {
  if (!userId) return
  await queryClient.cancelQueries({ queryKey: queryKeys.notifications.all })

  const previousData: OptimisticUpdateContext = {
    infiniteQueries: new Map(),
    unreadCount: queryClient.getQueryData(queryKeys.notifications.unreadCount(userId)),
  }

  // Сохраняем ТОЛЬКО infinite queries
  queryClient
    .getQueryCache()
    .findAll({ queryKey: queryKeys.notifications.lists() })
    .forEach((query) => {
      previousData.infiniteQueries.set(query.queryKey, query.state.data)
    })

  // АРХИВИРОВАНИЕ: isArchived = true
  if (isArchived) {
    // 1. Найти уведомление один раз для проверки wasUnread
    let wasUnread = false
    let found = false

    for (const query of queryClient.getQueryCache().findAll({ queryKey: queryKeys.notifications.lists() })) {
      if (found) break  // Early exit

      const data = query.state.data as any
      if (data?.pages) {
        for (const page of data.pages) {
          const notification = page.find((n: Notification) => n.id === id)
          if (notification) {
            wasUnread = !notification.isRead
            found = true
            break
          }
        }
      }
    }

    // 2. Удалить из всех списков ОДИН РАЗ
    updateInfiniteQueriesWithEarlyExit(
      queryClient,
      queryKeys.notifications.lists(),
      (page) => {
        const notification = page.find((n) => n.id === id)
        if (!notification) return { page, found: false }

        const newPage = page.filter((n) => n.id !== id)
        return { page: newPage, found: true }
      }
    )

    // 3. Обновить счётчик
    if (wasUnread) {
      queryClient.setQueryData(
        queryKeys.notifications.unreadCount(userId),
        (old: number = 0) => Math.max(0, old - 1)
      )
    }
  }
  // РАЗАРХИВИРОВАНИЕ: isArchived = false
  else {
    // Удалить из archived списков
    updateInfiniteQueriesWithEarlyExit(
      queryClient,
      queryKeys.notifications.lists(),
      (page) => {
        const notificationInPage = page.find((n) => n.id === id)
        if (!notificationInPage) return { page, found: false }

        const newPage = page.filter((n) => n.id !== id)
        return { page: newPage, found: true }
      }
    )

    // Если есть объект уведомления, добавить в non-archived списки
    if (notification) {
      const unarchivedNotification = {
        ...notification,
        isArchived: false,
      }

      // Добавить в начало первой страницы non-archived списков
      queryClient
        .getQueryCache()
        .findAll({ queryKey: queryKeys.notifications.lists() })
        .forEach((query) => {
          const key = query.queryKey as any[]
          const filters = key.find((k) => k?.filters)?.filters

          // Только non-archived списки
          if (!filters?.includeArchived) {
            queryClient.setQueryData<InfiniteData<Notification[]>>(
              query.queryKey,
              (old) => {
                if (!old?.pages || old.pages.length === 0) return old

                return {
                  ...old,
                  pages: [
                    [unarchivedNotification, ...old.pages[0]],
                    ...old.pages.slice(1),
                  ],
                }
              }
            )
          }
        })
    }
  }

  return previousData
}
```

#### Эффект:

| Подход | Iterations | Performance |
|--------|------------|-------------|
| Текущий | N queries × 5 calls = **5N** | Медленно |
| Исправленный | N queries × 1 call = **N** | Быстро |

---

### Проблема 12: Отсутствие обработки edge case в early exit логике

#### Где находится:
- **Файл:** `modules/notifications/hooks/use-notifications.ts:110-141`

#### Текущий код:
```typescript
function updateInfiniteQueriesWithEarlyExit(
  queryClient: QueryClient,
  queryKeyBase: readonly unknown[],
  operation: (page: Notification[]) => { page: Notification[]; found: boolean }
): void {
  queryClient
    .getQueryCache()
    .findAll({ queryKey: queryKeyBase })
    .forEach((query) => {
      let found = false  // ← Early exit флаг LOCAL для каждого query

      queryClient.setQueryData<InfiniteData<Notification[]>>(
        query.queryKey,
        (old) => {
          if (!old?.pages || found) return old

          const newPages = old.pages.map((page) => {
            if (found) return page  // ← Early exit ВНУТРИ query

            const result = operation(page)
            if (result.found) {
              found = true
            }

            return result.page
          })

          return { ...old, pages: newPages }
        }
      )
    })
}
```

#### Почему это проблема:

1. **Early exit работает только внутри одного query:**
   - `found` флаг сбрасывается для каждого query (объявлен внутри `forEach`)
   - Если уведомление найдено в первом query, второй query всё равно будет искать его

2. **Пример:**
   ```
   Queries:
   1. all notifications (100 items)
   2. unread notifications (50 items)
   3. type:announcement (20 items)

   Ищем notification с id='123', который находится в позиции 1 во всех queries.

   Текущее поведение:
   - Query 1: проверяем страницу 1 → находим → early exit
   - Query 2: проверяем страницу 1 → находим ЕЩЁ РАЗ → early exit
   - Query 3: проверяем страницу 1 → находим ЕЩЁ РАЗ → early exit

   Итого: 3 операции поиска + 3 операции map
   ```

3. **Ожидаемое поведение:**
   ```
   Оптимальный подход:
   - Query 1: проверяем страницу 1 → находим → GLOBAL early exit
   - Query 2: ПРОПУСКАЕМ (уже нашли)
   - Query 3: ПРОПУСКАЕМ (уже нашли)

   Итого: 1 операция поиска + 1 операция map
   ```

4. **Performance impact:**
   - При 5 queries и уведомлении на первой странице: **5× лишней работы**
   - Не критично, но противоречит названию "early exit"

#### Решение:

**Вариант A (простой):** Оставить как есть, переименовать функцию:

```typescript
/**
 * Применяет операцию к элементам в infinite query с early exit ПО СТРАНИЦАМ.
 *
 * Early exit работает внутри каждого query (останавливаем обработку страниц),
 * но НЕ между queries (обрабатываем все matching queries).
 */
function updateInfiniteQueriesWithPageEarlyExit(...)
```

**Вариант B (оптимальный):** Добавить global early exit:

```typescript
/**
 * Применяет операцию к элементам в infinite query с ГЛОБАЛЬНЫМ early exit.
 *
 * Останавливает обработку всех queries после того, как элемент найден в любом из них.
 */
function updateInfiniteQueriesWithEarlyExit(
  queryClient: QueryClient,
  queryKeyBase: readonly unknown[],
  operation: (page: Notification[]) => { page: Notification[]; found: boolean }
): void {
  let globalFound = false  // ← GLOBAL early exit flag

  queryClient
    .getQueryCache()
    .findAll({ queryKey: queryKeyBase })
    .forEach((query) => {
      if (globalFound) return  // ← SKIP remaining queries if already found

      let found = false

      queryClient.setQueryData<InfiniteData<Notification[]>>(
        query.queryKey,
        (old) => {
          if (!old?.pages || found || globalFound) return old

          const newPages = old.pages.map((page) => {
            if (found || globalFound) return page

            const result = operation(page)
            if (result.found) {
              found = true
              globalFound = true  // ← Set GLOBAL flag
            }

            return result.page
          })

          return { ...old, pages: newPages }
        }
      )
    })
}
```

#### Сравнение:

| Вариант | Iterations (5 queries) | Naming accuracy | Complexity |
|---------|------------------------|-----------------|------------|
| Текущий | 5 queries × 1 page | ⚠️ Misleading | Простой |
| A (rename) | 5 queries × 1 page | ✅ Accurate | Простой |
| B (global exit) | 1 query × 1 page | ✅ Accurate | Средний |

**Рекомендация:** Вариант A (переименовать) - минимальные изменения, но честное название.

---

## 🟡 МЕЛКИЕ ЗАМЕЧАНИЯ

### Замечание 1: Неиспользуемый параметр `notification` в `useArchiveNotification`

#### Где находится:
- **Файл:** `modules/notifications/hooks/use-notifications.ts:433`

#### Код:
```typescript
mutationFn: (input: { id: string; isArchived: boolean; notification?: Notification }) =>
  archiveNotificationAction({ id: input.id, isArchived: input.isArchived }),
  //                         ↑ notification не передаётся в action
```

#### Проблема:
- `notification` объект используется только в `onMutate` для optimistic update при разархивировании
- Но он НЕ передаётся в Server Action
- Это может сбить с толку разработчика

#### Решение:
Добавить комментарий:

```typescript
mutationFn: (input: {
  id: string
  isArchived: boolean
  notification?: Notification  // Только для optimistic update, не отправляется на сервер
}) =>
  archiveNotificationAction({ id: input.id, isArchived: input.isArchived }),
```

---

### Замечание 2: Отсутствие проверки `userId` перед операциями

#### Где находится:
- **Файл:** `modules/notifications/hooks/use-notifications.ts:245`, `338`, `437`

#### Код:
```typescript
onMutate: async ({ id }) => {
  if (!userId) return  // ← Early return если нет userId

  // ... остальная логика ...
}
```

#### Проблема:
- Если `userId === null`, мы возвращаем `undefined` из `onMutate`
- Это правильно, НО при этом:
  1. `mutationFn` всё равно вызовется (отправится Server Action)
  2. Server Action вернёт ошибку "Не авторизован"
  3. `onError` вызовется, но `context === undefined`
  4. Rollback не произойдёт (т.к. нет previousData)

#### Это не баг, но можно улучшить:

**Вариант A:** Не делать ничего (текущее поведение приемлемо):
- Server Action валидирует авторизацию
- Если userId нет, optimistic update не выполняется
- Пользователь увидит ошибку

**Вариант B:** Вообще не вызывать mutation если нет userId:

```typescript
export function useMarkAsRead() {
  const queryClient = useQueryClient()
  const userId = useUserStore((s) => s.id)

  return useMutation({
    mutationFn: async (input: { id: string }) => {
      // Проверка ПЕРЕД отправкой на сервер
      if (!userId) {
        return { success: false, error: 'Не авторизован' }
      }
      return markAsReadAction(input)
    },
    // ... остальное
  })
}
```

**Рекомендация:** Оставить как есть (Вариант A) - Server Action всё равно валидирует.

---

## 📊 ИТОГОВАЯ ТАБЛИЦА НОВЫХ ПРОБЛЕМ

| # | Проблема | Приоритет | Impact | Сложность | Время |
|---|----------|-----------|--------|-----------|-------|
| 10 | Dead code: старые API функции | 🟡 Важно | Maintenance | Низкая | 10 мин |
| 11 | Дублирование логики в архивировании | 🟡 Важно | Performance | Средняя | 20 мин |
| 12 | Early exit не глобальный | 🟢 Желательно | Performance | Низкая | 15 мин |

---

## 🎯 РЕКОМЕНДАЦИИ ПО ВНЕДРЕНИЮ

### Фаза 1: Cleanup (10 минут)
1. Удалить устаревшие функции из `modules/notifications/api/notifications.ts`:
   - `markNotificationAsRead()`
   - `markNotificationAsUnread()`
   - `markAllNotificationsAsRead()`

### Фаза 2: Performance (20 минут)
2. Исправить дублирование логики в `useArchiveNotification` (Проблема 11)
3. Переименовать `updateInfiniteQueriesWithEarlyExit` → `updateInfiniteQueriesWithPageEarlyExit` (Проблема 12, Вариант A)

### Фаза 3: Опционально (15 минут)
4. Добавить комментарий к `notification` параметру (Замечание 1)
5. Рассмотреть Вариант B для Проблемы 12 если нужна максимальная оптимизация

---

## ✅ КРИТЕРИИ ГОТОВНОСТИ

После исправления новых проблем:

- [ ] Удалены все неиспользуемые функции из `api/notifications.ts`
- [ ] Логика архивирования не вызывает `updateInfiniteQueriesWithEarlyExit()` несколько раз
- [ ] Функция early exit переименована или реализует глобальный early exit
- [ ] Добавлены комментарии к неочевидным параметрам

---

## 📝 ОБЩИЙ СТАТУС МОДУЛЯ

### ✅ Что работает отлично:

1. **Server Actions:** Полная миграция на серверные операции с валидацией
2. **Optimistic updates:** Early exit оптимизация для производительности
3. **Memory management:** Очистка previousData Map для предотвращения утечек
4. **Realtime sync:** Автоматическая инвалидация кеша через Supabase Realtime
5. **Type safety:** Типизация с `InfiniteData<Notification[]>` и `OptimisticUpdateContext`

### ⚠️ Что нужно улучшить:

1. **Dead code cleanup:** Удалить старые API функции (10 мин)
2. **Performance:** Исправить дублирование в архивировании (20 мин)
3. **Naming:** Уточнить название early exit функции (5 мин)

### 🎯 Общая оценка:

**8.5/10** — Модуль в отличном состоянии после исправлений, осталось только minor cleanup.

Приоритет на следующие 30 минут:
1. Удалить dead code (Проблема 10)
2. Исправить архивирование (Проблема 11)
3. Переименовать early exit (Проблема 12)

После этого модуль будет в production-ready состоянии.
