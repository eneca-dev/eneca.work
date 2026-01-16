# Inline Filter Module

GitHub Projects-style inline filter component with autocomplete support.

> **⚠️ ВАЖНО: Этот модуль является общим для всего приложения**
>
> Все модули, которым нужна фильтрация (kanban, planning, resource-graph и др.), **ОБЯЗАНЫ** использовать этот модуль для обеспечения единообразия UI и поведения фильтров.

## Quick Start

```typescript
import { InlineFilter, type FilterConfig } from '@/modules/inline-filter'
import { Building2, FolderKanban } from 'lucide-react'

// 1. Define filter configuration
const filterConfig: FilterConfig = {
  keys: {
    'подразделение': {
      field: 'subdivision_id',
      label: 'Подразделение',
      icon: Building2,
      color: 'violet',
    },
    'проект': {
      field: 'project_id',
      label: 'Проект',
      icon: FolderKanban,
      color: 'amber',
    },
  },
  placeholder: 'Filter by subdivision or project...',
}

// 2. Prepare autocomplete options
const options: FilterOption[] = [
  { id: '1', name: 'ОВ и К', key: 'подразделение' },
  { id: '2', name: 'Проект Солнечный', key: 'проект' },
]

// 3. Use component
<InlineFilter
  config={filterConfig}
  value={filterString}
  onChange={setFilterString}
  options={options}
/>
```

## Filter Syntax

```
key:value                    # Simple value
key:"value with spaces"      # Quoted value for spaces
key:"value with \"quotes\""  # Escaped quotes in value
подразделение:ОВ проект:Test # Multiple filters
```

## Security Features

- **Quote escaping**: Values with quotes are properly escaped (`"` → `\"`)
- **Input limits**: Maximum 2000 characters per filter string
- **Token limits**: Maximum 20 tokens per filter string
- **Value limits**: Maximum 500 characters per value
- **Invalid keys ignored**: Unknown filter keys are silently dropped

## Exports

### Components

| Export | Description |
|--------|-------------|
| `InlineFilter` | Main filter input component with autocomplete |

### Hooks

| Export | Description |
|--------|-------------|
| `useFilterContext` | Low-level hook for detecting input context (key/value) |

### Parser Utilities

| Export | Description |
|--------|-------------|
| `parseFilterString(input, config)` | Parse filter string to tokens |
| `serializeFilter(tokens)` | Convert tokens back to string |
| `tokensToQueryParams(tokens, config)` | Convert tokens to DB query params |
| `addOrUpdateToken(filter, key, value, config)` | Add/update a filter token |
| `removeToken(filter, key, value, config)` | Remove a filter token |
| `hasActiveFilters(input, config)` | Check if any filters are active |
| `getValuesForKey(input, key, config)` | Get all values for a specific key |

### Types

| Export | Description |
|--------|-------------|
| `FilterConfig` | Main configuration object |
| `FilterKeyConfig` | Configuration for a single filter key |
| `FilterOption` | Autocomplete option |
| `ParsedToken` | Single parsed filter token |
| `ParsedFilter` | Result of parsing filter string |
| `FilterQueryParams` | Query parameters for database |
| `FilterKeyColor` | Available color names |
| `FilterInputContext` | Input context type (empty, key, or value) |
| `UseFilterContextOptions` | Options for useFilterContext hook |

---

## Type Reference

### FilterConfig

```typescript
interface FilterConfig {
  keys: Record<string, FilterKeyConfig>
  placeholder?: string
}
```

### FilterKeyConfig

```typescript
interface FilterKeyConfig {
  /** Database field name (e.g., 'subdivision_id') */
  field: string

  /** Display label for autocomplete */
  label?: string

  /** Allow multiple values for this key */
  multiple?: boolean

  /** Lucide icon component */
  icon?: LucideIcon

  /** Color: 'violet' | 'blue' | 'amber' | 'emerald' | 'rose' | 'cyan' | 'gray' */
  color?: FilterKeyColor
}
```

### FilterOption

```typescript
interface FilterOption {
  id: string      // Record ID
  name: string    // Display name
  key: string     // Which filter key this belongs to
}
```

### ParsedToken

```typescript
interface ParsedToken {
  key: string     // Filter key (e.g., 'подразделение')
  value: string   // Filter value (e.g., 'ОВ')
  raw: string     // Raw token string (e.g., 'подразделение:"ОВ"')
}
```

---

## Usage Patterns

### Pattern 1: Basic Usage with Component

```typescript
import { useState } from 'react'
import { InlineFilter, parseFilterString, tokensToQueryParams } from '@/modules/inline-filter'

function MyComponent() {
  const [filterString, setFilterString] = useState('')

  // Parse to query params for API calls
  const queryParams = useMemo(() => {
    const parsed = parseFilterString(filterString, config)
    return tokensToQueryParams(parsed.tokens, config)
  }, [filterString])

  // Use queryParams in data fetching
  const { data } = useQuery({
    queryKey: ['items', queryParams],
    queryFn: () => fetchItems(queryParams),
  })

  return (
    <InlineFilter
      config={config}
      value={filterString}
      onChange={setFilterString}
      options={filterOptions}
    />
  )
}
```

### Pattern 2: Zustand Store Integration

```typescript
// stores/filters.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { FilterConfig } from '@/modules/inline-filter'
import { parseFilterString, tokensToQueryParams, hasActiveFilters } from '@/modules/inline-filter'

export const FILTER_CONFIG: FilterConfig = {
  keys: {
    'статус': { field: 'status', label: 'Статус', color: 'blue' },
    'автор': { field: 'author_id', label: 'Автор', color: 'violet' },
  },
}

export const useFiltersStore = create(
  persist(
    (set, get) => ({
      filterString: '',
      setFilterString: (value: string) => set({ filterString: value }),
      getQueryParams: () => {
        const { filterString } = get()
        const parsed = parseFilterString(filterString, FILTER_CONFIG)
        return tokensToQueryParams(parsed.tokens, FILTER_CONFIG)
      },
      hasFilters: () => hasActiveFilters(get().filterString, FILTER_CONFIG),
    }),
    { name: 'my-module-filters' }
  )
)
```

### Pattern 3: Loading Options from Database

```typescript
import { useQuery } from '@tanstack/react-query'
import type { FilterOption } from '@/modules/inline-filter'

function useFilterOptions() {
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
  })

  const { data: statuses } = useQuery({
    queryKey: ['statuses'],
    queryFn: fetchStatuses,
  })

  const options = useMemo<FilterOption[]>(() => {
    const result: FilterOption[] = []

    users?.forEach(user => {
      result.push({ id: user.id, name: user.name, key: 'автор' })
    })

    statuses?.forEach(status => {
      result.push({ id: status.id, name: status.label, key: 'статус' })
    })

    return result
  }, [users, statuses])

  return options
}
```

---

## Available Colors

| Color | Tailwind Class | Use Case |
|-------|---------------|----------|
| `violet` | `text-violet-400` | Organizations, subdivisions |
| `blue` | `text-blue-400` | Departments, teams |
| `amber` | `text-amber-400` | Projects, tasks |
| `emerald` | `text-emerald-400` | Tags, labels |
| `rose` | `text-rose-400` | Priority, alerts |
| `cyan` | `text-cyan-400` | Status, state |
| `gray` | `text-gray-400` | Default, misc |

---

## Component Props

### InlineFilter

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `config` | `FilterConfig` | Yes | Filter keys configuration |
| `value` | `string` | Yes | Current filter string |
| `onChange` | `(value: string) => void` | Yes | Change handler |
| `options` | `FilterOption[]` | No | Autocomplete options |
| `placeholder` | `string` | No | Input placeholder |
| `className` | `string` | No | Additional CSS classes |
| `debounceMs` | `number` | No | Debounce delay (default: 300) |

---

## Accessibility (A11y)

The component includes full ARIA support:
- `role="combobox"` on the input element
- `aria-expanded` indicates dropdown visibility
- `aria-haspopup="listbox"` indicates dropdown type
- `aria-controls` links input to dropdown
- `aria-activedescendant` indicates selected option
- Dropdown uses `role="listbox"` with `role="option"` for items
- `aria-selected` indicates the currently highlighted option

Keyboard navigation:
- `ArrowDown/ArrowUp`: Navigate suggestions
- `Enter/Tab`: Apply selected suggestion
- `Escape`: Close suggestions dropdown

## File Structure

```
modules/inline-filter/
├── index.ts                    # Public API exports
├── types.ts                    # TypeScript types
├── parser.ts                   # Parsing utilities (with security limits)
├── README.md                   # This file
├── components/
│   ├── index.ts
│   ├── InlineFilter.tsx        # Main component
│   └── FilterSuggestions.tsx   # Dropdown suggestions component
└── hooks/
    ├── index.ts
    └── useFilterContext.ts     # Input context detection hook
```

---

## Интеграция в новый модуль (Step-by-Step)

При добавлении фильтрации в новый модуль (например, `kanban`), следуйте этим шагам:

### Шаг 1: Создать конфигурацию фильтра в stores модуля

```typescript
// modules/kanban/stores/index.ts
import { Building2, Users, CircleDot } from 'lucide-react'
import type { FilterConfig, FilterQueryParams } from '@/modules/inline-filter'
import { parseFilterString, tokensToQueryParams, hasActiveFilters } from '@/modules/inline-filter'

// Определите ключи фильтра для вашего модуля
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
  },
  placeholder: 'Фильтр: статус:"В работе" исполнитель:"Иванов"',
}
```

### Шаг 2: Создать Zustand store для фильтров

```typescript
// modules/kanban/stores/index.ts (продолжение)
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface FiltersState {
  filterString: string
  setFilterString: (value: string) => void
  clearFilters: () => void
  getQueryParams: () => FilterQueryParams
  hasFilters: () => boolean
}

export const useKanbanFiltersStore = create<FiltersState>()(
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

### Шаг 3: Создать хук для загрузки опций автокомплита

```typescript
// modules/kanban/filters/useFilterOptions.ts
'use client'

import { useMemo } from 'react'
import type { FilterOption } from '@/modules/inline-filter'
import { useStatuses, useUsers, useSubdivisions } from '../hooks' // Ваши хуки данных

export function useKanbanFilterOptions() {
  const { data: statuses, isLoading: loadingStatuses } = useStatuses()
  const { data: users, isLoading: loadingUsers } = useUsers()
  const { data: subdivisions, isLoading: loadingSubs } = useSubdivisions()

  const options = useMemo<FilterOption[]>(() => {
    const result: FilterOption[] = []

    statuses?.forEach(status => {
      result.push({ id: status.id, name: status.name, key: 'статус' })
    })

    users?.forEach(user => {
      result.push({ id: user.id, name: user.full_name, key: 'исполнитель' })
    })

    subdivisions?.forEach(sub => {
      result.push({ id: sub.id, name: sub.name, key: 'подразделение' })
    })

    return result
  }, [statuses, users, subdivisions])

  return {
    options,
    isLoading: loadingStatuses || loadingUsers || loadingSubs,
  }
}
```

### Шаг 4: Использовать компонент InlineFilter

```typescript
// modules/kanban/components/KanbanBoard.tsx
'use client'

import { InlineFilter } from '@/modules/inline-filter'
import { useKanbanFiltersStore, KANBAN_FILTER_CONFIG } from '../stores'
import { useKanbanFilterOptions } from '../filters/useFilterOptions'

export function KanbanBoard() {
  const { filterString, setFilterString, getQueryParams } = useKanbanFiltersStore()
  const { options, isLoading: loadingOptions } = useKanbanFilterOptions()

  // Используйте queryParams для фильтрации данных
  const queryParams = getQueryParams()

  return (
    <div>
      <InlineFilter
        config={KANBAN_FILTER_CONFIG}
        value={filterString}
        onChange={setFilterString}
        options={options}
      />

      {/* Передайте queryParams в хук загрузки данных */}
      <KanbanColumns filters={queryParams} />
    </div>
  )
}
```

### Шаг 5: Применить фильтры к данным

```typescript
// modules/kanban/actions/index.ts
'use server'

import type { FilterQueryParams } from '@/modules/inline-filter'

export async function getKanbanCards(filters: FilterQueryParams) {
  // Используйте filters для построения запроса
  let query = supabase.from('kanban_cards').select('*')

  if (filters.status_id) {
    query = query.eq('status_id', filters.status_id)
  }
  if (filters.assignee_id) {
    query = query.eq('assignee_id', filters.assignee_id)
  }
  // ... другие фильтры

  return query
}
```

---

## Требования к интеграции

При интеграции модуля inline-filter в новый модуль **ОБЯЗАТЕЛЬНО**:

1. **Используйте единый компонент** — `<InlineFilter />` из `@/modules/inline-filter`
2. **Создайте `FilterConfig`** — в stores вашего модуля с осмысленными ключами на русском языке
3. **Используйте Zustand** — для хранения строки фильтра (persist для сохранения между сессиями)
4. **Загружайте опции** — через кастомный хук `useXxxFilterOptions()` в папке `filters/`
5. **Применяйте фильтры** — через `getQueryParams()` в Server Actions

**НЕ ДЕЛАЙТЕ:**

- ❌ Не создавайте свой компонент фильтров
- ❌ Не используйте другой синтаксис фильтров
- ❌ Не храните фильтры в useState (используйте Zustand с persist)

---

## Example: Full Implementation

See `modules/resource-graph/` for a complete implementation example:

- Config definition: `stores/index.ts` → `RESOURCE_GRAPH_FILTER_CONFIG`
- Options loading: `filters/useFilterOptions.ts`
- Component usage: `components/ResourceGraph.tsx`
