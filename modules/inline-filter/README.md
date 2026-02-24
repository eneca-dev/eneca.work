# Inline Filter Module

GitHub Projects-style inline filter component with autocomplete support.

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
| `useInlineFilter` | State management hook with parsing utilities |
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
| `FilterValueType` | Value types: string, date, number, boolean, select |
| `FilterOperator` | Comparison operators for future use |
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

  /** Value type (for future validation) */
  valueType?: 'string' | 'date' | 'number' | 'boolean' | 'select'

  /** Operators for date/number (for future use) */
  operators?: FilterOperator[]

  /** Enum values for select/boolean types */
  enumValues?: FilterEnumValue[]
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

### Pattern 2: Using the Hook

```typescript
import { useInlineFilter } from '@/modules/inline-filter'

function MyComponent() {
  const {
    value,           // Current filter string
    setValue,        // Set filter string
    parsedTokens,    // Parsed tokens array
    queryParams,     // Ready-to-use query params
    hasFilters,      // Boolean: any filters active?
    clear,           // Clear all filters
    addToken,        // Add a filter programmatically
    removeToken,     // Remove a filter programmatically
  } = useInlineFilter({ config })

  // Add filter programmatically
  const handleAddProjectFilter = (projectName: string) => {
    addToken('проект', projectName)
  }

  return (
    <InlineFilter
      config={config}
      value={value}
      onChange={setValue}
      options={options}
    />
  )
}
```

### Pattern 3: Zustand Store Integration

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

### Pattern 4: Loading Options from Database

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

## Future Extensions

The module is prepared for these future features:

### Date/Number Filters with Operators

```typescript
// Future syntax support
'дата:>2024-01-01'           // After date
'загрузка:<100'              // Less than number
'приоритет:>=5'              // Greater or equal
```

Configuration ready:
```typescript
{
  'дата': {
    field: 'created_at',
    valueType: 'date',
    operators: ['gt', 'lt', 'gte', 'lte', 'eq'],
  },
}
```

### Boolean Filters

```typescript
// Future syntax support
'архив:да'
'активный:нет'
```

Configuration ready:
```typescript
{
  'архив': {
    field: 'is_archived',
    valueType: 'boolean',
    enumValues: [
      { value: 'да', label: 'Да' },
      { value: 'нет', label: 'Нет' },
    ],
  },
}
```

### Select Filters

```typescript
{
  'статус': {
    field: 'status',
    valueType: 'select',
    enumValues: [
      { value: 'active', label: 'Активный' },
      { value: 'paused', label: 'Приостановлен' },
      { value: 'completed', label: 'Завершён' },
    ],
  },
}
```

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
    ├── useInlineFilter.ts      # State management hook
    └── useFilterContext.ts     # Input context detection hook
```

---

## Example: Full Implementation

See `modules/resource-graph/` for a complete implementation example:

- Config definition: `stores/index.ts` → `RESOURCE_GRAPH_FILTER_CONFIG`
- Options loading: `filters/useFilterOptions.ts`
- Component usage: `components/ResourceGraph.tsx`
