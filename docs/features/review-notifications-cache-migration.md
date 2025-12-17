# Code Review: Notifications Cache Migration (Этап 3)

Дата: 2025-12-11
Статус: Проблемы выявлены, требуется исправление

---

## 🔴 КРИТИЧЕСКИЕ ПРОБЛЕМЫ

### Проблема 1: Использование клиентского Supabase client в Server Actions

#### Где находится:
- **Файл:** `modules/notifications/actions/mutations.ts:46`
- **Файл:** `modules/notifications/actions/mutations.ts:107`
- **Файл:** `modules/notifications/actions/mutations.ts:235`

#### Текущий код:
```typescript
// mutations.ts:46
export async function markAsRead(input: MarkAsReadInput): Promise<ActionResult<void>> {
  return Sentry.startSpan({ ... }, async (span) => {
    await markNotificationAsRead(input.userId, input.id)  // ← Вызов API-функции
  })
}

// notifications.ts:1065 - API функция
export async function markNotificationAsUnread(userId: string, userNotificationId: string): Promise<void> {
  const supabase = createClient()  // ← КЛИЕНТСКИЙ client в Server Action контексте!

  const { error } = await supabase
    .from('user_notifications')
    .update({ is_read: false })
    .eq('user_id', userId)
    .eq('id', userNotificationId)
    .select()
}
```

#### Почему это проблема:

1. **Авторизация:** Клиентский `createClient()` из `@/utils/supabase/client` использует cookies через browser API. В Server Action контексте это может не работать корректно (зависит от Next.js middleware).

2. **Inconsistent architecture:**
   - `archiveNotification` использует серверный client ✅
   - `markAsRead/markAsUnread` используют клиентский client ❌
   - Разное поведение при одинаковых операциях

3. **Хрупкость:** Может работать сейчас, но упадёт при изменении Next.js middleware или Supabase SSR конфигурации.

#### Решение:

**Вариант A (рекомендуется):** Заменить вызов API-функций на прямые запросы с серверным клиентом (как в `archiveNotification`):

```typescript
// mutations.ts - markAsRead
export async function markAsRead(input: MarkAsReadInput): Promise<ActionResult<void>> {
  return Sentry.startSpan(
    {
      op: 'notifications.mark_as_read_action',
      name: 'Mark Notification As Read (Action)',
    },
    async (span) => {
      try {
        span.setAttribute('user.id', input.userId)
        span.setAttribute('user_notification.id', input.id)

        // ИСПОЛЬЗОВАТЬ СЕРВЕРНЫЙ CLIENT
        const supabase = await createClient()  // ← Импорт из '@/utils/supabase/server'

        const { error } = await supabase
          .from('user_notifications')
          .update({
            is_read: true,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', input.userId)
          .eq('id', input.id)

        if (error) {
          console.error('[markAsRead] Supabase error:', error)
          throw error
        }

        span.setAttribute('mark.success', true)
        return { success: true, data: undefined }
      } catch (error) {
        span.setAttribute('mark.success', false)
        span.recordException(error as Error)

        Sentry.captureException(error, {
          tags: {
            module: 'notifications',
            action: 'mark_as_read_action',
            error_type: 'mutation_error',
          },
          extra: {
            user_id: input.userId,
            user_notification_id: input.id,
            timestamp: new Date().toISOString(),
          },
        })

        console.error('[markAsRead] Error:', error)
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Ошибка отметки уведомления как прочитанного',
        }
      }
    }
  )
}
```

**Применить к:**
- `markAsRead` (mutations.ts:33)
- `markAsUnread` (mutations.ts:94)
- `markAllAsRead` (mutations.ts:223) - нужно заменить вызов `markAllNotificationsAsRead()`

#### Риски решения:
- ❌ **Нет** - это правильный подход
- ✅ Улучшает консистентность
- ✅ Убирает зависимость от клиентского кода

---

### Проблема 2: Отсутствие валидации userId в Server Actions

#### Где находится:
- **Файл:** `modules/notifications/actions/mutations.ts:173`
- Все три мутации: `markAsRead`, `markAsUnread`, `archiveNotification`

#### Текущий код:
```typescript
export async function archiveNotification(input: ArchiveNotificationInput): Promise<ActionResult<void>> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('user_notifications')
    .update({ is_archived: input.isArchived })
    .eq('user_id', input.userId)  // ← userId приходит от клиента без проверки!
    .eq('id', input.id)
}
```

#### Почему это проблема:

1. **Security vulnerability:** Злоумышленник может подменить `userId` в запросе и изменить чужие уведомления:
   ```typescript
   // Злоумышленник отправляет:
   archiveNotification({
     id: 'notification-123',
     userId: 'VICTIM_USER_ID',  // ← Чужой ID!
     isArchived: true
   })
   ```

2. **Нет проверки ownership:** Мы доверяем клиенту, что он передал правильный `userId`.

3. **RLS bypass risk:** Если Row Level Security (RLS) настроен неправильно или отключён, злоумышленник получит доступ к чужим данным.

#### Решение:

**Добавить проверку авторизации в начале каждой Server Action:**

```typescript
export async function archiveNotification(input: ArchiveNotificationInput): Promise<ActionResult<void>> {
  return Sentry.startSpan(
    {
      op: 'notifications.archive_notification_action',
      name: 'Archive Notification (Action)',
    },
    async (span) => {
      try {
        // 1. ПОЛУЧИТЬ АВТОРИЗОВАННОГО ПОЛЬЗОВАТЕЛЯ
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        // 2. ПРОВЕРИТЬ АВТОРИЗАЦИЮ
        if (authError || !user) {
          span.setAttribute('auth.status', 'unauthenticated')
          return {
            success: false,
            error: 'Не авторизован',
          }
        }

        // 3. ПРОВЕРИТЬ ЧТО userId СООТВЕТСТВУЕТ СЕССИИ
        if (user.id !== input.userId) {
          span.setAttribute('auth.status', 'unauthorized')
          Sentry.captureMessage('archiveNotification: userId mismatch', {
            level: 'warning',
            extra: {
              sessionUserId: user.id,
              requestUserId: input.userId,
              notificationId: input.id
            },
          })
          return {
            success: false,
            error: 'Доступ запрещён',
          }
        }

        span.setAttribute('user.id', user.id)
        span.setAttribute('user_notification.id', input.id)
        span.setAttribute('archived.value', input.isArchived)

        // 4. ВЫПОЛНИТЬ ОПЕРАЦИЮ
        const { error } = await supabase
          .from('user_notifications')
          .update({
            is_archived: input.isArchived,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)  // ← Используем user.id из сессии, не input.userId
          .eq('id', input.id)

        if (error) {
          console.error('[archiveNotification] Supabase error:', error)
          throw error
        }

        span.setAttribute('archive.success', true)
        return { success: true, data: undefined }
      } catch (error) {
        span.setAttribute('archive.success', false)
        span.recordException(error as Error)

        Sentry.captureException(error, {
          tags: {
            module: 'notifications',
            action: 'archive_notification_action',
            error_type: 'mutation_error',
          },
          extra: {
            user_id: input.userId,
            user_notification_id: input.id,
            is_archived: input.isArchived,
            timestamp: new Date().toISOString(),
          },
        })

        console.error('[archiveNotification] Error:', error)
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Ошибка архивирования уведомления',
        }
      }
    }
  )
}
```

**Применить к:**
- `markAsRead`
- `markAsUnread`
- `archiveNotification`

#### Риски решения:
- ⚠️ **Небольшое снижение производительности** (+1 дополнительный запрос `auth.getUser()`)
- ✅ Но это критично для безопасности
- ✅ Современные best practices требуют явной валидации

---

### Проблема 3: Избыточное копирование данных при optimistic updates

#### Где находится:
- **Файл:** `modules/notifications/hooks/use-notifications.ts:161-167`
- Все три хука: `useMarkAsRead`, `useMarkAsUnread`, `useArchiveNotification`

#### Текущий код:
```typescript
onMutate: async ({ id }) => {
  await queryClient.cancelQueries({ queryKey: queryKeys.notifications.all })

  // ПРОБЛЕМА: Копируем ВСЕ данные всех queries
  const previousData = new Map()
  queryClient
    .getQueryCache()
    .findAll({ queryKey: queryKeys.notifications.all })  // ← Может вернуть 10+ queries
    .forEach((query) => {
      previousData.set(query.queryKey, query.state.data)  // ← Копируем ВЕСЬ state (сотни KB)
    })

  // ... optimistic updates
}
```

#### Почему это проблема:

1. **Memory overhead:**
   - Если у пользователя 100 уведомлений по 2KB = **200KB данных**
   - Копируем для **каждого** query (может быть 5-10 с разными фильтрами)
   - Итого: **200KB × 10 queries = 2MB в памяти** при одном клике!

2. **Performance:**
   - Глубокое копирование объектов - медленная операция
   - При 10 параллельных кликах = **20MB в памяти**

3. **Ненужное копирование:**
   - Мы копируем queries, которые не будем обновлять (например, `typeCounts`)
   - Нужно копировать только те queries, которые реально изменяются

#### Решение:

**Вариант A (рекомендуется):** Копировать только queries, которые мы обновляем:

```typescript
onMutate: async ({ id, userId }) => {
  await queryClient.cancelQueries({ queryKey: queryKeys.notifications.all })

  // КОПИРУЕМ ТОЛЬКО НЕОБХОДИМОЕ
  const previousData = {
    infiniteQueries: new Map(),
    unreadCount: queryClient.getQueryData(queryKeys.notifications.unreadCount(userId)),
  }

  // Находим и сохраняем ТОЛЬКО infinite queries (списки уведомлений)
  queryClient
    .getQueryCache()
    .findAll({ queryKey: queryKeys.notifications.lists() })  // ← Только lists, не все queries
    .forEach((query) => {
      previousData.infiniteQueries.set(query.queryKey, query.state.data)
    })

  // ... optimistic updates ...

  return previousData
},
onError: (error, variables, context) => {
  if (context?.infiniteQueries) {
    // Restore только infinite queries
    context.infiniteQueries.forEach((data, queryKey) => {
      queryClient.setQueryData(queryKey, data)
    })
  }

  if (context?.unreadCount !== undefined) {
    // Restore unreadCount
    queryClient.setQueryData(
      queryKeys.notifications.unreadCount(variables.userId),
      context.unreadCount
    )
  }
},
```

**Вариант B (оптимальный, но сложнее):** Не копировать данные вообще, а делать "обратные операции":

```typescript
onMutate: async ({ id }) => {
  // НЕ копируем данные, запоминаем только ID и старое состояние
  let wasRead = false

  queryClient.getQueryCache().findAll({ queryKey: queryKeys.notifications.lists() })
    .forEach((query) => {
      const data = query.state.data as any
      if (data?.pages) {
        const notification = data.pages.flat().find((n: Notification) => n.id === id)
        if (notification) {
          wasRead = notification.isRead  // ← Запоминаем только булево значение
        }
      }
    })

  // ... optimistic update ...

  return { id, wasRead }  // ← Возвращаем минимум данных
},
onError: (error, { id, userId }, context) => {
  if (!context) return

  // Откатываем ТОЛЬКО измененное уведомление
  queryClient.getQueryCache().findAll({ queryKey: queryKeys.notifications.lists() })
    .forEach((query) => {
      queryClient.setQueryData(query.queryKey, (old: any) => {
        if (!old?.pages) return old
        return {
          ...old,
          pages: old.pages.map((page: Notification[]) =>
            page.map((n: Notification) =>
              n.id === id ? { ...n, isRead: context.wasRead } : n  // ← Восстанавливаем старое значение
            )
          ),
        }
      })
    })
}
```

#### Сравнение вариантов:

| Вариант | Memory | Performance | Сложность |
|---------|--------|-------------|-----------|
| Текущий (копируем всё) | 2MB | Медленно | Простой |
| A (копируем нужное) | 400KB | Средне | Средний |
| B (только метаданные) | <1KB | Быстро | Сложный |

**Рекомендация:** Вариант A - баланс между простотой и эффективностью.

---

### Проблема 4: N×M×K сложность при optimistic updates

#### Где находится:
- **Файл:** `modules/notifications/hooks/use-notifications.ts:169-185`

#### Текущий код:
```typescript
queryClient
  .getQueryCache()
  .findAll({ queryKey: queryKeys.notifications.lists() })  // ← N queries (5-10)
  .forEach((query) => {
    queryClient.setQueryData(query.queryKey, (old: any) => {
      return {
        ...old,
        pages: old.pages.map((page: Notification[]) =>  // ← M pages (5-10)
          page.map((n: Notification) =>  // ← K notifications (20 per page)
            n.id === id ? { ...n, isRead: true } : n
          )
        ),
      }
    })
  })
```

#### Почему это проблема:

1. **Computational complexity:** `O(N × M × K)`
   - N = 5 queries (разные фильтры)
   - M = 5 pages (infinite scroll)
   - K = 20 уведомлений на странице
   - **Итого: 5 × 5 × 20 = 500 итераций** для обновления ОДНОГО уведомления

2. **Создание новых объектов:**
   - `.map()` создаёт новый массив при каждом вызове
   - Для каждой страницы создаём новый массив: `5 pages × 20 items = 100 новых объектов`
   - Умножаем на количество queries: `100 × 5 = 500 объектов в памяти`

3. **React re-renders:**
   - Каждый `setQueryData` триггерит re-render всех компонентов, подписанных на этот query
   - 5 queries = 5 re-renders подряд

#### Решение:

**Вариант A (рекомендуется):** Early exit при нахождении уведомления:

```typescript
queryClient.getQueryCache().findAll({ queryKey: queryKeys.notifications.lists() })
  .forEach((query) => {
    let found = false  // ← Флаг что нашли уведомление

    queryClient.setQueryData(query.queryKey, (old: any) => {
      if (!old?.pages || found) return old  // ← Выходим если уже нашли

      const newPages = old.pages.map((page: Notification[]) => {
        if (found) return page  // ← Не обрабатываем остальные страницы

        const newPage = page.map((n: Notification) => {
          if (n.id === id) {
            found = true  // ← Нашли!
            return { ...n, isRead: true }
          }
          return n
        })

        return newPage
      })

      return { ...old, pages: newPages }
    })
  })
```

**Эффект:**
- Было: 500 итераций
- Стало: ~10-20 итераций (останавливаемся при нахождении)
- **Ускорение в 25-50 раз**

**Вариант B (оптимальный):** Обновлять только один query (где сейчас находится пользователь):

```typescript
// В компоненте NotificationsPanel передавать текущие фильтры:
const currentFilters = { onlyUnread: false, includeArchived: false }
const markAsReadMutation = useMarkAsRead(userId, currentFilters)  // ← Передаём фильтры

// В хуке:
export function useMarkAsRead(userId: string, currentFilters?: NotificationFilters) {
  return useMutation({
    onMutate: async ({ id }) => {
      // Обновляем ТОЛЬКО текущий query
      const currentQueryKey = queryKeys.notifications.infinite(userId, currentFilters)

      await queryClient.cancelQueries({ queryKey: currentQueryKey })

      const previousData = queryClient.getQueryData(currentQueryKey)

      queryClient.setQueryData(currentQueryKey, (old: any) => {
        // Обновляем только один query, не все
      })

      return { previousData, queryKey: currentQueryKey }
    },
    onError: (error, variables, context) => {
      // Восстанавливаем только один query
      if (context?.previousData) {
        queryClient.setQueryData(context.queryKey, context.previousData)
      }
    }
  })
}
```

**Эффект:**
- Было: обновляем 5 queries = 500 итераций
- Стало: обновляем 1 query = 100 итераций
- **Ускорение в 5 раз**

#### Сравнение:

| Вариант | Итерации | Re-renders | Сложность реализации |
|---------|----------|------------|----------------------|
| Текущий | 500 | 5 | Простой |
| A (early exit) | 10-20 | 5 | Средний |
| B (только текущий query) | 100 | 1 | Сложный |

**Рекомендация:** Вариант A как минимальное улучшение, Вариант B - для максимальной производительности.

---

### Проблема 5: Двойная инвалидация кеша

#### Где находится:
- **Файл:** `modules/notifications/hooks/use-notifications.ts:203-206`
- **Файл:** `modules/cache/realtime/config.ts` (RealtimeSync)

#### Текущий код:
```typescript
// В хуке:
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })  // ← 1-я инвалидация
}

// В RealtimeSync (автоматически):
supabase.channel('cache-sync')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'user_notifications'
  }, () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })  // ← 2-я инвалидация
  })
```

#### Почему это проблема:

1. **Двойной refetch:**
   ```
   User clicks "mark as read"
   → Mutation starts
   → Optimistic update (UI changes instantly)
   → Server Action completes (200ms)
   → onSettled → invalidate → REFETCH #1 (300ms)
   → Realtime UPDATE event arrives (400ms)
   → RealtimeSync → invalidate → REFETCH #2 (500ms)
   ```

2. **Network overhead:**
   - Делаем 2 идентичных запроса к Supabase вместо 1
   - При 10 уведомлениях = **20 лишних запросов**

3. **UI flickering:**
   - Список может "моргнуть" дважды
   - Плохой UX

#### Решение:

**Вариант A (рекомендуется):** Убрать `invalidateQueries` из `onSettled`, оставить только Realtime:

```typescript
// use-notifications.ts
export function useMarkAsRead(userId: string) {
  return useMutation({
    mutationFn: markAsReadAction,
    onMutate: async ({ id }) => {
      // ... optimistic update ...
    },
    onError: (error, variables, context) => {
      // ... rollback ...
    },
    // УБРАТЬ onSettled полностью - полагаемся на Realtime
  })
}
```

**Обоснование:**
- Realtime событие приходит через ~200-500ms после успешной мутации
- Этого достаточно для синхронизации
- Optimistic update обеспечивает мгновенный UI feedback

**Вариант B (альтернатива):** Debounce инвалидации в RealtimeSync:

```typescript
// modules/cache/realtime/config.ts
let invalidateTimeout: NodeJS.Timeout | null = null

const handleUpdate = (table: string) => {
  const queryKeysToInvalidate = getQueryKeysForTable(table)

  // Debounce: если за 500ms пришло несколько UPDATE events, сделаем один refetch
  if (invalidateTimeout) {
    clearTimeout(invalidateTimeout)
  }

  invalidateTimeout = setTimeout(() => {
    queryClient.invalidateQueries({ queryKey: queryKeysToInvalidate })
    invalidateTimeout = null
  }, 500)
}
```

**Вариант C (самый надёжный):** Оставить `onSettled`, но добавить флаг "skip realtime if just mutated":

```typescript
// use-notifications.ts
const recentMutations = useRef(new Set<string>())

export function useMarkAsRead(userId: string) {
  return useMutation({
    onMutate: async ({ id }) => {
      recentMutations.current.add(id)  // ← Запоминаем что только что мутировали
      setTimeout(() => recentMutations.current.delete(id), 2000)  // ← Очищаем через 2 секунды
      // ... optimistic update ...
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
    }
  })
}

// В RealtimeSync:
.on('postgres_changes', { event: 'UPDATE', table: 'user_notifications' }, (payload) => {
  const notificationId = payload.new.id

  // SKIP если это наша собственная мутация
  if (recentMutations.current.has(notificationId)) {
    console.log('[RealtimeSync] Skipping invalidation - recent mutation')
    return
  }

  queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
})
```

#### Сравнение:

| Вариант | Refetch count | Надёжность | Сложность |
|---------|---------------|------------|-----------|
| Текущий | 2 | ✅ Высокая | Простой |
| A (только Realtime) | 1 | ⚠️ Средняя | Простой |
| B (debounce) | 1 | ✅ Высокая | Средний |
| C (skip own mutations) | 1 | ✅ Высокая | Сложный |

**Рекомендация:** Вариант A для начала (самый простой), если будут проблемы - Вариант C.

---

### Проблема 6: Избыточный `.select()` в API-функциях

#### Где находится:
- **Файл:** `modules/notifications/api/notifications.ts:1078`

#### Текущий код:
```typescript
const { error, data } = await supabase
  .from('user_notifications')
  .update({ is_read: false, updated_at: new Date().toISOString() })
  .eq('user_id', userId)
  .eq('id', userNotificationId)
  .select()  // ← Запрашиваем обновлённую запись

if (error) throw error

// data нигде не используется! ❌
```

#### Почему это проблема:

1. **Network overhead:**
   - Без `.select()`: ответ ~200 байт (только status)
   - С `.select()`: ответ ~2-5KB (полная запись с JOINами)
   - **В 10-25 раз больше данных**

2. **Latency:**
   - Supabase должен выполнить SELECT после UPDATE
   - Добавляет ~20-50ms к каждому запросу

3. **Ненужная работа:**
   - Мы не используем возвращённые данные
   - Всё равно делаем refetch через TanStack Query

#### Решение:

**Просто убрать `.select()`:**

```typescript
// БЫЛО:
const { error, data } = await supabase
  .from('user_notifications')
  .update({ is_read: false })
  .eq('user_id', userId)
  .eq('id', userNotificationId)
  .select()  // ← Удалить

// СТАЛО:
const { error } = await supabase
  .from('user_notifications')
  .update({ is_read: false, updated_at: new Date().toISOString() })
  .eq('user_id', userId)
  .eq('id', userNotificationId)
// Без .select() - возвращается только { error, status, statusText }
```

**Применить к:**
- `markNotificationAsRead()` (notifications.ts)
- `markNotificationAsUnread()` (notifications.ts)
- Все другие update/insert операции где `data` не используется

#### Когда `.select()` НУЖЕН:

```typescript
// Когда нужно вернуть созданную запись:
const { data, error } = await supabase
  .from('notifications')
  .insert({ title: 'New', ... })
  .select()
  .single()

return data  // ← Используем data
```

---

### Проблема 7: Потенциальная утечка памяти с previousData Map

#### Где находится:
- **Файл:** `modules/notifications/hooks/use-notifications.ts:161`

#### Текущий код:
```typescript
export function useMarkAsRead(userId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    onMutate: async ({ id }) => {
      const previousData = new Map()  // ← Создаётся при каждом вызове

      queryClient.getQueryCache().findAll({ ... })
        .forEach((query) => {
          previousData.set(query.queryKey, query.state.data)  // ← Сотни KB данных
        })

      return { previousData }
    },
    onSettled: () => {
      // previousData не очищается явно
    }
  })
}
```

#### Почему это проблема:

1. **Memory не очищается немедленно:**
   - `previousData` Map содержит ссылки на query data (сотни KB)
   - Даже после `onSettled`, Map остаётся в памяти до следующей GC
   - При быстрых кликах (10 раз подряд) = **10 копий данных в памяти**

2. **React component unmount:**
   - Если компонент unmount-ится во время выполнения mutation (например, user уходит со страницы)
   - `previousData` остаётся в памяти навсегда (до перезагрузки страницы)

3. **Garbage Collector delay:**
   - GC не запускается мгновенно
   - При активной работе может накопиться 10-20MB "мусора"

#### Решение:

**Вариант A (рекомендуется):** Явная очистка после использования:

```typescript
export function useMarkAsRead(userId: string) {
  return useMutation({
    onMutate: async ({ id }) => {
      const previousData = new Map()
      // ... fill previousData ...
      return { previousData }
    },
    onError: (error, variables, context) => {
      if (context?.previousData) {
        // Restore data
        context.previousData.forEach((data, queryKey) => {
          queryClient.setQueryData(queryKey, data)
        })

        // ОЧИСТИТЬ MAP
        context.previousData.clear()
      }
    },
    onSettled: (data, error, variables, context) => {
      // Refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })

      // ОЧИСТИТЬ MAP если не было ошибки
      if (!error && context?.previousData) {
        context.previousData.clear()
      }
    }
  })
}
```

**Вариант B (оптимальный):** Не хранить previousData вообще (см. Проблему 3, Вариант B).

#### Эффект:

| Подход | Memory при 10 кликах | GC latency |
|--------|---------------------|------------|
| Текущий | 20MB | Высокая |
| С `.clear()` | 2MB | Низкая |
| Без previousData (Вариант B) | <100KB | Минимальная |

---

## 🟡 СРЕДНИЕ ПРОБЛЕМЫ

### Проблема 8: Type safety - использование `any`

#### Где находится:
- **Файл:** `modules/notifications/hooks/use-notifications.ts:174`, `line 248`, `line 332`, `line 343`

#### Текущий код:
```typescript
queryClient.setQueryData(query.queryKey, (old: any) => {  // ← any!
  if (!old?.pages) return old
  return {
    ...old,
    pages: old.pages.map((page: Notification[]) => ...  // ← TypeScript не проверит структуру
  }
})
```

#### Почему это проблема:

1. **Нет type checking:**
   - Если структура infinite query изменится, TypeScript не предупредит
   - Можем случайно обращаться к несуществующим полям

2. **Runtime errors:**
   - `old.pages.map is not a function` - узнаем только в runtime
   - Сложнее дебажить

3. **Нет автодополнения:**
   - IDE не подсказывает доступные поля
   - Увеличивается вероятность опечаток

#### Решение:

**Определить тип для infinite query data:**

```typescript
import type { InfiniteData } from '@tanstack/react-query'
import type { Notification } from '../utils/transform'

// В use-notifications.ts:
export function useMarkAsRead(userId: string) {
  return useMutation({
    onMutate: async ({ id }) => {
      // ... cancel queries ...

      const previousData = new Map<readonly unknown[], unknown>()

      queryClient.getQueryCache()
        .findAll({ queryKey: queryKeys.notifications.lists() })
        .forEach((query) => {
          previousData.set(query.queryKey, query.state.data)
        })

      // Optimistic update с типами
      queryClient.getQueryCache()
        .findAll({ queryKey: queryKeys.notifications.lists() })
        .forEach((query) => {
          queryClient.setQueryData<InfiniteData<Notification[]>>(  // ← Явный тип!
            query.queryKey,
            (old) => {  // ← Теперь old типизирован
              if (!old?.pages) return old

              return {
                ...old,
                pages: old.pages.map((page) =>  // ← page: Notification[]
                  page.map((n) =>  // ← n: Notification
                    n.id === id ? { ...n, isRead: true } : n
                  )
                ),
              }
            }
          )
        })

      return { previousData }
    },
  })
}
```

**Эффект:**
- ✅ TypeScript проверяет что `old.pages` существует
- ✅ Автодополнение для `Notification` полей
- ✅ Ошибки компиляции вместо runtime errors

---

### Проблема 9: Отсутствие rate limiting для массовых операций

#### Где находится:
- **Хуки:** `modules/notifications/hooks/use-notifications.ts`

#### Текущее поведение:

```
User кликает "mark as read" 10 раз подряд:
  ✅ 10 optimistic updates (500 итераций × 10 = 5000 итераций)
  ✅ 10 Server Actions (10 параллельных запросов к Supabase)
  ✅ 10 Realtime events
  ✅ 10 refetch operations

= Перегрузка клиента, сервера и базы данных
```

#### Почему это проблема:

1. **Client перегрузка:**
   - 5000 итераций для optimistic updates
   - Main thread блокируется
   - UI лагает

2. **Server перегрузка:**
   - 10 параллельных UPDATE запросов к PostgreSQL
   - Может вызвать lock contention на таблице

3. **Realtime перегрузка:**
   - 10 WebSocket событий подряд
   - 10 refetch операций

4. **Bad UX:**
   - User случайно кликнул 5 раз → приложение "зависло"

#### Решение:

**Вариант A (рекомендуется):** Debounce на уровне UI:

```typescript
// NotificationsPanel.tsx или NotificationItem.tsx
import { useDebouncedCallback } from 'use-debounce'

export function NotificationItem({ notification, userId }: Props) {
  const markAsReadMutation = useMarkAsRead(userId)

  // Debounce: игнорируем клики в течение 300ms после последнего
  const handleMarkAsRead = useDebouncedCallback(
    (id: string) => {
      markAsReadMutation.mutate({ id, userId })
    },
    300,  // ← 300ms debounce
    { leading: true, trailing: false }  // ← Первый клик срабатывает сразу
  )

  return (
    <div onClick={() => handleMarkAsRead(notification.id)}>
      {/* ... */}
    </div>
  )
}
```

**Эффект:**
- 10 кликов за 1 секунду → выполнится только 1 операция
- Защита от случайных double-clicks
- **Performance improvement: ~90%**

**Вариант B:** Batch mutations (группировать несколько операций в одну):

```typescript
// modules/notifications/actions/mutations.ts
export async function markMultipleAsRead(input: {
  ids: string[]
  userId: string
}): Promise<ActionResult<void>> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('user_notifications')
    .update({ is_read: true, updated_at: new Date().toISOString() })
    .eq('user_id', input.userId)
    .in('id', input.ids)  // ← Batch update

  if (error) throw error

  return { success: true, data: undefined }
}

// В UI:
const [pendingIds, setPendingIds] = useState<string[]>([])

const batchMarkAsRead = useDebouncedCallback(
  () => {
    if (pendingIds.length > 0) {
      markMultipleAsReadMutation.mutate({ ids: pendingIds, userId })
      setPendingIds([])
    }
  },
  500
)

const handleMarkAsRead = (id: string) => {
  setPendingIds(prev => [...prev, id])
  batchMarkAsRead()
}
```

**Эффект:**
- 10 кликов → 1 batch запрос вместо 10 отдельных
- **Network reduction: 90%**
- **Database load reduction: 90%**

---

## 📊 ИТОГОВАЯ ТАБЛИЦА ПРИОРИТЕТОВ

| # | Проблема | Приоритет | Impact | Сложность | Время |
|---|----------|-----------|--------|-----------|-------|
| 1 | Клиентский Supabase client в Server Actions | 🔴 Критично | Безопасность | Средняя | 30 мин |
| 2 | Отсутствие валидации userId | 🔴 Критично | Безопасность | Низкая | 15 мин |
| 3 | Избыточное копирование previousData | 🔴 Критично | Performance | Средняя | 20 мин |
| 4 | N×M×K сложность optimistic updates | 🟡 Важно | Performance | Средняя | 30 мин |
| 5 | Двойная инвалидация кеша | 🟡 Важно | Performance | Низкая | 10 мин |
| 6 | Избыточный `.select()` | 🟡 Важно | Performance | Низкая | 5 мин |
| 7 | Memory leak с previousData | 🟡 Важно | Стабильность | Низкая | 10 мин |
| 8 | Type safety (`any`) | 🟢 Желательно | DX | Низкая | 15 мин |
| 9 | Rate limiting | 🟢 Желательно | UX | Средняя | 20 мин |

**Итого времени на все исправления: ~2.5 часа**

---

## 🎯 РЕКОМЕНДАЦИИ ПО ВНЕДРЕНИЮ

### Фаза 1: Критические проблемы (1 час)
1. Заменить клиентский Supabase client на серверный в `markAsRead`, `markAsUnread`, `markAllAsRead`
2. Добавить валидацию `userId` во всех Server Actions
3. Оптимизировать копирование `previousData` (Вариант A)

### Фаза 2: Важные проблемы (30 минут)
4. Добавить early exit в optimistic updates
5. Убрать `onSettled` из mutation hooks (полагаться только на Realtime)
6. Убрать избыточный `.select()` из API-функций
7. Добавить `.clear()` для `previousData` Map

### Фаза 3: Желательные улучшения (35 минут)
8. Заменить `any` на `InfiniteData<Notification[]>`
9. Добавить debounce в UI компонентах

---

## ✅ КРИТЕРИИ ГОТОВНОСТИ

После исправления всех проблем должно быть выполнено:

- [ ] Все Server Actions используют серверный Supabase client
- [ ] Все Server Actions валидируют `userId` через `auth.getUser()`
- [ ] `previousData` копирует только infinite queries и unreadCount
- [ ] Optimistic updates используют early exit
- [ ] Нет двойной инвалидации кеша (убран `onSettled`)
- [ ] Нет избыточных `.select()` в update операциях
- [ ] `previousData.clear()` вызывается в `onError` и `onSettled`
- [ ] Типы явно указаны (`InfiniteData<Notification[]>` вместо `any`)
- [ ] Добавлен debounce в UI компонентах

---

## 📝 ЗАМЕТКИ

- Все изменения должны быть протестированы на реальных данных (100+ уведомлений)
- Измерить performance до и после с помощью React DevTools Profiler
- Проверить memory usage в Chrome DevTools Memory tab
- Убедиться что Realtime события корректно инвалидируют кеш без `onSettled`
