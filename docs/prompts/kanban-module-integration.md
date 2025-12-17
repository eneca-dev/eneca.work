# Промпт: Интеграция модуля Kanban с фильтрами и кешем

> **Цель:** Создать модуль kanban с интеграцией `inline-filter` для фильтрации и `cache` для управления данными.

---

## Контекст

### Обязательные зависимости

1. **`modules/inline-filter`** — модуль фильтрации (README: `modules/inline-filter/README.md`)
2. **`modules/cache`** — модуль кеширования (README: `modules/cache/README.md`)

### Примеры интеграции

- **Фильтры:** `modules/resource-graph/stores/index.ts` — `RESOURCE_GRAPH_FILTER_CONFIG`
- **Опции фильтров:** `modules/resource-graph/filters/useFilterOptions.ts`
- **Cache hooks:** `modules/cache/hooks/use-users.ts`
- **Server Actions:** `modules/cache/actions/users.ts`

---

## Задание

Создай модуль `modules/kanban/` со следующей структурой и функционалом:

### 1. Структура модуля

```
modules/kanban/
├── index.ts                      # Public API
├── types/
│   └── index.ts                  # Типы: KanbanCard, KanbanColumn, etc.
├── stores/
│   └── index.ts                  # Zustand stores + FilterConfig
├── filters/
│   └── useFilterOptions.ts       # Хук для загрузки опций фильтров
├── actions/
│   └── index.ts                  # Server Actions (getCards, updateCard, etc.)
├── hooks/
│   └── index.ts                  # Cache hooks (useKanbanCards, useUpdateCard, etc.)
├── components/
│   ├── index.ts                  # Экспорты компонентов
│   ├── KanbanBoard.tsx           # Основной компонент доски
│   ├── KanbanColumn.tsx          # Колонка (статус)
│   ├── KanbanCard.tsx            # Карточка задачи
│   └── KanbanHeader.tsx          # Заголовок с фильтром
└── schemas/
    └── index.ts                  # Zod schemas для форм
```

---

### 2. Интеграция inline-filter

#### 2.1 Конфигурация фильтра (stores/index.ts)

```typescript
import { Building2, Users, CircleDot, Tag } from 'lucide-react'
import type { FilterConfig, FilterQueryParams } from '@/modules/inline-filter'
import { parseFilterString, tokensToQueryParams, hasActiveFilters } from '@/modules/inline-filter'

export const KANBAN_FILTER_CONFIG: FilterConfig = {
  keys: {
    'статус': {
      field: 'status_id',
      label: 'Статус',
      icon: CircleDot,
      color: 'cyan',
    },
    'исполнитель': {
      field: 'assignee_id',
      label: 'Исполнитель',
      icon: Users,
      color: 'blue',
    },
    'подразделение': {
      field: 'subdivision_id',
      label: 'Подразделение',
      icon: Building2,
      color: 'violet',
    },
    'метка': {
      field: 'tag_id',
      label: 'Метка',
      icon: Tag,
      color: 'emerald',
      multiple: true, // Можно несколько меток
    },
    'приоритет': {
      field: 'priority',
      label: 'Приоритет',
      color: 'rose',
      valueType: 'select',
      enumValues: [
        { value: 'high', label: 'Высокий' },
        { value: 'medium', label: 'Средний' },
        { value: 'low', label: 'Низкий' },
      ],
    },
  },
  placeholder: 'Фильтр: статус:"В работе" исполнитель:"Иванов"',
}
```

#### 2.2 Zustand Store для фильтров (stores/index.ts)

```typescript
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface KanbanFiltersState {
  filterString: string
  setFilterString: (value: string) => void
  clearFilters: () => void
  getQueryParams: () => FilterQueryParams
  hasFilters: () => boolean
}

export const useKanbanFiltersStore = create<KanbanFiltersState>()(
  devtools(
    persist(
      (set, get) => ({
        filterString: '',
        setFilterString: (value) => set({ filterString: value }),
        clearFilters: () => set({ filterString: '' }),
        getQueryParams: () => {
          const { filterString } = get()
          const parsed = parseFilterString(filterString, KANBAN_FILTER_CONFIG)
          return tokensToQueryParams(parsed.tokens, KANBAN_FILTER_CONFIG)
        },
        hasFilters: () => hasActiveFilters(get().filterString, KANBAN_FILTER_CONFIG),
      }),
      { name: 'kanban-filters' }
    )
  )
)
```

#### 2.3 Хук для загрузки опций (filters/useFilterOptions.ts)

```typescript
'use client'

import { useMemo } from 'react'
import type { FilterOption } from '@/modules/inline-filter'
// Импортируй свои хуки данных из cache module
import { useUsers } from '@/modules/cache'
import { useKanbanStatuses, useKanbanTags } from '../hooks'

export function useKanbanFilterOptions() {
  const { data: users, isLoading: loadingUsers } = useUsers({})
  const { data: statuses, isLoading: loadingStatuses } = useKanbanStatuses({})
  const { data: tags, isLoading: loadingTags } = useKanbanTags({})

  const options = useMemo<FilterOption[]>(() => {
    const result: FilterOption[] = []

    // Статусы
    statuses?.forEach(status => {
      result.push({ id: status.id, name: status.name, key: 'статус' })
    })

    // Исполнители
    users?.forEach(user => {
      result.push({ id: user.id, name: user.full_name ?? user.email, key: 'исполнитель' })
    })

    // Метки
    tags?.forEach(tag => {
      result.push({ id: tag.id, name: tag.name, key: 'метка' })
    })

    // Приоритеты (статические)
    result.push(
      { id: 'high', name: 'Высокий', key: 'приоритет' },
      { id: 'medium', name: 'Средний', key: 'приоритет' },
      { id: 'low', name: 'Низкий', key: 'приоритет' },
    )

    return result
  }, [users, statuses, tags])

  return {
    options,
    isLoading: loadingUsers || loadingStatuses || loadingTags,
  }
}
```

---

### 3. Интеграция cache module

#### 3.1 Query Keys (добавить в modules/cache/keys/query-keys.ts)

```typescript
export const queryKeys = {
  // ... существующие ключи

  kanban: {
    all: ['kanban'] as const,
    cards: () => [...queryKeys.kanban.all, 'cards'] as const,
    cardsList: (filters?: FilterQueryParams) => [...queryKeys.kanban.cards(), 'list', filters] as const,
    card: (id: string) => [...queryKeys.kanban.cards(), 'detail', id] as const,
    statuses: () => [...queryKeys.kanban.all, 'statuses'] as const,
    tags: () => [...queryKeys.kanban.all, 'tags'] as const,
  },
}
```

#### 3.2 Server Actions (actions/index.ts)

```typescript
'use server'

import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/modules/cache'
import type { FilterQueryParams } from '@/modules/inline-filter'
import type { KanbanCard, KanbanStatus, KanbanTag } from '../types'

// ============================================================================
// Queries
// ============================================================================

export async function getKanbanCards(
  filters?: FilterQueryParams
): Promise<ActionResult<KanbanCard[]>> {
  try {
    const supabase = await createClient()

    let query = supabase
      .from('kanban_cards')
      .select(`
        *,
        status:kanban_statuses(*),
        assignee:profiles(id, full_name, avatar_url),
        tags:kanban_card_tags(tag:kanban_tags(*))
      `)
      .order('position')

    // Применяем фильтры
    if (filters?.status_id) {
      query = query.eq('status_id', filters.status_id)
    }
    if (filters?.assignee_id) {
      query = query.eq('assignee_id', filters.assignee_id)
    }
    if (filters?.priority) {
      query = query.eq('priority', filters.priority)
    }
    // Для массивов (multiple: true)
    if (filters?.tag_id) {
      const tagIds = Array.isArray(filters.tag_id) ? filters.tag_id : [filters.tag_id]
      query = query.contains('tag_ids', tagIds) // или join через kanban_card_tags
    }

    const { data, error } = await query

    if (error) return { success: false, error: error.message }
    return { success: true, data }
  } catch (error) {
    return { success: false, error: 'Ошибка загрузки карточек' }
  }
}

export async function getKanbanStatuses(): Promise<ActionResult<KanbanStatus[]>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('kanban_statuses')
      .select('*')
      .order('position')

    if (error) return { success: false, error: error.message }
    return { success: true, data }
  } catch (error) {
    return { success: false, error: 'Ошибка загрузки статусов' }
  }
}

export async function getKanbanTags(): Promise<ActionResult<KanbanTag[]>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('kanban_tags')
      .select('*')
      .order('name')

    if (error) return { success: false, error: error.message }
    return { success: true, data }
  } catch (error) {
    return { success: false, error: 'Ошибка загрузки меток' }
  }
}

// ============================================================================
// Mutations
// ============================================================================

export async function updateCardStatus(input: {
  cardId: string
  statusId: string
  position: number
}): Promise<ActionResult<KanbanCard>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('kanban_cards')
      .update({
        status_id: input.statusId,
        position: input.position,
      })
      .eq('id', input.cardId)
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data }
  } catch (error) {
    return { success: false, error: 'Ошибка обновления карточки' }
  }
}

export async function createCard(input: {
  title: string
  description?: string
  statusId: string
  assigneeId?: string
  priority?: 'high' | 'medium' | 'low'
}): Promise<ActionResult<KanbanCard>> {
  try {
    const supabase = await createClient()

    // Получаем максимальную позицию для нового статуса
    const { data: maxPos } = await supabase
      .from('kanban_cards')
      .select('position')
      .eq('status_id', input.statusId)
      .order('position', { ascending: false })
      .limit(1)
      .single()

    const newPosition = (maxPos?.position ?? 0) + 1

    const { data, error } = await supabase
      .from('kanban_cards')
      .insert({
        title: input.title,
        description: input.description,
        status_id: input.statusId,
        assignee_id: input.assigneeId,
        priority: input.priority ?? 'medium',
        position: newPosition,
      })
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data }
  } catch (error) {
    return { success: false, error: 'Ошибка создания карточки' }
  }
}
```

#### 3.3 Cache Hooks (hooks/index.ts)

```typescript
'use client'

import {
  createCacheQuery,
  createUpdateMutation,
  createCreateMutation,
  queryKeys,
  staleTimePresets,
} from '@/modules/cache'
import type { FilterQueryParams } from '@/modules/inline-filter'
import {
  getKanbanCards,
  getKanbanStatuses,
  getKanbanTags,
  updateCardStatus,
  createCard,
} from '../actions'
import type { KanbanCard, KanbanStatus, KanbanTag } from '../types'

// ============================================================================
// Query Hooks
// ============================================================================

export const useKanbanCards = createCacheQuery<KanbanCard[], { filters?: FilterQueryParams }>({
  queryKey: (params) => queryKeys.kanban.cardsList(params?.filters),
  queryFn: (params) => getKanbanCards(params?.filters),
  staleTime: staleTimePresets.short, // 1 минута
})

export const useKanbanStatuses = createCacheQuery<KanbanStatus[], Record<string, never>>({
  queryKey: () => queryKeys.kanban.statuses(),
  queryFn: getKanbanStatuses,
  staleTime: staleTimePresets.static, // 10 минут (редко меняются)
})

export const useKanbanTags = createCacheQuery<KanbanTag[], Record<string, never>>({
  queryKey: () => queryKeys.kanban.tags(),
  queryFn: getKanbanTags,
  staleTime: staleTimePresets.static,
})

// ============================================================================
// Mutation Hooks с Optimistic Updates
// ============================================================================

export const useUpdateCardStatus = createUpdateMutation<
  { cardId: string; statusId: string; position: number },
  KanbanCard
>({
  mutationFn: updateCardStatus,
  listQueryKey: queryKeys.kanban.cards(),
  getId: (input) => input.cardId,
  getItemId: (item) => item.id,
  merge: (item, input) => ({
    ...item,
    status_id: input.statusId,
    position: input.position,
  }),
  invalidateKeys: [queryKeys.kanban.all],
})

export const useCreateCard = createCreateMutation<
  { title: string; description?: string; statusId: string; assigneeId?: string; priority?: 'high' | 'medium' | 'low' },
  KanbanCard
>({
  mutationFn: createCard,
  invalidateKeys: [queryKeys.kanban.cards()],
})
```

---

### 4. Компонент KanbanHeader с фильтром

```typescript
// components/KanbanHeader.tsx
'use client'

import { InlineFilter } from '@/modules/inline-filter'
import { useKanbanFiltersStore, KANBAN_FILTER_CONFIG } from '../stores'
import { useKanbanFilterOptions } from '../filters/useFilterOptions'

export function KanbanHeader() {
  const { filterString, setFilterString } = useKanbanFiltersStore()
  const { options, isLoading } = useKanbanFilterOptions()

  return (
    <header className="flex items-center justify-between p-4 border-b">
      <h1 className="text-xl font-semibold">Kanban</h1>

      <div className="w-96">
        <InlineFilter
          config={KANBAN_FILTER_CONFIG}
          value={filterString}
          onChange={setFilterString}
          options={options}
        />
      </div>
    </header>
  )
}
```

---

### 5. Основной компонент KanbanBoard

```typescript
// components/KanbanBoard.tsx
'use client'

import { useKanbanFiltersStore } from '../stores'
import { useKanbanCards, useKanbanStatuses } from '../hooks'
import { KanbanHeader } from './KanbanHeader'
import { KanbanColumn } from './KanbanColumn'

export function KanbanBoard() {
  const { getQueryParams } = useKanbanFiltersStore()
  const filters = getQueryParams()

  const { data: cards, isLoading: loadingCards } = useKanbanCards({ filters })
  const { data: statuses, isLoading: loadingStatuses } = useKanbanStatuses({})

  if (loadingStatuses) {
    return <div className="p-4">Загрузка...</div>
  }

  return (
    <div className="flex flex-col h-full">
      <KanbanHeader />

      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-4 h-full">
          {statuses?.map((status) => (
            <KanbanColumn
              key={status.id}
              status={status}
              cards={cards?.filter(card => card.status_id === status.id) ?? []}
              isLoading={loadingCards}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
```

---

### 6. Realtime (опционально)

#### 6.1 Добавить в modules/cache/realtime/config.ts

```typescript
export const realtimeSubscriptions: TableSubscription[] = [
  // ... существующие
  {
    table: 'kanban_cards',
    invalidateKeys: [queryKeys.kanban.all],
  },
]
```

#### 6.2 SQL для publication

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE kanban_cards;
```

---

## Чек-лист реализации

### Этап 1: Базовая структура
- [ ] Создать папку `modules/kanban/`
- [ ] Создать `types/index.ts` с типами KanbanCard, KanbanStatus, KanbanTag
- [ ] Создать `stores/index.ts` с KANBAN_FILTER_CONFIG и useKanbanFiltersStore
- [ ] Создать `index.ts` с публичным API

### Этап 2: Server Actions + Cache
- [ ] Добавить query keys в `modules/cache/keys/query-keys.ts`
- [ ] Создать `actions/index.ts` с Server Actions
- [ ] Создать `hooks/index.ts` с cache hooks

### Этап 3: Фильтры
- [ ] Создать `filters/useFilterOptions.ts`
- [ ] Интегрировать InlineFilter в KanbanHeader

### Этап 4: Компоненты
- [ ] Создать `components/KanbanHeader.tsx`
- [ ] Создать `components/KanbanColumn.tsx`
- [ ] Создать `components/KanbanCard.tsx`
- [ ] Создать `components/KanbanBoard.tsx`

### Этап 5: Тестирование
- [ ] Проверить фильтрацию по всем ключам
- [ ] Проверить optimistic updates при перетаскивании
- [ ] Проверить persist фильтров в localStorage
- [ ] Проверить realtime обновления

---

## Важные замечания

1. **Используй inline-filter** — НЕ создавай свой компонент фильтров
2. **Используй cache module** — НЕ используй прямой useQuery из @tanstack/react-query
3. **Zustand с persist** — фильтры должны сохраняться между сессиями
4. **Русские ключи** — ключи фильтров на русском языке (`'статус'`, `'исполнитель'`)
5. **Optimistic updates** — обязательно для drag-and-drop операций

---

## Ссылки на документацию

- `modules/inline-filter/README.md` — полная документация модуля фильтров
- `modules/cache/README.md` — полная документация модуля кеширования
- `modules/resource-graph/` — пример полной интеграции
