# Cache Module - План разработки

## Цель

Централизованный модуль кеширования на базе TanStack Query + Server Actions для типобезопасного, масштабируемого взаимодействия с Supabase.

---

## Архитектура модуля

```
modules/cache/
├── providers/
│   └── query-provider.tsx      # QueryClientProvider для App Router (SSR-safe)
├── client/
│   └── query-client.ts         # Конфигурация QueryClient
├── keys/
│   └── query-keys.ts           # Query Keys Factory (типобезопасные ключи)
├── actions/
│   ├── base.ts                 # Базовые утилиты для Server Actions
│   ├── users.ts                # Server Actions для users/profiles
│   ├── projects.ts             # Server Actions для projects
│   ├── sections.ts             # Server Actions для sections
│   ├── loadings.ts             # Server Actions для loadings
│   └── ...                     # Другие сущности по мере необходимости
├── hooks/
│   ├── use-query-config.ts     # Общие конфигурации для queries
│   └── index.ts                # Реэкспорт хуков
├── types/
│   └── index.ts                # Типы для кеша и actions
├── utils/
│   ├── invalidation.ts         # Стратегии инвалидации кеша
│   └── optimistic.ts           # Утилиты для optimistic updates
└── index.ts                    # Public API модуля
```

---

## Этапы разработки

### Этап 1: Базовая инфраструктура

1. **QueryClient конфигурация** (`client/query-client.ts`)
   - SSR-safe создание клиента
   - Default options (staleTime, gcTime, retry)
   - Error handling глобальный

2. **QueryClientProvider** (`providers/query-provider.tsx`)
   - 'use client' компонент
   - Интеграция с существующим layout.tsx

3. **Query Keys Factory** (`keys/query-keys.ts`)
   - Типобезопасные ключи для всех сущностей
   - Иерархическая структура (entity -> list/detail -> params)

### Этап 2: Server Actions база

4. **Базовые утилиты** (`actions/base.ts`)
   - createServerClient() wrapper
   - Обработка ошибок
   - Типы для результатов (ActionResult<T>)

5. **Первые actions** (users, projects)
   - CRUD операции
   - Валидация через Zod
   - Типизированные ответы

### Этап 3: Интеграция с модулями

6. **Миграция dashboard hooks**
   - useProjectInfo -> через Server Actions
   - useProjectStatistics -> через Server Actions

7. **Документация подключения**
   - Как подключить модуль к кешу
   - Примеры использования

---

## Ключевые решения

### Query Keys структура

```typescript
export const queryKeys = {
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (filters: UserFilters) => [...queryKeys.users.lists(), filters] as const,
    details: () => [...queryKeys.users.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.users.details(), id] as const,
  },
  projects: {
    // аналогично
  },
  // ...
}
```

### Server Action паттерн

```typescript
'use server'

import { createClient } from '@/utils/supabase/server'
import { z } from 'zod'

const schema = z.object({ ... })

export async function getUsers(filters?: UserFilters): Promise<ActionResult<User[]>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('view_users')
    .select('*')

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data }
}
```

### Hook использование

```typescript
// В компоненте модуля
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/modules/cache'
import { getUsers } from '@/modules/cache/actions/users'

export function useUsers(filters?: UserFilters) {
  return useQuery({
    queryKey: queryKeys.users.list(filters),
    queryFn: () => getUsers(filters),
  })
}
```

---

## Стратегия инвалидации

| Действие | Инвалидация |
|----------|-------------|
| Create user | `users.lists()` |
| Update user | `users.detail(id)`, `users.lists()` |
| Delete user | `users.all` |
| Update project | `projects.detail(id)`, связанные sections |

---

## Приоритет сущностей для миграции

1. **users/profiles** - базовая сущность, много зависимостей
2. **projects** - основа планирования
3. **sections** - часто запрашиваются
4. **loadings** - критично для planning модуля
5. **departments/teams** - справочники
6. **notifications** - real-time (отдельная стратегия)

---

## Принятые решения

1. **Optimistic updates** - ДА, реализуем для всех мутаций
2. **Prefetching** - будет решаться по ходу разработки
3. **Persistence** - выборочно (справочники да, чувствительные данные нет)
4. **Real-time** - ДА, полная интеграция с Supabase Realtime
5. **Stale time** - разные значения (см. README.md)

---

## Зависимости

```json
{
  "@tanstack/react-query": "^5.x",  // уже установлен
  "zod": "^3.x"                     // уже установлен
}
```

Дополнительно может понадобиться:
- `@tanstack/react-query-devtools` - для отладки (dev only)
