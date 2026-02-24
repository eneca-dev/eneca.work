# Resource Graph Module

Модуль графика ресурсов — визуализация загрузки сотрудников по проектам.

## Страница

```
/dashboard/resource-graph
```

## Структура модуля

```
modules/resource-graph/
├── index.ts                    # Public API
├── README.md                   # Документация
├── types/
│   └── index.ts               # Типы данных
├── actions/
│   └── index.ts               # Server Actions
├── hooks/
│   └── index.ts               # Query/Mutation хуки
├── components/
│   ├── index.ts               # Экспорты компонентов
│   └── ResourceGraph.tsx      # Главный компонент
├── stores/
│   └── index.ts               # Zustand stores
├── utils/
│   └── index.ts               # Утилиты
└── constants/
    └── index.ts               # Константы
```

## Архитектура

### Data Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Server Action  │────▶│   Cache Hook    │────▶│   Component     │
│  (RLS secured)  │     │  (TanStack Q)   │     │   (React)       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Supabase DB   │     │  Query Cache    │     │  Zustand Store  │
│   (with RLS)    │     │  (invalidation) │     │  (UI state)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Слои

1. **Actions** (`actions/`) — Server Actions для безопасного доступа к данным
2. **Hooks** (`hooks/`) — React хуки с кешированием (TanStack Query)
3. **Stores** (`stores/`) — Локальное состояние UI (Zustand)
4. **Components** (`components/`) — React компоненты

## Использование

### Импорт компонента

```tsx
import { ResourceGraph } from '@/modules/resource-graph'

export default function Page() {
  return <ResourceGraph />
}
```

### Импорт хуков

```tsx
import { useResourceGraphData, useUserWorkload } from '@/modules/resource-graph'

function MyComponent() {
  const { data, isLoading, error } = useResourceGraphData({
    userId: 'xxx',
    dateRange: { start: '2024-01-01', end: '2024-03-31' }
  })

  // ...
}
```

### Импорт stores

```tsx
import { useDisplaySettingsStore, useFiltersStore } from '@/modules/resource-graph'

function Settings() {
  const { settings, setScale } = useDisplaySettingsStore()
  const { filters, setSearch } = useFiltersStore()

  // ...
}
```

## Server Actions

### `getResourceGraphData(filters)`

Получает данные для графика ресурсов.

```typescript
const result = await getResourceGraphData({
  userId: 'xxx',
  departmentId: 'yyy',
  dateRange: { start: '2024-01-01', end: '2024-03-31' }
})

if (result.success) {
  console.log(result.data) // ProjectWithStructure[]
}
```

### `getUserWorkload(userId, dateRange)`

Получает загрузку конкретного пользователя.

```typescript
const result = await getUserWorkload('user-id', {
  start: '2024-01-01',
  end: '2024-03-31'
})
```

## Stores

### `useDisplaySettingsStore`

Настройки отображения (сохраняются в localStorage).

```typescript
interface DisplaySettingsState {
  settings: DisplaySettings
  setScale: (scale: TimelineScale) => void
  toggleWeekends: () => void
  toggleHolidays: () => void
  toggleCompactMode: () => void
  resetSettings: () => void
}
```

### `useFiltersStore`

Фильтры для данных.

```typescript
interface FiltersState {
  filters: ResourceGraphFilters
  setFilters: (filters: Partial<ResourceGraphFilters>) => void
  setDateRange: (start: string, end: string) => void
  setSearch: (search: string) => void
  clearFilters: () => void
}
```

### `useUIStateStore`

Состояние UI (развёрнутые элементы, выбор).

```typescript
interface UIState {
  expandedProjects: Set<string>
  expandedStages: Set<string>
  selectedItemId: string | null
  toggleProject: (projectId: string) => void
  toggleStage: (stageId: string) => void
  expandAll: () => void
  collapseAll: () => void
  setSelectedItem: (id: string | null) => void
}
```

## Типы

### Domain Types

```typescript
interface ProjectWithStructure {
  id: string
  name: string
  status: ProjectStatusType | null
  stages: Stage[]
}

interface Stage {
  id: string
  name: string
  objects: ProjectObject[]
}

interface Section {
  id: string
  name: string
  decompositionStages: DecompositionStage[]
}

interface LoadingPeriod {
  id: string
  startDate: string
  endDate: string
  rate: number // 0.25, 0.5, 0.75, 1
  status: LoadingStatusType
}
```

### Filter Types

```typescript
interface ResourceGraphFilters {
  userId?: string
  departmentId?: string
  teamId?: string
  dateRange?: { start: string; end: string }
  projectStatuses?: ProjectStatusType[]
  search?: string
}
```

## Утилиты

```typescript
import {
  createTimelineRange,
  generateTimelineDates,
  formatTimelineHeader,
  calculateItemPosition,
  isWeekend,
} from '@/modules/resource-graph'

// Создать диапазон на 3 месяца от сегодня
const range = createTimelineRange(new Date(), 3)

// Сгенерировать даты для шкалы
const dates = generateTimelineDates(range, 'week')

// Вычислить позицию элемента
const { left, width } = calculateItemPosition(
  new Date('2024-01-15'),
  new Date('2024-02-15'),
  range,
  1000 // totalWidth
)
```

## TODO

- [ ] Реализовать запрос данных из view
- [ ] Добавить визуализацию timeline
- [ ] Добавить drag-and-drop для загрузок
- [ ] Добавить модальные окна редактирования
- [ ] Добавить экспорт данных
- [ ] Добавить RLS политики для загрузок
