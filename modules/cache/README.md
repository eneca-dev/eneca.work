# Cache Module

Централизованный модуль кеширования на базе **TanStack Query** + **Server Actions**.

## Возможности

- **Server Actions** — типобезопасные запросы к Supabase
- **Query Keys Factory** — централизованное управление ключами кеша
- **Hook Factories** — фабрики для создания типизированных хуков
- **Optimistic Updates** — мгновенный отклик UI
- **Realtime Sync** — автоматическая инвалидация при изменениях в БД

## Структура

```
modules/cache/
├── index.ts                    # Public API
├── types/index.ts              # Типы (ActionResult, PaginatedActionResult)
├── client/query-client.ts      # QueryClient + staleTimePresets
├── keys/query-keys.ts          # Query Keys Factory
├── providers/query-provider.tsx # Provider + DevTools + Realtime
├── hooks/
│   ├── index.ts                # Экспорты хуков
│   ├── use-cache-query.ts      # Фабрики для queries
│   └── use-cache-mutation.ts   # Фабрики для mutations
├── actions/
│   ├── base.ts                 # safeAction wrapper
│   └── projects.ts             # Server Actions для проектов
├── realtime/
│   ├── config.ts               # Таблицы → Query Keys
│   ├── realtime-sync.tsx       # Компонент синхронизации
│   └── index.ts                # Экспорты
└── utils/action-helpers.ts     # Хелперы
```

## Тестовая страница

```
/dashboard/cache-test
```

---

## Быстрый старт

### 1. Создать Server Action

```typescript
// modules/my-module/actions/items.ts
'use server'

import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/modules/cache'

export interface Item {
  id: string
  name: string
}

export async function getItems(): Promise<ActionResult<Item[]>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.from('items').select('*')

    if (error) return { success: false, error: error.message }
    return { success: true, data }
  } catch (error) {
    return { success: false, error: 'Ошибка загрузки' }
  }
}

export async function updateItem(
  input: { id: string; name: string }
): Promise<ActionResult<Item>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('items')
      .update({ name: input.name })
      .eq('id', input.id)
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data }
  } catch (error) {
    return { success: false, error: 'Ошибка обновления' }
  }
}
```

### 2. Добавить Query Key

```typescript
// modules/cache/keys/query-keys.ts

export const queryKeys = {
  // ... существующие ключи

  items: {
    all: ['items'] as const,
    lists: () => [...queryKeys.items.all, 'list'] as const,
    list: (filters?: ItemFilters) => [...queryKeys.items.lists(), filters] as const,
    details: () => [...queryKeys.items.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.items.details(), id] as const,
  },
}
```

### 3. Создать хуки с фабриками

```typescript
// modules/my-module/hooks/use-items.ts
'use client'

import {
  createCacheQuery,
  createUpdateMutation,
  queryKeys,
  staleTimePresets,
} from '@/modules/cache'
import { getItems, updateItem, type Item } from '../actions/items'

// Query хук
export const useItems = createCacheQuery({
  queryKey: () => queryKeys.items.lists(),
  queryFn: getItems,
  staleTime: staleTimePresets.medium,
})

// Mutation хук с optimistic update
export const useUpdateItem = createUpdateMutation<{ id: string; name: string }, Item>({
  mutationFn: updateItem,
  listQueryKey: queryKeys.items.lists(),
  getId: (input) => input.id,
  getItemId: (item) => item.id,
  merge: (item, input) => ({ ...item, name: input.name }),
  invalidateKeys: [queryKeys.items.all],
})
```

### 4. Использовать в компоненте

```tsx
'use client'

import { useItems, useUpdateItem } from './hooks/use-items'

export function ItemsList() {
  const { data: items, isLoading, error } = useItems({})
  const updateItem = useUpdateItem()

  if (isLoading) return <div>Загрузка...</div>
  if (error) return <div>Ошибка: {error.message}</div>

  return (
    <ul>
      {items?.map((item) => (
        <li key={item.id}>
          <input
            value={item.name}
            onChange={(e) =>
              updateItem.mutate({ id: item.id, name: e.target.value })
            }
          />
          {updateItem.isPending && <span>Сохранение...</span>}
        </li>
      ))}
    </ul>
  )
}
```

### 5. Добавить Realtime (опционально)

```typescript
// modules/cache/realtime/config.ts

export const realtimeSubscriptions: TableSubscription[] = [
  {
    table: 'items',
    invalidateKeys: [queryKeys.items.all],
  },
]
```

Добавить таблицу в publication:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE items;
```

---

## API Reference

### Query Factories

#### `createCacheQuery<TData, TFilters>`

Создаёт хук для запроса с фильтрами.

```typescript
const useItems = createCacheQuery({
  queryKey: (filters) => queryKeys.items.list(filters),
  queryFn: (filters) => getItems(filters),
  staleTime: staleTimePresets.medium,
})

// Использование
const { data, isLoading } = useItems({ status: 'active' })
```

#### `createSimpleCacheQuery<TData>`

Создаёт хук для запроса без фильтров.

```typescript
const useDepartments = createSimpleCacheQuery({
  queryKey: queryKeys.departments.list(),
  queryFn: getDepartments,
  staleTime: staleTimePresets.static, // Справочники меняются редко
})
```

#### `createDetailCacheQuery<TData>`

Создаёт хук для запроса по ID.

```typescript
const useItem = createDetailCacheQuery({
  queryKey: (id) => queryKeys.items.detail(id),
  queryFn: (id) => getItemById(id),
})

// Использование
const { data: item } = useItem('item-id-123')
const { data: item } = useItem(undefined) // Запрос не выполнится
```

#### `createInfiniteCacheQuery<TData, TFilters>`

Создаёт хук для бесконечной прокрутки.

```typescript
const useItemsInfinite = createInfiniteCacheQuery({
  queryKey: (filters) => queryKeys.items.list(filters),
  queryFn: (filters) => getItemsPaginated(filters),
  pageSize: 20,
})

// Использование
const { data, fetchNextPage, hasNextPage } = useItemsInfinite({})
```

### Mutation Factories

#### `createCacheMutation<TInput, TData>`

Базовая фабрика для мутаций.

```typescript
const useCreateItem = createCacheMutation({
  mutationFn: createItem,
  invalidateKeys: [queryKeys.items.all],
  onSuccess: (data) => console.log('Created:', data),
})
```

#### `createUpdateMutation<TInput, TData>`

Фабрика для обновления с optimistic update.

```typescript
const useUpdateItem = createUpdateMutation({
  mutationFn: updateItem,
  listQueryKey: queryKeys.items.lists(),
  getId: (input) => input.id,
  getItemId: (item) => item.id,
  merge: (item, input) => ({ ...item, ...input }),
  invalidateKeys: [queryKeys.items.all],
})
```

#### `createDeleteMutation<TInput, TData>`

Фабрика для удаления с optimistic update.

```typescript
const useDeleteItem = createDeleteMutation({
  mutationFn: deleteItem,
  listQueryKey: queryKeys.items.lists(),
  getId: (input) => input.id,
  getItemId: (item) => item.id,
  invalidateKeys: [queryKeys.items.all],
})
```

### staleTimePresets

```typescript
const staleTimePresets = {
  static: 10 * 60 * 1000,   // 10 мин — справочники
  slow: 5 * 60 * 1000,      // 5 мин — профили, настройки
  medium: 3 * 60 * 1000,    // 3 мин — проекты (default)
  fast: 2 * 60 * 1000,      // 2 мин — разделы
  realtime: 1 * 60 * 1000,  // 1 мин — загрузки
  none: 0,                   // 0 — уведомления
}
```

---

## Realtime

Realtime синхронизация включена по умолчанию в `QueryProvider`.

### Как это работает

1. `RealtimeSync` подписывается на изменения таблиц через Supabase Realtime
2. При изменении инвалидирует соответствующие query keys
3. TanStack Query автоматически перезапрашивает данные

### Текущие подписки

| Таблица | Инвалидируемые ключи |
|---------|---------------------|
| projects | `queryKeys.projects.all` |
| stages | `queryKeys.projects.all` |
| objects | `queryKeys.projects.all` |
| sections | `queryKeys.sections.all`, `queryKeys.projects.all` |
| profiles | `queryKeys.users.all` |
| loadings | `queryKeys.loadings.all`, `queryKeys.sections.all` |
| departments | `queryKeys.departments.all` |
| teams | `queryKeys.teams.all` |
| clients | `queryKeys.projects.all` |
| notifications | `queryKeys.notifications.all` |

### Добавление новой таблицы

1. Добавить в `modules/cache/realtime/config.ts`:
```typescript
{
  table: 'my_table',
  invalidateKeys: [queryKeys.myEntity.all],
}
```

2. Добавить в Supabase publication:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE my_table;
```

### Отключение Realtime

```tsx
<QueryProvider disableRealtime>
  {children}
</QueryProvider>
```

---

## Миграция существующего кода

### До (прямые запросы)

```typescript
const [items, setItems] = useState<Item[]>([])
const [loading, setLoading] = useState(true)

useEffect(() => {
  fetchItems().then(setItems).finally(() => setLoading(false))
}, [])
```

### После (cache module)

```typescript
const { data: items, isLoading } = useItems({})
```

---

## Troubleshooting

### Данные не обновляются после мутации

Убедитесь что `invalidateKeys` включает нужные ключи:

```typescript
invalidateKeys: [queryKeys.items.all] // Инвалидирует ВСЕ items запросы
```

### Realtime не работает

1. Проверьте что таблица добавлена в publication:
```sql
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
```

2. Добавьте если нужно:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE your_table;
```

3. Проверьте консоль браузера на `[RealtimeSync] Subscription status: SUBSCRIBED`

### TypeScript ошибки

Убедитесь что Server Actions возвращают `ActionResult<T>`:

```typescript
export async function getItems(): Promise<ActionResult<Item[]>> {
  // ...
}
```

---

## Changelog

### v0.2.0 (текущая)

- [x] Hook Factories (createCacheQuery, createCacheMutation, etc.)
- [x] Realtime синхронизация с debounce
- [x] View `v_cache_projects` для структуры проектов
- [x] Документация

### v0.1.0

- [x] Базовая структура модуля
- [x] QueryClientProvider (SSR-safe)
- [x] Query Keys Factory
- [x] Server Actions: projects
- [x] DevTools для разработки
- [x] Optimistic Updates
