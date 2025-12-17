# Третий Code Review: Notifications Cache Migration

Дата: 2025-12-12
Статус: После исправлений проблем 10-12 из второго ревью

---

## ✅ ЧТО ИСПРАВЛЕНО

### Исправленные проблемы из второго ревью:

1. ✅ **Проблема 10:** Остаточное использование клиентского Supabase в API модуле — **ИСПРАВЛЕНО**
   - Вся папка `modules/notifications/api/` удалена полностью
   - Старые функции `markNotificationAsRead()`, `markNotificationAsUnread()`, `markAllNotificationsAsRead()` больше не существуют
   - Нет риска случайного использования deprecated функций

2. ✅ **Проблема 11:** Дублирование логики в optimistic updates для архивирования — **ИСПРАВЛЕНО**
   - В `useArchiveNotification()` логика архивирования переписана
   - Поиск `wasUnread` выполняется один раз с early exit (строки 456-476)
   - `updateInfiniteQueriesWithEarlyExit()` вызывается один раз вне цикла (строки 479-489)
   - Сложность снижена с **5N** до **N** операций

3. ⚠️ **Проблема 12:** Отсутствие обработки edge case в early exit логике — **ЧАСТИЧНО**
   - Функция `updateInfiniteQueriesWithEarlyExit()` не переименована
   - Global early exit НЕ реализован (флаг `found` локальный для каждого query)
   - **Но:** Название функции соответствует текущему поведению (early exit по страницам, не по queries)

---

## 🟢 НОВЫЕ ПОЛОЖИТЕЛЬНЫЕ ИЗМЕНЕНИЯ

### 1. Отличная архитектура модуля

#### Server Actions + TanStack Query:
```typescript
// modules/notifications/actions/queries.ts
export async function getNotificationsPaginated(...) // Server Action

// modules/notifications/actions/mutations.ts
export async function markAsRead(...) // Server Action

// modules/notifications/hooks/use-notifications.ts
export const useNotificationsInfinite = createInfiniteCacheQuery(...) // Hook с optimistic
```

**Почему это хорошо:**
- ✅ Полное разделение server/client логики
- ✅ Использование серверного Supabase client в actions
- ✅ Валидация пользователя через `validateUserWithSpan()`
- ✅ Типобезопасность через `ActionResult<T>`

### 2. Optimistic Updates с ранним выходом

```typescript
// use-notifications.ts:264-276
updateInfiniteQueriesWithEarlyExit(
  queryClient,
  queryKeys.notifications.lists(),
  (page) => {
    const notification = page.find((n) => n.id === id)
    if (!notification) return { page, found: false }

    const newPage = page.map((n) =>
      n.id === id ? { ...n, isRead: true } : n
    )
    return { page: newPage, found: true }
  }
)
```

**Почему это хорошо:**
- ✅ Early exit прекращает обработку страниц после нахождения элемента
- ✅ Минимизирует количество обновлений при больших списках
- ✅ Чистый API: `operation()` возвращает `{ page, found }`

### 3. Memory Management

```typescript
// use-notifications.ts:306-310
onSuccess: (data, variables, context) => {
  // ОЧИСТИТЬ MAP после успешной mutation (Проблема 7)
  if (context?.infiniteQueries) {
    context.infiniteQueries.clear()
  }
}
```

**Почему это хорошо:**
- ✅ Явная очистка Map предотвращает утечки памяти
- ✅ Очистка в `onError` и `onSuccess`
- ✅ Использование `OptimisticUpdateContext` интерфейса

### 4. Realtime Sync вместо ручной инвалидации

```typescript
// modules/cache/realtime/config.ts:112-119
{
  table: 'notifications',
  invalidateKeys: [queryKeys.notifications.all],
},
{
  table: 'user_notifications',
  invalidateKeys: [queryKeys.notifications.all],
}
```

**Почему это хорошо:**
- ✅ Убран `onSettled` из mutation hooks
- ✅ Автоматическая синхронизация через Supabase Realtime
- ✅ Нет двойной инвалидации (Проблема 5 из первого ревью)

### 5. Чистая структура компонентов

```typescript
// NotificationItem.tsx:78-80
const markAsReadMutation = useMarkAsRead()
const markAsUnreadMutation = useMarkAsUnread()
const archiveMutation = useArchiveNotification()

// NotificationItem.tsx:385-392
onClick={(e) => {
  e.stopPropagation()
  if (!notification.isRead) {
    markAsReadMutation.mutate({ id: notification.id })
  } else {
    markAsUnreadMutation.mutate({ id: notification.id })
  }
}}
```

**Почему это хорошо:**
- ✅ Декларативный код в компонентах
- ✅ Вся логика optimistic updates скрыта в hooks
- ✅ Автоматический rollback при ошибках

---

## 🔴 НОВЫЕ ПРОБЛЕМЫ

### Проблема 13: Потенциальная race condition в `useArchiveNotification`

#### Где находится:
- **Файл:** `modules/notifications/hooks/use-notifications.ts:455-498`

#### Текущий код:
```typescript
if (isArchived) {
  // 1. Find notification ONCE to check if it was unread (before removal)
  let wasUnread = false
  let found = false

  for (const query of queryClient
    .getQueryCache()
    .findAll({ queryKey: queryKeys.notifications.lists() })) {
    if (found) break // Early exit after finding

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

  // 2. Remove from all lists ONCE (outside the loop)
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

  // 3. If notification was unread, decrement count
  if (wasUnread) {
    queryClient.setQueryData(
      queryKeys.notifications.unreadCount(userId),
      (old: number = 0) => Math.max(0, old - 1)
    )
  }
}
```

#### Почему это проблема:

1. **Поиск и удаление разделены:**
   - Сначала ищем уведомление для проверки `wasUnread` (шаг 1)
   - Потом удаляем из всех списков (шаг 2)
   - **Между этими операциями** может произойти инвалидация кеша от Realtime

2. **Пример race condition:**
   ```
   Сценарий:
   1. User нажимает "Архивировать" уведомление с id='123' (isRead=false)
   2. onMutate начинает выполнение:
      - Находит notification.isRead=false → wasUnread=true
   3. В это время приходит Realtime UPDATE: notification.isRead=true
      - Realtime инвалидирует кеш и перезагружает данные
      - Теперь в кеше notification.isRead=true
   4. onMutate продолжает:
      - Удаляет уведомление из списков
      - Уменьшает unreadCount на 1 (хотя оно уже прочитано!)
   5. Результат: unreadCount некорректен (на 1 меньше чем должен быть)
   ```

3. **Почему `cancelQueries` не помогает:**
   - `cancelQueries` отменяет только **текущие запросы** (in-flight requests)
   - Но не блокирует **Realtime события**, которые могут прийти в любой момент

#### Решение:

**Вариант A (простой):** Читать `isRead` во время удаления:

```typescript
if (isArchived) {
  let wasUnread = false

  // Объединяем поиск и удаление в одну операцию
  updateInfiniteQueriesWithEarlyExit(
    queryClient,
    queryKeys.notifications.lists(),
    (page) => {
      const notification = page.find((n) => n.id === id)
      if (!notification) return { page, found: false }

      // Читаем статус ВО ВРЕМЯ удаления (atomic operation)
      if (!notification.isRead) {
        wasUnread = true
      }

      const newPage = page.filter((n) => n.id !== id)
      return { page: newPage, found: true }
    }
  )

  // Обновляем счётчик на основе прочитанного значения
  if (wasUnread) {
    queryClient.setQueryData(
      queryKeys.notifications.unreadCount(userId),
      (old: number = 0) => Math.max(0, old - 1)
    )
  }
}
```

**Преимущества:**
- ✅ Атомарная операция (read + remove в одном цикле)
- ✅ Нет окна для race condition между чтением и удалением
- ✅ Меньше кода (один проход вместо двух)

**Вариант B (более надёжный):** Использовать snapshot из `previousData`:

```typescript
if (isArchived) {
  // Читаем из snapshot, который был сделан ДО cancelQueries
  let wasUnread = false

  previousData.infiniteQueries.forEach((data: any) => {
    if (wasUnread) return // Early exit

    if (data?.pages) {
      for (const page of data.pages) {
        const notification = page.find((n: Notification) => n.id === id)
        if (notification) {
          wasUnread = !notification.isRead
          break
        }
      }
    }
  })

  // Удаление из актуального кеша
  updateInfiniteQueriesWithEarlyExit(...)

  // Обновление счётчика
  if (wasUnread) {
    queryClient.setQueryData(...)
  }
}
```

**Преимущества:**
- ✅ Гарантированно читаем состояние из snapshot (до любых изменений)
- ✅ Полностью исключаем race condition

**Рекомендация:** Вариант A (простой) - достаточно для большинства случаев, меньше кода.

#### Риски решения:
- ⚠️ Минимальные - race condition маловероятна, но возможна при высокой нагрузке

---

### Проблема 14: Недостаточная типизация в `updateInfiniteQueriesWithEarlyExit`

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
      let found = false

      queryClient.setQueryData<InfiniteData<Notification[]>>(
        query.queryKey,
        (old) => {
          if (!old?.pages || found) return old

          const newPages = old.pages.map((page) => {
            if (found) return page

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

1. **Generic тип не используется:**
   - Функция жёстко типизирована под `Notification[]`
   - Но потенциально может быть переиспользована для других сущностей

2. **Нет защиты от неправильных query keys:**
   ```typescript
   // Ничто не мешает передать неправильный queryKey:
   updateInfiniteQueriesWithEarlyExit(
     queryClient,
     queryKeys.projects.all, // ← WRONG! Это не infinite query
     (page) => { ... }
   )
   ```

3. **Нет проверки типа страницы:**
   - `operation()` ожидает `Notification[]`, но не валидирует
   - Если `page` имеет другой тип, будет runtime ошибка

#### Решение:

**Сделать функцию generic и типобезопасной:**

```typescript
/**
 * Применяет операцию к элементам в infinite query с early exit оптимизацией.
 *
 * @template T - Тип элементов в странице
 * @param queryClient - TanStack Query client
 * @param queryKeyBase - Базовый query key для поиска queries
 * @param operation - Функция для трансформации страницы
 *
 * @example
 * ```typescript
 * updateInfiniteQueriesWithEarlyExit<Notification>(
 *   queryClient,
 *   queryKeys.notifications.lists(),
 *   (page) => {
 *     const notification = page.find((n) => n.id === targetId)
 *     if (!notification) return { page, found: false }
 *
 *     const newPage = page.map((n) =>
 *       n.id === targetId ? { ...n, isRead: true } : n
 *     )
 *     return { page: newPage, found: true }
 *   }
 * )
 * ```
 */
function updateInfiniteQueriesWithEarlyExit<T>(
  queryClient: QueryClient,
  queryKeyBase: readonly unknown[],
  operation: (page: T[]) => { page: T[]; found: boolean }
): void {
  queryClient
    .getQueryCache()
    .findAll({ queryKey: queryKeyBase })
    .forEach((query) => {
      let found = false

      queryClient.setQueryData<InfiniteData<T[]>>(
        query.queryKey,
        (old) => {
          if (!old?.pages || found) return old

          const newPages = old.pages.map((page) => {
            if (found) return page

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

**Использование:**
```typescript
// Явное указание типа при вызове
updateInfiniteQueriesWithEarlyExit<Notification>(
  queryClient,
  queryKeys.notifications.lists(),
  (page) => { ... }
)
```

**Преимущества:**
- ✅ Полная типобезопасность
- ✅ Переиспользуемость для других сущностей
- ✅ TypeScript валидирует типы страниц

#### Риски решения:
- ✅ Нулевые - чисто типовые изменения, не влияют на runtime

---

### Проблема 15: Отсутствие обработки ошибок в `NotificationItem`

#### Где находится:
- **Файл:** `modules/notifications/components/NotificationItem.tsx:385-392`

#### Текущий код:
```typescript
<Button
  onClick={(e) => {
    e.stopPropagation()
    // Используем mutation hooks с автоматическим optimistic update и rollback
    if (!notification.isRead) {
      markAsReadMutation.mutate({ id: notification.id })
    } else {
      markAsUnreadMutation.mutate({ id: notification.id })
    }
  }}
  // ...
>
```

#### Почему это проблема:

1. **Silent failures:**
   - Если mutation падает с ошибкой, пользователь не узнает об этом
   - Optimistic update откатывается, но никакой обратной связи нет

2. **Нет индикации pending состояния:**
   - Кнопка не показывает, что операция выполняется
   - Пользователь может кликнуть несколько раз подряд

3. **Пример проблемы:**
   ```
   Сценарий:
   1. User кликает "Отметить прочитанным"
   2. Optimistic update: UI показывает как прочитанное
   3. Server Action падает с ошибкой (сеть/валидация)
   4. Rollback: UI возвращается в непрочитанное
   5. User не понимает что произошло - нет сообщения об ошибке
   ```

#### Решение:

**Добавить обработку ошибок и индикацию pending:**

```typescript
// В NotificationItem.tsx

import { toast } from "@/components/ui/use-toast"

// ...

<Button
  onClick={async (e) => {
    e.stopPropagation()

    try {
      if (!notification.isRead) {
        await markAsReadMutation.mutateAsync({ id: notification.id })
      } else {
        await markAsUnreadMutation.mutateAsync({ id: notification.id })
      }
    } catch (error) {
      // Показываем toast с ошибкой
      toast({
        title: "Ошибка",
        description: "Не удалось обновить статус уведомления",
        variant: "destructive"
      })
      console.error('[NotificationItem] Mutation error:', error)
    }
  }}
  disabled={markAsReadMutation.isPending || markAsUnreadMutation.isPending}
  // ...
>
  {(markAsReadMutation.isPending || markAsUnreadMutation.isPending) ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : notification.isRead ? (
    <SquareCheck className="h-4 w-4" />
  ) : (
    <span className="relative inline-flex h-4 w-4 items-center justify-center">
      <Square className="h-4 w-4" />
      <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-blue-500" />
    </span>
  )}
</Button>
```

**То же самое для кнопки архивирования:**
```typescript
<Button
  onClick={async (e) => {
    e.stopPropagation()

    try {
      // Если непрочитанное, сначала отметить прочитанным
      if (!notification.isRead) {
        await markAsReadMutation.mutateAsync({ id: notification.id })
      }
      // Затем архивировать
      await archiveMutation.mutateAsync({ id: notification.id, isArchived: true })
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось архивировать уведомление",
        variant: "destructive"
      })
      console.error('[NotificationItem] Archive error:', error)
    }
  }}
  disabled={
    markAsReadMutation.isPending ||
    archiveMutation.isPending
  }
  // ...
>
  {archiveMutation.isPending ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : (
    <Archive className="h-4 w-4" />
  )}
</Button>
```

**Преимущества:**
- ✅ Видимая обратная связь при ошибках
- ✅ Индикация загрузки во время операции
- ✅ Предотвращение двойных кликов через `disabled`

#### Риски решения:
- ⚠️ Добавляет немного визуального шума (спиннеры)
- ✅ Но улучшает UX в разы

---

## 🟡 МЕЛКИЕ ЗАМЕЧАНИЯ

### Замечание 1: Дублирование типа фильтров

#### Где находится:
- **Файл:** `modules/notifications/hooks/use-notifications.ts:56-63`
- **Файл:** `modules/cache/keys/query-keys.ts:140-147`

#### Код:
```typescript
// use-notifications.ts:56-63
export interface NotificationInfiniteFilters {
  userId: string
  filters?: {
    onlyUnread?: boolean
    includeArchived?: boolean
    types?: string[]
  }
}

// query-keys.ts:140-147
list: (
  userId: string,
  filters?: {
    onlyUnread?: boolean
    includeArchived?: boolean
    types?: string[]
  }
) => [...queryKeys.notifications.lists(), userId, filters] as const,
```

#### Проблема:
- Тип фильтров дублируется в двух местах
- При изменении нужно обновлять оба места

#### Решение:
```typescript
// Вынести в query-keys.ts:
export interface NotificationFilters {
  onlyUnread?: boolean
  includeArchived?: boolean
  types?: string[]
}

// В query-keys.ts:
list: (userId: string, filters?: NotificationFilters) => ...
infinite: (userId: string, filters?: NotificationFilters) => ...

// В use-notifications.ts:
import type { NotificationFilters } from '@/modules/cache/keys/query-keys'

export interface NotificationInfiniteFilters {
  userId: string
  filters?: NotificationFilters
}
```

---

### Замечание 2: Консистентность названий параметров

#### Где находится:
- **Файл:** `modules/notifications/hooks/use-notifications.ts:433-434`

#### Код:
```typescript
mutationFn: (input: { id: string; isArchived: boolean; notification?: Notification }) =>
  archiveNotificationAction({ id: input.id, isArchived: input.isArchived }),
```

#### Проблема:
- Параметр `notification` используется только в `onMutate` для optimistic add
- Но в названии ничего не говорит о его назначении
- Может сбить с толку других разработчиков

#### Решение (уже было в замечании 1 второго ревью):
```typescript
mutationFn: (input: {
  id: string
  isArchived: boolean
  /**
   * Полный объект уведомления для optimistic update при разархивировании.
   * Используется только в onMutate для добавления в non-archived списки.
   * НЕ отправляется на сервер.
   */
  notification?: Notification
}) =>
  archiveNotificationAction({ id: input.id, isArchived: input.isArchived }),
```

---

### Замечание 3: Отсутствие dedupe в `NotificationsPanel`

#### Где находится:
- **Файл:** `modules/notifications/components/NotificationsPanel.tsx:123-135`

#### Код:
```typescript
// Дедупликация уведомлений по id, чтобы избежать повторов
const dedupedNotifications = useMemo(() => {
  const seen = new Set<string>()
  const result: typeof notifications = []
  for (const n of notifications) {
    const id = (n as any)?.id
    if (id && !seen.has(id)) {
      seen.add(id)
      result.push(n)
    }
  }
  return result
}, [notifications])
```

#### Почему это нужно:
- Защита от дублей в случае race condition при пагинации
- TanStack Query **может** возвращать дубликаты при обновлении страниц

#### Но есть вопрос:
- **Почему дубликаты вообще возможны?**
- Infinite query должен гарантировать уникальность элементов

#### Анализ:

1. **Возможные причины дублей:**
   - Realtime UPDATE может добавить элемент в начало первой страницы
   - Одновременно этот элемент уже есть на второй странице
   - Результат: дубликат

2. **Пример:**
   ```
   Сценарий:
   1. Загружены страницы 1-3 (60 уведомлений)
   2. Приходит новое уведомление через Realtime
   3. Realtime инвалидирует кеш и перезагружает страницу 1
   4. Новое уведомление теперь на позиции 1
   5. Но старое уведомление еще на позиции 21 (страница 2)
   6. Результат: дубликат между страницами 1 и 2
   ```

#### Вывод:
- ✅ Dedupe — это **правильное решение** для infinite scroll
- ✅ Защищает от edge cases с Realtime updates
- ⚠️ Но можно оптимизировать: проверять только соседние страницы

---

## 📊 ИТОГОВАЯ ТАБЛИЦА НОВЫХ ПРОБЛЕМ

| # | Проблема | Приоритет | Impact | Сложность | Время |
|---|----------|-----------|--------|-----------|-------|
| 13 | Race condition в архивировании | 🟡 Важно | Correctness | Низкая | 15 мин |
| 14 | Недостаточная типизация early exit | 🟢 Желательно | Type Safety | Низкая | 10 мин |
| 15 | Отсутствие обработки ошибок в UI | 🟡 Важно | UX | Средняя | 20 мин |

---

## 🎯 РЕКОМЕНДАЦИИ ПО ВНЕДРЕНИЮ

### Фаза 1: Correctness (15 минут)
1. Исправить race condition в `useArchiveNotification` (Проблема 13, Вариант A)
   - Объединить чтение `isRead` и удаление в одну операцию

### Фаза 2: Type Safety (10 минут)
2. Сделать `updateInfiniteQueriesWithEarlyExit` generic (Проблема 14)
   - Добавить `<T>` параметр типа
   - Вынести `NotificationFilters` в query-keys (Замечание 1)

### Фаза 3: UX (20 минут)
3. Добавить обработку ошибок в `NotificationItem` (Проблема 15)
   - Toast уведомления при ошибках
   - Индикаторы загрузки для кнопок
   - Disable кнопок во время операций

### Фаза 4: Опционально (10 минут)
4. Добавить JSDoc комментарии (Замечание 2)
5. Оптимизировать dedupe для проверки только соседних страниц (Замечание 3)

---

## ✅ КРИТЕРИИ ГОТОВНОСТИ

После исправления новых проблем:

- [ ] Race condition в архивировании устранена (атомарное чтение + удаление)
- [ ] `updateInfiniteQueriesWithEarlyExit` — generic функция
- [ ] Все кнопки в `NotificationItem` показывают ошибки через toast
- [ ] Кнопки disabled во время pending операций
- [ ] Типы фильтров вынесены в query-keys
- [ ] Добавлены JSDoc комментарии к неочевидным параметрам

---

## 📝 ОБЩИЙ СТАТУС МОДУЛЯ

### ✅ Что работает отлично:

1. **Architecture:** Чистое разделение server/client через Server Actions
2. **Optimistic Updates:** Early exit оптимизация работает корректно
3. **Memory Management:** Map очищаются в onError/onSuccess
4. **Realtime Sync:** Автоматическая инвалидация без двойных запросов
5. **Type Safety:** Полная типизация с ActionResult и InfiniteData
6. **Dead Code Cleanup:** Все старые API функции удалены

### ⚠️ Что нужно улучшить:

1. **Race Condition:** Архивирование может некорректно обновить unreadCount (15 мин)
2. **Type Safety:** Early exit функция не generic (10 мин)
3. **Error Handling:** Нет обратной связи при ошибках мутаций (20 мин)

### 🎯 Общая оценка:

**9/10** — Модуль в отличном состоянии, осталось несколько minor issues.

Приоритет на следующие 45 минут:
1. Исправить race condition (Проблема 13)
2. Добавить error handling в UI (Проблема 15)
3. Сделать early exit generic (Проблема 14)

После этого модуль будет в идеальном production-ready состоянии.

---

## 🚀 ДОПОЛНИТЕЛЬНЫЕ НАБЛЮДЕНИЯ

### Сильные стороны текущей реализации:

1. **Separation of Concerns:**
   ```
   ✅ Server Actions (actions/) — бизнес-логика
   ✅ Hooks (hooks/) — кеш и optimistic updates
   ✅ Components (components/) — UI и взаимодействие
   ```

2. **Cache Module Integration:**
   - Использование `createInfiniteCacheQuery` для DRY кода
   - Централизованные query keys
   - Realtime sync из коробки

3. **Performance:**
   - Early exit минимизирует обновления
   - Dedupe предотвращает дубли
   - Throttle для pointer tracking (60fps)

4. **Security:**
   - Валидация userId в каждом Server Action
   - XSS защита через `escapeHtml()` в `NotificationItem`
   - Серверный Supabase client вместо клиентского

### Потенциальные улучшения (не критично):

1. **Pagination Strategy:**
   - Текущая: Infinite scroll (20 элементов на страницу)
   - Альтернатива: Virtual scrolling для списков >100 элементов

2. **Optimistic Updates:**
   - Текущая: Обновление всех queries
   - Альтернатива: Обновление только видимого query (если есть фильтры)

3. **Error Recovery:**
   - Текущая: Rollback + console.error
   - Альтернатива: Retry стратегия с exponential backoff

Но эти улучшения **не обязательны** — текущая реализация полностью соответствует production требованиям.
